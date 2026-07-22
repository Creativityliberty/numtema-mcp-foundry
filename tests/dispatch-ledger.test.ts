import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  commitDispatch,
  initializeDispatchLedger,
  readDispatchLedgerSnapshot,
  releaseDispatch,
  reserveDispatch,
  verifyDispatchReceipt
} from '../src/dispatch/ledger-store.js';
import { sha256ArtifactPayload } from '../src/runtime/canonical.js';
import type { AuthorizedExecutionEnvelope, RuntimeTrustStore } from '../src/runtime/types.js';

const keyPair = generateKeyPairSync('ed25519');
const privateKeyPem = keyPair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const trustStore: RuntimeTrustStore = {
  artifact_type: 'runtime_trust_store', artifact_version: '0.8',
  keys: [{
    key_id: 'dispatch-key-1', algorithm: 'ed25519', purpose: 'dispatch', status: 'active',
    public_key_pem: keyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString()
  }]
};

async function envelope(): Promise<AuthorizedExecutionEnvelope> {
  return JSON.parse(await readFile('examples/runtime/authorized-execution-envelope.generated.json', 'utf8')) as AuthorizedExecutionEnvelope;
}

function variant(source: AuthorizedExecutionEnvelope, suffix: string, amount = 25): AuthorizedExecutionEnvelope {
  const copy = JSON.parse(JSON.stringify(source)) as AuthorizedExecutionEnvelope;
  copy.authorization_id = `${source.authorization_id}-${suffix}`;
  copy.execution_nonce = `${source.execution_nonce}-${suffix}`;
  if (copy.approval.nonce !== null) copy.approval.nonce = `${copy.approval.nonce}-${suffix}`;
  copy.execution_plan.idempotency.key = `${source.execution_plan.idempotency.key}-${suffix}`;
  copy.execution_plan.request.body = { ...copy.execution_plan.request.body!, value: { amount, currency: 'EUR' } };
  copy.execution_plan.arguments_hash = `${source.execution_plan.arguments_hash}-${suffix}`;
  copy.binding.arguments_hash = copy.execution_plan.arguments_hash;
  copy.budget.estimated_amount = amount;
  copy.integrity.digest = sha256ArtifactPayload(copy);
  return copy;
}

