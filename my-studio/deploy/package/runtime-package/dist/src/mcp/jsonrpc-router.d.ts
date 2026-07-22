import type { McpCallToolResult, McpToolRegistry, JsonRpcResponse, McpRequestContext, McpResourceRegistry } from './types.js';
export interface McpRouterOptions {
    registry: McpToolRegistry;
    serverName: string;
    serverVersion: string;
    protocolVersion?: string;
    resources?: McpResourceRegistry;
    callTool(name: string, args: Record<string, unknown>, meta?: Record<string, unknown>, context?: McpRequestContext): Promise<McpCallToolResult>;
}
export interface McpRouter {
    handle(message: unknown, context?: McpRequestContext): Promise<JsonRpcResponse | null>;
}
export declare function createMcpRouter(options: McpRouterOptions): McpRouter;
