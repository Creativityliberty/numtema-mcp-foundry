import type { ProviderAdapterContract, ProviderExecutionPlan, ProviderPlanOptions } from './types.js';
export declare class ProviderPlanError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
export declare function planProviderRequest(adapter: ProviderAdapterContract, args: Record<string, unknown>, options: ProviderPlanOptions): ProviderExecutionPlan;
