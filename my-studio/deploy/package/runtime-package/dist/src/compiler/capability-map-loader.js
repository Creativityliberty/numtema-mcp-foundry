import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { parseControlledYaml } from '../contracts/contract-bundle.js';
import { resolvePackageAsset } from '../system/package-assets.js';
import { validateValueAgainstSchema } from '../validation/schema-validator.js';
export class CapabilityMapLoadError extends Error {
    code;
    constructor(code, message) {
        super(`${code}: ${message}`);
        this.code = code;
        this.name = 'CapabilityMapLoadError';
    }
}
export async function loadCapabilityMap(filePath, options = {}) {
    const absolutePath = resolve(filePath);
    const extension = extname(absolutePath).toLowerCase();
    let source;
    try {
        source = await readFile(absolutePath, 'utf8');
    }
    catch (error) {
        throw new CapabilityMapLoadError('CAPABILITY_MAP_READ_ERROR', errorMessage(error));
    }
    let parsed;
    try {
        if (extension === '.json') {
            parsed = JSON.parse(source);
        }
        else if (extension === '.yaml' || extension === '.yml') {
            parsed = parseControlledYaml(source);
        }
        else {
            throw new CapabilityMapLoadError('UNSUPPORTED_CAPABILITY_MAP_FORMAT', `Expected .json, .yaml, or .yml, received ${extension || 'no extension'}.`);
        }
    }
    catch (error) {
        if (error instanceof CapabilityMapLoadError)
            throw error;
        throw new CapabilityMapLoadError('CAPABILITY_MAP_PARSE_ERROR', errorMessage(error));
    }
    if (!isCapabilityMap(parsed)) {
        throw new CapabilityMapLoadError('INVALID_CAPABILITY_MAP', 'Artifact must be a CapabilityMapArtifact with artifact_type "capability_map" and artifact_version "0.3".');
    }
    const schemaPath = resolve(options.schemaDirectory ?? resolvePackageAsset('schemas'), 'capability-map-artifact.schema.json');
    let schemaSource;
    try {
        schemaSource = await readFile(schemaPath, 'utf8');
    }
    catch (error) {
        throw new CapabilityMapLoadError('CAPABILITY_MAP_SCHEMA_READ_ERROR', errorMessage(error));
    }
    const schema = JSON.parse(schemaSource);
    const issues = validateValueAgainstSchema(schema, parsed, 'capability_map');
    if (issues.length > 0) {
        const preview = issues.slice(0, 5).map((issue) => `${issue.path || '/'} ${issue.code}: ${issue.message}`).join('; ');
        throw new CapabilityMapLoadError('INVALID_CAPABILITY_MAP_SCHEMA', preview);
    }
    return parsed;
}
function isCapabilityMap(value) {
    if (!isRecord(value))
        return false;
    return value.artifact_type === 'capability_map'
        && value.artifact_version === '0.3'
        && typeof value.source_ref === 'string'
        && typeof value.source_title === 'string'
        && Array.isArray(value.capabilities)
        && Array.isArray(value.domains)
        && Array.isArray(value.workflow_hints)
        && isRecord(value.summary)
        && Array.isArray(value.limitations);
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
//# sourceMappingURL=capability-map-loader.js.map