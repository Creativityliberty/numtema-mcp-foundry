import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import { validateValueAgainstSchema } from '../src/validation/schema-validator.js';
import { authorizeExecution } from '../src/runtime/secure-preflight.js';
import type { ApprovalProof, BudgetAuthorization, RuntimePolicyDecision, RuntimeTrustStore } from '../src/runtime/types.js';
import type { ProviderExecutionPlan } from '../src/adapters/types.js';
import type { CredentialResolutionPlan } from '../src/auth/types.js';

async function schema(name: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(`schemas/${name}`, 'utf8')) as Record<string, unknown>;
}

const binding = { tool_id: 'tool-1', tool_revision: 'rev-1', adapter_id: 'adapter-1', adapter_revision: 'adapter-rev-1', arguments_hash: 'args', context_hash: 'context' };
const signature = { algorithm: 'ed25519' as const, key_id: 'key-1', value: 'signature' };
const integrity = { algorithm: 'sha256' as const, digest: 'digest' };

const policy: RuntimePolicyDecision = {
  artifact_type: 'runtime_policy_decision', artifact_version: '0.8', policy_ref: 'policy-1', decision: 'allow', risk_class: 'R2', binding,
  subject_ref: 'subject-1', client_ref: 'client-1', workspace_ref: 'workspace-1',
  approval: { required: false, approval_ref: null, mode: null, risk_summary_hash: null },
  budget: { required: false, currency: null, estimated_amount: null, cost_summary_hash: null },
  evaluated_at: '2026-07-22T16:00:00Z', expires_at: '2026-07-22T16:10:00Z', integrity, signature
};
const approval: ApprovalProof = {
  artifact_type: 'approval_proof', artifact_version: '0.8', approval_ref: 'approval-1', mode: 'chat_explicit', approved: true, single_use: true, nonce: 'nonce-1',
  binding: { ...binding, subject_ref: 'subject-1', client_ref: 'client-1', workspace_ref: 'workspace-1' }, risk_summary_hash: 'risk', cost_summary_hash: null,
  issued_at: '2026-07-22T16:00:00Z', expires_at: '2026-07-22T16:10:00Z', integrity, signature
};
const budget: BudgetAuthorization = {
  artifact_type: 'budget_authorization', artifact_version: '0.8', budget_ref: 'budget-1', approved: true,
  binding: { ...binding, subject_ref: 'subject-1', client_ref: 'client-1', workspace_ref: 'workspace-1' }, currency: 'EUR', estimated_amount: 1, max_authorized_amount: 2, remaining_before: 3, cost_summary_hash: 'cost',
  issued_at: '2026-07-22T16:00:00Z', expires_at: '2026-07-22T16:10:00Z', integrity, signature
};
const trustStore: RuntimeTrustStore = { artifact_type: 'runtime_trust_store', artifact_version: '0.8', keys: [{ key_id: 'key-1', algorithm: 'ed25519', purpose: 'policy', status: 'active', public_key_pem: '-----BEGIN PUBLIC KEY-----\nkey\n-----END PUBLIC KEY-----' }] };

describe('Sprint 0.8 runtime artifact schemas', () => {
  it('validates policy, approval, budget, trust store, and authorized envelope shapes', async () => {
    assert.deepEqual(validateValueAgainstSchema(await schema('runtime-policy-decision.schema.json'), policy, 'runtime_policy_decision'), []);
    assert.deepEqual(validateValueAgainstSchema(await schema('approval-proof.schema.json'), approval, 'approval_proof'), []);
    assert.deepEqual(validateValueAgainstSchema(await schema('budget-authorization.schema.json'), budget, 'budget_authorization'), []);
    assert.deepEqual(validateValueAgainstSchema(await schema('runtime-trust-store.schema.json'), trustStore, 'runtime_trust_store'), []);

    const executionPlan = { artifact_type: 'provider_execution_plan', artifact_version: '0.6', dry_run: true, adapter_id: 'adapter-1', adapter_revision: 'adapter-rev-1', tool_id: 'tool-1', tool_revision: 'rev-1', arguments_hash: 'args', credential_requirement: { auth_ref: null, required_scopes: [], secret_material_included: false }, request: { method: 'GET', url: 'https://example.test', path: '/', query: [], headers: [], body: null }, idempotency: { mode: 'none', header_name: 'Idempotency-Key', key_source: 'none', key: null }, response_plan: { success_statuses: ['200'], error_statuses: [], other_statuses: [] }, warnings: [], integrity: { algorithm: 'sha256', digest: '' } } as ProviderExecutionPlan;
    const credentialPlan = { artifact_type: 'credential_resolution_plan', artifact_version: '0.7', dry_run: true, binding_id: 'binding-1', binding_revision: 'binding-rev-1', adapter_id: 'adapter-1', adapter_revision: 'adapter-rev-1', tool_id: 'tool-1', tool_revision: 'rev-1', context_hash: 'context', selected_credential: null, checks: [], scope_check: { required: [], granted: [], missing: [] }, audience_check: { required: false, expected: null, matched: true }, tenant_check: { required_dimensions: [], matched: true }, injection_envelope: { strategy: 'none', location: 'runtime', name: null, prefix: null, signing_algorithm: null, credential_handle: null, secret_material_included: false }, ready: true, warnings: [], errors: [], integrity: { algorithm: 'sha256', digest: '' } } as CredentialResolutionPlan;
    const envelope = authorizeExecution({ executionPlan, credentialPlan, policy, trustStore, at: '2026-07-22T16:01:00Z' });
    assert.deepEqual(validateValueAgainstSchema(await schema('authorized-execution-envelope.schema.json'), envelope, 'authorized_execution_envelope'), []);
  });
});
