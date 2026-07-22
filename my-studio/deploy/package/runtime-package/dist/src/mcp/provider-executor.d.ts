import type { ProviderAdapterContract, ProviderExecutionPlan } from '../adapters/types.js';
export interface ProviderExecutionOptions {
    timeoutMs: number;
}
export declare function executeProviderRequest(adapter: ProviderAdapterContract, request: ProviderExecutionPlan['request'], options: ProviderExecutionOptions): Promise<import("../adapters/types.js").NormalizedProviderResponse>;
