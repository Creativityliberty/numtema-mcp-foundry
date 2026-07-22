import type { ProviderAdapterBundle } from '../adapters/types.js';
import type { ContractBundle } from '../contracts/types.js';
import type { McpRegisteredTool, McpToolRegistry } from './types.js';
export declare function createMcpToolRegistry(bundle: ContractBundle, adapters: ProviderAdapterBundle, pageSize?: number, extraTools?: McpRegisteredTool[]): McpToolRegistry;
