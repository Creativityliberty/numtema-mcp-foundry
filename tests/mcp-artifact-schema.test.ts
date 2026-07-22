import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import { validateValueAgainstSchema } from '../src/validation/schema-validator.js';

async function schema(name: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(`schemas/${name}`, 'utf8')) as Record<string, unknown>;
}

describe('Sprint 1.0 MCP artifact schemas', () => {
  it('validates a portable MCP runtime configuration', async () => {
    const config = {
      artifact_type: 'mcp_runtime_config', artifact_version: '1.0',
      server: { name: 'numtema-demo', version: '1.0.0', protocol_version: '2025-11-25', transport: { type: 'streamable_http', host: '127.0.0.1', port: 8787, path: '/mcp', allowed_origins: ['https://chatgpt.com'], bearer_token_env: 'MCP_SERVER_TOKEN', require_mcp_headers: true } },
      provider: { base_url: 'https://api.example.test', timeout_ms: 30000 },
      artifacts: { contract_bundle: './contracts.json', provider_adapter_bundle: './adapters.json', provider_auth_binding_bundle: './auth-bindings.json', credential_catalog: './credentials.json', runtime_trust_store: './trust-store.json', ledger_directory: './ledger' },
      context: { subject_ref: 'user-1', client_ref: 'chatgpt', workspace_ref: 'workspace-1', provider_ref: 'provider-1' },
      credentials: { environment_by_handle: { 'credential-handle-1': 'PROVIDER_TOKEN' } },
      signing: { policy: { key_id: 'policy-key', private_key_file: './policy.pem' }, dispatch: { key_id: 'dispatch-key', private_key_file: './dispatch.pem' }, execution: { key_id: 'execution-key', private_key_file: './execution.pem' } }
    };
    assert.deepEqual(validateValueAgainstSchema(await schema('mcp-runtime-config.schema.json'), config, 'mcp_runtime_config'), []);
  });

  it('validates a signed execution receipt and enforces redaction flags', async () => {
    const receipt = {
      artifact_type: 'signed_execution_receipt', artifact_version: '1.0', receipt_id: 'exec-1', authorization_id: 'auth-1', reservation_id: 'res-1',
      binding: { tool_id: 'tool-1', tool_revision: 'rev-1', adapter_id: 'adapter-1', adapter_revision: 'adapter-rev-1', arguments_hash: 'args', context_hash: 'ctx', subject_ref: 'user-1', client_ref: 'chatgpt', workspace_ref: 'workspace-1' },
      status: 'succeeded', started_at: '2026-07-22T16:00:00Z', completed_at: '2026-07-22T16:00:01Z', duration_ms: 1000,
      provider: { response_received: true, http_status: 200, media_type: 'application/json', retryable: false, result_digest: 'result-digest' },
      dispatch: { transition: 'reserved_to_dispatched', state: 'dispatched', receipt_id: 'dispatch-1', receipt_digest: 'dispatch-digest' },
      redaction: { secret_material_included: false, credential_handle_included: false },
      integrity: { algorithm: 'sha256', digest: 'digest' }, signature: { algorithm: 'ed25519', key_id: 'execution-key', value: 'signature' }
    };
    const receiptSchema = await schema('signed-execution-receipt.schema.json');
    assert.deepEqual(validateValueAgainstSchema(receiptSchema, receipt, 'signed_execution_receipt'), []);
    const leaked = { ...receipt, redaction: { ...receipt.redaction, secret_material_included: true } };
    assert.ok(validateValueAgainstSchema(receiptSchema, leaked, 'signed_execution_receipt').length > 0);
  });
});
