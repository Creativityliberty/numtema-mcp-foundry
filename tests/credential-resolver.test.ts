import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ProviderAdapterContract } from '../src/adapters/types.js';
import { resolveCredentialPlan } from '../src/auth/credential-resolver.js';
import type {
  CredentialCatalog,
  CredentialResolutionContext,
  ProviderAuthBindingContract
} from '../src/auth/types.js';

const binding: ProviderAuthBindingContract = {
  id: 'auth-binding:procuflow-default',
  version: '0.7.0',
  revision: 'binding-rev-1',
  auth_ref: 'auth://procuflow/default@1',
  auth_mode: 'oauth2_1',
  transport: 'http',
  adapter_ids: ['adapter:supplier_search'],
  tool_ids: ['tool://procuflow/supplier-search@1'],
  required_scopes: ['supplier:read'],
  optional_scopes: [],
  tenant_resolution: 'required',
  binding_dimensions: ['provider', 'scope_set', 'subject', 'workspace'],
  token_passthrough: false,
  audience: {
    validation_required: true,
    canonical_resource_uri: 'https://mcp.procuflow.example',
    authorization_server: 'https://auth.procuflow.example',
    pkce_required: true
  },
  injection: {
    strategy: 'bearer_token',
    location: 'header',
    name: 'Authorization',
    prefix: 'Bearer',
    signing_algorithm: null,
    secret_material_allowed_in_artifact: false
  },
  integrity: { algorithm: 'sha256', digest: 'binding-rev-1' }
};

const adapter: ProviderAdapterContract = {
  id: 'adapter:supplier_search',
  version: '0.6.0',
  revision: 'adapter-rev-1',
  provider_kind: 'http_openapi',
  tool_id: 'tool://procuflow/supplier-search@1',
  tool_name: 'supplier_search',
  tool_revision: 'tool-rev-1',
  credential: { auth_ref: 'auth://procuflow/default@1', required_scopes: ['supplier:read'] },
  request: {
    method: 'GET', path_template: '/suppliers', parameters: [], body: null,
    idempotency: { mode: 'none', header_name: 'Idempotency-Key' }
  },
  response: { success: [], errors: [], other: [] },
  integrity: { algorithm: 'sha256', digest: 'adapter-rev-1' }
};

const context: CredentialResolutionContext = {
  subject_ref: 'user-001',
  client_ref: 'chatgpt-client',
  workspace_ref: 'workspace-001',
  provider_ref: 'procuflow',
  provider_account_ref: 'account-001',
  requested_at: '2026-07-22T17:00:00Z'
};

function catalog(overrides: Partial<CredentialCatalog['accounts'][number]> = {}): CredentialCatalog {
  return {
    artifact_type: 'credential_catalog',
    artifact_version: '0.7',
    accounts: [{
      id: 'credential-account-001',
      credential_handle: 'credential-handle-001',
      auth_ref: 'auth://procuflow/default@1',
      provider_ref: 'procuflow',
      provider_account_ref: 'account-001',
      subject_ref: 'user-001',
      client_ref: 'chatgpt-client',
      workspace_ref: 'workspace-001',
      mode: 'oauth2_1',
      status: 'active',
      granted_scopes: ['supplier:read', 'supplier:write'],
      audiences: ['https://mcp.procuflow.example'],
      expires_at: '2026-07-23T17:00:00Z',
      secret_locator: 'vault://procuflow/credential-account-001',
      ...overrides
    }]
  };
}

describe('Credential Resolver', () => {
  it('selects a deterministic matching credential and emits only a redacted injection envelope', () => {
    const result = resolveCredentialPlan(binding, adapter, catalog(), context);
    assert.equal(result.ready, true);
    assert.equal(result.selected_credential?.account_id, 'credential-account-001');
    assert.equal(result.selected_credential?.credential_handle, 'credential-handle-001');
    assert.equal(result.selected_credential?.secret_locator_included, false);
    assert.equal(result.selected_credential?.secret_material_included, false);
    assert.equal(result.injection_envelope.credential_handle, 'credential-handle-001');
    assert.equal(result.injection_envelope.secret_material_included, false);
    assert.deepEqual(result.scope_check.missing, []);
    assert.equal(result.audience_check.matched, true);
    assert.equal(JSON.stringify(result).includes('vault://'), false);
  });

  it('fails closed when required scopes are missing', () => {
    const result = resolveCredentialPlan(binding, adapter, catalog({ granted_scopes: [] }), context);
    assert.equal(result.ready, false);
    assert.deepEqual(result.scope_check.missing, ['supplier:read']);
    assert.ok(result.errors.some((error) => error.code === 'INSUFFICIENT_SCOPES'));
  });

  it('fails closed on OAuth audience mismatch', () => {
    const result = resolveCredentialPlan(binding, adapter, catalog({ audiences: ['https://wrong.example'] }), context);
    assert.equal(result.ready, false);
    assert.equal(result.audience_check.matched, false);
    assert.ok(result.errors.some((error) => error.code === 'AUDIENCE_MISMATCH'));
  });

  it('does not cross subject or workspace tenant boundaries', () => {
    const result = resolveCredentialPlan(binding, adapter, catalog({ workspace_ref: 'workspace-other' }), context);
    assert.equal(result.ready, false);
    assert.equal(result.selected_credential, null);
    assert.ok(result.errors.some((error) => error.code === 'NO_MATCHING_CREDENTIAL'));
  });

  it('rejects inactive or expired credentials', () => {
    const revoked = resolveCredentialPlan(binding, adapter, catalog({ status: 'revoked' }), context);
    assert.equal(revoked.ready, false);
    assert.ok(revoked.errors.some((error) => error.code === 'NO_MATCHING_CREDENTIAL'));

    const expired = resolveCredentialPlan(binding, adapter, catalog({ expires_at: '2026-07-21T17:00:00Z' }), context);
    assert.equal(expired.ready, false);
    assert.ok(expired.errors.some((error) => error.code === 'NO_MATCHING_CREDENTIAL'));
  });

  it('is deterministic for identical inputs', () => {
    assert.deepEqual(
      resolveCredentialPlan(binding, adapter, catalog(), context),
      resolveCredentialPlan(binding, adapter, catalog(), context)
    );
  });
});
