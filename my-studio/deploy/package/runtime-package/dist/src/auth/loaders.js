import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { resolvePackageAsset } from '../system/package-assets.js';
import { validateValueAgainstSchema } from '../validation/schema-validator.js';
export async function loadCredentialCatalog(path, schemaDirectory = resolvePackageAsset('schemas')) {
    const value = await loadJson(path, 'credential catalog');
    const schema = await loadSchema(schemaDirectory, 'credential-catalog.schema.json');
    const issues = validateValueAgainstSchema(schema, value, 'credential_catalog');
    if (issues.length > 0)
        throw new Error(`INVALID_CREDENTIAL_CATALOG: ${issues[0]?.path || '/'} ${issues[0]?.message ?? 'schema validation failed'}`);
    return value;
}
export async function loadCredentialContext(path) {
    const value = await loadJson(path, 'credential context');
    const required = ['subject_ref', 'client_ref', 'workspace_ref', 'provider_ref', 'requested_at'];
    for (const key of required) {
        if (typeof value[key] !== 'string' || value[key].length === 0) {
            throw new Error(`INVALID_CREDENTIAL_CONTEXT: ${key} is required.`);
        }
    }
    return value;
}
export async function loadProviderAuthBindingBundle(path, schemaDirectory = resolvePackageAsset('schemas')) {
    const value = await loadJson(path, 'provider auth binding bundle');
    const schema = await loadSchema(schemaDirectory, 'provider-auth-binding-bundle.schema.json');
    const issues = validateValueAgainstSchema(schema, value, 'provider_auth_binding_bundle');
    if (issues.length > 0)
        throw new Error(`INVALID_AUTH_BINDING_BUNDLE: ${issues[0]?.path || '/'} ${issues[0]?.message ?? 'schema validation failed'}`);
    return value;
}
async function loadJson(path, label) {
    let parsed;
    try {
        parsed = JSON.parse(await readFile(resolve(path), 'utf8'));
    }
    catch (error) {
        throw new Error(`INVALID_JSON: could not load ${label}: ${errorMessage(error)}`);
    }
    if (!isRecord(parsed))
        throw new Error(`INVALID_JSON_ROOT: ${label} root must be an object.`);
    return parsed;
}
async function loadSchema(directory, filename) {
    return JSON.parse(await readFile(resolve(directory, filename), 'utf8'));
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
//# sourceMappingURL=loaders.js.map