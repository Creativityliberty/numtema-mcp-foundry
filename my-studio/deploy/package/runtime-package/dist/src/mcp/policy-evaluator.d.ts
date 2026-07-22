import type { ApprovalProof, BudgetAuthorization, RuntimePolicyDecision } from '../runtime/types.js';
import type { PolicyContract, RiskClass, ToolContract } from '../contracts/types.js';
import type { ProviderExecutionPlan } from '../adapters/types.js';
import type { CredentialResolutionPlan } from '../auth/types.js';
import { type RuntimeSigner } from './signing.js';
export interface EvaluatePolicyInput {
    tool: ToolContract;
    policy: PolicyContract;
    executionPlan: ProviderExecutionPlan;
    credentialPlan: CredentialResolutionPlan;
    tenant: {
        subject_ref: string;
        client_ref: string;
        workspace_ref: string;
    };
    approval?: ApprovalProof;
    budget?: BudgetAuthorization;
    signer: RuntimeSigner;
    at: string;
    ttlSeconds?: number;
}
export declare function evaluateAndSignPolicy(input: EvaluatePolicyInput): RuntimePolicyDecision;
export declare function riskClassForTool(tool: ToolContract, policy: PolicyContract | undefined): RiskClass;
