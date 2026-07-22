import type { RuntimeKeyPurpose, RuntimeSignature, RuntimeTrustStore } from './types.js';
export interface SignedRuntimeArtifact {
    integrity: {
        algorithm: 'sha256';
        digest: string;
    };
    signature: RuntimeSignature;
}
export interface SignatureVerificationResult {
    valid: boolean;
    errors: Array<{
        code: string;
        message: string;
    }>;
}
export declare function verifySignedArtifact(artifact: SignedRuntimeArtifact, trustStore: RuntimeTrustStore, purpose: RuntimeKeyPurpose, at: string): SignatureVerificationResult;
