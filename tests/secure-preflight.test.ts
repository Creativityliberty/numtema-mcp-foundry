import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { describe, it } from 'node:test';
import { authorizeExecution } from '../src/runtime/secure-preflight.js';
import { sha256ArtifactPayload } from '../src/runtime/canonical.js';
import type { ProviderExecutionPlan } from '../src/adapters/types.js';
import type { CredentialResolutionPlan } from '../src/auth/types.js';
import type { ApprovalProof, BudgetAuthorization, RuntimePolicyDecision, RuntimeTrustStore } from '../src/runtime/types.js';

const keys = {
  policy: generateKeyPairSync('ed25519'),
  approval: generateKeyPairSync('ed25519'),
  budget: generateKeyPairSync('ed25519')
};

const trustStore: RuntimeTrustStore = {
  artifact_type: 'runtime_trust_store',
  artifact_version: '0.8',
  keys: (['policy', 'approval', 'budget'] as const).map((purpose) => ({
    key_id: `${purpose}-key`, algorithm: 'ed25519' as const, purpose, status: 'active' as const,
    public_key_pem: keys[purpose].publicKey.export({ type: 'spki', format: 'pem' }).toString()
  }))
};

function seal<T extends object>(value: T, purpose: keyof typeof keys): T & { integrity: { algorithm: 'sha256'; digest: string }; signature: { algorithm: 'ed25519'; key_id: string; value: string } } {
  const digest = sha256ArtifactPayload(value);
  return {
    ...value,
    integrity: { algorithm: 'sha256', digest },
    signature: {
      algorithm: 'ed25519', key_id: `${purpose}-key`,
      value: sign(null, digest, keys[purpose].privateKey).toString('base64')
    }
  };
}

const executionPlan: ProviderExecutionPlan = {
  artifact_type: 'provider_execution_plan', artifact_version: '0.6', dry_run: true,
  adapter_id: 'adapter-payment-refund', adapter_revision: 'adapter-rev-1',
  tool_id: 'tool-payment-refund', tool_revision: 'tool-rev-1', arguments_hash: 'args-hash',
  credential_requirement: { auth_ref: 'auth-provider', required_scopes: ['payment:refund'], secret_material_included: false },
  request: { method: 'POST', url: 'https://api.example.test/payments/pay-1/refund', path: '/payments/pay-1/refund', query: [], headers: [], body: { content_type: 'application/json', encoding: 'json', value: { amount: 25 } } },
  idempotency: { mode: 'required', header_name: 'Idempotency-Key', key_source: 'provided', key: 'operation-123' },
  response_plan: { success_statuses: ['200'], error_statuses: ['400', '401'], other_statuses: [] }, warnings: [],
  integrity: { algorithm: 'sha256', digest: '' }
};

const credentialPlan: CredentialResolutionPlan = {
  artifact_type: 'credential_resolution_plan', artifact_version: '0.7', dry_run: true,
  binding_id: 'auth-binding-1', binding_revision: 'auth-binding-rev-1',
  adapter_id: 'adapter-payment-refund', adapter_revision: 'adapter-rev-1',
  tool_id: 'tool-payment-refund', tool_revision: 'tool-rev-1', context_hash: 'context-hash',
  selected_credential: { account_id: 'account-1', credential_handle: 'credential-handle-1', provider_account_ref: 'provider-account-1', mode: 'oauth2_1', secret_locator_included: false, secret_material_included: false },
  checks: [], scope_check: { required: ['payment:refund'], granted: ['payment:refund'], missing: [] },
  audience_check: { required: true, expected: 'https://api.example.test', matched: true },
  tenant_check: { required_dimensions: ['subject', 'client', 'workspace'], matched: true },
  injection_envelope: { strategy: 'bearer_token', location: 'header', name: 'Authorization', prefix: 'Bearer', signing_algorithm: null, credential_handle: 'credential-handle-1', secret_material_included: false },
  ready: true, warnings: [], errors: [], integrity: { algorithm: 'sha256', digest: '' }
};

executionPlan.integrity.digest = sha256ArtifactPayload(executionPlan);
credentialPlan.integrity.digest = sha256ArtifactPayload(credentialPlan);

function unsigned<T extends object>(value: T): Omit<T, 'integrity' | 'signature'> {
  const copy = { ...value } as Record<string, unknown>;
  delete copy.integrity;
  delete copy.signature;
  return copy as Omit<T, 'integrity' | 'signature'>;
}

