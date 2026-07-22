import type { OAuthAccessTokenClaims, OAuthClient, OAuthGatewayConfig, OAuthTokenResponse, OAuthUser, OAuthPublicJwk } from './types.js';
export interface AuthorizeInput {
    clientId: string;
    redirectUri: string;
    resource: string;
    scopes?: string[];
    codeChallenge: string;
    codeChallengeMethod: string;
    username: string;
    password: string;
    workspaceRef: string;
    now?: string;
}
export interface ExchangeCodeInput {
    code: string;
    clientId: string;
    redirectUri: string;
    codeVerifier: string;
    resource: string;
    now?: string;
}
export interface RefreshInput {
    refreshToken: string;
    clientId: string;
    resource: string;
    scopes?: string[];
    now?: string;
}
export interface DynamicClientInput {
    client_name: string;
    redirect_uris: string[];
    grant_types?: string[];
    response_types?: string[];
    token_endpoint_auth_method?: string;
}
export interface OAuthService {
    config: OAuthGatewayConfig;
    authorize(input: AuthorizeInput): Promise<{
        code: string;
    }>;
    exchangeAuthorizationCode(input: ExchangeCodeInput): Promise<OAuthTokenResponse>;
    refresh(input: RefreshInput): Promise<OAuthTokenResponse>;
    registerClient(input: DynamicClientInput, now?: string): Promise<OAuthClient>;
    revoke(token: string, now?: string): Promise<void>;
    validateAccessToken(token: string, now?: string): Promise<OAuthAccessTokenClaims>;
    getClient(clientId: string): Promise<OAuthClient | undefined>;
    getUser(userId: string): OAuthUser | undefined;
    metadata(): {
        protectedResource: Record<string, unknown>;
        authorizationServer: Record<string, unknown>;
        jwks: {
            keys: OAuthPublicJwk[];
        };
    };
}
export declare function createOAuthService(config: OAuthGatewayConfig): OAuthService;
