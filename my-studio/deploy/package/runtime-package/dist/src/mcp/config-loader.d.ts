import type { ProviderAdapterBundle } from '../adapters/types.js';
import type { McpRouter } from './jsonrpc-router.js';
import type { McpRuntimeConfig, McpRuntimeConfigSummary } from './runtime-config.js';
export interface LoadedMcpAssembly {
    config: McpRuntimeConfig;
    router: McpRouter;
    summary: McpRuntimeConfigSummary;
    http: {
        host: string;
        port: number;
        path: string;
        allowedOrigins: string[];
        bearerToken?: string;
        requireMcpHeaders: boolean;
    };
}
export declare function loadMcpAssembly(configPath: string, environment?: Record<string, string | undefined>): Promise<LoadedMcpAssembly>;
export declare function loadProviderAdapterBundle(path: string): Promise<ProviderAdapterBundle>;
export declare function parseMcpRuntimeConfig(value: unknown): McpRuntimeConfig;
