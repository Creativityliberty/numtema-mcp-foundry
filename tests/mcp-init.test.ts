import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { initializeMcpRuntime } from '../src/mcp/init-runtime.js';
import { loadMcpAssembly } from '../src/mcp/config-loader.js';

const cleanup: string[] = [];
afterEach(async () => { await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true }))); });

describe('foundry mcp init', () => {
  it('creates a portable local runtime demo with ephemeral signing keys', async () => {
    const root = await mkdtemp(join(tmpdir(), 'foundry-mcp-init-'));
    cleanup.push(root);
    const target = join(root, 'demo');
    const report = await initializeMcpRuntime(target);
    assert.equal(report.generated_private_keys, 3);
    const configText = await readFile(join(target, 'runtime-config.json'), 'utf8');
    assert.equal(/BEGIN PRIVATE KEY/.test(configText), false);
    const assembly = await loadMcpAssembly(join(target, 'runtime-config.json'), { CUSTOMER_API_TOKEN: 'demo-token' });
    assert.equal(assembly.summary.tool_count, 4);
  });
});
