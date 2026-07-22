import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { parseControlledYaml } from '../contracts/contract-bundle.js';
import type { CapabilityMapArtifact } from '../inspection/types.js';
import { resolvePackageAsset } from '../system/package-assets.js';
import { validateValueAgainstSchema } from '../validation/schema-validator.js';

export class CapabilityMapLoadError extends Error {
  constructor(public readonly code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = 'CapabilityMapLoadError';
  }
}

export interface CapabilityMapLoadOptions {
  schemaDirectory?: string;
}

export async function loadCapabilityMap(
  filePath: string,
  options: CapabilityMapLoadOptions = {}
): Promise<CapabilityMapArtifact> {
  const absolutePath = resolve(filePath);
  const extension = extname(absolutePath).toLowerCase();
  let source: string;
  try {
    source = await readFile(absolutePath, 'utf8');
  } catch (error) {
    throw new CapabilityMapLoadError('CAPABILITY_MAP_READ_ERROR', errorMessage(error));
  }

  let parsed: unknown;
  try {
    if (extension === '.json') {
      parsed = JSON.parse(source) as unknown;
    } else if (extension === '.yaml' || extension === '.yml') {
      parsed = parseControlledYaml(source);
    } else {
      throw new CapabilityMapLoadError(
        'UNSUPPORTED_CAPABILITY_MAP_FORMAT',
        `Expected .json, .yaml, or .yml, received ${extension || 'no extension'}.`
      );
    }
  } catch (error) {
    if (error instanceof CapabilityMapLoadError) throw error;
    throw new CapabilityMapLoadError('CAPABILITY_MAP_PARSE_ERROR', errorMessage(error));
  }

  if (!isCapabilityMap(parsed)) {
    throw new CapabilityMapLoadError(
      'INVALID_CAPABILITY_MAP',
      'Artifact must be a CapabilityMapArtifact with artifact_type "capability_map" and artifact_version "0.3".'
    );
  }

  const schemaPath = resolve(options.schemaDirectory ?? resolvePackageAsset('schemas'), 'capability-map-artifact.schema.json');
  let schemaSource: string;
  try {
    schemaSource = await readFile(schemaPath, 'utf8');
  } catch (error) {
    throw new CapabilityMapLoadError('CAPABILITY_MAP_SCHEMA_READ_ERROR', errorMessage(error));
  }
  const schema = JSON.parse(schemaSource) as Record<string, unknown>;
  const issues = validateValueAgainstSchema(schema, parsed, 'capability_map');
  if (issues.length > 0) {
    const preview = issues.slice(0, 5).map((issue) => `${issue.path || '/'} ${issue.code}: ${issue.message}`).join('; ');
    throw new CapabilityMapLoadError('INVALID_CAPABILITY_MAP_SCHEMA', preview);
  }
  return parsed;
}

function isCapabilityMap(value: unknown): value is CapabilityMapArtifact {
  if (!isRecord(value)) return false;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
