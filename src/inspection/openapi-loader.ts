import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { parseControlledYaml } from '../contracts/contract-bundle.js';
import type { OpenApiDocument } from './types.js';

export class OpenApiLoadError extends Error {
  constructor(public readonly code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = 'OpenApiLoadError';
  }
}

export async function loadOpenApiDocument(filePath: string): Promise<OpenApiDocument> {
  const absolutePath = resolve(filePath);
  const source = await readFile(absolutePath, 'utf8');
  const extension = extname(absolutePath).toLowerCase();
  let parsed: unknown;

  try {
    if (extension === '.json') {
      parsed = JSON.parse(source) as unknown;
    } else if (extension === '.yaml' || extension === '.yml') {
      parsed = parseControlledYaml(source);
    } else {
      throw new OpenApiLoadError('UNSUPPORTED_SOURCE_FORMAT', `Expected .json, .yaml, or .yml, received ${extension || 'no extension'}.`);
    }
  } catch (error) {
    if (error instanceof OpenApiLoadError) throw error;
    throw new OpenApiLoadError('INVALID_OPENAPI_SYNTAX', errorMessage(error));
  }

  if (!isRecord(parsed)) {
    throw new OpenApiLoadError('INVALID_OPENAPI_ROOT', 'OpenAPI root must be an object.');
  }
  if (typeof parsed.openapi !== 'string' || !/^3\.(?:0|1)\.\d+(?:[-+].*)?$/.test(parsed.openapi)) {
    throw new OpenApiLoadError('UNSUPPORTED_OPENAPI_VERSION', 'Only OpenAPI 3.0.x and 3.1.x are supported.');
  }
  if (!isRecord(parsed.info) || typeof parsed.info.title !== 'string' || typeof parsed.info.version !== 'string') {
    throw new OpenApiLoadError('INVALID_OPENAPI_INFO', 'info.title and info.version are required strings.');
  }
  if (!isRecord(parsed.paths)) {
    throw new OpenApiLoadError('INVALID_OPENAPI_PATHS', 'paths must be an object.');
  }

  return parsed as unknown as OpenApiDocument;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
