import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runCli } from '../src/cli/foundry.js';

function io() { const out: string[] = []; const error: string[] = []; return { out, error, adapter: { out: (value: string) => out.push(value), error: (value: string) => error.push(value) } }; }

describe('Foundry Studio CLI', () => {
  it('initializes, inspects, and builds a deployable Studio project', async () => {
    const root = await mkdtemp(join(tmpdir(), 'studio-cli-'));
    try {
      const project = join(root, 'procuflow-studio');
      const initialized = io();
      assert.equal(await runCli(['studio','init',project,'--name','ProcuFlow Studio'], initialized.adapter), 0);
      assert.match(initialized.out.join('\n'), /STUDIO_INIT_OK/);
      const inspected = io();
      assert.equal(await runCli(['studio','inspect',project,'--json'], inspected.adapter), 0);
      const descriptor = JSON.parse(inspected.out.join('\n')) as { artifact_version: string };
      assert.equal(descriptor.artifact_version, '1.2');
      const built = io();
      assert.equal(await runCli(['studio','build',project], built.adapter), 0);
      assert.match(built.out.join('\n'), /STUDIO_BUILD_OK/);
      assert.match(built.out.join('\n'), /private keys included: false/);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
