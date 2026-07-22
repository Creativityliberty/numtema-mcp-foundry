import type { IncomingMessage, ServerResponse } from 'node:http';
import { URL, URLSearchParams } from 'node:url';
import type { OAuthService } from './service.js';

export interface OAuthHttpGateway {
  handle(request: IncomingMessage, response: ServerResponse): Promise<boolean>;
}

export function createOAuthHttpGateway(service: OAuthService): OAuthHttpGateway {
  const resourcePath = new URL(service.config.resource).pathname.replace(/^\//, '');
  const protectedPaths = new Set([
    '/.well-known/oauth-protected-resource',
    `/.well-known/oauth-protected-resource/${resourcePath}`.replace(/\/$/, '')
  ]);
  return {
    async handle(request, response) {
      const parsed = new URL(request.url ?? '/', service.config.issuer);
      const path = parsed.pathname;
      if (request.method === 'OPTIONS') {
        response.writeHead(204, corsHeaders()); response.end(); return true;
      }
      if (request.method === 'GET' && protectedPaths.has(path)) {
        return sendJson(response, 200, service.metadata().protectedResource, cacheHeaders());
      }
      if (request.method === 'GET' && (path === '/.well-known/oauth-authorization-server' || path === '/.well-known/openid-configuration')) {
        return sendJson(response, 200, service.metadata().authorizationServer, cacheHeaders());
      }
      if (request.method === 'GET' && path === '/oauth/jwks') return sendJson(response, 200, service.metadata().jwks, cacheHeaders());
      if (request.method === 'GET' && path === '/oauth/authorize') return renderAuthorizationPage(service, parsed, response);
      if (request.method === 'POST' && path === '/oauth/authorize') return authorize(service, request, response);
      if (request.method === 'POST' && path === '/oauth/token') return token(service, request, response);
      if (request.method === 'POST' && path === '/oauth/register') return register(service, request, response);
      if (request.method === 'POST' && path === '/oauth/revoke') return revoke(service, request, response);
      if (request.method === 'GET' && path === '/oauth/userinfo') return userinfo(service, request, response);
      if (request.method === 'GET' && path === '/oauth/health') return sendJson(response, 200, { status: 'ok', issuer: service.config.issuer, resource: service.config.resource });
      if (request.method === 'GET' && path === '/docs') return sendHtml(response, 200, documentationPage(service));
      return false;
    }
  };
}

async function renderAuthorizationPage(service: OAuthService, url: URL, response: ServerResponse): Promise<boolean> {
  const clientId = requiredQuery(url, 'client_id');
  const redirectUri = requiredQuery(url, 'redirect_uri');
  const responseType = requiredQuery(url, 'response_type');
  const resource = requiredQuery(url, 'resource');
  const codeChallenge = requiredQuery(url, 'code_challenge');
  const method = requiredQuery(url, 'code_challenge_method');
  const scope = url.searchParams.get('scope') ?? service.config.baseline_scopes.join(' ');
  const state = url.searchParams.get('state') ?? '';
  const client = await service.getClient(clientId);
  if (!client || !client.redirect_uris.includes(redirectUri) || responseType !== 'code' || resource !== service.config.resource || method !== 'S256') {
    return sendHtml(response, 400, errorPage('Invalid OAuth authorization request.'));
  }
  const workspaces = service.config.workspaces.map((workspace) => `<option value="${escapeHtml(workspace.id)}">${escapeHtml(workspace.name)}</option>`).join('');
  const hidden = { client_id: clientId, redirect_uri: redirectUri, response_type: responseType, resource, scope, state, code_challenge: codeChallenge, code_challenge_method: method };
  const inputs = Object.entries(hidden).map(([name, value]) => `<input type="hidden" name="${name}" value="${escapeHtml(value)}">`).join('');
  return sendHtml(response, 200, `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Authorize ${escapeHtml(client.client_name)}</title><style>${consentCss()}</style></head><body><main><div class="mark">N</div><h1>Authorize ${escapeHtml(client.client_name)}</h1><p class="muted">This app requests access to <strong>${escapeHtml(scope)}</strong> for resource <code>${escapeHtml(resource)}</code>.</p><form method="post" action="/oauth/authorize">${inputs}<label>Email<input name="username" type="email" required autocomplete="username"></label><label>Password<input name="password" type="password" required autocomplete="current-password"></label><label>Workspace<select name="workspace_ref">${workspaces}</select></label><div class="actions"><button name="decision" value="approve" class="primary">Authorize</button><button name="decision" value="deny" class="secondary">Deny</button></div></form><p class="fine">PKCE S256 · exact redirect URI · audience-bound token</p></main></body></html>`);
}

async function authorize(service: OAuthService, request: IncomingMessage, response: ServerResponse): Promise<boolean> {
  const form = new URLSearchParams(await readBody(request, 64_000));
  const redirectUri = form.get('redirect_uri') ?? '';
  const state = form.get('state') ?? '';
  if (form.get('decision') !== 'approve') return oauthRedirect(response, redirectUri, { error: 'access_denied', state });
  try {
    const result = await service.authorize({
      clientId: requiredForm(form, 'client_id'), redirectUri, resource: requiredForm(form, 'resource'),
      scopes: splitScopes(form.get('scope')), codeChallenge: requiredForm(form, 'code_challenge'),
      codeChallengeMethod: requiredForm(form, 'code_challenge_method'), username: requiredForm(form, 'username'),
      password: requiredForm(form, 'password'), workspaceRef: requiredForm(form, 'workspace_ref')
    });
    return oauthRedirect(response, redirectUri, { code: result.code, state });
  } catch (error) {
    return oauthRedirect(response, redirectUri, { error: 'access_denied', error_description: errorMessage(error), state });
  }
}

async function token(service: OAuthService, request: IncomingMessage, response: ServerResponse): Promise<boolean> {
  if (!isFormRequest(request)) return sendOAuthError(response, 415, 'invalid_request', 'Content-Type must be application/x-www-form-urlencoded.');
  const form = new URLSearchParams(await readBody(request, 64_000));
  try {
    const grantType = requiredForm(form, 'grant_type');
    const result = grantType === 'authorization_code'
      ? await service.exchangeAuthorizationCode({
          code: requiredForm(form, 'code'), clientId: requiredForm(form, 'client_id'), redirectUri: requiredForm(form, 'redirect_uri'),
          codeVerifier: requiredForm(form, 'code_verifier'), resource: requiredForm(form, 'resource')
        })
      : grantType === 'refresh_token'
        ? await service.refresh({ refreshToken: requiredForm(form, 'refresh_token'), clientId: requiredForm(form, 'client_id'),
            resource: requiredForm(form, 'resource'), ...(form.has('scope') ? { scopes: splitScopes(form.get('scope')) } : {}) })
        : (() => { throw new Error('GRANT_TYPE_UNSUPPORTED'); })();
    return sendJson(response, 200, result, { 'Cache-Control': 'no-store', Pragma: 'no-cache' });
  } catch (error) {
    const message = errorMessage(error);
    const oauthError = message.includes('CLIENT') ? 'invalid_client' : message.includes('SCOPE') ? 'invalid_scope' : 'invalid_grant';
    return sendOAuthError(response, 400, oauthError, message);
  }
}

async function register(service: OAuthService, request: IncomingMessage, response: ServerResponse): Promise<boolean> {
  try {
    const body = JSON.parse(await readBody(request, 128_000)) as unknown;
    if (!isRecord(body)) throw new Error('CLIENT_METADATA_INVALID');
    const client = await service.registerClient({
      client_name: stringField(body, 'client_name'), redirect_uris: stringArray(body.redirect_uris),
      ...(Array.isArray(body.grant_types) ? { grant_types: stringArray(body.grant_types) } : {}),
      ...(Array.isArray(body.response_types) ? { response_types: stringArray(body.response_types) } : {}),
      ...(typeof body.token_endpoint_auth_method === 'string' ? { token_endpoint_auth_method: body.token_endpoint_auth_method } : {})
    });
    return sendJson(response, 201, client, { 'Cache-Control': 'no-store' });
  } catch (error) { return sendOAuthError(response, 400, 'invalid_client_metadata', errorMessage(error)); }
}

async function revoke(service: OAuthService, request: IncomingMessage, response: ServerResponse): Promise<boolean> {
  const form = new URLSearchParams(await readBody(request, 64_000));
  const value = form.get('token');
  if (value) await service.revoke(value);
  response.writeHead(200, { 'Cache-Control': 'no-store' }); response.end(); return true;
}

async function userinfo(service: OAuthService, request: IncomingMessage, response: ServerResponse): Promise<boolean> {
  const token = bearer(request);
  if (!token) return sendJson(response, 401, { error: 'invalid_token' }, { 'WWW-Authenticate': 'Bearer' });
  try {
    const claims = await service.validateAccessToken(token);
    const user = service.getUser(claims.sub);
    return sendJson(response, 200, { sub: claims.sub, name: user?.display_name ?? claims.sub, preferred_username: user?.username ?? claims.sub,
      workspace_ref: claims.workspace_ref, scope: claims.scope.join(' ') }, { 'Cache-Control': 'no-store' });
  } catch (error) { return sendJson(response, 401, { error: 'invalid_token', error_description: errorMessage(error) }, { 'WWW-Authenticate': 'Bearer error="invalid_token"' }); }
}

function oauthRedirect(response: ServerResponse, redirectUri: string, values: Record<string, string>): boolean {
  let url: URL;
  try { url = new URL(redirectUri); } catch { return sendHtml(response, 400, errorPage('Invalid redirect URI.')); }
  for (const [key, value] of Object.entries(values)) if (value) url.searchParams.append(key, value);
  response.writeHead(302, { Location: url.toString(), 'Cache-Control': 'no-store' }); response.end(); return true;
}
function sendOAuthError(response: ServerResponse, status: number, error: string, description: string): boolean {
  return sendJson(response, status, { error, error_description: description }, { 'Cache-Control': 'no-store' });
}
function sendJson(response: ServerResponse, status: number, body: unknown, extra: Record<string, string> = {}): boolean {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(), ...extra }); response.end(JSON.stringify(body)); return true;
}
function sendHtml(response: ServerResponse, status: number, html: string): boolean {
  response.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' https: http:", 'X-Frame-Options': 'DENY', ...corsHeaders() }); response.end(html); return true;
}
function corsHeaders(): Record<string, string> { return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' }; }
function cacheHeaders(): Record<string, string> { return { 'Cache-Control': 'public, max-age=300' }; }
function requiredQuery(url: URL, name: string): string { const value = url.searchParams.get(name); if (!value) throw new Error(`Missing ${name}.`); return value; }
function requiredForm(form: URLSearchParams, name: string): string { const value = form.get(name); if (!value) throw new Error(`Missing ${name}.`); return value; }
function splitScopes(value: string | null): string[] { return (value ?? '').split(/\s+/).filter(Boolean); }
function bearer(request: IncomingMessage): string | null { const value = request.headers.authorization; const text = Array.isArray(value) ? value[0] : value; return text?.startsWith('Bearer ') ? text.slice(7) : null; }
function isFormRequest(request: IncomingMessage): boolean { const value = request.headers['content-type']; const text = Array.isArray(value) ? value[0] : value; return text?.toLowerCase().startsWith('application/x-www-form-urlencoded') === true; }
async function readBody(request: IncomingMessage, maxBytes: number): Promise<string> { return new Promise((resolvePromise, reject) => { let source = ''; request.on('data', (chunk) => { source += chunk.toString('utf8'); if (source.length > maxBytes) reject(new Error('REQUEST_BODY_TOO_LARGE')); }); request.on('end', () => resolvePromise(source)); request.on('error', reject); }); }
function stringField(record: Record<string, unknown>, key: string): string { const value = record[key]; if (typeof value !== 'string' || value.length === 0) throw new Error(`Missing ${key}.`); return value; }
function stringArray(value: unknown): string[] { if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) throw new Error('Expected string array.'); return value; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
function escapeHtml(value: string): string { return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] ?? char)); }
function consentCss(): string { return `:root{font-family:Inter,ui-sans-serif,system-ui;background:#f5f7f4;color:#152019}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px}main{width:min(520px,100%);box-sizing:border-box;background:rgba(255,255,255,.92);border:1px solid #dfe7df;border-radius:28px;padding:34px;box-shadow:0 24px 70px rgba(26,45,33,.12)}.mark{width:48px;height:48px;display:grid;place-items:center;border-radius:16px;background:#173f32;color:white;font-weight:800}h1{font-size:28px;margin:22px 0 8px}.muted{color:#56645b;line-height:1.6}label{display:grid;gap:7px;margin:18px 0;font-weight:650}input,select{font:inherit;border:1px solid #cbd7cf;border-radius:14px;padding:13px;background:white}.actions{display:flex;gap:12px;margin-top:24px}button{font:inherit;border:0;border-radius:14px;padding:13px 18px;font-weight:750;cursor:pointer}.primary{background:#173f32;color:white}.secondary{background:#e9efeb;color:#26372d}.fine{font-size:12px;color:#7a867e;margin-top:24px}code{font-size:12px;word-break:break-all}`; }
function errorPage(message: string): string { return `<!doctype html><html><body><h1>Authorization error</h1><p>${escapeHtml(message)}</p></body></html>`; }
function documentationPage(service: OAuthService): string { return `<!doctype html><html><body><h1>Nümtema MCP Foundry OAuth Gateway</h1><p>Resource: <code>${escapeHtml(service.config.resource)}</code></p><p>Use OAuth 2.1 Authorization Code with PKCE S256.</p></body></html>`; }
