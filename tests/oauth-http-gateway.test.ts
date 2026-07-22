import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { URL, URLSearchParams } from 'node:url';
import { createFoundryAppHttpServer } from '../src/apps/app-http-server.js';
import { createOAuthService } from '../src/oauth/service.js';
import { createPkceChallenge } from '../src/oauth/pkce.js';
import { hashPassword } from '../src/oauth/password.js';
import type { OAuthGatewayConfig } from '../src/oauth/types.js';
import type { McpRouter } from '../src/mcp/jsonrpc-router.js';

async function startFixture() {
  const directory = await mkdtemp(join(tmpdir(), 'foundry-oauth-http-'));
  const pair = generateKeyPairSync('ed25519');
  const config: OAuthGatewayConfig = {
    issuer: 'http://127.0.0.1:0', resource: 'http://127.0.0.1:0/mcp',
    signing_key_id: 'oauth-key-1',
    private_key_pem: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    public_key_pem: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    storage_directory: directory, scopes_supported: ['mcp:tools', 'mcp:resources', 'customers:read'],
    baseline_scopes: ['mcp:tools'], access_token_ttl_seconds: 86400, refresh_token_ttl_seconds: 3600,
    authorization_code_ttl_seconds: 120, allow_dynamic_client_registration: true,
    workspaces: [{ id: 'workspace-1', name: 'Workspace One' }],
    users: [{ id: 'user-1', username: 'demo@example.test', display_name: 'Demo User', password_hash: hashPassword('demo-password'),
      workspace_refs: ['workspace-1'], allowed_scopes: ['mcp:tools', 'mcp:resources', 'customers:read'], status: 'active' }],
    clients: [{ client_id: 'client-1', client_name: 'ChatGPT Test', redirect_uris: ['https://chatgpt.example.test/callback'],
      grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], token_endpoint_auth_method: 'none', created_at: '2026-07-22T18:00:00.000Z' }]
  };
  let seenContext: unknown;
  const router: McpRouter = {
    async handle(message: unknown, context) {
      seenContext = context;
      const record = message as Record<string, unknown>;
      if (record.method === 'tools/list') return { jsonrpc: '2.0', id: record.id as number, result: { tools: [] } };
      return { jsonrpc: '2.0', id: record.id as number, result: { content: [{ type: 'text', text: 'ok' }] } };
    }
  };
  const service = createOAuthService(config);
  const server = createFoundryAppHttpServer(router, {
    mcpPath: '/mcp', allowedOrigins: ['https://chatgpt.com'], oauth: service,
    requiredScopes(message: unknown) {
      const record = message as Record<string, unknown>;
      if (record.method !== 'tools/call') return ['mcp:tools'];
      return ['mcp:tools', 'customers:read'];
    }
  });
  await new Promise<void>((resolvePromise) => server.listen(0, '127.0.0.1', resolvePromise));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('SERVER_ADDRESS_MISSING');
  const base = `http://127.0.0.1:${address.port}`;
  // Recreate service URLs around the actual test port.
  config.issuer = base;
  config.resource = `${base}/mcp`;
  return { directory, server, service, config, base, seenContext: () => seenContext };
}

function close(server: { close(callback: (error?: Error) => void): void }): Promise<void> {
  return new Promise((resolvePromise, reject) => server.close((error) => error ? reject(error) : resolvePromise()));
}

async function issueToken(service: ReturnType<typeof createOAuthService>, config: OAuthGatewayConfig, scopes: string[]) {
  const verifier = 'verifier-abcdefghijklmnopqrstuvwxyz-0123456789-ABCDEFG';
  const now = new Date().toISOString();
  const auth = await service.authorize({ clientId: 'client-1', redirectUri: 'https://chatgpt.example.test/callback', resource: config.resource,
    scopes, codeChallenge: createPkceChallenge(verifier), codeChallengeMethod: 'S256', username: 'demo@example.test', password: 'demo-password',
    workspaceRef: 'workspace-1', now });
  return service.exchangeAuthorizationCode({ code: auth.code, clientId: 'client-1', redirectUri: 'https://chatgpt.example.test/callback',
    codeVerifier: verifier, resource: config.resource, now });
}