function fixtures() {
  const policy = seal({
    artifact_type: 'runtime_policy_decision' as const, artifact_version: '0.8' as const,
    policy_ref: 'policy-payment-refund', decision: 'allow' as const, risk_class: 'R4' as const,
    binding: { tool_id: executionPlan.tool_id, tool_revision: executionPlan.tool_revision, adapter_id: executionPlan.adapter_id, adapter_revision: executionPlan.adapter_revision, arguments_hash: executionPlan.arguments_hash, context_hash: credentialPlan.context_hash },
    subject_ref: 'subject-1', client_ref: 'client-1', workspace_ref: 'workspace-1',
    approval: { required: true, approval_ref: 'approval-payment-refund', mode: 'secure_widget' as const, risk_summary_hash: 'risk-hash' },
    budget: { required: true, currency: 'EUR', estimated_amount: 25, cost_summary_hash: 'cost-hash' },
    evaluated_at: '2026-07-22T16:00:00Z', expires_at: '2026-07-22T16:10:00Z'
  }, 'policy') as RuntimePolicyDecision;

  const approval = seal({
    artifact_type: 'approval_proof' as const, artifact_version: '0.8' as const,
    approval_ref: 'approval-payment-refund', mode: 'secure_widget' as const, approved: true as const, single_use: true as const,
    nonce: 'approval-nonce-1',
    binding: { ...policy.binding, subject_ref: policy.subject_ref, client_ref: policy.client_ref, workspace_ref: policy.workspace_ref },
    risk_summary_hash: 'risk-hash', cost_summary_hash: 'cost-hash',
    issued_at: '2026-07-22T16:00:30Z', expires_at: '2026-07-22T16:05:00Z'
  }, 'approval') as ApprovalProof;

  const budget = seal({
    artifact_type: 'budget_authorization' as const, artifact_version: '0.8' as const,
    budget_ref: 'budget-workspace-1', approved: true as const,
    binding: { ...policy.binding, subject_ref: policy.subject_ref, client_ref: policy.client_ref, workspace_ref: policy.workspace_ref },
    currency: 'EUR', estimated_amount: 25, max_authorized_amount: 50, remaining_before: 100, cost_summary_hash: 'cost-hash',
    issued_at: '2026-07-22T16:00:20Z', expires_at: '2026-07-22T16:05:00Z'
  }, 'budget') as BudgetAuthorization;
  return { policy, approval, budget };
}

describe('Secure Provider Runtime Preflight', () => {
  it('authorizes an exact, signed, budgeted R4 execution without executing the network', () => {
    const { policy, approval, budget } = fixtures();
    const result = authorizeExecution({ executionPlan, credentialPlan, policy, approval, budget, trustStore, at: '2026-07-22T16:01:00Z' });
    assert.equal(result.dispatch_permitted, true);
    assert.equal(result.network_executed, false);
    assert.equal(result.redaction.secret_material_included, false);
    assert.equal(result.execution_plan.request.url, executionPlan.request.url);
    assert.equal(result.credential_plan.selected_credential?.credential_handle, 'credential-handle-1');
    assert.deepEqual(result.errors, []);
  });

  it('blocks policy denial, expired approval, insufficient budget, and context mismatch', () => {
    const denied = fixtures();
    denied.policy = seal({ ...unsigned(denied.policy), decision: 'deny' }, 'policy') as RuntimePolicyDecision;
    assert.equal(authorizeExecution({ executionPlan, credentialPlan, ...denied, trustStore, at: '2026-07-22T16:01:00Z' }).dispatch_permitted, false);

    const expired = fixtures();
    assert.ok(authorizeExecution({ executionPlan, credentialPlan, ...expired, trustStore, at: '2026-07-22T16:06:00Z' }).errors.some((error) => error.code === 'APPROVAL_EXPIRED'));

    const insufficient = fixtures();
    insufficient.budget = seal({ ...unsigned(insufficient.budget), max_authorized_amount: 10 }, 'budget') as BudgetAuthorization;
    assert.ok(authorizeExecution({ executionPlan, credentialPlan, ...insufficient, trustStore, at: '2026-07-22T16:01:00Z' }).errors.some((error) => error.code === 'BUDGET_LIMIT_EXCEEDED'));

    const mismatch = fixtures();
    mismatch.approval = seal({ ...unsigned(mismatch.approval), binding: { ...mismatch.approval.binding, context_hash: 'other-context' } }, 'approval') as ApprovalProof;
    assert.ok(authorizeExecution({ executionPlan, credentialPlan, ...mismatch, trustStore, at: '2026-07-22T16:01:00Z' }).errors.some((error) => error.code === 'APPROVAL_BINDING_MISMATCH'));
  });

  it('blocks missing required proofs, unready credentials, altered signatures, and secret-bearing plans', () => {
    const valid = fixtures();
    assert.ok(authorizeExecution({ executionPlan, credentialPlan, policy: valid.policy, trustStore, at: '2026-07-22T16:01:00Z' }).errors.some((error) => error.code === 'APPROVAL_REQUIRED'));

    const unreadyCredential = { ...credentialPlan, ready: false, errors: [{ code: 'NO_MATCHING_CREDENTIAL', message: 'missing' }] };
    assert.ok(authorizeExecution({ executionPlan, credentialPlan: unreadyCredential, ...valid, trustStore, at: '2026-07-22T16:01:00Z' }).errors.some((error) => error.code === 'CREDENTIAL_PLAN_NOT_READY'));

    const altered = fixtures();
    (altered.approval as unknown as { approved: boolean }).approved = false;
    assert.ok(authorizeExecution({ executionPlan, credentialPlan, ...altered, trustStore, at: '2026-07-22T16:01:00Z' }).errors.some((error) => error.code === 'INTEGRITY_MISMATCH'));

    const secretPlan = JSON.parse(JSON.stringify(executionPlan)) as ProviderExecutionPlan & { request: ProviderExecutionPlan['request'] & { access_token?: string } };
    secretPlan.request.access_token = 'top-secret';
    assert.ok(authorizeExecution({ executionPlan: secretPlan, credentialPlan, ...valid, trustStore, at: '2026-07-22T16:01:00Z' }).errors.some((error) => error.code === 'SECRET_MATERIAL_DETECTED'));
  });

  it('is deterministic for identical inputs', () => {
    const valid = fixtures();
    assert.deepEqual(
      authorizeExecution({ executionPlan, credentialPlan, ...valid, trustStore, at: '2026-07-22T16:01:00Z' }),
      authorizeExecution({ executionPlan, credentialPlan, ...valid, trustStore, at: '2026-07-22T16:01:00Z' })
    );
  });
});
