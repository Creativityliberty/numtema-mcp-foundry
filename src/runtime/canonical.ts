import { createHash } from 'node:crypto';

export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalize(value));
}

export function sha256(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

export function sha256ArtifactPayload(value: unknown): string {
  if (!isRecord(value)) return sha256(value);
  const payload: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === 'integrity' || key === 'signature' || child === undefined) continue;
    payload[key] = child;
  }
  return sha256(payload);
}

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (!isRecord(value)) return value;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    const child = value[key];
    if (child !== undefined) result[key] = normalize(child);
  }
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