describe('OAuth HTTP gateway and protected MCP resource', () => {
  it('serves protected resource, authorization server and JWKS metadata', async () => {
    const f = await startFixture();
    try {
      const protectedResponse = await fetch(`${f.base}/.well-known/oauth-protected-resource`);
      assert.equal(protectedResponse.status, 200);
      const protectedBody = JSON.parse(await protectedResponse.text()) as Record<string, unknown>;
      assert.equal(protectedBody.resource, `${f.base}/mcp`);
      const asResponse = await fetch(`${f.base}/.well-known/oauth-authorization-server`);
      const asBody = JSON.parse(await asResponse.text()) as Record<string, unknown>;
      assert.equal(asBody.authorization_endpoint, `${f.base}/oauth/authorize`);
      assert.deepEqual(asBody.code_challenge_methods_supported, ['S256']);
      const jwks = JSON.parse(await (await fetch(`${f.base}/oauth/jwks`)).text()) as { keys: unknown[] };
      assert.equal(jwks.keys.length, 1);
    } finally { await close(f.server); await rm(f.directory, { recursive: true, force: true }); }
  });

  it('completes the HTTP authorization-code flow with PKCE', async () => {
    const f = await startFixture();
    try {
      const verifier = 'verifier-abcdefghijklmnopqrstuvwxyz-0123456789-ABCDEFG';
      const form = new URLSearchParams({
        client_id: 'client-1', redirect_uri: 'https://chatgpt.example.test/callback', response_type: 'code',
        resource: f.config.resource, scope: 'mcp:tools customers:read', code_challenge: createPkceChallenge(verifier),
        code_challenge_method: 'S256', state: 'state-123', username: 'demo@example.test', password: 'demo-password',
        workspace_ref: 'workspace-1', decision: 'approve'
      });
      const authorize = await fetch(`${f.base}/oauth/authorize`, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString(), redirect: 'manual'
      });
      assert.equal(authorize.status, 302);
      const location = authorize.headers.get('location');
      assert.ok(location);
      const code = new URL(location).searchParams.get('code');
      assert.ok(code);
      const tokenForm = new URLSearchParams({ grant_type: 'authorization_code', client_id: 'client-1',
        redirect_uri: 'https://chatgpt.example.test/callback', code, code_verifier: verifier, resource: f.config.resource });
      const tokenResponse = await fetch(`${f.base}/oauth/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: tokenForm.toString() });
      assert.equal(tokenResponse.status, 200);
      const token = JSON.parse(await tokenResponse.text()) as { access_token: string; refresh_token: string };
      assert.match(token.access_token, /^ey/);
      assert.match(token.refresh_token, /^refresh_/);
    } finally { await close(f.server); await rm(f.directory, { recursive: true, force: true }); }
  });

  it('returns RFC 9728 challenges and propagates authenticated user/workspace context', async () => {
    const f = await startFixture();
    try {
      const request = { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} };
      const missing = await fetch(`${f.base}/mcp`, { method: 'POST', headers: { Origin: 'https://chatgpt.com', Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
      assert.equal(missing.status, 401);
      assert.match(missing.headers.get('www-authenticate') ?? '', /resource_metadata=/);

      const baseline = await issueToken(f.service, f.config, ['mcp:tools']);
      const listed = await fetch(`${f.base}/mcp`, { method: 'POST', headers: { Origin: 'https://chatgpt.com', Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json', Authorization: `Bearer ${baseline.access_token}` }, body: JSON.stringify(request) });
      assert.equal(listed.status, 200);
      assert.deepEqual(f.seenContext(), { auth: { subject_ref: 'user-1', client_ref: 'client-1', workspace_ref: 'workspace-1', scopes: ['mcp:tools'] } });

      const call = { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'customer_get', arguments: {} } };
      const insufficient = await fetch(`${f.base}/mcp`, { method: 'POST', headers: { Origin: 'https://chatgpt.com', Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json', Authorization: `Bearer ${baseline.access_token}` }, body: JSON.stringify(call) });
      assert.equal(insufficient.status, 403);
      assert.match(insufficient.headers.get('www-authenticate') ?? '', /insufficient_scope/);
      assert.match(insufficient.headers.get('www-authenticate') ?? '', /customers:read/);

      const elevated = await issueToken(f.service, f.config, ['mcp:tools', 'customers:read']);
      const allowed = await fetch(`${f.base}/mcp`, { method: 'POST', headers: { Origin: 'https://chatgpt.com', Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json', Authorization: `Bearer ${elevated.access_token}` }, body: JSON.stringify(call) });
      assert.equal(allowed.status, 200);
    } finally { await close(f.server); await rm(f.directory, { recursive: true, force: true }); }
  });
});
