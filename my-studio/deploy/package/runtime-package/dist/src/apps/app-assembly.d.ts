import type { Server } from 'node:http';
import { type OAuthService } from '../oauth/service.js';
import { type McpRouter } from '../mcp/jsonrpc-router.js';
import type { ChatGptAppConfig, ChatGptAppSummary } from './app-config.js';
import type { McpToolRegistry } from '../mcp/types.js';
export interface LoadedChatGptAppAssembly {
    config: ChatGptAppConfig;
    oauth: OAuthService;
    router: McpRouter;
    registry: McpToolRegistry;
    server: Server;
    summary: ChatGptAppSummary;
}
export declare function loadChatGptAppAssembly(configPath: string, environment?: Record<string, string | undefined>): Promise<LoadedChatGptAppAssembly>;
export declare function createAppToolCaller(runtimeCall: (name: string, args: Record<string, unknown>, meta?: Record<string, unknown>, context?: import('../mcp/types.js').McpRequestContext) => Promise<import('../mcp/types.js').McpCallToolResult>, approvalCall: (name: string, args: Record<string, unknown>, context?: import('../mcp/types.js').McpRequestContext) => Promise<import('../mcp/types.js').McpCallToolResult>): (name: string, args: Record<string, unknown>, meta?: Record<string, unknown>, context?: import('../mcp/types.js').McpRequestContext) => Promise<import('../mcp/types.js').McpCallToolResult>;
export declare function createScopeResolver(registry: McpToolRegistry, baselineScopes: string[]): (message: unknown) => string[];
