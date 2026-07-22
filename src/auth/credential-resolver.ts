import { createHash } from 'node:crypto';
import type { ProviderAdapterContract } from '../adapters/types.js';
import type {
  CredentialAccountDescriptor,
  CredentialCatalog,
  CredentialPreflightCheck,
  CredentialResolutionContext,
  CredentialResolutionPlan,
  ProviderAuthBindingContract
} from './types.js';

export function resolveCredentialPlan(
  binding: ProviderAuthBindingContract,
  adapter: ProviderAdapterContract,
  catalog: CredentialCatalog,
  context: CredentialResolutionContext
): CredentialResolutionPlan {
  const checks: CredentialPreflightCheck[] = [];
  const errors: CredentialResolutionPlan['errors'] = [];
  const warnings: CredentialResolutionPlan['warnings'] = [];
  const requestedAt = Date.parse(context.requested_at);
  if (Number.isNaN(requestedAt)) {
    errors.push({ code: 'INVALID_REQUESTED_AT', message: 'requested_at must be a valid RFC 3339 timestamp.' });
  }

  const candidates = catalog.accounts
    .filter((account) => account.auth_ref === binding.auth_ref)
    .filter((account) => account.mode === binding.auth_mode)
    .filter((account) => account.status === 'active')
    .filter((account) => account.provider_ref === context.provider_ref)
    .filter((account) => matchesDimension('subject', binding, account.subject_ref, context.subject_ref))
    .filter((account) => matchesDimension('client', binding, account.client_ref, context.client_ref))
    .filter((account) => matchesDimension('workspace', binding, account.workspace_ref, context.workspace_ref))
    .filter((account) => context.provider_account_ref === undefined || account.provider_account_ref === context.provider_account_ref)
    .filter((account) => !isExpired(account, requestedAt))
    .sort((left, right) => left.id.localeCompare(right.id));

  const selected = candidates[0] ?? null;
  const requiredScopes = uniqueSorted([...binding.required_scopes, ...adapter.credential.required_scopes]);
  const grantedScopes = uniqueSorted(selected?.granted_scopes ?? []);
  const missingScopes = requiredScopes.filter((scope) => !grantedScopes.includes(scope));
  const expectedAudience = binding.audience.canonical_resource_uri;
  const audienceRequired = binding.audience.validation_required;
  const audienceMatched = !audienceRequired || (selected !== null && expectedAudience !== null && (selected.audiences ?? []).includes(expectedAudience));
  const tenantMatched = selected !== null;

  checks.push({
    code: 'TOKEN_PASSTHROUGH_FORBIDDEN',
    status: binding.token_passthrough === false ? 'pass' : 'fail',
    message: 'Provider credentials are resolved independently; incoming client tokens are never forwarded.'
  });
  checks.push({
    code: 'CREDENTIAL_ACCOUNT_MATCH',
    status: selected === null ? 'fail' : 'pass',
    message: selected === null ? 'No active credential account matches the binding context.' : `Matched credential account ${selected.id}.`
  });
  checks.push({
    code: 'SCOPE_COVERAGE',
    status: selected === null ? 'not_applicable' : missingScopes.length === 0 ? 'pass' : 'fail',
    message: selected === null
      ? 'Scope coverage cannot be checked without a matching credential.'
      : missingScopes.length === 0
        ? 'Credential grants every required scope.'
        : `Credential is missing scopes: ${missingScopes.join(', ')}.`
  });
  checks.push({
    code: 'AUDIENCE_VALIDATION',
    status: !audienceRequired ? 'not_applicable' : audienceMatched ? 'pass' : 'fail',
    message: !audienceRequired
      ? 'Audience validation is not required by this AuthContract.'
      : audienceMatched
        ? `Credential audience matches ${expectedAudience}.`
        : `Credential audience does not match ${expectedAudience ?? 'the required resource URI'}.`
  });
  checks.push({
    code: 'TENANT_BINDING',
    status: binding.tenant_resolution === 'none' ? 'not_applicable' : tenantMatched ? 'pass' : 'fail',
    message: binding.tenant_resolution === 'none'
      ? 'Tenant resolution is disabled for this binding.'
      : tenantMatched
        ? 'Credential matches the required tenant dimensions.'
        : 'No credential matches the required tenant dimensions.'
  });

  if (selected === null) errors.push({ code: 'NO_MATCHING_CREDENTIAL', message: 'No active, unexpired credential matches the requested subject, client, workspace, provider, and provider account.' });
  if (selected !== null && missingScopes.length > 0) errors.push({ code: 'INSUFFICIENT_SCOPES', message: `Missing scopes: ${missingScopes.join(', ')}.` });
  if (selected !== null && !audienceMatched) errors.push({ code: 'AUDIENCE_MISMATCH', message: `Credential is not valid for audience ${expectedAudience ?? 'unknown'}.` });
  if (binding.auth_mode === 'host_managed') warnings.push({ code: 'HOST_MANAGED_RESOLUTION', message: 'The host must resolve and inject credential material at execution time.' });

  const contextHash = sha256(context);
  const planBase = {
    artifact_type: 'credential_resolution_plan' as const,
    artifact_version: '0.7' as const,
    dry_run: true as const,
    binding_id: binding.id,
    binding_revision: binding.revision,
    adapter_id: adapter.id,
    adapter_revision: adapter.revision,
    tool_id: adapter.tool_id,
    tool_revision: adapter.tool_revision,
    context_hash: contextHash,
    selected_credential: selected === null ? null : {
      account_id: selected.id,
      credential_handle: selected.credential_handle,
      provider_account_ref: selected.provider_account_ref,
      mode: selected.mode,
      secret_locator_included: false as const,
      secret_material_included: false as const
    },
    checks,
    scope_check: {
      required: requiredScopes,
      granted: grantedScopes,
      missing: missingScopes
    },
    audience_check: {
      required: audienceRequired,
      expected: expectedAudience,
      matched: audienceMatched
    },
    tenant_check: {
      required_dimensions: [...binding.binding_dimensions].sort(),
      matched: binding.tenant_resolution === 'none' || tenantMatched
    },
    injection_envelope: {
      strategy: binding.injection.strategy,
      location: binding.injection.location,
      name: binding.injection.name,
      prefix: binding.injection.prefix,
      signing_algorithm: binding.injection.signing_algorithm,
      credential_handle: selected?.credential_handle ?? null,
      secret_material_included: false as const
    },
    ready: errors.length === 0,
    warnings,
    errors
  };
  const digest = sha256(planBase);
  return {
    ...planBase,
    integrity: { algorithm: 'sha256', digest }
  };
}

function matchesDimension(
  dimension: 'subject' | 'client' | 'workspace',
  binding: ProviderAuthBindingContract,
  accountValue: string | undefined,
  contextValue: string
): boolean {
  if (!binding.binding_dimensions.includes(dimension)) return true;
  return accountValue === contextValue;
}

function isExpired(account: CredentialAccountDescriptor, requestedAt: number): boolean {
  if (account.expires_at === undefined) return false;
  const expiry = Date.parse(account.expires_at);
  return Number.isNaN(expiry) || expiry <= requestedAt;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function sha256(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])]));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
