import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ProviderAdapterBundle } from '../src/adapters/types.js';
import { compileProviderAuthBindings } from '../src/auth/provider-auth-binding-compiler.js';
import { loadContractBundle } from '../src/contracts/contract-bundle.js';

function adapterBundle(): ProviderAdapterBundle {
  return {
    artifact_type: 'provider_adapter_bundle',
    artifact_version: '0.6',
    source_bundle_version: '0.2',
    adapters: [{
      id: 'adapter:supplier_search',
      version: '0.6.0',
      revision: 'adapter-rev-1',
      provider_kind: 'http_openapi',
      tool_id: 'tool://procuflow/supplier-search@1',
      tool_name: 'supplier_search',
      tool_revision: 'rev-supplier-search-1',
      credential: {
        auth_ref: 'auth://procuflow/default@1',
        required_scopes: ['supplier:read']
      },
      request: {
        method: 'GET',
        path_template: '/suppliers',
        parameters: [],
        body: null,
        idempotency: { mode: 'none', header_name: 'Idempotency-Key' }
      },
      response: { success: [], errors: [], other: [] },
      integrity: { algorithm: 'sha256', digest: 'adapter-rev-1' }
    }],
    summary: {
      adapter_count: 1,
      authenticated_count: 1,
      idempotency_required_count: 0,
      body_binding_count: 0,
      binary_binding_count: 0,
      skipped_tool_count: 0
    },
    warnings: [],
    integrity: { algorithm: 'sha256', digest: 'bundle-rev-1' }
  };
}

describe('Provider Auth Binding Compiler', () => {
  it('compiles OAuth audience, scopes, dimensions, and bearer injection without secrets', async () => {
    const bundle = await loadContractBundle('tests/fixtures/valid-bundle.json');
    const result = compileProviderAuthBindings(bundle, adapterBundle());
    assert.equal(result.artifact_type, 'provider_auth_binding_bundle');
    assert.equal(result.bindings.length, 1);
    const binding = result.bindings[0];
    assert.ok(binding);
    assert.equal(binding.auth_mode, 'oauth2_1');
    assert.equal(binding.injection.strategy, 'bearer_token');
    assert.equal(binding.injection.name, 'Authorization');
    assert.equal(binding.injection.prefix, 'Bearer');
    assert.equal(binding.injection.secret_material_allowed_in_artifact, false);
    assert.equal(binding.audience.validation_required, true);
    assert.equal(binding.audience.canonical_resource_uri, 'https://mcp.procuflow.example');
    assert.deepEqual(binding.required_scopes, ['supplier:read']);
    assert.deepEqual(binding.binding_dimensions, ['provider', 'scope_set', 'subject', 'workspace']);
    assert.deepEqual(binding.adapter_ids, ['adapter:supplier_search']);
  });

  it('maps API key provider extensions into a redacted injection contract', async () => {
    const bundle = await loadContractBundle('tests/fixtures/valid-bundle.json');
    bundle.auth[0] = {
      id: 'auth://procuflow/default@1',
      version: '0.7.0',
      transport: 'http',
      mode: 'api_key',
      required_scopes: ['supplier:read'],
      tenant_resolution: 'required',
      credential_binding_dimensions: ['subject', 'workspace', 'provider', 'scope_set'],
      token_passthrough: false,
      extensions: {
        provider_binding: { location: 'header', name: 'X-Procuflow-Key', prefix: 'Key' }
      }
    };
    const binding = compileProviderAuthBindings(bundle, adapterBundle()).bindings[0];
    assert.ok(binding);
    assert.equal(binding.injection.strategy, 'api_key');
    assert.equal(binding.injection.location, 'header');
    assert.equal(binding.injection.name, 'X-Procuflow-Key');
    assert.equal(binding.injection.prefix, 'Key');
  });

  it('is deterministic for identical inputs', async () => {
    const bundle = await loadContractBundle('tests/fixtures/valid-bundle.json');
    assert.deepEqual(
      compileProviderAuthBindings(bundle, adapterBundle()),
      compileProviderAuthBindings(bundle, adapterBundle())
    );
  });
});
