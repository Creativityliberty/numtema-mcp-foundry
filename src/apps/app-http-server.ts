import { createServer, type Server, type RequestListener } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import type { McpRouter } from '../mcp/jsonrpc-router.js';
import { handleMcpHttpRequest, type McpHttpServerOptions } from '../mcp/http-server.js';
import { createOAuthHttpGateway } from '../oauth/http-gateway.js';
import type { OAuthService } from '../oauth/service.js';

export interface FoundryAppHttpServerOptions {
  mcpPath?: string;
  allowedOrigins?: string[];
  requireMcpHeaders?: boolean;
  maxBodyBytes?: number;
  oauth: OAuthService;
  requiredScopes(message: unknown): string[];
  tls?: { certificate: string; privateKey: string };
}

export function createFoundryAppHttpServer(router: McpRouter, options: FoundryAppHttpServerOptions): Server {
  const oauthGateway = createOAuthHttpGateway(options.oauth);
  const mcpOptions: McpHttpServerOptions = {
    path: options.mcpPath ?? '/mcp', allowedOrigins: options.allowedOrigins ?? [],
    requireMcpHeaders: options.requireMcpHeaders ?? false, maxBodyBytes: options.maxBodyBytes ?? 1_048_576,
    oauth: {
      service: options.oauth,
      resourceMetadataUrl: `${options.oauth.config.issuer.replace(/\/$/, '')}/.well-known/oauth-protected-resource`,
      baselineScopes: options.oauth.config.baseline_scopes,
      requiredScopes: options.requiredScopes
    }
  };
  const listener: RequestListener = (request, response) => {
    void (async () => {
      if (await oauthGateway.handle(request, response)) return;
      await handleMcpHttpRequest(router, request, response, mcpOptions);
    })().catch(() => {
      if (!response.headersSent) { response.writeHead(500, { 'Content-Type': 'application/json' }); response.end(JSON.stringify({ error: 'internal_error' })); }
      else response.end();
    });
  };
  return options.tls === undefined
    ? createServer(listener)
    : createHttpsServer({ cert: options.tls.certificate, key: options.tls.privateKey }, listener);
}
