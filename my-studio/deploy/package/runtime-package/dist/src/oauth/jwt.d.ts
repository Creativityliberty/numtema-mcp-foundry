import type { OAuthAccessTokenClaims, OAuthPublicJwk } from './types.js';
export interface SignAccessTokenInput {
    issuer: string;
    resource: string;
    subject: string;
    clientId: string;
    workspaceRef: string;
    scopes: string[];
    ttlSeconds: number;
    keyId: string;
    privateKeyPem: string;
    now?: string;
}
export interface VerifyAccessTokenOptions {
    issuer: string;
    resource: string;
    publicKeys: Record<string, string>;
    revokedJti?: Set<string>;
    now?: string;
}
export declare function signAccessToken(input: SignAccessTokenInput): string;
export declare function verifyAccessToken(token: string, options: VerifyAccessTokenOptions): OAuthAccessTokenClaims;
export declare function publicJwk(publicKeyPem: string, keyId: string): OAuthPublicJwk;
