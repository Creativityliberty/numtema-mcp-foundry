import { createPrivateKey, sign } from 'node:crypto';
import { mkdir, open, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { AuthorizedExecutionEnvelope, RuntimeTrustStore } from '../runtime/types.js';
import { canonicalJson, sha256, sha256ArtifactPayload } from '../runtime/canonical.js';
import { verifySignedArtifact, type SignatureVerificationResult } from '../runtime/signature-verifier.js';
import type {
  DispatchBudgetReservation,
  DispatchBudgetTotal,
  DispatchLedgerEvent,
  DispatchLedgerMetadata,
  DispatchLedgerSnapshot,
  DispatchMutationResult,
  DispatchReleaseReason,
  DispatchReservation,
  DispatchReservationState,
  DispatchSignerInput,
  DispatchTransition,
  SignedDispatchReceipt
} from './types.js';

const METADATA_FILE = 'ledger.meta.json';
const EVENTS_FILE = 'events.jsonl';
const LOCK_DIRECTORY = '.dispatch-lock';

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

interface ReservationRecord {
  creation: DispatchLedgerEvent;
  latest: DispatchLedgerEvent;
  state: DispatchReservationState;
}

interface DerivedLedgerState {
  metadata: DispatchLedgerMetadata;
  events: DispatchLedgerEvent[];
  reservations: Map<string, ReservationRecord>;
}

export async function initializeDispatchLedger(input: InitializeDispatchLedgerInput): Promise<DispatchLedgerMetadata> {
  assertDateTime(input.at, 'INVALID_LEDGER_TIME');
  const directory = resolve(input.directory);
  await mkdir(directory, { recursive: true });
  return withLedgerLock(directory, 5_000, async () => {
    const metadataPath = join(directory, METADATA_FILE);
    try {
      return await loadMetadata(directory);
    } catch (error) {
      if (!hasCode(error, 'ENOENT')) throw error;
    }
    const base = {
      artifact_type: 'dispatch_ledger_metadata' as const,
      artifact_version: '0.9' as const,
      ledger_id: input.ledgerId ?? `ledger_${sha256({ directory, created_at: input.at }).slice(0, 24)}`,
      created_at: input.at,
      storage: 'append_only_jsonl' as const
    };
    const metadata: DispatchLedgerMetadata = { ...base, integrity: { algorithm: 'sha256', digest: sha256ArtifactPayload(base) } };
    await writeAtomicJson(metadataPath, metadata);
    await ensureFile(join(directory, EVENTS_FILE));
    return metadata;
  });
}

export async function reserveDispatch(input: ReserveDispatchInput): Promise<DispatchMutationResult> {
  validateAuthorizedEnvelope(input.envelope, input.at);
  const directory = resolve(input.directory);
  const timeout = input.lockTimeoutMs ?? 5_000;
  return withLedgerLock(directory, timeout, async () => {
    const state = await loadLedgerState(directory);
    const envelope = input.envelope;
    const envelopeDigest = envelope.integrity.digest;
    const idempotencyKey = envelope.execution_plan.idempotency.key;

    const sameKey = idempotencyKey === null
      ? undefined
      : [...state.reservations.values()].find((record) => record.creation.idempotency_key === idempotencyKey);
    if (sameKey !== undefined) {
      if (sameKey.creation.envelope_digest !== envelopeDigest) throw new Error('IDEMPOTENCY_CONFLICT: key is already bound to a different authorized envelope.');
      if (sameKey.state !== 'reserved') throw new Error('AUTHORIZATION_ALREADY_TERMINAL: exact authorization already reached a terminal dispatch state.');
      const reservation = reservationFromRecord(state.metadata.ledger_id, sameKey, true);
      return {
        reservation,
        receipt: signReceipt(sameKey.creation, reservation, 'authorized_to_reserved', true, input),
        replayed: true
      };
    }

    for (const record of state.reservations.values()) {
      if (record.creation.execution_nonce === envelope.execution_nonce) throw new Error('NONCE_ALREADY_CONSUMED: execution nonce is permanently single-use.');
      if (envelope.approval.nonce !== null && record.creation.approval_nonce === envelope.approval.nonce) {
        throw new Error('APPROVAL_NONCE_ALREADY_CONSUMED: approval nonce is permanently single-use.');
      }
      if (record.creation.authorization_id === envelope.authorization_id) throw new Error('AUTHORIZATION_ALREADY_RESERVED: authorization id already exists in the ledger.');
    }

    const budget = budgetFromEnvelope(envelope);
    if (budget !== null) ensureBudgetAvailable(state, budget);

    const sequence = state.events.length + 1;
    const previousDigest = state.events.at(-1)?.integrity.digest ?? null;
    const reservationId = `res_${sha256({ ledger_id: state.metadata.ledger_id, authorization_id: envelope.authorization_id, execution_nonce: envelope.execution_nonce }).slice(0, 32)}`;
    const event = createEvent({
      ledgerId: state.metadata.ledger_id,
      sequence,
      previousDigest,
      eventType: 'reservation_created',
      reservationId,
      authorizationId: envelope.authorization_id,
      executionNonce: envelope.execution_nonce,
      approvalNonce: envelope.approval.nonce,
      idempotencyKey,
      envelopeDigest,
      binding: envelope.binding,
      budget,
      stateAfter: 'reserved',
      reason: null,
      occurredAt: input.at,
      expiresAt: envelope.expires_at
    });
    await appendEvent(directory, event);
    const record: ReservationRecord = { creation: event, latest: event, state: 'reserved' };
    const reservation = reservationFromRecord(state.metadata.ledger_id, record, false);
    return {
      reservation,
      receipt: signReceipt(event, reservation, 'authorized_to_reserved', false, input),
      replayed: false
    };
  });
}

export async function commitDispatch(input: CommitDispatchInput): Promise<DispatchMutationResult> {
  assertDateTime(input.at, 'INVALID_DISPATCH_TIME');
  const directory = resolve(input.directory);
  return withLedgerLock(directory, input.lockTimeoutMs ?? 5_000, async () => {
    const state = await loadLedgerState(directory);
    const record = requireReservation(state, input.reservationId);
    if (record.state === 'dispatched') {
      const event = record.latest;
      const reservation = reservationFromRecord(state.metadata.ledger_id, record, true);
      return { reservation, receipt: signReceipt(event, reservation, 'reserved_to_dispatched', true, input), replayed: true };
    }
    if (record.state !== 'reserved') throw new Error('INVALID_DISPATCH_TRANSITION: only a reserved authorization may be dispatched.');
    if (record.creation.expires_at !== null && Date.parse(input.at) >= Date.parse(record.creation.expires_at)) {
      throw new Error('RESERVATION_EXPIRED: release the reservation as expired before any dispatch.');
    }
    const event = createTransitionEvent(state, record, 'dispatch_committed', 'dispatched', null, input.at);
    await appendEvent(directory, event);
    const updated: ReservationRecord = { creation: record.creation, latest: event, state: 'dispatched' };
    const reservation = reservationFromRecord(state.metadata.ledger_id, updated, false);
    return { reservation, receipt: signReceipt(event, reservation, 'reserved_to_dispatched', false, input), replayed: false };
  });
}

export async function releaseDispatch(input: ReleaseDispatchInput): Promise<DispatchMutationResult> {
  assertDateTime(input.at, 'INVALID_RELEASE_TIME');
  const directory = resolve(input.directory);
  return withLedgerLock(directory, input.lockTimeoutMs ?? 5_000, async () => {
    const state = await loadLedgerState(directory);
    const record = requireReservation(state, input.reservationId);
    if (record.state === 'released') {
      if (record.latest.reason !== input.reason) throw new Error('INVALID_DISPATCH_TRANSITION: reservation was released for a different reason.');
      const reservation = reservationFromRecord(state.metadata.ledger_id, record, true);
      return { reservation, receipt: signReceipt(record.latest, reservation, 'reserved_to_released', true, input), replayed: true };
    }
    if (record.state !== 'reserved') throw new Error('INVALID_DISPATCH_TRANSITION: only a reserved authorization may be released.');
    if (input.reason === 'expired' && (record.creation.expires_at === null || Date.parse(input.at) < Date.parse(record.creation.expires_at))) {
      throw new Error('RESERVATION_NOT_EXPIRED: expired release requires the reservation expiry to have passed.');
    }
    const event = createTransitionEvent(state, record, 'reservation_released', 'released', input.reason, input.at);
    await appendEvent(directory, event);
    const updated: ReservationRecord = { creation: record.creation, latest: event, state: 'released' };
    const reservation = reservationFromRecord(state.metadata.ledger_id, updated, false);
    return { reservation, receipt: signReceipt(event, reservation, 'reserved_to_released', false, input), replayed: false };
  });
}

export async function readDispatchLedgerSnapshot(directory: string, generatedAt?: string): Promise<DispatchLedgerSnapshot> {
  const state = await loadLedgerState(resolve(directory));
  const at = generatedAt ?? state.events.at(-1)?.occurred_at ?? state.metadata.created_at;
  const reservations = [...state.reservations.values()]
    .map((record) => reservationFromRecord(state.metadata.ledger_id, record, false))
    .sort((left, right) => left.sequence - right.sequence);
  const budgetTotals = buildBudgetTotals(reservations);
  const base = {
    artifact_type: 'dispatch_ledger_snapshot' as const,
    artifact_version: '0.9' as const,
    ledger_id: state.metadata.ledger_id,
    sequence: state.events.length,
    generated_at: at,
    reservations,
    budget_totals: budgetTotals
  };
  return { ...base, integrity: { algorithm: 'sha256', digest: sha256ArtifactPayload(base) } };
}

export function verifyDispatchReceipt(receipt: SignedDispatchReceipt, trustStore: RuntimeTrustStore, at: string): SignatureVerificationResult {
  return verifySignedArtifact(receipt, trustStore, 'dispatch', at);
}

async function loadLedgerState(directory: string): Promise<DerivedLedgerState> {
  const metadata = await loadMetadata(directory);
  const source = await readFile(join(directory, EVENTS_FILE), 'utf8');
  const lines = source.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const events: DispatchLedgerEvent[] = [];
  let previousDigest: string | null = null;
  for (let index = 0; index < lines.length; index += 1) {
    const parsed = JSON.parse(lines[index]!) as DispatchLedgerEvent;
    if (parsed.artifact_type !== 'dispatch_ledger_event' || parsed.artifact_version !== '0.9') throw new Error(`LEDGER_CORRUPT: invalid event artifact at line ${index + 1}.`);
    if (parsed.ledger_id !== metadata.ledger_id) throw new Error(`LEDGER_CORRUPT: event ledger id mismatch at line ${index + 1}.`);
    if (parsed.sequence !== index + 1) throw new Error(`LEDGER_CORRUPT: non-contiguous sequence at line ${index + 1}.`);
    if (parsed.previous_event_digest !== previousDigest) throw new Error(`LEDGER_CORRUPT: previous digest mismatch at line ${index + 1}.`);
    if (parsed.integrity.algorithm !== 'sha256' || parsed.integrity.digest !== sha256ArtifactPayload(parsed)) {
      throw new Error(`LEDGER_CORRUPT: event integrity mismatch at line ${index + 1}.`);
    }
    events.push(parsed);
    previousDigest = parsed.integrity.digest;
  }
  const reservations = new Map<string, ReservationRecord>();
  for (const event of events) {
    const existing = reservations.get(event.reservation_id);
    if (event.event_type === 'reservation_created') {
      if (existing !== undefined) throw new Error(`LEDGER_CORRUPT: duplicate reservation ${event.reservation_id}.`);
      reservations.set(event.reservation_id, { creation: event, latest: event, state: 'reserved' });
      continue;
    }
    if (existing === undefined) throw new Error(`LEDGER_CORRUPT: transition without reservation ${event.reservation_id}.`);
    if (existing.state !== 'reserved') throw new Error(`LEDGER_CORRUPT: transition from terminal state for ${event.reservation_id}.`);
    const stateAfter = event.event_type === 'dispatch_committed' ? 'dispatched' : 'released';
    reservations.set(event.reservation_id, { creation: existing.creation, latest: event, state: stateAfter });
  }
  return { metadata, events, reservations };
}

async function loadMetadata(directory: string): Promise<DispatchLedgerMetadata> {
  const metadata = JSON.parse(await readFile(join(directory, METADATA_FILE), 'utf8')) as DispatchLedgerMetadata;
  if (metadata.artifact_type !== 'dispatch_ledger_metadata' || metadata.artifact_version !== '0.9') throw new Error('INVALID_LEDGER_METADATA: unsupported metadata artifact.');
  if (metadata.integrity.algorithm !== 'sha256' || metadata.integrity.digest !== sha256ArtifactPayload(metadata)) throw new Error('INVALID_LEDGER_METADATA: digest mismatch.');
  return metadata;
}

function validateAuthorizedEnvelope(envelope: AuthorizedExecutionEnvelope, at: string): void {
  assertDateTime(at, 'INVALID_RESERVATION_TIME');
  if (envelope.artifact_type !== 'authorized_execution_envelope' || envelope.artifact_version !== '0.8') throw new Error('INVALID_AUTHORIZATION_ENVELOPE: unsupported artifact.');
  if (!envelope.dispatch_permitted || !envelope.dry_run || envelope.network_executed) throw new Error('DISPATCH_NOT_AUTHORIZED: envelope does not permit dispatch.');
  if (envelope.integrity.algorithm !== 'sha256' || envelope.integrity.digest !== sha256ArtifactPayload(envelope)) throw new Error('AUTHORIZATION_INTEGRITY_MISMATCH: authorized envelope digest is invalid.');
  if (envelope.expires_at !== null && Date.parse(at) >= Date.parse(envelope.expires_at)) throw new Error('AUTHORIZATION_EXPIRED: authorized envelope has expired.');
  if (containsSecretMaterial(envelope)) throw new Error('SECRET_MATERIAL_DETECTED: authorized envelope contains forbidden secret material.');
  if (envelope.execution_plan.idempotency.mode === 'required' && !envelope.execution_plan.idempotency.key) throw new Error('IDEMPOTENCY_KEY_REQUIRED: provider plan requires an idempotency key.');
  if (envelope.budget.required && (envelope.budget.budget_ref === null || envelope.budget.currency === null || envelope.budget.estimated_amount === null || envelope.budget.remaining_before === null)) {
    throw new Error('BUDGET_BINDING_INCOMPLETE: required budget details are missing.');
  }
}

function ensureBudgetAvailable(state: DerivedLedgerState, budget: DispatchBudgetReservation): void {
  let active = 0;
  for (const record of state.reservations.values()) {
    if (record.state === 'released') continue;
    const candidate = record.creation.budget;
    if (candidate?.budget_ref === budget.budget_ref && candidate.currency === budget.currency) active += candidate.amount;
  }
  const available = budget.remaining_before - active;
  if (budget.amount > available) throw new Error(`BUDGET_RESERVATION_EXCEEDED: requested ${budget.amount} ${budget.currency}, only ${available} remains after durable reservations.`);
}

function budgetFromEnvelope(envelope: AuthorizedExecutionEnvelope): DispatchBudgetReservation | null {
  if (!envelope.budget.required) return null;
  return {
    budget_ref: envelope.budget.budget_ref!,
    currency: envelope.budget.currency!,
    amount: envelope.budget.estimated_amount!,
    remaining_before: envelope.budget.remaining_before!
  };
}

function createTransitionEvent(
  state: DerivedLedgerState,
  record: ReservationRecord,
  eventType: 'dispatch_committed' | 'reservation_released',
  stateAfter: 'dispatched' | 'released',
  reason: DispatchReleaseReason | null,
  occurredAt: string
): DispatchLedgerEvent {
  return createEvent({
    ledgerId: state.metadata.ledger_id,
    sequence: state.events.length + 1,
    previousDigest: state.events.at(-1)?.integrity.digest ?? null,
    eventType,
    reservationId: record.creation.reservation_id,
    authorizationId: record.creation.authorization_id,
    executionNonce: record.creation.execution_nonce,
    approvalNonce: record.creation.approval_nonce,
    idempotencyKey: record.creation.idempotency_key,
    envelopeDigest: record.creation.envelope_digest,
    binding: record.creation.binding,
    budget: record.creation.budget,
    stateAfter,
    reason,
    occurredAt,
    expiresAt: record.creation.expires_at
  });
}

function createEvent(input: {
  ledgerId: string;
  sequence: number;
  previousDigest: string | null;
  eventType: DispatchLedgerEvent['event_type'];
  reservationId: string;
  authorizationId: string;
  executionNonce: string;
  approvalNonce: string | null;
  idempotencyKey: string | null;
  envelopeDigest: string;
  binding: DispatchLedgerEvent['binding'];
  budget: DispatchBudgetReservation | null;
  stateAfter: DispatchReservationState;
  reason: DispatchReleaseReason | null;
  occurredAt: string;
  expiresAt: string | null;
}): DispatchLedgerEvent {
  const eventId = `evt_${sha256({ ledger_id: input.ledgerId, sequence: input.sequence, type: input.eventType, reservation_id: input.reservationId, at: input.occurredAt, previous: input.previousDigest }).slice(0, 32)}`;
  const base = {
    artifact_type: 'dispatch_ledger_event' as const,
    artifact_version: '0.9' as const,
    ledger_id: input.ledgerId,
    sequence: input.sequence,
    event_id: eventId,
    previous_event_digest: input.previousDigest,
    event_type: input.eventType,
    reservation_id: input.reservationId,
    authorization_id: input.authorizationId,
    execution_nonce: input.executionNonce,
    approval_nonce: input.approvalNonce,
    idempotency_key: input.idempotencyKey,
    envelope_digest: input.envelopeDigest,
    binding: input.binding,
    budget: input.budget,
    state_after: input.stateAfter,
    reason: input.reason,
    occurred_at: input.occurredAt,
    expires_at: input.expiresAt
  };
  return { ...base, integrity: { algorithm: 'sha256', digest: sha256ArtifactPayload(base) } };
}

function reservationFromRecord(ledgerId: string, record: ReservationRecord, replayed: boolean): DispatchReservation {
  const base = {
    artifact_type: 'dispatch_reservation' as const,
    artifact_version: '0.9' as const,
    ledger_id: ledgerId,
    sequence: record.latest.sequence,
    reservation_id: record.creation.reservation_id,
    authorization_id: record.creation.authorization_id,
    execution_nonce: record.creation.execution_nonce,
    approval_nonce: record.creation.approval_nonce,
    idempotency_key: record.creation.idempotency_key,
    envelope_digest: record.creation.envelope_digest,
    state: record.state,
    replayed,
    reserved_at: record.creation.occurred_at,
    updated_at: record.latest.occurred_at,
    expires_at: record.creation.expires_at,
    terminal_reason: record.latest.reason,
    binding: record.creation.binding,
    budget: record.creation.budget
  };
  return { ...base, integrity: { algorithm: 'sha256', digest: sha256ArtifactPayload(base) } };
}

function signReceipt(
  event: DispatchLedgerEvent,
  reservation: DispatchReservation,
  transition: DispatchTransition,
  replayed: boolean,
  signer: DispatchSignerInput
): SignedDispatchReceipt {
  const receiptId = `dispatch_receipt_${sha256({ event: event.integrity.digest, transition }).slice(0, 32)}`;
  const base = {
    artifact_type: 'signed_dispatch_receipt' as const,
    artifact_version: '0.9' as const,
    receipt_id: receiptId,
    ledger_id: event.ledger_id,
    sequence: event.sequence,
    reservation_id: event.reservation_id,
    authorization_id: event.authorization_id,
    transition,
    state: reservation.state,
    replayed,
    occurred_at: event.occurred_at,
    binding: event.binding,
    execution_nonce: event.execution_nonce,
    approval_nonce: event.approval_nonce,
    idempotency_key: event.idempotency_key,
    budget: event.budget,
    envelope_digest: event.envelope_digest,
    ledger_event_digest: event.integrity.digest
  };
  const digest = sha256ArtifactPayload(base);
  return {
    ...base,
    integrity: { algorithm: 'sha256', digest },
    signature: {
      algorithm: 'ed25519',
      key_id: signer.keyId,
      value: sign(null, digest, createPrivateKey(signer.signingKeyPem)).toString('base64')
    }
  };
}

function buildBudgetTotals(reservations: DispatchReservation[]): DispatchBudgetTotal[] {
  const totals = new Map<string, DispatchBudgetTotal>();
  for (const reservation of reservations) {
    const budget = reservation.budget;
    if (budget === null) continue;
    const key = `${budget.budget_ref}\u0000${budget.currency}`;
    const total = totals.get(key) ?? { budget_ref: budget.budget_ref, currency: budget.currency, active_amount: 0, dispatched_amount: 0, released_amount: 0 };
    if (reservation.state === 'released') total.released_amount += budget.amount;
    else total.active_amount += budget.amount;
    if (reservation.state === 'dispatched') total.dispatched_amount += budget.amount;
    totals.set(key, total);
  }
  return [...totals.values()].sort((left, right) => `${left.budget_ref}:${left.currency}`.localeCompare(`${right.budget_ref}:${right.currency}`));
}

function requireReservation(state: DerivedLedgerState, reservationId: string): ReservationRecord {
  const record = state.reservations.get(reservationId);
  if (record === undefined) throw new Error(`RESERVATION_NOT_FOUND: ${reservationId}`);
  return record;
}

async function appendEvent(directory: string, event: DispatchLedgerEvent): Promise<void> {
  const handle = await open(join(directory, EVENTS_FILE), 'a');
  try {
    await handle.writeFile(`${canonicalJson(event)}\n`, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function writeAtomicJson(path: string, value: unknown): Promise<void> {
  const temporary = `${path}.tmp`;
  const handle = await open(temporary, 'w');
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(temporary, path);
}

async function ensureFile(path: string): Promise<void> {
  try {
    await readFile(path, 'utf8');
  } catch (error) {
    if (!hasCode(error, 'ENOENT')) throw error;
    await writeFile(path, '', 'utf8');
  }
}

async function withLedgerLock<T>(directory: string, timeoutMs: number, fn: () => Promise<T>): Promise<T> {
  const lockPath = join(directory, LOCK_DIRECTORY);
  const started = Date.now();
  while (true) {
    try {
      await mkdir(lockPath);
      break;
    } catch (error) {
      if (!hasCode(error, 'EEXIST')) throw error;
      if (Date.now() - started >= timeoutMs) throw new Error('LEDGER_LOCK_TIMEOUT: could not acquire the durable dispatch lock.');
      await sleep(10);
    }
  }
  try {
    return await fn();
  } finally {
    await rm(lockPath, { recursive: true, force: true });
  }
}

function containsSecretMaterial(value: unknown, key = ''): boolean {
  if (Array.isArray(value)) return value.some((entry) => containsSecretMaterial(entry));
  if (typeof value !== 'object' || value === null) return false;
  for (const [childKey, child] of Object.entries(value)) {
    const normalized = childKey.toLowerCase();
    if (/^(access_token|refresh_token|api_key|password|client_secret|private_key|secret_locator|secret)$/.test(normalized) && child !== null && child !== false && child !== '') return true;
    if (containsSecretMaterial(child, normalized)) return true;
  }
  return false;
}

function assertDateTime(value: string, code: string): void {
  if (Number.isNaN(Date.parse(value))) throw new Error(`${code}: value must be RFC 3339.`);
}

function hasCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === code;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}
