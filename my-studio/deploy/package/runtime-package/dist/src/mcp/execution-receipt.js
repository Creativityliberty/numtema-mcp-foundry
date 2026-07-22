import { sha256, sha256ArtifactPayload } from '../runtime/canonical.js';
import { verifySignedArtifact } from '../runtime/signature-verifier.js';
import { signArtifact } from './signing.js';
export function createExecutionReceipt(input) {
    const resultPayload = input.normalized ?? { transport_error: input.transportError ?? 'unknown' };
    const started = Date.parse(input.startedAt);
    const completed = Date.parse(input.completedAt);
    const base = {
        artifact_type: 'signed_execution_receipt',
        artifact_version: '1.0',
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
            secret_material_included: false,
            credential_handle_included: false
        }
    };
    return signArtifact(base, input.signer);
}
export function verifyExecutionReceipt(receipt, trustStore, at) {
    return verifySignedArtifact(receipt, trustStore, 'execution', at);
}
export function executionReceiptPayloadDigest(receipt) {
    return sha256ArtifactPayload(receipt);
}
//# sourceMappingURL=execution-receipt.js.map