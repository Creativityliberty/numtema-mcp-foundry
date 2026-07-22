import type { ProviderAdapterBundle, ProviderAdapterContract } from '../adapters/types.js';
import type { CredentialCatalog, ProviderAuthBindingBundle } from '../auth/types.js';
import type { ContractBundle, ToolContract } from '../contracts/types.js';
import type { ApprovalProof, BudgetAuthorization, RuntimeTrustStore } from '../runtime/types.js';
import type { McpCallToolResult, McpRequestContext } from './types.js';
import type { RuntimeSigner } from './signing.js';
export interface FoundryMcpRuntimeContext {
    subject_ref: string;
    client_ref: string;
    workspace_ref: string;
    provider_ref: string;
    provider_account_ref?: string;
}
export interface DynamicApprovalResolverInput {
    tool: ToolContract;
    adapter: ProviderAdapterContract;
    argumentsHash: string;
    contextHash: string;
    tenant: {
        subject_ref: string;
        client_ref: string;
        workspace_ref: string;
    };
    riskSummaryHash: string;
    costSummaryHash: string | null;
    at: string;
    args: Record<string, unknown>;
}
export interface FoundryMcpRuntimeOptions {
    contractBundle: ContractBundle;
    adapterBundle: ProviderAdapterBundle;
    authBindings: ProviderAuthBindingBundle;
    credentialCatalog: CredentialCatalog;
    trustStore: RuntimeTrustStore;
    ledgerDirectory: string;
    baseUrl: string;
    context: FoundryMcpRuntimeContext;
    policySigner: RuntimeSigner;
    dispatchSigner: RuntimeSigner;
    executionSigner: RuntimeSigner;
    credentialEnvironment: Record<string, string>;
    environment?: Record<string, string | undefined>;
    approvalsByTool?: Record<string, ApprovalProof>;
    approvalResolver?: (input: DynamicApprovalResolverInput) => Promise<ApprovalProof | undefined>;
    budgetsByTool?: Record<string, BudgetAuthorization>;
    timeoutMs?: number;
    now?: () => string;
}
export interface FoundryMcpRuntime {
    callTool(name: string, args: Record<string, unknown>, meta?: Record<string, unknown>, requestContext?: McpRequestContext): Promise<McpCallToolResult>;
}
export declare function createFoundryMcpRuntime(options: FoundryMcpRuntimeOptions): FoundryMcpRuntime;
