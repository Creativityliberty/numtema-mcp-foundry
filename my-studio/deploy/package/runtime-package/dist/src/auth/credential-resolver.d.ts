import type { ProviderAdapterContract } from '../adapters/types.js';
import type { CredentialCatalog, CredentialResolutionContext, CredentialResolutionPlan, ProviderAuthBindingContract } from './types.js';
export declare function resolveCredentialPlan(binding: ProviderAuthBindingContract, adapter: ProviderAdapterContract, catalog: CredentialCatalog, context: CredentialResolutionContext): CredentialResolutionPlan;
