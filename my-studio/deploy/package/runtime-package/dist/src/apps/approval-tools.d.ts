import type { ProviderAdapterBundle, ProviderAdapterContract } from '../adapters/types.js';
import type { ContractBundle, ToolContract } from '../contracts/types.js';
import type { McpCallToolResult, McpRegisteredTool, McpRequestContext } from '../mcp/types.js';
import { type RuntimeSigner } from '../mcp/signing.js';
import type { ApprovalProof } from '../runtime/types.js';
export interface ResolveDynamicApprovalInput {
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
export interface ApprovalController {
    callTool(name: string, args: Record<string, unknown>, context?: McpRequestContext): Promise<McpCallToolResult>;
    resolveApproval(input: ResolveDynamicApprovalInput): Promise<ApprovalProof | undefined>;
}
export interface ApprovalControllerOptions {
    contracts: ContractBundle;
    adapters: ProviderAdapterBundle;
    directory: string;
    signer: RuntimeSigner;
    now?: () => string;
}
export declare function createApprovalToolRegistrations(): McpRegisteredTool[];
export declare function createApprovalController(options: ApprovalControllerOptions): ApprovalController;
