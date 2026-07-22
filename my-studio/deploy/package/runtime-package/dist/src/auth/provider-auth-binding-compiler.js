import { createHash } from 'node:crypto';
export function compileProviderAuthBindings(bundle, adapters) {
    const referenced = new Set(adapters.adapters
        .map((adapter) => adapter.credential.auth_ref)
        .filter((value) => value !== null));
    const authById = new Map(bundle.auth.map((auth) => [auth.id, auth]));
    const warnings = [];
    for (const authRef of referenced) {
        if (!authById.has(authRef)) {
            warnings.push({
                code: 'AUTH_CONTRACT_MISSING',
                message: `Adapter references missing AuthContract ${authRef}.`,
                auth_ref: authRef
            });
        }
    }
    const bindings = bundle.auth
        .map((auth) => compileBinding(auth, adapters))
        .sort((left, right) => left.id.localeCompare(right.id));
    const unreferenced = bundle.auth.filter((auth) => !referenced.has(auth.id));
    for (const auth of unreferenced) {
        warnings.push({
            code: 'AUTH_CONTRACT_UNREFERENCED',
            message: `AuthContract ${auth.id} is not referenced by any provider adapter.`,
            auth_ref: auth.id
        });
    }
    warnings.sort((left, right) => `${left.code}:${left.auth_ref ?? ''}`.localeCompare(`${right.code}:${right.auth_ref ?? ''}`));
    const payload = {
        artifact_type: 'provider_auth_binding_bundle',
        artifact_version: '0.7',
        source_bundle_version: bundle.bundle_version,
        source_adapter_artifact_version: adapters.artifact_version,
        bindings,
        summary: {
            binding_count: bindings.length,
            referenced_auth_count: referenced.size,
            oauth_binding_count: bindings.filter((binding) => binding.auth_mode === 'oauth2_1').length,
            api_key_binding_count: bindings.filter((binding) => binding.auth_mode === 'api_key').length,
            host_managed_binding_count: bindings.filter((binding) => binding.auth_mode === 'host_managed').length,
            unreferenced_auth_count: unreferenced.length
        },
        warnings
    };
    const digest = sha256(payload);
    return {
        ...payload,
        integrity: { algorithm: 'sha256', digest }
    };
}
function compileBinding(auth, adapters) {
    const referencedAdapters = adapters.adapters
        .filter((adapter) => adapter.credential.auth_ref === auth.id)
        .sort((left, right) => left.id.localeCompare(right.id));
    const injection = resolveInjection(auth);
    const bindingBase = {
        id: `auth-binding:${slug(auth.id)}`,
        version: '0.7.0',
        auth_ref: auth.id,
        auth_mode: auth.mode,
        transport: auth.transport,
        adapter_ids: referencedAdapters.map((adapter) => adapter.id),
        tool_ids: referencedAdapters.map((adapter) => adapter.tool_id).sort(),
        required_scopes: uniqueSorted([
            ...auth.required_scopes,
            ...referencedAdapters.flatMap((adapter) => adapter.credential.required_scopes)
        ]),
        optional_scopes: uniqueSorted(auth.optional_scopes ?? []),
        tenant_resolution: auth.tenant_resolution,
        binding_dimensions: uniqueSorted(auth.credential_binding_dimensions ?? []),
        token_passthrough: false,
        audience: {
            validation_required: auth.audience_validation === true || auth.mode === 'oauth2_1',
            canonical_resource_uri: auth.canonical_resource_uri ?? null,
            authorization_server: auth.authorization_server ?? null,
            pkce_required: auth.pkce_required === true || auth.mode === 'oauth2_1'
        },
        injection
    };
    const revision = sha256(bindingBase);
    return {
        ...bindingBase,
        revision,
        integrity: { algorithm: 'sha256', digest: revision }
    };
}
function resolveInjection(auth) {
    const extension = providerBindingExtension(auth);
    const defaultLocation = 'header';
    const defaults = {
        none: { strategy: 'none', location: 'runtime', name: null, prefix: null, signing_algorithm: null },
        bearer: { strategy: 'bearer_token', location: 'header', name: 'Authorization', prefix: 'Bearer', signing_algorithm: null },
        oauth2_1: { strategy: 'bearer_token', location: 'header', name: 'Authorization', prefix: 'Bearer', signing_algorithm: null },
        api_key: { strategy: 'api_key', location: defaultLocation, name: 'X-API-Key', prefix: null, signing_algorithm: null },
        basic: { strategy: 'basic_auth', location: 'header', name: 'Authorization', prefix: 'Basic', signing_algorithm: null },
        hmac: { strategy: 'hmac_signature', location: 'header', name: 'Authorization', prefix: 'HMAC', signing_algorithm: 'HMAC-SHA256' },
        host_managed: { strategy: 'host_managed', location: 'runtime', name: null, prefix: null, signing_algorithm: null }
    };
    const selected = defaults[auth.mode];
    return {
        strategy: selected.strategy,
        location: readLocation(extension.location) ?? selected.location,
        name: readStringOrNull(extension.name, selected.name),
        prefix: readStringOrNull(extension.prefix, selected.prefix),
        signing_algorithm: readStringOrNull(extension.signing_algorithm, selected.signing_algorithm),
        secret_material_allowed_in_artifact: false
    };
}
function providerBindingExtension(auth) {
    const extensions = auth.extensions;
    if (!isRecord(extensions) || !isRecord(extensions.provider_binding))
        return {};
    return extensions.provider_binding;
}
function readLocation(value) {
    return value === 'header' || value === 'query' || value === 'cookie' || value === 'runtime' ? value : null;
}
function readStringOrNull(value, fallback) {
    if (value === null)
        return null;
    return typeof value === 'string' && value.length > 0 ? value : fallback;
}
function uniqueSorted(values) {
    return [...new Set(values)].sort();
}
function slug(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
function sha256(value) {
    return createHash('sha256').update(stableStringify(value)).digest('hex');
}
function stableStringify(value) {
    return JSON.stringify(sortValue(value));
}
function sortValue(value) {
    if (Array.isArray(value))
        return value.map(sortValue);
    if (!isRecord(value))
        return value;
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])]));
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
//# sourceMappingURL=provider-auth-binding-compiler.js.map