import { type Server } from 'node:http';
import type { McpRouter } from '../mcp/jsonrpc-router.js';
import type { OAuthService } from '../oauth/service.js';
export interface FoundryAppHttpServerOptions {
    mcpPath?: string;
    allowedOrigins?: string[];
    requireMcpHeaders?: boolean;
    maxBodyBytes?: number;
    oauth: OAuthService;
    requiredScopes(message: unknown): string[];
    tls?: {
        certificate: string;
        privateKey: string;
    };
}
export declare function createFoundryAppHttpServer(router: McpRouter, options: FoundryAppHttpServerOptions): Server;
