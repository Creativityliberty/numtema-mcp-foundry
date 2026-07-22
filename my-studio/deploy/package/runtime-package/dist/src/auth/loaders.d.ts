import type { CredentialCatalog, CredentialResolutionContext, ProviderAuthBindingBundle } from './types.js';
export declare function loadCredentialCatalog(path: string, schemaDirectory?: string): Promise<CredentialCatalog>;
export declare function loadCredentialContext(path: string): Promise<CredentialResolutionContext>;
export declare function loadProviderAuthBindingBundle(path: string, schemaDirectory?: string): Promise<ProviderAuthBindingBundle>;
