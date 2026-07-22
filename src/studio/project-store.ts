import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { resolvePackageAsset } from '../system/package-assets.js';
import type { StudioProject, StudioToolOverride } from './types.js';

const PROJECT_FILE = 'studio-project.json';
const MAX_NAME_LENGTH = 80;

export async function createStudioProject(directory: string, options: { name?: string; force?: boolean; withExample?: boolean } = {}): Promise<StudioProject> {
  const root = resolve(directory);
  if (await exists(root)) {
    const entries = await readdir(root);
    if (entries.length > 0 && options.force !== true) {
      throw new Error(`STUDIO_INIT_REFUSED: ${root} is not empty. Use --force to replace generated files.`);
    }
  }
  await mkdir(join(root, 'source'), { recursive: true });
  await mkdir(join(root, 'overrides'), { recursive: true });
  await mkdir(join(root, 'generated'), { recursive: true });
  await mkdir(join(root, 'deploy'), { recursive: true });
  const now = new Date().toISOString();
  const project: StudioProject = {
    artifact_type: 'studio_project', artifact_version: '1.2',
    name: normalizeName(options.name ?? basenameSafe(root)), created_at: now, updated_at: now,
    source: { file: './source/openapi.json', imported_at: null, original_name: null },
    provider: {
      base_url: 'http://127.0.0.1:9797', provider_ref: 'provider-api', provider_account_ref: 'provider-account-001',
      auth_mode: 'bearer', credential_handle: 'credential-handle-provider-001', credential_environment: 'PROVIDER_API_TOKEN'
    },
    chatgpt_app: { public_base_url: 'http://127.0.0.1:8788', allowed_origins: ['https://chatgpt.com', 'http://localhost:8788'], baseline_scopes: ['mcp:tools'] },
    paths: {
      overrides: './overrides/tool-overrides.json', inspection: './generated/source-inspection.json', capability_map: './generated/capability-map.json',
      contract_bundle: './generated/contract-bundle.json', provider_adapters: './generated/provider-adapters.json', provider_auth_bindings: './generated/provider-auth-bindings.json',
      credential_catalog: './generated/credential-catalog.json', deployment_directory: './deploy/package'
    },
    last_build: null
  };
  await writeJsonAtomic(root, project.paths.overrides, [] satisfies StudioToolOverride[]);
  if (options.withExample !== false) {
    await copyFile(resolvePackageAsset('examples', 'openapi-schema-rich.json'), resolveWithin(root, project.source.file));
    project.source = { file: './source/openapi.json', imported_at: now, original_name: 'openapi-schema-rich.json' };
  } else {
    await writeJsonAtomic(root, project.source.file, { openapi: '3.1.0', info: { title: project.name, version: '0.1.0' }, paths: {} });
  }
  await saveStudioProject(root, project);
  return project;
}

export async function loadStudioProject(directory: string): Promise<StudioProject> {
  const root = resolve(directory);
  const parsed = JSON.parse(await readFile(join(root, PROJECT_FILE), 'utf8')) as StudioProject;
  if (parsed.artifact_type !== 'studio_project' || parsed.artifact_version !== '1.2') throw new Error('STUDIO_PROJECT_INVALID: unsupported project descriptor.');
  validateProjectPaths(root, parsed);
  return parsed;
}

export async function saveStudioProject(directory: string, project: StudioProject): Promise<void> {
  const root = resolve(directory);
  validateProjectPaths(root, project);
  const next = { ...project, updated_at: new Date().toISOString() };
  await writeJsonAtomic(root, `./${PROJECT_FILE}`, next);
}

export async function loadStudioOverrides(directory: string, project?: StudioProject): Promise<StudioToolOverride[]> {
  const root = resolve(directory);
  const selected = project ?? await loadStudioProject(root);
  const parsed = JSON.parse(await readFile(resolveWithin(root, selected.paths.overrides), 'utf8')) as unknown;
  if (!Array.isArray(parsed)) throw new Error('STUDIO_OVERRIDES_INVALID: expected an array.');
  return parsed as StudioToolOverride[];
}

export async function saveStudioOverrides(directory: string, overrides: StudioToolOverride[]): Promise<void> {
  const root = resolve(directory);
  const project = await loadStudioProject(root);
  await writeJsonAtomic(root, project.paths.overrides, overrides);
}

export async function writeProjectJson(directory: string, relativePath: string, value: unknown): Promise<string> {
  const root = resolve(directory);
  const absolute = resolveWithin(root, relativePath);
  await mkdir(dirname(absolute), { recursive: true });
  await writeJsonAtomic(root, relativePath, value);
  return absolute;
}

export function resolveStudioPath(directory: string, relativePath: string): string {
  return resolveWithin(resolve(directory), relativePath);
}

export async function importStudioSource(directory: string, filename: string, content: string): Promise<StudioProject> {
  if (content.length > 2_000_000) throw new Error('STUDIO_SOURCE_TOO_LARGE: source exceeds 2 MB.');
  const extension = filename.toLowerCase().endsWith('.yaml') || filename.toLowerCase().endsWith('.yml') ? 'yaml' : 'json';
  const root = resolve(directory);
  const project = await loadStudioProject(root);
  const sourcePath = `./source/openapi.${extension}`;
  const absolute = resolveWithin(root, sourcePath);
  await mkdir(dirname(absolute), { recursive: true });
  await writeTextAtomic(absolute, content);
  project.source = { file: sourcePath, imported_at: new Date().toISOString(), original_name: sanitizeFilename(filename) };
  await saveStudioProject(root, project);
  return project;
}

function validateProjectPaths(root: string, project: StudioProject): void {
  for (const value of [project.source.file, ...Object.values(project.paths)]) resolveWithin(root, value);
}

function resolveWithin(root: string, candidate: string): string {
  const absolute = resolve(root, candidate);
  const rel = relative(root, absolute);
  if (rel.startsWith('..') || rel === '..') throw new Error(`STUDIO_PATH_TRAVERSAL: ${candidate}`);
  return absolute;
}

async function writeJsonAtomic(root: string, relativePath: string, value: unknown): Promise<void> {
  const absolute = resolveWithin(root, relativePath);
  await mkdir(dirname(absolute), { recursive: true });
  await writeTextAtomic(absolute, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeTextAtomic(path: string, value: string): Promise<void> {
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, value, 'utf8');
  await rename(temporary, path);
}

function normalizeName(value: string): string {
  const normalized = value.trim().slice(0, MAX_NAME_LENGTH);
  if (normalized.length === 0) throw new Error('STUDIO_PROJECT_NAME_INVALID: name cannot be empty.');
  return normalized;
}

function basenameSafe(path: string): string {
  const segments = path.split(/[\\/]/).filter(Boolean);
  return segments.at(-1) ?? 'numtema-foundry-project';
}

function sanitizeFilename(value: string): string {
  return value.split(/[\\/]/).at(-1)?.replace(/[^a-zA-Z0-9._-]/g, '-') ?? 'openapi.json';
}

async function exists(path: string): Promise<boolean> { try { await stat(path); return true; } catch { return false; } }
