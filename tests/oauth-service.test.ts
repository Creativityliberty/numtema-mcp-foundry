import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createOAuthService } from '../src/oauth/service.js';
import { createPkceChallenge } from '../src/oauth/pkce.js';
import { hashPassword } from '../src/oauth/password.js';
import type { OAuthGatewayConfig } from '../src/oauth/types.js';

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'foundry-oauth-service-'));
  const pair = generateKeyPairSync('ed25519');
  const config: OAuthGatewayConfig = {
    issuer: 'https://auth.example.test',
    resource: 'https://mcp.example.test/mcp',
    signing_key_id: 'oauth-key-1',
    private_key_pem: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    public_key_pem: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    storage_directory: directory,
    scopes_supported: ['mcp:tools', 'customers:read', 'customers:write'],
    baseline_scopes: ['mcp:tools'],
    access_token_ttl_seconds: 300,
    refresh_token_ttl_seconds: 3600,
    authorization_code_ttl_seconds: 120,
    allow_dynamic_client_registration: true,
    workspaces: [{ id: 'workspace-1', name: 'Workspace One' }],
    users: [{
      id: 'user-1', username: 'demo@example.test', display_name: 'Demo User',
      password_hash: hashPassword('demo-password'), workspace_refs: ['workspace-1'],
      allowed_scopes: ['mcp:tools', 'customers:read'], status: 'active'
    }],
    clients: [{
      client_id: 'client-1', client_name: 'ChatGPT Test', redirect_uris: ['https://chatgpt.example.test/callback'],
      grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'],
      token_endpoint_auth_method: 'none', created_at: '2026-07-22T18:00:00.000Z'
    }]
  };
  return { directory, service: createOAuthService(config), config };
}

const verifier = 'verifier-abcdefghijklmnopqrstuvwxyz-0123456789-ABCDEFG';

