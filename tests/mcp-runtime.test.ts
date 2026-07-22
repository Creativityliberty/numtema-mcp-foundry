import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, it } from 'node:test';
import type { ProviderAdapterBundle } from '../src/adapters/types.js';
import type { ProviderAuthBindingBundle, CredentialCatalog } from '../src/auth/types.js';
import type { ContractBundle } from '../src/contracts/types.js';
import type { RuntimeTrustStore } from '../src/runtime/types.js';
import { createFoundryMcpRuntime } from '../src/mcp/server-runtime.js';
import { readDispatchLedgerSnapshot } from '../src/dispatch/ledger-store.js';
import { verifyExecutionReceipt } from '../src/mcp/execution-receipt.js';

const tempDirectories: string[] = [];
afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('Foundry MCP governed execution runtime', () => {
  it('executes an authorized provider call, commits dispatch, and returns a signed redacted receipt', async () => {
    const provider = await startProvider((request, response) => {
      assert.equal(request.headers.authorization, 'Bearer provider-secret-token');
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ id: 'customer-42', name: 'Ada' }));
    });
    const fixture = await createRuntimeFixture(provider.baseUrl);
    const result = await fixture.runtime.callTool('customer_get', { customerId: 'customer-42' }, { idempotencyKey: 'call-001' });
    assert.equal(result.isError, false);
    assert.deepEqual(result.structuredContent, { id: 'customer-42', name: 'Ada' });
    const receipt = ((result._meta?.foundry as Record<string, unknown>).executionReceipt) as Parameters<typeof verifyExecutionReceipt>[0];
    assert.equal(receipt.status, 'succeeded');
    assert.equal(JSON.stringify(result).includes('provider-secret-token'), false);
    assert.equal(verifyExecutionReceipt(receipt, fixture.trustStore, fixture.now).valid, true);
    const snapshot = await readDispatchLedgerSnapshot(fixture.ledgerDirectory, fixture.now);
    assert.equal(snapshot.reservations[0]?.state, 'dispatched');
    await provider.close();
  });

  it('returns provider failures as MCP tool errors after committing the dispatch', async () => {
    const provider = await startProvider((_request, response) => {
      response.writeHead(404, { 'content-type': 'application/problem+json' });
      response.end(JSON.stringify({ title: 'Missing', detail: 'Customer does not exist.' }));
    });
    const fixture = await createRuntimeFixture(provider.baseUrl);
    const result = await fixture.runtime.callTool('customer_get', { customerId: 'missing' }, { idempotencyKey: 'call-404' });
    assert.equal(result.isError, true);
    assert.equal((result.structuredContent as Record<string, unknown>).category, 'not_found');
    const snapshot = await readDispatchLedgerSnapshot(fixture.ledgerDirectory, fixture.now);
    assert.equal(snapshot.reservations[0]?.state, 'dispatched');
    await provider.close();
  });

  it('releases a reservation when the provider cannot be reached', async () => {
    const fixture = await createRuntimeFixture('http://127.0.0.1:1');
    const result = await fixture.runtime.callTool('customer_get', { customerId: 'network-fail' }, { idempotencyKey: 'call-network' });
    assert.equal(result.isError, true);
    const snapshot = await readDispatchLedgerSnapshot(fixture.ledgerDirectory, fixture.now);
    assert.equal(snapshot.reservations[0]?.state, 'released');
  });

  it('blocks high-risk tools before the network when exact approval is absent', async () => {
    let providerCalls = 0;
    const provider = await startProvider((_request, response) => { providerCalls += 1; response.end('{}'); });
    const fixture = await createRuntimeFixture(provider.baseUrl, true);
    const result = await fixture.runtime.callTool('customer_delete', { customerId: 'customer-42' }, { idempotencyKey: 'call-delete' });
    assert.equal(result.isError, true);
    assert.match(result.content[0]?.text ?? '', /approval/i);
    assert.equal(providerCalls, 0);
    await provider.close();
  });
});

