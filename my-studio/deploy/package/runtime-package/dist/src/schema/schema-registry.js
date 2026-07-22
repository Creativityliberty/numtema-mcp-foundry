import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { resolvePackageAsset } from '../system/package-assets.js';
const SCHEMA_FILES = {
    tool: 'tool-contract.schema.json',
    auth: 'auth-contract.schema.json',
    policy: 'policy-contract.schema.json',
    approval: 'approval-contract.schema.json',
    recovery: 'recovery-contract.schema.json',
    receipt: 'receipt-contract.schema.json',
    artifact: 'foundry-artifact.schema.json'
};
export async function createSchemaRegistry(schemaDirectory) {
    const absoluteDirectory = resolve(schemaDirectory ?? resolvePackageAsset('schemas'));
    const entries = await Promise.all(Object.entries(SCHEMA_FILES).map(async ([kind, filename]) => {
        const source = await readFile(resolve(absoluteDirectory, filename), 'utf8');
        return [kind, JSON.parse(source)];
    }));
    return {
        schemaDirectory: absoluteDirectory,
        schemas: new Map(entries)
    };
}
//# sourceMappingURL=schema-registry.js.map