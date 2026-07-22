import { sha256, sha256ArtifactPayload } from '../runtime/canonical.js';
import { verifySignedArtifact, type SignatureVerificationResult } from '../runtime/signature-verifier.js';
import type { RuntimeIntegrity, RuntimeSignature, RuntimeTenantBinding, RuntimeTrustStore } from '../runtime/types.js';
import type { SignedDispatchReceipt } from '../dispatch/types.js';
import type { NormalizedProviderResponse } from '../adapters/types.js';
import { signArtifact, type RuntimeSigner } from './signing.js';

export type ExecutionReceiptStatus = 'succeeded' | 'provider_error' | 'transport_error';

export interface SignedExecutionReceipt {
  artifact_type: 'signed_execution_receipt';
  artifact_version: '1.0';
  receipt_id: string;
  authorization_id: string;
  reservation_id: string;
  binding: RuntimeTenantBinding;
  status: ExecutionReceiptStatus;
  started_at: string;
  completed_at: string;
  duration_ms: number;
  provider: {
    response_received: boolean;
    http_status: number | null;
    media_type: string | null;
    retryable: boolean;
    result_digest: string;
  };
  dispatch: {
    transition: SignedDispatchReceipt['transition'];
    state: SignedDispatchReceipt['state'];
    receipt_id: string;
    receipt_digest: string;
  };
  redaction: {
    secret_material_included: false;
    credential_handle_included: false;
  };
  integrity: RuntimeIntegrity;
  signature: RuntimeSignature;
}

export interface CreateExecutionReceiptInput {
  authorizationId: string;
  reservationId: string;
  binding: RuntimeTenantBinding;
  status: ExecutionReceiptStatus;
  startedAt: string;
  completedAt: string;
  normalized?: NormalizedProviderResponse;
  transportError?: string;
  dispatchReceipt: SignedDispatchReceipt;
  signer: RuntimeSigner;
}

export function createExecutionReceipt(input: CreateExecutionReceiptInput): SignedExecutionReceipt {
  const resultPayload = input.normalized ?? { transport_error: input.transportError ?? 'unknown' };
  const started = Date.parse(input.startedAt);
  const completed = Date.parse(input.completedAt);
  const base = {
    artifact_type: 'signed_execution_receipt' as const,
    artifact_version: '1.0' as const,
    receipt_id: `exec_${sha256({ authorization_id: input.authorizationId, reservation_id: input.reservationId, completed_at: input.completedAt, result: resultPayload }).slice(0, 32)}`,
    authorization_id: input.authorizationId,
    reservation_id: input.reservationId,
    binding: input.binding,
    status: input.status,
    started_at: input.startedAt,
    completed_at: input.completedAt,
    duration_ms: Number.isNaN(started) || Number.isNaN(completed) ? 0 : Math.max(0, completed - started),
    provider: {
      response_received: input.normalized !== undefined,
      http_status: input.normalized?.status ?? null,
      media_type: input.normalized?.media_type ?? null,
      retryable: input.normalized?.error?.retryable ?? input.status === 'transport_error',
      result_digest: sha256(resultPayload)
    },
    dispatch: {
      transition: input.dispatchReceipt.transition,
      state: input.dispatchReceipt.state,
      receipt_id: input.dispatchReceipt.receipt_id,
      receipt_digest: input.dispatchReceipt.integrity.digest
    },
    redaction: {
      secret_material_included: false as const,
      credential_handle_included: false as const
    }
  };
  return signArtifact(base, input.signer);
}

export function verifyExecutionReceipt(receipt: SignedExecutionReceipt, trustStore: RuntimeTrustStore, at: string): SignatureVerificationResult {
  return verifySignedArtifact(receipt, trustStore, 'execution', at);
}

export function executionReceiptPayloadDigest(receipt: SignedExecutionReceipt): string {
  return sha256ArtifactPayload(receipt);
}
