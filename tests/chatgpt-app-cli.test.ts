import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runCli } from '../src/cli/foundry.js';

function io() { const out: string[] = []; const error: string[] = []; return { out, error, adapter: { out: (value: string) => out.push(value), error: (value: string) => error.push(value) } }; }

describe('ChatGPT App CLI', () => {
  it('creates and inspects a ChatGPT app project', async () => {
    const root = await mkdtemp(join(tmpdir(), 'foundry-app-cli-'));
    try {
      const target = join(root, 'app');
      const created = io();
      assert.equal(await runCli(['app','init',target,'--public-base-url','http://127.0.0.1:8788'], created.adapter), 0);
      assert.match(created.out.join('\n'), /APP_INIT_OK/);
      const inspected = io();
      assert.equal(await runCli(['app','inspect','--config',join(target,'chatgpt-app-config.json'),'--json'], inspected.adapter), 0);
      const summary = JSON.parse(inspected.out.join('\n')) as Record<string, unknown>;
      assert.equal(summary.mcp_endpoint, 'http://127.0.0.1:8788/mcp');
      assert.equal(summary.dynamic_client_registration, true);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
