import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import type { ProviderAdapterBundle, ProviderAdapterContract } from '../src/adapters/types.js';
import { resolveCredentialPlan } from '../src/auth/credential-resolver.js';
import { compileProviderAuthBindings } from '../src/auth/provider-auth-binding-compiler.js';
import type { CredentialCatalog, CredentialResolutionContext } from '../src/auth/types.js';
import { loadContractBundle } from '../src/contracts/contract-bundle.js';
import { validateValueAgainstSchema } from '../src/validation/schema-validator.js';

function adapterBundle(): ProviderAdapterBundle {
  const adapter: ProviderAdapterContract = {
    id: 'adapter:supplier_search', version: '0.6.0', revision: 'adapter-rev-1', provider_kind: 'http_openapi',
    tool_id: 'tool://procuflow/supplier-search@1', tool_name: 'supplier_search', tool_revision: 'rev-supplier-search-1',
    credential: { auth_ref: 'auth://procuflow/default@1', required_scopes: ['supplier:read'] },
    request: { method: 'GET', path_template: '/suppliers', parameters: [], body: null, idempotency: { mode: 'none', header_name: 'Idempotency-Key' } },
    response: { success: [], errors: [], other: [] }, integrity: { algorithm: 'sha256', digest: 'adapter-rev-1' }
  };
  return {
    artifact_type: 'provider_adapter_bundle', artifact_version: '0.6', source_bundle_version: '0.2', adapters: [adapter],
    summary: { adapter_count: 1, authenticated_count: 1, idempotency_required_count: 0, body_binding_count: 0, binary_binding_count: 0, skipped_tool_count: 0 },
    warnings: [], integrity: { algorithm: 'sha256', digest: 'adapter-bundle-rev' }
  };
}

describe('Sprint 0.7 auth artifact schemas', () => {
  it('validates auth binding bundles, credential catalogs, and resolution plans', async () => {
    const bundle = await loadContractBundle('tests/fixtures/valid-bundle.json');
    const adapters = adapterBundle();
    const bindings = compileProviderAuthBindings(bundle, adapters);
    const bindingSchema = JSON.parse(await readFile('schemas/provider-auth-binding-bundle.schema.json', 'utf8')) as Record<string, unknown>;
    assert.deepEqual(validateValueAgainstSchema(bindingSchema, bindings, 'provider_auth_binding_bundle'), []);

    const catalog: CredentialCatalog = {
      artifact_type: 'credential_catalog', artifact_version: '0.7', accounts: [{
        id: 'credential-001', credential_handle: 'handle-001', auth_ref: 'auth://procuflow/default@1',
        provider_ref: 'procuflow', provider_account_ref: 'account-001', subject_ref: 'user-001',
        client_ref: 'chatgpt', workspace_ref: 'workspace-001', mode: 'oauth2_1', status: 'active',
        granted_scopes: ['supplier:read'], audiences: ['https://mcp.procuflow.example']
      }]
    };
    const catalogSchema = JSON.parse(await readFile('schemas/credential-catalog.schema.json', 'utf8')) as Record<string, unknown>;
    assert.deepEqual(validateValueAgainstSchema(catalogSchema, catalog, 'credential_catalog'), []);

    const context: CredentialResolutionContext = {
      subject_ref: 'user-001', client_ref: 'chatgpt', workspace_ref: 'workspace-001', provider_ref: 'procuflow',
      provider_account_ref: 'account-001', requested_at: '2026-07-22T17:00:00Z'
    };
    const binding = bindings.bindings[0];
    const adapter = adapters.adapters[0];
    assert.ok(binding && adapter);
    const plan = resolveCredentialPlan(binding, adapter, catalog, context);
    const planSchema = JSON.parse(await readFile('schemas/credential-resolution-plan.schema.json', 'utf8')) as Record<string, unknown>;
    assert.deepEqual(validateValueAgainstSchema(planSchema, plan, 'credential_resolution_plan'), []);
  });
});
