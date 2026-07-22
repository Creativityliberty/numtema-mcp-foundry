import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import type { McpRouter } from './jsonrpc-router.js';
import type { OAuthService } from '../oauth/service.js';

export interface McpOAuthProtection {
  service: OAuthService;
  resourceMetadataUrl: string;
  baselineScopes: string[];
  requiredScopes(message: unknown): string[];
}

export interface McpHttpServerOptions {
  path?: string;
  allowedOrigins?: string[];
  bearerToken?: string;
  requireMcpHeaders?: boolean;
  maxBodyBytes?: number;
  oauth?: McpOAuthProtection;
}

export function createMcpHttpServer(router: McpRouter, options: McpHttpServerOptions = {}): Server {
  return createServer((request, response) => {
    void handleMcpHttpRequest(router, request, response, options).catch(() => {
      if (!response.headersSent) json(response, 500, { jsonrpc: '2.0', id: null, error: { code: -32603, message: 'Internal error' } });
      else response.end();
    });
  });
}

export async function handleMcpHttpRequest(
  router: McpRouter,
  request: IncomingMessage,
  response: ServerResponse,
  options: McpHttpServerOptions = {}
): Promise<void> {
  const path = options.path ?? '/mcp';
  const maxBodyBytes = options.maxBodyBytes ?? 1_048_576;
  const requestUrl = request.url?.split('?', 1)[0] ?? '';
  if (requestUrl !== path) return json(response, 404, { error: 'not_found' });
  if (request.method !== 'POST') {
    response.writeHead(405, { 'Content-Type': 'application/json', 'Allow': 'POST' });
    response.end(JSON.stringify({ error: 'method_not_allowed' }));
    return;
  }
  const origin = header(request, 'origin');
  if (origin !== undefined && !(options.allowedOrigins ?? []).includes(origin)) return json(response, 403, { error: 'origin_forbidden' });
  const accept = (header(request, 'accept') ?? '').toLowerCase();
  if (!accept.includes('application/json') || !accept.includes('text/event-stream')) return json(response, 406, { error: 'not_acceptable' });
  const contentType = (header(request, 'content-type') ?? '').toLowerCase();
  if (!contentType.startsWith('application/json')) return json(response, 415, { error: 'unsupported_media_type' });
  const protocolVersion = header(request, 'mcp-protocol-version');
  if (protocolVersion !== undefined && !['2025-11-25', '2025-06-18'].includes(protocolVersion)) return json(response, 400, { error: 'unsupported_protocol_version' });

  let body: unknown;
  try {
    body = JSON.parse(await readBody(request, maxBodyBytes)) as unknown;
  } catch (error) {
    return json(response, 400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: error instanceof Error ? error.message : 'Parse error' } });
  }
  if (!isRecord(body) || typeof body.method !== 'string') return json(response, 400, { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid Request' } });

  let authContext: { auth: { subject_ref: string; client_ref: string; workspace_ref: string; scopes: string[] } } | undefined;
  if (options.oauth !== undefined) {
    const authorization = header(request, 'authorization') ?? '';
    if (!authorization.startsWith('Bearer ') || authorization.length <= 7) return oauthUnauthorized(response, options.oauth, options.oauth.baselineScopes);
    try {
      const claims = await options.oauth.service.validateAccessToken(authorization.slice(7));
      const required = [...new Set(options.oauth.requiredScopes(body))].sort();
      const missing = required.filter((scope) => !claims.scope.includes(scope));
      if (missing.length > 0) return oauthInsufficientScope(response, options.oauth, [...new Set([...claims.scope, ...missing])].sort());
      authContext = { auth: { subject_ref: claims.sub, client_ref: claims.client_id, workspace_ref: claims.workspace_ref, scopes: [...claims.scope] } };
    } catch {
      return oauthUnauthorized(response, options.oauth, options.oauth.baselineScopes);
    }
  } else if (options.bearerToken !== undefined) {
    const authorization = header(request, 'authorization') ?? '';
    const expected = `Bearer ${options.bearerToken}`;
    if (!constantTimeEqual(authorization, expected)) return json(response, 401, { error: 'unauthorized' }, { 'WWW-Authenticate': 'Bearer' });
  }

  const mirroredMethod = header(request, 'mcp-method');
  if ((options.requireMcpHeaders === true && mirroredMethod === undefined) || (mirroredMethod !== undefined && mirroredMethod !== body.method)) {
    return json(response, 400, { error: 'mcp_method_header_mismatch' });
  }
  if (body.method === 'tools/call') {
    const toolName = isRecord(body.params) && typeof body.params.name === 'string' ? body.params.name : undefined;
    const mirroredName = header(request, 'mcp-name');
    if ((options.requireMcpHeaders === true && mirroredName === undefined) || (mirroredName !== undefined && mirroredName !== toolName)) {
      return json(response, 400, { error: 'mcp_name_header_mismatch' });
    }
  }
  const result = await router.handle(body, authContext);
  if (result === null) {
    response.writeHead(202, { 'Content-Type': 'application/json' });
    response.end();
    return;
  }
  return json(response, 200, result);
}

function oauthUnauthorized(response: ServerResponse, oauth: McpOAuthProtection, scopes: string[]): void {
  const challenge = `Bearer resource_metadata="${oauth.resourceMetadataUrl}", scope="${scopes.join(' ')}"`;
  return json(response, 401, { error: 'unauthorized' }, { 'WWW-Authenticate': challenge });
}
function oauthInsufficientScope(response: ServerResponse, oauth: McpOAuthProtection, scopes: string[]): void {
  const challenge = `Bearer error="insufficient_scope", scope="${scopes.join(' ')}", resource_metadata="${oauth.resourceMetadataUrl}", error_description="Additional permission is required"`;
  return json(response, 403, { error: 'insufficient_scope', required_scopes: scopes }, { 'WWW-Authenticate': challenge });
}
function header(request: IncomingMessage, name: string): string | undefined {
  const value = request.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}
async function readBody(request: IncomingMessage, maxBytes: number): Promise<string> {
  return new Promise<string>((resolvePromise, reject) => {
    let source = '';
    request.on('data', (chunk) => {
      source += chunk.toString('utf8');
      if (source.length > maxBytes) reject(new Error('Request body exceeds configured limit.'));
    });
    request.on('end', () => resolvePromise(source));
    request.on('error', reject);
  });
}
function json(response: ServerResponse, status: number, body: unknown, extraHeaders: Record<string, string> = {}): void {
  response.writeHead(status, { 'Content-Type': 'application/json', ...extraHeaders });
  response.end(JSON.stringify(body));
}
function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  return leftBuffer.byteLength === rightBuffer.byteLength && timingSafeEqual(leftBuffer, rightBuffer);
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
