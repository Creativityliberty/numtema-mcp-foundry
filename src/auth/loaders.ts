import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { resolvePackageAsset } from '../system/package-assets.js';
import { validateValueAgainstSchema } from '../validation/schema-validator.js';
import type { CredentialCatalog, CredentialResolutionContext, ProviderAuthBindingBundle } from './types.js';

export async function loadCredentialCatalog(path: string, schemaDirectory = resolvePackageAsset('schemas')): Promise<CredentialCatalog> {
  const value = await loadJson(path, 'credential catalog');
  const schema = await loadSchema(schemaDirectory, 'credential-catalog.schema.json');
  const issues = validateValueAgainstSchema(schema, value, 'credential_catalog');
  if (issues.length > 0) throw new Error(`INVALID_CREDENTIAL_CATALOG: ${issues[0]?.path || '/'} ${issues[0]?.message ?? 'schema validation failed'}`);
  return value as unknown as CredentialCatalog;
}

export async function loadCredentialContext(path: string): Promise<CredentialResolutionContext> {
  const value = await loadJson(path, 'credential context');
  const required = ['subject_ref', 'client_ref', 'workspace_ref', 'provider_ref', 'requested_at'];
  for (const key of required) {
    if (typeof value[key] !== 'string' || (value[key] as string).length === 0) {
      throw new Error(`INVALID_CREDENTIAL_CONTEXT: ${key} is required.`);
    }
  }
  return value as unknown as CredentialResolutionContext;
}

export async function loadProviderAuthBindingBundle(path: string, schemaDirectory = resolvePackageAsset('schemas')): Promise<ProviderAuthBindingBundle> {
  const value = await loadJson(path, 'provider auth binding bundle');
  const schema = await loadSchema(schemaDirectory, 'provider-auth-binding-bundle.schema.json');
  const issues = validateValueAgainstSchema(schema, value, 'provider_auth_binding_bundle');
  if (issues.length > 0) throw new Error(`INVALID_AUTH_BINDING_BUNDLE: ${issues[0]?.path || '/'} ${issues[0]?.message ?? 'schema validation failed'}`);
  return value as unknown as ProviderAuthBindingBundle;
}

async function loadJson(path: string, label: string): Promise<Record<string, unknown>> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(resolve(path), 'utf8')) as unknown;
  } catch (error) {
    throw new Error(`INVALID_JSON: could not load ${label}: ${errorMessage(error)}`);
  }
  if (!isRecord(parsed)) throw new Error(`INVALID_JSON_ROOT: ${label} root must be an object.`);
  return parsed;
}

async function loadSchema(directory: string, filename: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(resolve(directory, filename), 'utf8')) as Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
