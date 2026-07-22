import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { initializeChatGptApp } from '../src/apps/init-app.js';
import { loadChatGptAppAssembly, createScopeResolver } from '../src/apps/app-assembly.js';
import { runChatGptAppSmoke } from '../src/apps/app-smoke.js';

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'foundry-chatgpt-app-'));
  const report = await initializeChatGptApp(directory, true, 'http://127.0.0.1:8788');
  const assembly = await loadChatGptAppAssembly(report.config_file, { CUSTOMER_API_TOKEN: 'demo-token' });
  return { directory, report, assembly };
}

describe('ChatGPT App assembly', () => {
  it('initializes a portable OAuth app without plaintext secrets in config', async () => {
    const f = await fixture();
    try {
      const config = await readFile(f.report.config_file, 'utf8');
      assert.equal(config.includes(f.report.password), false);
      assert.equal(f.assembly.summary.mcp_endpoint, 'http://127.0.0.1:8788/mcp');
      assert.equal(f.assembly.summary.tool_count, 6);
      assert.equal(f.assembly.summary.resource_count, 1);
      assert.equal(f.assembly.summary.dynamic_client_registration, true);
      assert.equal(f.assembly.config.oauth.users[0]?.id, 'user-001');
      assert.equal(f.assembly.config.oauth.clients[0]?.client_id, 'chatgpt-client');
    } finally { await rm(f.directory, { recursive: true, force: true }); }
  });

  it('performs OAuth PKCE and exposes tools/resources in a smoke flow', async () => {
    const f = await fixture();
    try {
      const report = await runChatGptAppSmoke(f.assembly, { username: f.report.username, password: f.report.password, workspaceRef: f.report.workspace_ref });
      const oauth = report.oauth as Record<string, unknown>;
      assert.equal(oauth.subject, 'user-001');
      assert.equal(oauth.client_id, 'chatgpt-client');
      assert.equal(oauth.workspace_ref, 'workspace-001');
      assert.equal(oauth.refresh_token_issued, true);
      assert.ok(report.tools);
      assert.ok(report.resources);
    } finally { await rm(f.directory, { recursive: true, force: true }); }
  });

  it('resolves progressive scopes for resources, approval tools, and provider tools', async () => {
    const f = await fixture();
    try {
      const resolver = createScopeResolver(f.assembly.registry, ['mcp:tools']);
      assert.deepEqual(resolver({ method: 'resources/read', params: { uri: 'ui://numtema/approval.html' } }), ['mcp:resources']);
      assert.deepEqual(resolver({ method: 'tools/call', params: { name: 'foundry_approval_prepare' } }), ['mcp:approve']);
      assert.deepEqual(resolver({ method: 'tools/call', params: { name: 'customer_get' } }), ['customer:read', 'mcp:tools']);
    } finally { await rm(f.directory, { recursive: true, force: true }); }
  });
});
