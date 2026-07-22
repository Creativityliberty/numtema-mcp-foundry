import { createHash } from 'node:crypto';
export function compileProviderAdapters(bundle) {
    const adapters = [];
    const warnings = [];
    for (const tool of [...bundle.tools].sort((left, right) => left.name.localeCompare(right.name))) {
        const foundry = foundryExtension(tool);
        if (!isHttpMethod(foundry.source_method) || typeof foundry.source_path !== 'string') {
            warnings.push({
                code: 'UNSUPPORTED_PROVIDER_BINDING',
                message: 'Tool does not expose an HTTP method and source path in extensions.foundry.',
                tool_id: tool.id
            });
            continue;
        }
        adapters.push(compileToolAdapter(tool, foundry));
    }
    const withoutIntegrity = {
        artifact_type: 'provider_adapter_bundle',
        artifact_version: '0.6',
        source_bundle_version: bundle.bundle_version,
        adapters,
        summary: {
            adapter_count: adapters.length,
            authenticated_count: adapters.filter((adapter) => adapter.credential.auth_ref !== null).length,
            idempotency_required_count: adapters.filter((adapter) => adapter.request.idempotency.mode === 'required').length,
            body_binding_count: adapters.filter((adapter) => adapter.request.body !== null).length,
            binary_binding_count: adapters.filter((adapter) => adapter.request.body?.binary === true).length,
            skipped_tool_count: bundle.tools.length - adapters.length
        },
        warnings
    };
    return {
        ...withoutIntegrity,
        integrity: { algorithm: 'sha256', digest: digest(withoutIntegrity) }
    };
}
function compileToolAdapter(tool, foundry) {
    const parameters = compileParameterBindings(foundry.parameter_contract ?? []);
    const body = compileBodyBinding(tool, foundry);
    const response = {
        success: compileResponseMatchers(foundry.response_contract?.success ?? [], foundry.media_contract?.binary_response === true),
        errors: compileResponseMatchers(foundry.response_contract?.errors ?? [], false),
        other: compileResponseMatchers(foundry.response_contract?.other ?? [], foundry.media_contract?.binary_response === true)
    };
    const base = {
        id: `adapter:${tool.name}`,
        version: '0.6.0',
        provider_kind: 'http_openapi',
        tool_id: tool.id,
        tool_name: tool.name,
        tool_revision: tool.revision ?? digest(tool),
        credential: {
            auth_ref: tool.auth_ref ?? null,
            required_scopes: [...tool.required_scopes].sort()
        },
        request: {
            method: foundry.source_method.toUpperCase(),
            path_template: foundry.source_path,
            parameters,
            body,
            idempotency: {
                mode: idempotencyMode(tool),
                header_name: 'Idempotency-Key'
            }
        },
        response
    };
    const revision = digest(base);
    return {
        ...base,
        revision,
        integrity: { algorithm: 'sha256', digest: revision }
    };
}
function compileParameterBindings(raw) {
    const records = raw.filter(isRecord);
    const counts = new Map();
    for (const parameter of records) {
        const name = stringValue(parameter.name);
        if (name !== null)
            counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    const bindings = [];
    for (const parameter of records) {
        const name = stringValue(parameter.name);
        const location = stringValue(parameter.location);
        if (name === null || !isParameterLocation(location))
            continue;
        const binding = {
            argument_name: (counts.get(name) ?? 0) > 1 ? `${location}_${name}` : name,
            source_name: name,
            location,
            required: parameter.required === true,
            deprecated: parameter.deprecated === true
        };
        if (typeof parameter.style === 'string')
            binding.style = parameter.style;
        if (typeof parameter.explode === 'boolean')
            binding.explode = parameter.explode;
        bindings.push(binding);
    }
    return bindings.sort((left, right) => parameterOrder(left.location) - parameterOrder(right.location) || left.argument_name.localeCompare(right.argument_name));
}
function compileBodyBinding(tool, foundry) {
    const contentTypes = stringArray(foundry.media_contract?.request_content_types);
    if (contentTypes.length === 0 && !inputHasBody(tool))
        return null;
    const preferred = preferredContentType(contentTypes);
    const binary = foundry.media_contract?.binary_request === true;
    return {
        argument_name: 'body',
        required: inputBodyRequired(tool),
        content_types: contentTypes,
        preferred_content_type: preferred,
        binary,
        encoding: bodyEncoding(preferred, binary)
    };
}
function compileResponseMatchers(raw, binary) {
    return raw.filter(isRecord).map((response) => {
        const status = typeof response.status === 'string' ? response.status : 'default';
        const content = Array.isArray(response.content) ? response.content.filter(isRecord) : [];
        const contentTypes = content.map((item) => stringValue(item.media_type)).filter((value) => value !== null).sort();
        return {
            status,
            content_types: contentTypes,
            normalizer: responseNormalizer(status, contentTypes, binary)
        };
    }).sort((left, right) => left.status.localeCompare(right.status));
}
function responseNormalizer(status, contentTypes, binary) {
    if (status === '204' || contentTypes.length === 0)
        return 'empty';
    if (binary || contentTypes.some((value) => isBinaryContentType(value)))
        return 'binary';
    if (contentTypes.every((value) => isJsonContentType(value)))
        return 'json';
    if (contentTypes.every((value) => value.startsWith('text/')))
        return 'text';
    return 'adaptive';
}
function idempotencyMode(tool) {
    if (tool.execution.idempotency === 'required')
        return 'required';
    if (tool.execution.idempotency === 'supported')
        return 'optional';
    return 'none';
}
function inputHasBody(tool) {
    const properties = isRecord(tool.input_schema.properties) ? tool.input_schema.properties : {};
    return 'body' in properties;
}
function inputBodyRequired(tool) {
    return Array.isArray(tool.input_schema.required) && tool.input_schema.required.includes('body');
}
function preferredContentType(contentTypes) {
    const priorities = ['application/json', 'application/x-www-form-urlencoded', 'multipart/form-data', 'application/octet-stream', 'text/plain'];
    for (const priority of priorities) {
        if (contentTypes.includes(priority))
            return priority;
    }
    return contentTypes[0] ?? null;
}
function bodyEncoding(contentType, binary) {
    if (contentType === 'multipart/form-data')
        return 'multipart_descriptor';
    if (contentType === 'application/x-www-form-urlencoded')
        return 'form_urlencoded';
    if (binary || contentType === 'application/octet-stream')
        return 'artifact_reference';
    if (contentType !== null && isJsonContentType(contentType))
        return 'json';
    if (contentType?.startsWith('text/'))
        return 'text';
    return 'adaptive';
}
function foundryExtension(tool) {
    const extensions = isRecord(tool.extensions) ? tool.extensions : {};
    return isRecord(extensions.foundry) ? extensions.foundry : {};
}
function parameterOrder(location) {
    return { path: 0, query: 1, header: 2, cookie: 3 }[location];
}
function isHttpMethod(value) {
    return typeof value === 'string' && ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'].includes(value);
}
function isParameterLocation(value) {
    return value !== null && ['path', 'query', 'header', 'cookie'].includes(value);
}
function isJsonContentType(value) {
    return value === 'application/json' || value.endsWith('+json');
}
function isBinaryContentType(value) {
    return value === 'application/octet-stream' || value.startsWith('image/') || value.startsWith('audio/') || value.startsWith('video/') || value === 'application/pdf';
}
function stringArray(value) {
    return Array.isArray(value) ? value.filter((item) => typeof item === 'string').sort() : [];
}
function stringValue(value) {
    return typeof value === 'string' ? value : null;
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function stableStringify(value) {
    return JSON.stringify(sortValue(value));
}
function sortValue(value) {
    if (Array.isArray(value))
        return value.map(sortValue);
    if (!isRecord(value))
        return value;
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])]));
}
export function digest(value) {
    return createHash('sha256').update(stableStringify(value)).digest('hex');
}
//# sourceMappingURL=provider-adapter-compiler.js.map