async function createRuntimeFixture(baseUrl: string, highRisk = false) {
  const now = '2026-07-22T18:30:00Z';
  const ledgerDirectory = await mkdtemp(join(tmpdir(), 'foundry-mcp-ledger-'));
  tempDirectories.push(ledgerDirectory);
  const policyKeys = keyPair();
  const dispatchKeys = keyPair();
  const executionKeys = keyPair();
  const toolName = highRisk ? 'customer_delete' : 'customer_get';
  const method = highRisk ? 'DELETE' : 'GET';
  const riskClass = highRisk ? 'R3' : 'R1';
  const contractBundle: ContractBundle = {
    bundle_version: '0.2',
    tools: [{
      id: `tool:${toolName}`, name: toolName, version: '1.0.0', revision: `rev-${toolName}`, title: toolName, description: toolName,
      input_schema: { type: 'object', properties: { customerId: { type: 'string' } }, required: ['customerId'], additionalProperties: false },
      output_schema: { type: 'object', additionalProperties: true },
      annotations: { read_only: !highRisk, destructive: highRisk, idempotent: true, open_world: false },
      effects: { writes: highRisk, external_communication: false, financial: false, credential_change: false, personal_data: true },
      execution: { mode: 'synchronous', task_support: 'forbidden', idempotency: highRisk ? 'required' : 'not_applicable' },
      required_scopes: ['customer:read'], policy_ref: `policy:${toolName}`,
      ...(highRisk ? { approval_ref: `approval:${toolName}` } : {}),
      auth_ref: 'auth:customer-api', extensions: { foundry: { risk_class: riskClass } }
    }],
    auth: [],
    policies: [{ id: `policy:${toolName}`, version: '1.0.0', risk_class: riskClass, default_decision: highRisk ? 'require_confirmation' : 'allow', rules: [] }],
    approvals: highRisk ? [{ id: `approval:${toolName}`, version: '1.0.0', mode: 'chat_explicit', binding: ['subject','client','workspace','tool_id','tool_revision','arguments_hash','risk_summary','nonce'], ttl_seconds: 600, single_use: true }] : [],
    recoveries: [], receipts: [], artifacts: []
  };
  const adapterBundle: ProviderAdapterBundle = {
    artifact_type: 'provider_adapter_bundle', artifact_version: '0.6', source_bundle_version: '0.2',
    adapters: [{
      id: `adapter:${toolName}`, version: '0.6.0', revision: `adapter-rev-${toolName}`, provider_kind: 'http_openapi', tool_id: `tool:${toolName}`, tool_name: toolName, tool_revision: `rev-${toolName}`,
      credential: { auth_ref: 'auth:customer-api', required_scopes: ['customer:read'] },
      request: { method, path_template: '/customers/{customerId}', parameters: [{ argument_name: 'customerId', source_name: 'customerId', location: 'path', required: true, deprecated: false }], body: null, idempotency: { mode: highRisk ? 'required' : 'none', header_name: 'Idempotency-Key' } },
      response: { success: [{ status: '200', content_types: ['application/json'], normalizer: 'json' }], errors: [{ status: '404', content_types: ['application/problem+json'], normalizer: 'json' }], other: [] },
      integrity: { algorithm: 'sha256', digest: `adapter-rev-${toolName}` }
    }],
    summary: { adapter_count: 1, authenticated_count: 1, idempotency_required_count: highRisk ? 1 : 0, body_binding_count: 0, binary_binding_count: 0, skipped_tool_count: 0 }, warnings: [], integrity: { algorithm: 'sha256', digest: 'adapter-bundle' }
  };
  const authBindings: ProviderAuthBindingBundle = {
    artifact_type: 'provider_auth_binding_bundle', artifact_version: '0.7', source_bundle_version: '0.2', source_adapter_artifact_version: '0.6',
    bindings: [{
      id: 'binding:customer', version: '0.7.0', revision: 'binding-rev', auth_ref: 'auth:customer-api', auth_mode: 'oauth2_1', transport: 'http',
      adapter_ids: [`adapter:${toolName}`], tool_ids: [`tool:${toolName}`], required_scopes: ['customer:read'], optional_scopes: [], tenant_resolution: 'required',
      binding_dimensions: ['subject','client','workspace','provider','provider_account','scope_set'], token_passthrough: false,
      audience: { validation_required: true, canonical_resource_uri: 'https://api.example.test', authorization_server: 'https://auth.example.test', pkce_required: true },
      injection: { strategy: 'bearer_token', location: 'header', name: 'Authorization', prefix: 'Bearer', signing_algorithm: null, secret_material_allowed_in_artifact: false },
      integrity: { algorithm: 'sha256', digest: 'binding-rev' }
    }],
    summary: { binding_count: 1, referenced_auth_count: 1, oauth_binding_count: 1, api_key_binding_count: 0, host_managed_binding_count: 0, unreferenced_auth_count: 0 }, warnings: [], integrity: { algorithm: 'sha256', digest: 'bindings' }
  };
  const credentialCatalog: CredentialCatalog = {
    artifact_type: 'credential_catalog', artifact_version: '0.7', accounts: [{
      id: 'account-1', credential_handle: 'credential-handle-1', auth_ref: 'auth:customer-api', provider_ref: 'customer-api', provider_account_ref: 'provider-account-1', subject_ref: 'user-1', client_ref: 'chatgpt-client', workspace_ref: 'workspace-1', mode: 'oauth2_1', status: 'active', granted_scopes: ['customer:read'], audiences: ['https://api.example.test'], expires_at: '2026-07-23T00:00:00Z'
    }]
  };
  const trustStore: RuntimeTrustStore = {
    artifact_type: 'runtime_trust_store', artifact_version: '0.8', keys: [
      { key_id: 'policy-key', algorithm: 'ed25519', purpose: 'policy', status: 'active', public_key_pem: policyKeys.publicKey },
      { key_id: 'dispatch-key', algorithm: 'ed25519', purpose: 'dispatch', status: 'active', public_key_pem: dispatchKeys.publicKey },
      { key_id: 'execution-key', algorithm: 'ed25519', purpose: 'execution', status: 'active', public_key_pem: executionKeys.publicKey }
    ]
  };
  const runtime = createFoundryMcpRuntime({
    contractBundle, adapterBundle, authBindings, credentialCatalog, trustStore, ledgerDirectory, baseUrl,
    context: { subject_ref: 'user-1', client_ref: 'chatgpt-client', workspace_ref: 'workspace-1', provider_ref: 'customer-api', provider_account_ref: 'provider-account-1' },
    policySigner: { keyId: 'policy-key', privateKeyPem: policyKeys.privateKey },
    dispatchSigner: { keyId: 'dispatch-key', privateKeyPem: dispatchKeys.privateKey },
    executionSigner: { keyId: 'execution-key', privateKeyPem: executionKeys.privateKey },
    credentialEnvironment: { 'credential-handle-1': 'CUSTOMER_API_TOKEN' },
    environment: { CUSTOMER_API_TOKEN: 'provider-secret-token' },
    now: () => now,
    timeoutMs: 1_000
  });
  return { runtime, trustStore, ledgerDirectory, now };
}

function keyPair(): { publicKey: string; privateKey: string } {
  const pair = generateKeyPairSync('ed25519');
  return {
    publicKey: String(pair.publicKey.export({ type: 'spki', format: 'pem' })),
    privateKey: String(pair.privateKey.export({ type: 'pkcs8', format: 'pem' }))
  };
}

async function startProvider(handler: Parameters<typeof createServer>[0]): Promise<{ baseUrl: string; close(): Promise<void> }> {
  const server = createServer(handler);
  await new Promise<void>((resolvePromise) => server.listen(0, '127.0.0.1', resolvePromise));
  const address = server.address();
  if (typeof address !== 'object' || address === null) throw new Error('Provider did not bind.');
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolvePromise, reject) => server.close((error) => error ? reject(error) : resolvePromise()))
  };
}
