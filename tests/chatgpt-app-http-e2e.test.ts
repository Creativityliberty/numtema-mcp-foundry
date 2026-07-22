import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { URL } from 'node:url';
import { initializeChatGptApp } from '../src/apps/init-app.js';
import { loadChatGptAppAssembly } from '../src/apps/app-assembly.js';
import { createPkceChallenge } from '../src/oauth/pkce.js';

function listen(server: ReturnType<typeof createServer>): Promise<number> {
  return new Promise((resolvePromise) => server.listen(0, '127.0.0.1', () => { const address = server.address(); if (!address || typeof address === 'string') throw new Error('NO_ADDRESS'); resolvePromise(address.port); }));
}
function close(server: ReturnType<typeof createServer>): Promise<void> { return new Promise((resolvePromise, reject) => server.close((error) => error ? reject(error) : resolvePromise())); }
async function token(assembly: Awaited<ReturnType<typeof loadChatGptAppAssembly>>, report: Awaited<ReturnType<typeof initializeChatGptApp>>, scopes: string[]) {
  const verifier = 'a'.repeat(64); const client = assembly.config.oauth.clients[0]!;
  const code = await assembly.oauth.authorize({ clientId: client.client_id, redirectUri: client.redirect_uris[0]!, resource: assembly.summary.oauth_resource, scopes,
    codeChallenge: createPkceChallenge(verifier), codeChallengeMethod: 'S256', username: report.username, password: report.password, workspaceRef: report.workspace_ref });
  return assembly.oauth.exchangeAuthorizationCode({ code: code.code, clientId: client.client_id, redirectUri: client.redirect_uris[0]!, codeVerifier: verifier, resource: assembly.summary.oauth_resource });
}

describe('ChatGPT App HTTP end-to-end', () => {
  it('serves OAuth metadata, progressive scope challenges, resources, and a governed provider call', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'foundry-app-http-'));
    const provider = createServer((request, response) => {
      if (request.headers.authorization !== 'Bearer demo-token') { response.writeHead(401, { 'content-type': 'application/problem+json' }); response.end(JSON.stringify({ title: 'Unauthorized' })); return; }
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify({ id: decodeURIComponent(url.pathname.split('/').pop() ?? ''), name: 'OAuth Customer' }));
    });
    let app: Awaited<ReturnType<typeof loadChatGptAppAssembly>> | undefined;
    try {
      const providerPort = await listen(provider);
      const report = await initializeChatGptApp(directory, true, 'http://127.0.0.1:8788');
      const runtimePath = join(directory, 'runtime-config.json');
      const runtime = JSON.parse(await readFile(runtimePath, 'utf8')) as Record<string, any>;
      runtime.provider.base_url = `http://127.0.0.1:${providerPort}`;
      await writeFile(runtimePath, `${JSON.stringify(runtime, null, 2)}\n`, 'utf8');
      app = await loadChatGptAppAssembly(report.config_file, { CUSTOMER_API_TOKEN: 'demo-token' });
      const appPort = await listen(app.server);
      const base = `http://127.0.0.1:${appPort}`;
      const metadata = await fetch(`${base}/.well-known/oauth-protected-resource`);
      assert.equal(metadata.status, 200);
      const metadataBody = JSON.parse(await metadata.text()) as Record<string, unknown>;
      assert.equal(metadataBody.resource, 'http://127.0.0.1:8788/mcp');
      const unauthorized = await fetch(`${base}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', origin: 'https://chatgpt.com' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }) });
      assert.equal(unauthorized.status, 401);
      assert.match(unauthorized.headers.get('www-authenticate') ?? '', /resource_metadata=/);
      const baseline = await token(app, report, ['mcp:tools']);
      const insufficient = await fetch(`${base}/mcp`, { method: 'POST', headers: { authorization: `Bearer ${baseline.access_token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream', origin: 'https://chatgpt.com' }, body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'customer_get', arguments: { customerId: 'customer 7' } } }) });
      assert.equal(insufficient.status, 403);
      assert.match(insufficient.headers.get('www-authenticate') ?? '', /insufficient_scope/);
      const full = await token(app, report, app.config.oauth.scopes_supported);
      const resources = await fetch(`${base}/mcp`, { method: 'POST', headers: { authorization: `Bearer ${full.access_token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream', origin: 'https://chatgpt.com' }, body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'resources/read', params: { uri: 'ui://numtema/approval.html' } }) });
      assert.equal(resources.status, 200);
      assert.match(await resources.text(), /Secure approval required/);
      const called = await fetch(`${base}/mcp`, { method: 'POST', headers: { authorization: `Bearer ${full.access_token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream', origin: 'https://chatgpt.com' }, body: JSON.stringify({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'customer_get', arguments: { customerId: 'customer 7' }, _meta: { idempotencyKey: 'oauth-e2e-1' } } }) });
      assert.equal(called.status, 200);
      const calledBody = JSON.parse(await called.text()) as Record<string, any>;
      assert.equal(calledBody.result.isError, false);
      assert.equal(calledBody.result.structuredContent.name, 'OAuth Customer');
      assert.equal(JSON.stringify(calledBody).includes('demo-token'), false);
    } finally {
      if (app) await close(app.server);
      await close(provider).catch(() => undefined);
      await rm(directory, { recursive: true, force: true });
    }
  });
});
