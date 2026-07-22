import type { AuthorizedExecutionEnvelope, RuntimeTrustStore } from '../runtime/types.js';
import { type SignatureVerificationResult } from '../runtime/signature-verifier.js';
import type { DispatchLedgerMetadata, DispatchLedgerSnapshot, DispatchMutationResult, DispatchReleaseReason, DispatchSignerInput, SignedDispatchReceipt } from './types.js';
export interface InitializeDispatchLedgerInput {
    directory: string;
    at: string;
    ledgerId?: string;
}
export interface ReserveDispatchInput extends DispatchSignerInput {
    directory: string;
    envelope: AuthorizedExecutionEnvelope;
    at: string;
    lockTimeoutMs?: number;
}
export interface CommitDispatchInput extends DispatchSignerInput {
    directory: string;
    reservationId: string;
    at: string;
    lockTimeoutMs?: number;
}
export interface ReleaseDispatchInput extends DispatchSignerInput {
    directory: string;
    reservationId: string;
    reason: DispatchReleaseReason;
    at: string;
    lockTimeoutMs?: number;
}
export declare function initializeDispatchLedger(input: InitializeDispatchLedgerInput): Promise<DispatchLedgerMetadata>;
export declare function reserveDispatch(input: ReserveDispatchInput): Promise<DispatchMutationResult>;
export declare function commitDispatch(input: CommitDispatchInput): Promise<DispatchMutationResult>;
export declare function releaseDispatch(input: ReleaseDispatchInput): Promise<DispatchMutationResult>;
export declare function readDispatchLedgerSnapshot(directory: string, generatedAt?: string): Promise<DispatchLedgerSnapshot>;
export declare function verifyDispatchReceipt(receipt: SignedDispatchReceipt, trustStore: RuntimeTrustStore, at: string): SignatureVerificationResult;
