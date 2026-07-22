import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface PackageMetadata {
  name: string;
  version: string;
  description: string;
  engines: { node?: string };
}

let cachedRoot: string | null = null;
let cachedMetadata: PackageMetadata | null = null;

export function getPackageRoot(): string {
  if (cachedRoot !== null) return cachedRoot;

  let directory = dirname(fileURLToPath(import.meta.url));
  while (true) {
    const packagePath = join(directory, 'package.json');
    if (existsSync(packagePath)) {
      try {
        const candidate = JSON.parse(readFileSync(packagePath, 'utf8')) as Partial<PackageMetadata>;
        if (candidate.name === '@numtema/mcp-foundry') {
          cachedRoot = directory;
          return directory;
        }
      } catch {
        // Continue walking. A parent package.json may be unrelated or malformed.
      }
    }
    const parent = dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }

  throw new Error('FOUNDRY_PACKAGE_ROOT_NOT_FOUND: could not locate @numtema/mcp-foundry package.json.');
}

export function resolvePackageAsset(...segments: string[]): string {
  return resolve(getPackageRoot(), ...segments);
}

export function getPackageMetadata(): PackageMetadata {
  if (cachedMetadata !== null) return cachedMetadata;
  const packagePath = resolvePackageAsset('package.json');
  const parsed = JSON.parse(readFileSync(packagePath, 'utf8')) as Partial<PackageMetadata>;
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
