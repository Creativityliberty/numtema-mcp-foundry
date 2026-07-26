import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadOpenApiDocument } from '../dist/src/inspection/openapi-loader.js';
import { inspectOpenApi } from '../dist/src/inspection/source-inspector.js';
import { mapCapabilities } from '../dist/src/mapping/capability-mapper.js';
import { compileCapabilityMap } from '../dist/src/compiler/tool-contract-compiler.js';
import { compileProviderAdapters } from '../dist/src/adapters/provider-adapter-compiler.js';
import { compileProviderAuthBindings } from '../dist/src/auth/provider-auth-binding-compiler.js';
import { enrichToolBundle } from '../dist/src/tools/enrichment-engine.js';
import { applyWhatsAppProviderPack, applyWhatsAppAdapterPack } from '../dist/src/providers/whatsapp/provider-pack.js';
import { createFoundryMcpRuntime } from '../dist/src/mcp/server-runtime.js';

function keyPair() {
  const pair = generateKeyPairSync('ed25519');
  return {
    publicKey: String(pair.publicKey.export({ type: 'spki', format: 'pem' })),
    privateKey: String(pair.privateKey.export({ type: 'pkcs8', format: 'pem' }))
  };
}

async function buildPack() {
  const document = await loadOpenApiDocument('providers/whatsapp-cloud-api/openapi.json');
  const inspection = inspectOpenApi(document, 'whatsapp-openapi.json');
  const map = mapCapabilities(inspection);
  const compilation = compileCapabilityMap(map, { version: '1.5.0', auth_id: 'auth:provider', tenant_resolution: 'required' });
  const enriched = applyWhatsAppProviderPack(enrichToolBundle(compilation.bundle));
  const auth = enriched.bundle.auth[0];
  auth.mode = 'bearer';
  auth.canonical_resource_uri = 'https://graph.facebook.com';
  auth.audience_validation = true;
  auth.extensions = { provider_binding: { location: 'header', name: 'Authorization', prefix: 'Bearer' } };
  const adapters = applyWhatsAppAdapterPack(compileProviderAdapters(enriched.bundle));
  const bindings = compileProviderAuthBindings(enriched.bundle, adapters);
  return { bundle: enriched.bundle, adapters, bindings };
}

test('runtime injects Meta identifiers and bearer token without exposing them to model arguments', async () => {
  let seenUrl = '';
  let seenAuthorization = '';
  const server = createServer((request, response) => {
    seenUrl = request.url ?? '';
    seenAuthorization = String(request.headers.authorization ?? '');
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ messaging_product: 'whatsapp', id: 'business-profile' }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const ledgerDirectory = await mkdtemp(join(tmpdir(), 'foundry-whatsapp-ledger-'));
  try {
    const pack = await buildPack();
    const policy = keyPair(); const dispatch = keyPair(); const execution = keyPair();
    const scopes = [...pack.bundle.auth[0].required_scopes];
    const runtime = createFoundryMcpRuntime({
      contractBundle: pack.bundle,
      adapterBundle: pack.adapters,
      authBindings: pack.bindings,
      credentialCatalog: {
        artifact_type: 'credential_catalog', artifact_version: '0.7', accounts: [{
          id: 'wa-account', credential_handle: 'wa-handle', auth_ref: 'auth:provider', provider_ref: 'whatsapp-cloud-api',
          provider_account_ref: 'wa-provider-account', subject_ref: 'user-1', client_ref: 'chatgpt-client', workspace_ref: 'workspace-1',
          mode: 'bearer', status: 'active', granted_scopes: scopes, audiences: ['https://graph.facebook.com']
        }]
      },
      trustStore: { artifact_type: 'runtime_trust_store', artifact_version: '0.8', keys: [
        { key_id: 'policy', algorithm: 'ed25519', purpose: 'policy', status: 'active', public_key_pem: policy.publicKey },
        { key_id: 'dispatch', algorithm: 'ed25519', purpose: 'dispatch', status: 'active', public_key_pem: dispatch.publicKey },
        { key_id: 'execution', algorithm: 'ed25519', purpose: 'execution', status: 'active', public_key_pem: execution.publicKey }
      ]},
      ledgerDirectory,
      baseUrl: `http://127.0.0.1:${address.port}`,
      context: { subject_ref: 'user-1', client_ref: 'chatgpt-client', workspace_ref: 'workspace-1', provider_ref: 'whatsapp-cloud-api', provider_account_ref: 'wa-provider-account' },
      policySigner: { keyId: 'policy', privateKeyPem: policy.privateKey },
      dispatchSigner: { keyId: 'dispatch', privateKeyPem: dispatch.privateKey },
      executionSigner: { keyId: 'execution', privateKeyPem: execution.privateKey },
      credentialEnvironment: { 'wa-handle': 'WHATSAPP_ACCESS_TOKEN' },
      environment: {
        WHATSAPP_ACCESS_TOKEN: 'meta-secret-token',
        WHATSAPP_GRAPH_API_VERSION: 'v23.0',
        WHATSAPP_PHONE_NUMBER_ID: '123456789',
        WHATSAPP_BUSINESS_ACCOUNT_ID: '987654321'
      },
      now: () => '2026-07-26T12:00:00Z'
    });
    const result = await runtime.callTool('whatsapp_business_profile_get', {});
    assert.equal(result.isError, false, JSON.stringify(result));
    assert.equal(seenUrl, '/v23.0/123456789/whatsapp_business_profile');
    assert.equal(seenAuthorization, 'Bearer meta-secret-token');
    assert.doesNotMatch(JSON.stringify(result), /meta-secret-token|123456789/);

    seenUrl = '';
    const send = await runtime.callTool('whatsapp_message_send_text', { to: '33600000000', message: 'Bonjour', preview_url: false });
    assert.equal(send.isError, true);
    assert.equal(send.structuredContent.category, 'approval_required', JSON.stringify(send));
    assert.equal(seenUrl, '', 'send must be blocked before provider network until approved');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(ledgerDirectory, { recursive: true, force: true });
  }
});