async function withLedger<T>(fn: (directory: string) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), 'foundry-ledger-'));
  try {
    await initializeDispatchLedger({ directory, at: '2026-07-22T16:01:00Z', ledgerId: 'ledger-test' });
    return await fn(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

const signer = { signingKeyPem: privateKeyPem, keyId: 'dispatch-key-1' };

describe('Durable Dispatch Authorization Ledger', () => {
  it('atomically reserves nonce, idempotency key and budget and verifies the signed receipt', async () => withLedger(async (directory) => {
    const result = await reserveDispatch({ directory, envelope: await envelope(), at: '2026-07-22T16:02:00Z', ...signer });
    assert.equal(result.replayed, false);
    assert.equal(result.reservation.state, 'reserved');
    assert.equal(result.reservation.budget?.amount, 25);
    assert.equal(verifyDispatchReceipt(result.receipt, trustStore, '2026-07-22T16:02:00Z').valid, true);

    const snapshot = await readDispatchLedgerSnapshot(directory);
    assert.equal(snapshot.sequence, 1);
    assert.equal(snapshot.reservations[0]?.state, 'reserved');
    assert.equal(snapshot.budget_totals[0]?.active_amount, 25);
  }));

  it('returns an exact retry without appending a second event and rejects conflicting reuse', async () => withLedger(async (directory) => {
    const source = await envelope();
    const first = await reserveDispatch({ directory, envelope: source, at: '2026-07-22T16:02:00Z', ...signer });
    const retry = await reserveDispatch({ directory, envelope: source, at: '2026-07-22T16:03:00Z', ...signer });
    assert.equal(retry.replayed, true);
    assert.equal(retry.reservation.reservation_id, first.reservation.reservation_id);
    assert.equal((await readDispatchLedgerSnapshot(directory)).sequence, 1);

    const conflict = variant(source, 'conflict');
    conflict.execution_plan.idempotency.key = source.execution_plan.idempotency.key;
    conflict.integrity.digest = sha256ArtifactPayload(conflict);
    await assert.rejects(
      () => reserveDispatch({ directory, envelope: conflict, at: '2026-07-22T16:03:00Z', ...signer }),
      /IDEMPOTENCY_CONFLICT/
    );
  }));

  it('prevents nonce replay and concurrent budget oversubscription', async () => withLedger(async (directory) => {
    const source = await envelope();
    const nonceConflict = variant(source, 'nonce');
    nonceConflict.execution_nonce = source.execution_nonce;
    nonceConflict.integrity.digest = sha256ArtifactPayload(nonceConflict);
    await reserveDispatch({ directory, envelope: source, at: '2026-07-22T16:02:00Z', ...signer });
    await assert.rejects(
      () => reserveDispatch({ directory, envelope: nonceConflict, at: '2026-07-22T16:03:00Z', ...signer }),
      /NONCE_ALREADY_CONSUMED/
    );
    const approvalConflict = variant(source, 'approval');
    approvalConflict.approval.nonce = source.approval.nonce;
    approvalConflict.integrity.digest = sha256ArtifactPayload(approvalConflict);
    await assert.rejects(
      () => reserveDispatch({ directory, envelope: approvalConflict, at: '2026-07-22T16:03:00Z', ...signer }),
      /APPROVAL_NONCE_ALREADY_CONSUMED/
    );

    const secondDirectory = await mkdtemp(join(tmpdir(), 'foundry-ledger-budget-'));
    try {
      await initializeDispatchLedger({ directory: secondDirectory, at: '2026-07-22T16:01:00Z', ledgerId: 'ledger-budget' });
      const a = variant(source, 'a', 60);
      const b = variant(source, 'b', 60);
      const settled = await Promise.allSettled([
        reserveDispatch({ directory: secondDirectory, envelope: a, at: '2026-07-22T16:02:00Z', ...signer }),
        reserveDispatch({ directory: secondDirectory, envelope: b, at: '2026-07-22T16:02:00Z', ...signer })
      ]);
      assert.equal(settled.filter((entry) => entry.status === 'fulfilled').length, 1);
      const rejected = settled.find((entry) => entry.status === 'rejected');
      assert.ok(rejected !== undefined && rejected.status === 'rejected');
      assert.match(String(rejected.reason), /BUDGET_RESERVATION_EXCEEDED/);
      assert.equal((await readDispatchLedgerSnapshot(secondDirectory)).sequence, 1);
    } finally {
      await rm(secondDirectory, { recursive: true, force: true });
    }
  }));

  it('commits and releases only valid state transitions while keeping nonces consumed', async () => withLedger(async (directory) => {
    const source = await envelope();
    const reserved = await reserveDispatch({ directory, envelope: source, at: '2026-07-22T16:02:00Z', ...signer });
    const committed = await commitDispatch({ directory, reservationId: reserved.reservation.reservation_id, at: '2026-07-22T16:03:00Z', ...signer });
    assert.equal(committed.reservation.state, 'dispatched');
    assert.equal(committed.receipt.transition, 'reserved_to_dispatched');
    const replay = await commitDispatch({ directory, reservationId: reserved.reservation.reservation_id, at: '2026-07-22T16:04:00Z', ...signer });
    assert.equal(replay.replayed, true);
    assert.equal((await readDispatchLedgerSnapshot(directory)).sequence, 2);
    await assert.rejects(
      () => releaseDispatch({ directory, reservationId: reserved.reservation.reservation_id, reason: 'cancelled', at: '2026-07-22T16:04:00Z', ...signer }),
      /INVALID_DISPATCH_TRANSITION/
    );
  }));

  it('rejects a corrupted journal before reading or mutating state', async () => withLedger(async (directory) => {
    await reserveDispatch({ directory, envelope: await envelope(), at: '2026-07-22T16:02:00Z', ...signer });
    const path = join(directory, 'events.jsonl');
    const event = JSON.parse((await readFile(path, 'utf8')).trim()) as { integrity: { digest: string } };
    event.integrity.digest = 'tampered';
    await writeFile(path, `${JSON.stringify(event)}\n`, 'utf8');
    await assert.rejects(() => readDispatchLedgerSnapshot(directory), /LEDGER_CORRUPT/);
  }));

  it('releases reserved budget but permanently prevents nonce reuse', async () => withLedger(async (directory) => {
    const source = await envelope();
    const reserved = await reserveDispatch({ directory, envelope: source, at: '2026-07-22T16:02:00Z', ...signer });
    const released = await releaseDispatch({ directory, reservationId: reserved.reservation.reservation_id, reason: 'cancelled', at: '2026-07-22T16:03:00Z', ...signer });
    assert.equal(released.reservation.state, 'released');
    assert.equal((await readDispatchLedgerSnapshot(directory)).budget_totals[0]?.active_amount, 0);
    await assert.rejects(
      () => reserveDispatch({ directory, envelope: source, at: '2026-07-22T16:04:00Z', ...signer }),
      /AUTHORIZATION_ALREADY_TERMINAL/
    );
    const replayNonce = variant(source, 'released-nonce');
    replayNonce.execution_nonce = source.execution_nonce;
    replayNonce.integrity.digest = sha256ArtifactPayload(replayNonce);
    await assert.rejects(
      () => reserveDispatch({ directory, envelope: replayNonce, at: '2026-07-22T16:04:00Z', ...signer }),
      /NONCE_ALREADY_CONSUMED/
    );
  }));
});
