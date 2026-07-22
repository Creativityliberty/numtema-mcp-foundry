import type { RuntimeIntegrity, RuntimeSignature, RuntimeTenantBinding } from '../runtime/types.js';
export type DispatchReservationState = 'reserved' | 'dispatched' | 'released';
export type DispatchReleaseReason = 'cancelled' | 'expired';
export type DispatchTransition = 'authorized_to_reserved' | 'reserved_to_dispatched' | 'reserved_to_released';
export type DispatchLedgerEventType = 'reservation_created' | 'dispatch_committed' | 'reservation_released';
export interface DispatchBudgetReservation {
    budget_ref: string;
    currency: string;
    amount: number;
    remaining_before: number;
}
export interface DispatchLedgerMetadata {
    artifact_type: 'dispatch_ledger_metadata';
    artifact_version: '0.9';
    ledger_id: string;
    created_at: string;
    storage: 'append_only_jsonl';
    integrity: RuntimeIntegrity;
}
export interface DispatchLedgerEvent {
    artifact_type: 'dispatch_ledger_event';
    artifact_version: '0.9';
    ledger_id: string;
    sequence: number;
    event_id: string;
    previous_event_digest: string | null;
    event_type: DispatchLedgerEventType;
    reservation_id: string;
    authorization_id: string;
    execution_nonce: string;
    approval_nonce: string | null;
    idempotency_key: string | null;
    envelope_digest: string;
    binding: RuntimeTenantBinding;
    budget: DispatchBudgetReservation | null;
    state_after: DispatchReservationState;
    reason: DispatchReleaseReason | null;
    occurred_at: string;
    expires_at: string | null;
    integrity: RuntimeIntegrity;
}
export interface DispatchReservation {
    artifact_type: 'dispatch_reservation';
    artifact_version: '0.9';
    ledger_id: string;
    sequence: number;
    reservation_id: string;
    authorization_id: string;
    execution_nonce: string;
    approval_nonce: string | null;
    idempotency_key: string | null;
    envelope_digest: string;
    state: DispatchReservationState;
    replayed: boolean;
    reserved_at: string;
    updated_at: string;
    expires_at: string | null;
    terminal_reason: DispatchReleaseReason | null;
    binding: RuntimeTenantBinding;
    budget: DispatchBudgetReservation | null;
    integrity: RuntimeIntegrity;
}
export interface SignedDispatchReceipt {
    artifact_type: 'signed_dispatch_receipt';
    artifact_version: '0.9';
    receipt_id: string;
    ledger_id: string;
    sequence: number;
    reservation_id: string;
    authorization_id: string;
    transition: DispatchTransition;
    state: DispatchReservationState;
    replayed: boolean;
    occurred_at: string;
    binding: RuntimeTenantBinding;
    execution_nonce: string;
    approval_nonce: string | null;
    idempotency_key: string | null;
    budget: DispatchBudgetReservation | null;
    envelope_digest: string;
    ledger_event_digest: string;
    integrity: RuntimeIntegrity;
    signature: RuntimeSignature;
}
export interface DispatchBudgetTotal {
    budget_ref: string;
    currency: string;
    active_amount: number;
    dispatched_amount: number;
    released_amount: number;
}
export interface DispatchLedgerSnapshot {
    artifact_type: 'dispatch_ledger_snapshot';
    artifact_version: '0.9';
    ledger_id: string;
    sequence: number;
    generated_at: string;
    reservations: DispatchReservation[];
    budget_totals: DispatchBudgetTotal[];
    integrity: RuntimeIntegrity;
}
export interface DispatchMutationResult {
    reservation: DispatchReservation;
    receipt: SignedDispatchReceipt;
    replayed: boolean;
}
export interface DispatchSignerInput {
    signingKeyPem: string;
    keyId: string;
}
