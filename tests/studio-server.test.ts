import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createStudioProject } from '../src/studio/project-store.js';
import { startStudioServer } from '../src/studio/server.js';

describe('Foundry Studio server', () => {
  it('serves the premium shell and protects write APIs with CSRF', async () => {
    const root = await mkdtemp(join(tmpdir(), 'studio-server-'));
    const directory = join(root, 'project');
    await createStudioProject(directory);
    const handle = await startStudioServer({ projectDirectory: directory, port: 0 });
    try {
      const page = await fetch(handle.url);
      assert.equal(page.status, 200);
      assert.match(await page.text(), /MCP Foundry Studio/);
      const denied = await fetch(`${handle.url}/api/pipeline/build`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      assert.equal(denied.status, 403);
      const allowed = await fetch(`${handle.url}/api/pipeline/build`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-foundry-csrf': handle.csrfToken }, body: '{}' });
      assert.equal(allowed.status, 200);
      const payload = JSON.parse(await allowed.text()) as { ok: boolean; data: { tool_count: number } };
      assert.equal(payload.ok, true);
      assert.equal(payload.data.tool_count, 4);
      const unknown = await fetch(`${handle.url}/../../package.json`);
      assert.equal(unknown.status, 404);
    } finally { await handle.close(); await rm(root, { recursive: true, force: true }); }
  });
});
