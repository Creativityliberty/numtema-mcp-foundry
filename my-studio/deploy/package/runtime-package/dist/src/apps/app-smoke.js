import { randomBytes } from 'node:crypto';
import { createPkceChallenge } from '../oauth/pkce.js';
export async function runChatGptAppSmoke(assembly, input) {
    const client = assembly.config.oauth.clients[0];
    if (!client)
        throw new Error('APP_SMOKE_CLIENT_MISSING');
    const verifier = randomBytes(48).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const code = await assembly.oauth.authorize({ clientId: client.client_id, redirectUri: client.redirect_uris[0], resource: assembly.summary.oauth_resource,
        scopes: assembly.config.oauth.scopes_supported, codeChallenge: createPkceChallenge(verifier), codeChallengeMethod: 'S256', username: input.username, password: input.password, workspaceRef: input.workspaceRef });
    const tokens = await assembly.oauth.exchangeAuthorizationCode({ code: code.code, clientId: client.client_id, redirectUri: client.redirect_uris[0], codeVerifier: verifier, resource: assembly.summary.oauth_resource });
    const claims = await assembly.oauth.validateAccessToken(tokens.access_token);
    const context = { auth: { subject_ref: claims.sub, client_ref: claims.client_id, workspace_ref: claims.workspace_ref, scopes: claims.scope } };
    const initialized = await assembly.router.handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'foundry-app-smoke', version: '1.1.0' } } }, context);
    const tools = await assembly.router.handle({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }, context);
    const resources = await assembly.router.handle({ jsonrpc: '2.0', id: 3, method: 'resources/list', params: {} }, context);
    let called = null;
    if (input.toolName)
        called = await assembly.router.handle({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: input.toolName, arguments: input.args ?? {}, _meta: { idempotencyKey: `app-smoke-${Date.now()}` } } }, context);
    return { initialized, tools, resources, called, oauth: { subject: claims.sub, client_id: claims.client_id, workspace_ref: claims.workspace_ref, scopes: claims.scope, refresh_token_issued: tokens.refresh_token.length > 0 } };
}
//# sourceMappingURL=app-smoke.js.map