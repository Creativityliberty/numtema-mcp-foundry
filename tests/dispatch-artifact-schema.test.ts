import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { initializeDispatchLedger, readDispatchLedgerSnapshot, reserveDispatch } from '../src/dispatch/ledger-store.js';
import type { AuthorizedExecutionEnvelope } from '../src/runtime/types.js';
import { validateValueAgainstSchema } from '../src/validation/schema-validator.js';

async function schema(name: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(`schemas/${name}`, 'utf8')) as Record<string, unknown>;
}

describe('Sprint 0.9 dispatch artifact schemas', () => {
  it('validates reservations, receipts, events and snapshots', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'foundry-dispatch-schema-'));
    const keys = generateKeyPairSync('ed25519');
    try {
      await initializeDispatchLedger({ directory, at: '2026-07-22T16:01:00Z', ledgerId: 'ledger-schema' });
      const envelope = JSON.parse(await readFile('examples/runtime/authorized-execution-envelope.generated.json', 'utf8')) as AuthorizedExecutionEnvelope;
      const result = await reserveDispatch({
        directory, envelope, at: '2026-07-22T16:02:00Z', keyId: 'dispatch-key',
        signingKeyPem: keys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
      });
      const snapshot = await readDispatchLedgerSnapshot(directory);
      const line = (await readFile(join(directory, 'events.jsonl'), 'utf8')).trim();
      const event = JSON.parse(line) as unknown;
      assert.deepEqual(validateValueAgainstSchema(await schema('dispatch-reservation.schema.json'), result.reservation, 'dispatch_reservation'), []);
      assert.deepEqual(validateValueAgainstSchema(await schema('signed-dispatch-receipt.schema.json'), result.receipt, 'signed_dispatch_receipt'), []);
      assert.deepEqual(validateValueAgainstSchema(await schema('dispatch-ledger-event.schema.json'), event, 'dispatch_ledger_event'), []);
      assert.deepEqual(validateValueAgainstSchema(await schema('dispatch-ledger-snapshot.schema.json'), snapshot, 'dispatch_ledger_snapshot'), []);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
