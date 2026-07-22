import type { AuthContract } from '../contracts/types.js';

export type AuthInjectionStrategy =
  | 'none'
  | 'bearer_token'
  | 'api_key'
  | 'basic_auth'
  | 'hmac_signature'
  | 'host_managed';

export type AuthInjectionLocation = 'header' | 'query' | 'cookie' | 'runtime';

export interface ProviderAuthBindingContract {
  id: string;
  version: '0.7.0';
  revision: string;
  auth_ref: string;
  auth_mode: AuthContract['mode'];
  transport: AuthContract['transport'];
  adapter_ids: string[];
  tool_ids: string[];
  required_scopes: string[];
  optional_scopes: string[];
  tenant_resolution: AuthContract['tenant_resolution'];
  binding_dimensions: NonNullable<AuthContract['credential_binding_dimensions']>;
  token_passthrough: false;
  audience: {
    validation_required: boolean;
    canonical_resource_uri: string | null;
    authorization_server: string | null;
    pkce_required: boolean;
  };
  injection: {
    strategy: AuthInjectionStrategy;
    location: AuthInjectionLocation;
    name: string | null;
    prefix: string | null;
    signing_algorithm: string | null;
    secret_material_allowed_in_artifact: false;
  };
  integrity: {
    algorithm: 'sha256';
    digest: string;
  };
}

export interface ProviderAuthBindingBundle {
  artifact_type: 'provider_auth_binding_bundle';
  artifact_version: '0.7';
  source_bundle_version: string;
  source_adapter_artifact_version: string;
  bindings: ProviderAuthBindingContract[];
  summary: {
    binding_count: number;
    referenced_auth_count: number;
    oauth_binding_count: number;
    api_key_binding_count: number;
    host_managed_binding_count: number;
    unreferenced_auth_count: number;
  };
  warnings: Array<{ code: string; message: string; auth_ref?: string }>;
  integrity: {
    algorithm: 'sha256';
    digest: string;
  };
}

export type CredentialAccountStatus = 'active' | 'expired' | 'revoked' | 'disabled';

export interface CredentialAccountDescriptor {
  id: string;
  credential_handle: string;
  auth_ref: string;
  provider_ref: string;
  provider_account_ref: string;
  subject_ref: string;
  client_ref?: string;
  workspace_ref?: string;
  mode: AuthContract['mode'];
  status: CredentialAccountStatus;
  granted_scopes: string[];
  audiences?: string[];
  expires_at?: string;
  secret_locator?: string;
  metadata?: Record<string, unknown>;
}

export interface CredentialCatalog {
  artifact_type: 'credential_catalog';
  artifact_version: '0.7';
  accounts: CredentialAccountDescriptor[];
  integrity?: {
    algorithm: 'sha256';
    digest: string;
  };
}

export interface CredentialResolutionContext {
  subject_ref: string;
  client_ref: string;
  workspace_ref: string;
  provider_ref: string;
  provider_account_ref?: string;
  requested_at: string;
}

export interface CredentialPreflightCheck {
  code: string;
  status: 'pass' | 'fail' | 'not_applicable';
  message: string;
}

export interface CredentialResolutionPlan {
  artifact_type: 'credential_resolution_plan';
  artifact_version: '0.7';
  dry_run: true;
  binding_id: string;
  binding_revision: string;
  adapter_id: string;
  adapter_revision: string;
  tool_id: string;
  tool_revision: string;
  context_hash: string;
  selected_credential: {
    account_id: string;
    credential_handle: string;
    provider_account_ref: string;
    mode: AuthContract['mode'];
    secret_locator_included: false;
    secret_material_included: false;
  } | null;
  checks: CredentialPreflightCheck[];
  scope_check: {
    required: string[];
    granted: string[];
    missing: string[];
  };
  audience_check: {
    required: boolean;
    expected: string | null;
    matched: boolean;
  };
  tenant_check: {
    required_dimensions: string[];
    matched: boolean;
  };
  injection_envelope: {
    strategy: AuthInjectionStrategy;
    location: AuthInjectionLocation;
    name: string | null;
    prefix: string | null;
    signing_algorithm: string | null;
    credential_handle: string | null;
    secret_material_included: false;
  };
  ready: boolean;
  warnings: Array<{ code: string; message: string }>;
  errors: Array<{ code: string; message: string }>;
  integrity: {
    algorithm: 'sha256';
    digest: string;
  };
}
