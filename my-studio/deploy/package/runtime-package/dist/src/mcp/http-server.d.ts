import { type IncomingMessage, type Server, type ServerResponse } from 'node:http';
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
export declare function createMcpHttpServer(router: McpRouter, options?: McpHttpServerOptions): Server;
export declare function handleMcpHttpRequest(router: McpRouter, request: IncomingMessage, response: ServerResponse, options?: McpHttpServerOptions): Promise<void>;
