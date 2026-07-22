import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { describe, it } from 'node:test';
import { canonicalJson, sha256ArtifactPayload } from '../src/runtime/canonical.js';
import { verifySignedArtifact } from '../src/runtime/signature-verifier.js';
import type { RuntimePolicyDecision, RuntimeTrustStore } from '../src/runtime/types.js';

function signedPolicy(purpose: 'policy' | 'approval' = 'policy') {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const base = {
    artifact_type: 'runtime_policy_decision' as const,
    artifact_version: '0.8' as const,
    policy_ref: 'policy-payment-refund',
    decision: 'allow' as const,
    risk_class: 'R4' as const,
    binding: {
      tool_id: 'tool-payment-refund',
      tool_revision: 'tool-rev-1',
      adapter_id: 'adapter-payment-refund',
      adapter_revision: 'adapter-rev-1',
      arguments_hash: 'args-hash',
      context_hash: 'context-hash'
    },
    subject_ref: 'subject-1',
    client_ref: 'client-1',
    workspace_ref: 'workspace-1',
    approval: { required: true, approval_ref: 'approval-payment-refund', mode: 'secure_widget' as const, risk_summary_hash: 'risk-hash' },
    budget: { required: true, currency: 'EUR', estimated_amount: 25, cost_summary_hash: 'cost-hash' },
    evaluated_at: '2026-07-22T16:00:00Z',
    expires_at: '2026-07-22T16:10:00Z'
  };
  const digest = sha256ArtifactPayload(base);
  const signature = sign(null, digest, privateKey).toString('base64');
  const artifact: RuntimePolicyDecision = {
    ...base,
    integrity: { algorithm: 'sha256', digest },
    signature: { algorithm: 'ed25519', key_id: 'runtime-key-1', value: signature }
  };
  const trustStore: RuntimeTrustStore = {
    artifact_type: 'runtime_trust_store',
    artifact_version: '0.8',
    keys: [{
      key_id: 'runtime-key-1',
      algorithm: 'ed25519',
      purpose,
      status: 'active',
      public_key_pem: publicKey.export({ type: 'spki', format: 'pem' }).toString()
    }]
  };
  return { artifact, trustStore };
}

describe('Runtime signature verifier', () => {
  it('verifies canonical digest and Ed25519 signature with the correct key purpose', () => {
    const { artifact, trustStore } = signedPolicy();
    const result = verifySignedArtifact(artifact, trustStore, 'policy', '2026-07-22T16:01:00Z');
    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
    assert.equal(canonicalJson({ b: 2, a: 1 }), '{"a":1,"b":2}');
  });

  it('rejects a modified payload after signature', () => {
    const { artifact, trustStore } = signedPolicy();
    artifact.decision = 'deny';
    const result = verifySignedArtifact(artifact, trustStore, 'policy', '2026-07-22T16:01:00Z');
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((error) => error.code === 'INTEGRITY_MISMATCH'));
  });

  it('rejects an unknown or wrong-purpose key', () => {
    const unknown = signedPolicy();
    unknown.artifact.signature.key_id = 'missing-key';
    assert.ok(verifySignedArtifact(unknown.artifact, unknown.trustStore, 'policy', '2026-07-22T16:01:00Z').errors.some((error) => error.code === 'TRUST_KEY_NOT_FOUND'));

    const wrongPurpose = signedPolicy('approval');
    assert.ok(verifySignedArtifact(wrongPurpose.artifact, wrongPurpose.trustStore, 'policy', '2026-07-22T16:01:00Z').errors.some((error) => error.code === 'TRUST_KEY_PURPOSE_MISMATCH'));
  });
});
