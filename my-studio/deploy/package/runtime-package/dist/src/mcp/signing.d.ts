import type { RuntimeIntegrity, RuntimeSignature } from '../runtime/types.js';
export interface RuntimeSigner {
    keyId: string;
    privateKeyPem: string;
}
export declare function signArtifact<T extends Record<string, unknown>>(base: T, signer: RuntimeSigner): T & {
    integrity: RuntimeIntegrity;
    signature: RuntimeSignature;
};
