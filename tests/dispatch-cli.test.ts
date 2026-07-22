import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { runCli, type CliIo } from '../src/cli/foundry.js';

function capture() {
  const out: string[] = [];
  const error: string[] = [];
  const io: CliIo = { out: (value) => out.push(value), error: (value) => error.push(value) };
  return { out, error, io };
}

describe('foundry durable dispatch CLI', () => {
  it('initializes, reserves, inspects, commits and verifies a dispatch receipt', async () => {
    const root = await mkdtemp(join(tmpdir(), 'foundry-dispatch-cli-'));
    const ledger = join(root, 'ledger');
    const keyFile = join(root, 'dispatch-private.pem');
    const receiptFile = join(root, 'receipt.json');
    const commitFile = join(root, 'commit.json');
    const trustFile = join(root, 'trust.json');
    const keys = generateKeyPairSync('ed25519');
    await writeFile(keyFile, keys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(), 'utf8');
    await writeFile(trustFile, JSON.stringify({
      artifact_type: 'runtime_trust_store', artifact_version: '0.8', keys: [{
        key_id: 'dispatch-key', algorithm: 'ed25519', purpose: 'dispatch', status: 'active',
        public_key_pem: keys.publicKey.export({ type: 'spki', format: 'pem' }).toString()
      }]
    }), 'utf8');
    try {
      let captured = capture();
      assert.equal(await runCli(['ledger', 'init', ledger, '--at', '2026-07-22T16:01:00Z'], captured.io), 0);
      assert.match(captured.out.join('\n'), /LEDGER_READY/);

      captured = capture();
      assert.equal(await runCli([
        'dispatch', 'reserve', '--ledger', ledger,
        '--envelope', 'examples/runtime/authorized-execution-envelope.generated.json',
        '--signing-key', keyFile, '--key-id', 'dispatch-key', '--at', '2026-07-22T16:02:00Z', '--out', receiptFile
      ], captured.io), 0);
      const receipt = JSON.parse(await readFile(receiptFile, 'utf8')) as { reservation_id: string };
      assert.ok(receipt.reservation_id);

      captured = capture();
      assert.equal(await runCli(['ledger', 'status', '--ledger', ledger, '--json'], captured.io), 0);
      assert.match(captured.out.join('\n'), /dispatch_ledger_snapshot/);

      captured = capture();
      assert.equal(await runCli([
        'dispatch', 'commit', '--ledger', ledger, '--reservation', receipt.reservation_id,
        '--signing-key', keyFile, '--key-id', 'dispatch-key', '--at', '2026-07-22T16:03:00Z', '--out', commitFile
      ], captured.io), 0);

      captured = capture();
      assert.equal(await runCli(['dispatch', 'verify', '--receipt', commitFile, '--trust-store', trustFile, '--at', '2026-07-22T16:03:00Z'], captured.io), 0);
      assert.match(captured.out.join('\n'), /RECEIPT_VALID/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
