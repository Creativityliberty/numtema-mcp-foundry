import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
let cachedRoot = null;
let cachedMetadata = null;
export function getPackageRoot() {
    if (cachedRoot !== null)
        return cachedRoot;
    let directory = dirname(fileURLToPath(import.meta.url));
    while (true) {
        const packagePath = join(directory, 'package.json');
        if (existsSync(packagePath)) {
            try {
                const candidate = JSON.parse(readFileSync(packagePath, 'utf8'));
                if (candidate.name === '@numtema/mcp-foundry') {
                    cachedRoot = directory;
                    return directory;
                }
            }
            catch {
                // Continue walking. A parent package.json may be unrelated or malformed.
            }
        }
        const parent = dirname(directory);
        if (parent === directory)
            break;
        directory = parent;
    }
    throw new Error('FOUNDRY_PACKAGE_ROOT_NOT_FOUND: could not locate @numtema/mcp-foundry package.json.');
}
export function resolvePackageAsset(...segments) {
    return resolve(getPackageRoot(), ...segments);
}
export function getPackageMetadata() {
    if (cachedMetadata !== null)
        return cachedMetadata;
    const packagePath = resolvePackageAsset('package.json');
    const parsed = JSON.parse(readFileSync(packagePath, 'utf8'));
    if (parsed.name !== '@numtema/mcp-foundry' || typeof parsed.version !== 'string') {
        throw new Error(`FOUNDRY_PACKAGE_METADATA_INVALID: ${packagePath}`);
    }
    cachedMetadata = {
        name: parsed.name,
        version: parsed.version,
        description: typeof parsed.description === 'string' ? parsed.description : '',
        engines: parsed.engines ?? {}
    };
    return cachedMetadata;
}
//# sourceMappingURL=package-assets.js.map