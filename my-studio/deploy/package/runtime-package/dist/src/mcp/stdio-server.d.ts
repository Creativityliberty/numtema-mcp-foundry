import type { McpRouter } from './jsonrpc-router.js';
export declare function handleStdioLine(router: McpRouter, line: string): Promise<string | null>;
export declare function startStdioServer(router: McpRouter): Promise<void>;
