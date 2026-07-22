import { URLSearchParams } from 'node:url';
import type { ProviderAdapterContract, ProviderExecutionPlan, ProviderResponseInput } from '../adapters/types.js';
import { normalizeProviderResponse } from '../adapters/response-normalizer.js';

export interface ProviderExecutionOptions {
  timeoutMs: number;
}

export async function executeProviderRequest(
  adapter: ProviderAdapterContract,
  request: ProviderExecutionPlan['request'],
  options: ProviderExecutionOptions
) {
  const headers: Record<string, string> = {};
  for (const entry of request.headers) headers[entry.name] = entry.value;
  let body: string | Uint8Array | undefined;
  if (request.body !== null) {
    if (request.body.encoding === 'json') body = JSON.stringify(request.body.value);
    else if (request.body.encoding === 'text') body = String(request.body.value ?? '');
    else if (request.body.encoding === 'form_urlencoded') body = encodeForm(request.body.value);
    else if (request.body.encoding === 'multipart_descriptor' || request.body.encoding === 'artifact_reference') {
      throw new Error(`UNSUPPORTED_PROVIDER_BODY: ${request.body.encoding} requires an Artifact Gateway materializer.`);
    } else body = typeof request.body.value === 'string' ? request.body.value : JSON.stringify(request.body.value);
    headers['Content-Type'] = request.body.content_type;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('PROVIDER_TIMEOUT')), options.timeoutMs);
  try {
    const response = await fetch(request.url, { method: request.method, headers, ...(body === undefined ? {} : { body }), signal: controller.signal });
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => { responseHeaders[key] = value; });
    const contentType = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() ?? '';
    const responseBody: unknown = isBinary(contentType)
      ? new Uint8Array(await response.arrayBuffer())
      : await response.text();
    const input: ProviderResponseInput = { status: response.status, headers: responseHeaders, body: responseBody };
    return normalizeProviderResponse(adapter, input);
  } finally {
    clearTimeout(timer);
  }
}

function encodeForm(value: unknown): string {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return String(value ?? '');
  const params = new URLSearchParams();
  for (const [key, child] of Object.entries(value)) {
    if (Array.isArray(child)) child.forEach((item) => params.append(key, String(item)));
    else if (child !== undefined && child !== null) params.append(key, String(child));
  }
  return params.toString();
}

function isBinary(contentType: string): boolean {
  return contentType === 'application/octet-stream' || contentType === 'application/pdf' || contentType.startsWith('image/') || contentType.startsWith('audio/') || contentType.startsWith('video/');
}
