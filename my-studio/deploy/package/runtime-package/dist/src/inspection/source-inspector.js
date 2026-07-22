import { extractOperationSchema } from './openapi-schema-extractor.js';
const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'];
const PAGINATION_NAMES = new Set(['cursor', 'after', 'before', 'page', 'page_size', 'pagesize', 'per_page', 'limit', 'offset']);
export function inspectOpenApi(document, sourceRef) {
    const securitySchemes = inspectSecuritySchemes(document);
    const operations = [];
    for (const path of Object.keys(document.paths).sort()) {
        const pathItem = document.paths[path];
        if (!isRecord(pathItem))
            continue;
        for (const method of HTTP_METHODS) {
            const rawOperation = pathItem[method];
            if (!isRecord(rawOperation))
                continue;
            operations.push(inspectOperation(document, path, method, pathItem, rawOperation));
        }
    }
    const domains = [...new Set(operations.map((operation) => operation.domain))].sort();
    return {
        artifact_type: 'source_inspection',
        artifact_version: '0.3',
        source: {
            ref: sourceRef,
            kind: 'openapi',
            openapi_version: document.openapi,
            title: document.info.title,
            version: document.info.version,
            servers: inspectServers(document)
        },
        summary: {
            operation_count: operations.length,
            security_scheme_count: securitySchemes.length,
            authenticated_operation_count: operations.filter((operation) => operation.auth.required).length,
            asynchronous_operation_count: operations.filter((operation) => operation.signals.asynchronous).length,
            high_signal_operation_count: operations.filter((operation) => operation.signals.destructive ||
                operation.signals.financial ||
                operation.signals.external_communication ||
                operation.signals.credential_change).length,
            domains
        },
        security_schemes: securitySchemes,
        operations,
        limitations: [
            'Remote and external $ref values are retained as unresolved references and are never fetched automatically.',
            'Lexical signals are conservative suggestions and require human review before compilation.',
            'Controlled YAML supports the Foundry YAML subset; JSON is canonical for full OpenAPI fidelity.'
        ]
    };
}
function inspectOperation(document, path, method, pathItem, operation) {
    const operationId = typeof operation.operationId === 'string' && operation.operationId.trim().length > 0
        ? operation.operationId
        : fallbackOperationId(method, path);
    const tags = stringArray(operation.tags);
    const domain = tags[0] ?? inferDomain(path);
    const summary = typeof operation.summary === 'string' ? operation.summary : humanize(operationId);
    const description = typeof operation.description === 'string' ? operation.description : undefined;
    const schema = extractOperationSchema(document, pathItem, operation);
    const parameters = schema.parameters.map(({ name, location, required }) => ({ name, location, required }));
    const requestContentTypes = schema.media.request_content_types;
    const responseStatuses = [...schema.success_responses, ...schema.error_responses, ...schema.other_responses].map((response) => response.status).sort();
    const responseContentTypes = schema.media.response_content_types;
    const auth = inspectAuth(document, operation);
    const pagination = inspectPagination(parameters);
    const evidence = [];
    const text = [operationId, summary, description ?? '', path, ...tags].join(' ').toLowerCase();
    const readOnly = method === 'get' || method === 'head' || method === 'options';
    const writes = !readOnly && method !== 'trace';
    if (readOnly)
        evidence.push(ev('READ_HTTP_METHOD', `${method.toUpperCase()} implies a read-oriented operation.`, 'http_method'));
    if (writes)
        evidence.push(ev('WRITE_HTTP_METHOD', `${method.toUpperCase()} implies server-side effects.`, 'http_method'));
    const destructive = method === 'delete' || matches(text, ['delete', 'remove', 'purge', 'revoke', 'erase', 'destroy', 'terminate']);
    if (destructive)
        evidence.push(ev('DESTRUCTIVE_SIGNAL', 'Method or metadata indicates destructive behavior.', method === 'delete' ? 'http_method' : 'operation_metadata'));
    const financial = matches(text, ['refund', 'payment', 'charge', 'payout', 'transfer', 'purchase', 'billing', 'checkout', 'invoice payment']);
    if (financial)
        evidence.push(ev('FINANCIAL_SIGNAL', 'Operation metadata contains a financial action or resource.', 'operation_metadata'));
    const externalCommunication = matches(text, ['send', 'email', 'sms', 'message', 'notify', 'notification', 'publish', 'broadcast', 'webhook']);
    if (externalCommunication)
        evidence.push(ev('EXTERNAL_COMMUNICATION_SIGNAL', 'Operation metadata indicates outbound communication or publication.', 'operation_metadata'));
    const credentialChange = matches(text, ['api key', 'api-key', 'token', 'credential', 'secret', 'password', 'permission', 'role', 'access key']);
    if (credentialChange)
        evidence.push(ev('CREDENTIAL_SIGNAL', 'Operation metadata references credentials or authorization state.', 'operation_metadata'));
    const personalData = matches(text, ['customer', 'patient', 'user', 'contact', 'profile', 'address', 'person', 'employee', 'applicant', 'identity']);
    if (personalData)
        evidence.push(ev('PERSONAL_DATA_SIGNAL', 'Operation metadata references a person or personal profile.', 'operation_metadata'));
    const callbackOrWebhook = (isRecord(operation.callbacks) && Object.keys(operation.callbacks).length > 0) ||
        (isRecord(document.webhooks) && Object.keys(document.webhooks).length > 0);
    if (callbackOrWebhook)
        evidence.push(ev('CALLBACK_SIGNAL', 'Callbacks or webhooks are declared.', 'callback'));
    const asynchronous = responseStatuses.includes('202') || callbackOrWebhook || matches(text, ['async', 'queue', 'queued', 'job', 'render', 'generate', 'process', 'compile', 'export', 'import', 'transcode']);
    if (asynchronous)
        evidence.push(ev('ASYNC_SIGNAL', 'Response codes, callbacks, or metadata indicate asynchronous execution.', responseStatuses.includes('202') ? 'response' : 'operation_metadata'));
    const upload = requestContentTypes.some((type) => type === 'multipart/form-data' || type === 'application/octet-stream') || matches(text, ['upload', 'import file']);
    if (upload)
        evidence.push(ev('UPLOAD_SIGNAL', 'Request media type or operation metadata indicates upload.', requestContentTypes.length > 0 ? 'request_body' : 'operation_metadata'));
    const download = responseContentTypes.some((type) => type === 'application/octet-stream' || type.startsWith('image/') || type.startsWith('video/') || type.startsWith('audio/')) || matches(text, ['download', 'export file']);
    if (download)
        evidence.push(ev('DOWNLOAD_SIGNAL', 'Response media type or metadata indicates downloadable content.', responseContentTypes.length > 0 ? 'response' : 'operation_metadata'));
    if (auth.required)
        evidence.push(ev('AUTH_REQUIRED', `Security schemes required: ${auth.schemes.join(', ') || 'unspecified'}.`, 'security'));
    if (pagination.detected)
        evidence.push(ev('PAGINATION_SIGNAL', `Pagination parameters detected: ${pagination.parameters.join(', ')}.`, 'parameter'));
    const signals = {
        read_only: readOnly,
        writes,
        destructive,
        financial,
        external_communication: externalCommunication,
        credential_change: credentialChange,
        personal_data: personalData,
        asynchronous,
        callback_or_webhook: callbackOrWebhook,
        upload,
        download
    };
    const base = {
        operation_id: operationId,
        method,
        path,
        summary,
        tags,
        domain,
        parameters,
        request_content_types: requestContentTypes,
        response_statuses: responseStatuses,
        response_content_types: responseContentTypes,
        auth,
        pagination,
        signals,
        evidence,
        schema
    };
    if (description !== undefined)
        base.description = description;
    return base;
}
function inspectSecuritySchemes(document) {
    const rawSchemes = document.components?.securitySchemes;
    if (!isRecord(rawSchemes))
        return [];
    return Object.keys(rawSchemes).sort().map((name) => {
        const raw = rawSchemes[name];
        const scheme = isRecord(raw) ? raw : {};
        return {
            name,
            type: typeof scheme.type === 'string' ? scheme.type : 'unknown',
            scopes: collectSchemeScopes(scheme)
        };
    });
}
function collectSchemeScopes(scheme) {
    if (!isRecord(scheme.flows))
        return [];
    const scopes = new Set();
    for (const flow of Object.values(scheme.flows)) {
        if (!isRecord(flow) || !isRecord(flow.scopes))
            continue;
        for (const scope of Object.keys(flow.scopes))
            scopes.add(scope);
    }
    return [...scopes].sort();
}
function inspectServers(document) {
    if (!Array.isArray(document.servers))
        return [];
    return document.servers
        .map((server) => isRecord(server) && typeof server.url === 'string' ? server.url : null)
        .filter((value) => value !== null);
}
function inspectParameters(pathItem, operation) {
    const rawParameters = [
        ...(Array.isArray(pathItem.parameters) ? pathItem.parameters : []),
        ...(Array.isArray(operation.parameters) ? operation.parameters : [])
    ];
    const seen = new Set();
    const parameters = [];
    for (const raw of rawParameters) {
        if (!isRecord(raw) || typeof raw.name !== 'string' || typeof raw.in !== 'string')
            continue;
        const key = `${raw.in}:${raw.name}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        parameters.push({ name: raw.name, location: raw.in, required: raw.required === true });
    }
    return parameters.sort((a, b) => `${a.location}:${a.name}`.localeCompare(`${b.location}:${b.name}`));
}
function inspectAuth(document, operation) {
    const hasOperationSecurity = Object.prototype.hasOwnProperty.call(operation, 'security');
    const rawSecurity = hasOperationSecurity ? operation.security : document.security;
    const requirements = Array.isArray(rawSecurity) ? rawSecurity : [];
    if (requirements.length === 0) {
        return { required: false, inherited: !hasOperationSecurity, schemes: [], required_scopes: [] };
    }
    const schemes = new Set();
    const scopes = new Set();
    let hasNonEmptyRequirement = false;
    for (const requirement of requirements) {
        if (!isRecord(requirement))
            continue;
        const names = Object.keys(requirement);
        if (names.length > 0)
            hasNonEmptyRequirement = true;
        for (const name of names) {
            schemes.add(name);
            for (const scope of stringArray(requirement[name]))
                scopes.add(scope);
        }
    }
    return {
        required: hasNonEmptyRequirement,
        inherited: !hasOperationSecurity,
        schemes: [...schemes].sort(),
        required_scopes: [...scopes].sort()
    };
}
function inspectPagination(parameters) {
    const names = parameters
        .filter((parameter) => parameter.location === 'query' && PAGINATION_NAMES.has(parameter.name.toLowerCase()))
        .map((parameter) => parameter.name)
        .sort();
    const lower = names.map((name) => name.toLowerCase());
    const style = lower.some((name) => ['cursor', 'after', 'before'].includes(name))
        ? 'cursor'
        : lower.includes('offset')
            ? 'offset'
            : lower.some((name) => ['page', 'page_size', 'pagesize', 'per_page'].includes(name))
                ? 'page'
                : 'none';
    return { detected: names.length > 0, style, parameters: names };
}
function contentTypes(requestBody) {
    if (!isRecord(requestBody) || !isRecord(requestBody.content))
        return [];
    return Object.keys(requestBody.content).sort();
}
function responseKeys(responses) {
    if (!isRecord(responses))
        return [];
    return Object.keys(responses).sort();
}
function responseMediaTypes(responses) {
    if (!isRecord(responses))
        return [];
    const result = new Set();
    for (const response of Object.values(responses)) {
        if (!isRecord(response) || !isRecord(response.content))
            continue;
        for (const type of Object.keys(response.content))
            result.add(type);
    }
    return [...result].sort();
}
function fallbackOperationId(method, path) {
    const normalized = path
        .replaceAll(/[{}]/g, '')
        .split('/')
        .filter(Boolean)
        .map((part) => part.replaceAll(/[^a-zA-Z0-9]+/g, ' '))
        .flatMap((part) => part.split(' '))
        .filter(Boolean)
        .map((part) => capitalize(part))
        .join('');
    return `${method}${normalized || 'Root'}`;
}
function inferDomain(path) {
    const first = path.split('/').filter(Boolean).find((part) => !part.startsWith('{')) ?? 'General';
    return capitalize(singularize(first.replaceAll(/[^a-zA-Z0-9]+/g, ' ')).replaceAll(' ', ''));
}
function humanize(value) {
    return splitWords(value).map((word) => word.toLowerCase()).join(' ').replace(/^./, (letter) => letter.toUpperCase());
}
function splitWords(value) {
    return value
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replaceAll(/[^a-zA-Z0-9]+/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
}
function singularize(value) {
    if (value.toLowerCase().endsWith('ies'))
        return `${value.slice(0, -3)}y`;
    if (value.toLowerCase().endsWith('sses'))
        return value.slice(0, -2);
    if (value.toLowerCase().endsWith('s') && !value.toLowerCase().endsWith('ss'))
        return value.slice(0, -1);
    return value;
}
function capitalize(value) {
    return value.length === 0 ? value : `${value[0].toUpperCase()}${value.slice(1)}`;
}
function stringArray(value) {
    return Array.isArray(value) ? value.filter((entry) => typeof entry === 'string') : [];
}
function matches(text, needles) {
    return needles.some((needle) => text.includes(needle));
}
function ev(code, message, source) {
    return { code, message, source };
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
//# sourceMappingURL=source-inspector.js.map