describe('OAuth authorization service', () => {
  it('issues a single-use code, access token and rotating refresh token', async () => {
    const { directory, service, config } = await fixture();
    try {
      const authorization = await service.authorize({
        clientId: 'client-1', redirectUri: 'https://chatgpt.example.test/callback', resource: config.resource,
        scopes: ['mcp:tools', 'customers:read'], codeChallenge: createPkceChallenge(verifier),
        codeChallengeMethod: 'S256', username: 'demo@example.test', password: 'demo-password',
        workspaceRef: 'workspace-1', now: '2026-07-22T18:01:00.000Z'
      });
      const token = await service.exchangeAuthorizationCode({
        code: authorization.code, clientId: 'client-1', redirectUri: 'https://chatgpt.example.test/callback',
        codeVerifier: verifier, resource: config.resource, now: '2026-07-22T18:01:10.000Z'
      });
      assert.equal(token.token_type, 'Bearer');
      assert.equal(token.scope, 'customers:read mcp:tools');
      const claims = await service.validateAccessToken(token.access_token, '2026-07-22T18:01:20.000Z');
      assert.equal(claims.sub, 'user-1');
      assert.equal(claims.workspace_ref, 'workspace-1');
      await assert.rejects(() => service.exchangeAuthorizationCode({
        code: authorization.code, clientId: 'client-1', redirectUri: 'https://chatgpt.example.test/callback',
        codeVerifier: verifier, resource: config.resource, now: '2026-07-22T18:01:30.000Z'
      }), /AUTHORIZATION_CODE_CONSUMED/);

      const refreshed = await service.refresh({
        refreshToken: token.refresh_token, clientId: 'client-1', resource: config.resource,
        scopes: ['mcp:tools'], now: '2026-07-22T18:02:00.000Z'
      });
      assert.equal(refreshed.scope, 'mcp:tools');
      assert.notEqual(refreshed.refresh_token, token.refresh_token);
      await assert.rejects(() => service.refresh({
        refreshToken: token.refresh_token, clientId: 'client-1', resource: config.resource,
        now: '2026-07-22T18:02:10.000Z'
      }), /REFRESH_TOKEN_REVOKED/);
    } finally { await rm(directory, { recursive: true, force: true }); }
  });

  it('fails closed on redirect, PKCE, workspace and scope escalation', async () => {
    const { directory, service, config } = await fixture();
    try {
      await assert.rejects(() => service.authorize({
        clientId: 'client-1', redirectUri: 'https://evil.example.test/callback', resource: config.resource,
        scopes: ['mcp:tools'], codeChallenge: createPkceChallenge(verifier), codeChallengeMethod: 'S256',
        username: 'demo@example.test', password: 'demo-password', workspaceRef: 'workspace-1', now: '2026-07-22T18:01:00.000Z'
      }), /REDIRECT_URI_MISMATCH/);
      await assert.rejects(() => service.authorize({
        clientId: 'client-1', redirectUri: 'https://chatgpt.example.test/callback', resource: config.resource,
        scopes: ['customers:write'], codeChallenge: createPkceChallenge(verifier), codeChallengeMethod: 'S256',
        username: 'demo@example.test', password: 'demo-password', workspaceRef: 'workspace-1', now: '2026-07-22T18:01:00.000Z'
      }), /SCOPE_NOT_ALLOWED/);
      await assert.rejects(() => service.authorize({
        clientId: 'client-1', redirectUri: 'https://chatgpt.example.test/callback', resource: config.resource,
        scopes: ['mcp:tools'], codeChallenge: createPkceChallenge(verifier), codeChallengeMethod: 'plain',
        username: 'demo@example.test', password: 'demo-password', workspaceRef: 'workspace-1', now: '2026-07-22T18:01:00.000Z'
      }), /PKCE_METHOD_UNSUPPORTED/);
      await assert.rejects(() => service.authorize({
        clientId: 'client-1', redirectUri: 'https://chatgpt.example.test/callback', resource: config.resource,
        scopes: ['mcp:tools'], codeChallenge: createPkceChallenge(verifier), codeChallengeMethod: 'S256',
        username: 'demo@example.test', password: 'demo-password', workspaceRef: 'workspace-other', now: '2026-07-22T18:01:00.000Z'
      }), /WORKSPACE_NOT_ALLOWED/);
    } finally { await rm(directory, { recursive: true, force: true }); }
  });

  it('registers public clients and rejects unsafe redirect URIs', async () => {
    const { directory, service } = await fixture();
    try {
      const client = await service.registerClient({
        client_name: 'Dynamic ChatGPT Client', redirect_uris: ['https://chatgpt.example.test/oauth/callback'],
        grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], token_endpoint_auth_method: 'none'
      }, '2026-07-22T18:01:00.000Z');
      assert.match(client.client_id, /^client_/);
      await assert.rejects(() => service.registerClient({
        client_name: 'Unsafe Client', redirect_uris: ['http://evil.example.test/callback'],
        grant_types: ['authorization_code'], response_types: ['code'], token_endpoint_auth_method: 'none'
      }, '2026-07-22T18:01:00.000Z'), /REDIRECT_URI_INSECURE/);
    } finally { await rm(directory, { recursive: true, force: true }); }
  });

  it('revokes refresh and access tokens', async () => {
    const { directory, service, config } = await fixture();
    try {
      const auth = await service.authorize({
        clientId: 'client-1', redirectUri: 'https://chatgpt.example.test/callback', resource: config.resource,
        scopes: ['mcp:tools'], codeChallenge: createPkceChallenge(verifier), codeChallengeMethod: 'S256',
        username: 'demo@example.test', password: 'demo-password', workspaceRef: 'workspace-1', now: '2026-07-22T18:01:00.000Z'
      });
      const token = await service.exchangeAuthorizationCode({
        code: auth.code, clientId: 'client-1', redirectUri: 'https://chatgpt.example.test/callback',
        codeVerifier: verifier, resource: config.resource, now: '2026-07-22T18:01:10.000Z'
      });
      await service.revoke(token.refresh_token, '2026-07-22T18:01:20.000Z');
      await assert.rejects(() => service.refresh({ refreshToken: token.refresh_token, clientId: 'client-1', resource: config.resource, now: '2026-07-22T18:01:30.000Z' }), /REFRESH_TOKEN_REVOKED/);
      await service.revoke(token.access_token, '2026-07-22T18:01:40.000Z');
      await assert.rejects(() => service.validateAccessToken(token.access_token, '2026-07-22T18:01:50.000Z'), /TOKEN_REVOKED/);
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
});
