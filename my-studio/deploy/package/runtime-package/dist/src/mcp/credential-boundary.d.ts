import type { ProviderAuthBindingContract, CredentialResolutionPlan } from '../auth/types.js';
import type { ProviderExecutionPlan } from '../adapters/types.js';
export interface CredentialBoundaryOptions {
    credentialEnvironment: Record<string, string>;
    environment: Record<string, string | undefined>;
}
export declare function injectCredential(plan: ProviderExecutionPlan, credentialPlan: CredentialResolutionPlan, binding: ProviderAuthBindingContract | undefined, options: CredentialBoundaryOptions): ProviderExecutionPlan['request'];
