import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { compileProviderAdapters } from '../src/adapters/provider-adapter-compiler.js';
import { normalizeProviderResponse } from '../src/adapters/response-normalizer.js';
import type { ProviderAdapterContract } from '../src/adapters/types.js';
import { loadContractBundle } from '../src/contracts/contract-bundle.js';

async function adapter(name: string) {
  const bundle = await loadContractBundle('examples/contract-bundle.schema-rich.generated.json');
  const found = compileProviderAdapters(bundle).adapters.find((candidate) => candidate.tool_name === name);
  assert.ok(found);
  return found;
}

describe('Provider response normalizer', () => {
  it('parses JSON success responses while preserving provider status', async () => {
    const result = normalizeProviderResponse(await adapter('customer_list'), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: '{"items":[],"next_cursor":null}'
    });
    assert.equal(result.ok, true);
    assert.equal(result.status, 200);
    assert.equal(result.kind, 'json');
    assert.deepEqual(result.data, { items: [], next_cursor: null });
  });

  it('normalizes problem details and retryability for provider errors', async () => {
    const invalid = normalizeProviderResponse(await adapter('customer_list'), {
      status: 400,
      headers: { 'content-type': 'application/problem+json' },
      body: JSON.stringify({ title: 'Invalid cursor', detail: 'Cursor expired', status: 400 })
    });
    assert.equal(invalid.ok, false);
    assert.equal(invalid.error?.category, 'invalid_request');
    assert.equal(invalid.error?.message, 'Cursor expired');
    assert.equal(invalid.error?.retryable, false);

    const unavailable = normalizeProviderResponse(await adapter('customer_list'), {
      status: 503,
      headers: { 'content-type': 'text/plain' },
      body: 'maintenance'
    });
    assert.equal(unavailable.error?.category, 'provider_unavailable');
    assert.equal(unavailable.error?.retryable, true);
  });

  it('handles empty and binary success responses without coercion', () => {
    const synthetic: ProviderAdapterContract = {
      id: 'adapter:file_download', version: '0.6.0', revision: 'a'.repeat(64), provider_kind: 'http_openapi',
      tool_id: 'tool:file_download', tool_name: 'file_download', tool_revision: 'b'.repeat(64),
      credential: { auth_ref: null, required_scopes: [] },
      request: { method: 'GET', path_template: '/file', parameters: [], body: null, idempotency: { mode: 'none', header_name: 'Idempotency-Key' } },
      response: {
        success: [
          { status: '204', content_types: [], normalizer: 'empty' },
          { status: '200', content_types: ['application/octet-stream'], normalizer: 'binary' }
        ], errors: [], other: []
      },
      integrity: { algorithm: 'sha256', digest: 'c'.repeat(64) }
    };
    const empty = normalizeProviderResponse(synthetic, { status: 204, headers: {}, body: null });
    assert.equal(empty.kind, 'empty');
    assert.equal(empty.data, null);
    const bytes = new Uint8Array([1, 2, 3]);
    const binary = normalizeProviderResponse(synthetic, { status: 200, headers: { 'content-type': 'application/octet-stream' }, body: bytes });
    assert.equal(binary.kind, 'binary');
    assert.equal(binary.data, bytes);
  });
});
