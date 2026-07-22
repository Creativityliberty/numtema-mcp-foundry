import { type SignatureVerificationResult } from '../runtime/signature-verifier.js';
import type { RuntimeIntegrity, RuntimeSignature, RuntimeTenantBinding, RuntimeTrustStore } from '../runtime/types.js';
import type { SignedDispatchReceipt } from '../dispatch/types.js';
import type { NormalizedProviderResponse } from '../adapters/types.js';
import { type RuntimeSigner } from './signing.js';
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
export declare function createExecutionReceipt(input: CreateExecutionReceiptInput): SignedExecutionReceipt;
export declare function verifyExecutionReceipt(receipt: SignedExecutionReceipt, trustStore: RuntimeTrustStore, at: string): SignatureVerificationResult;
export declare function executionReceiptPayloadDigest(receipt: SignedExecutionReceipt): string;
