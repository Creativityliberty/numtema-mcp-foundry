export interface OAuthAccessTokenClaims {
    iss: string;
    sub: string;
    aud: string;
    exp: number;
    iat: number;
    jti: string;
    client_id: string;
    workspace_ref: string;
    scope: string[];
    token_use: 'access';
}
export interface OAuthPublicJwk {
    kty: string;
    crv: string;
    x: string;
    kid: string;
    use: 'sig';
    alg: 'EdDSA';
}
export interface OAuthWorkspace {
    id: string;
    name: string;
}
export interface OAuthUser {
    id: string;
    username: string;
    display_name: string;
    password_hash: string;
    workspace_refs: string[];
    allowed_scopes: string[];
    status: 'active' | 'disabled';
}
export interface OAuthClient {
    client_id: string;
    client_name: string;
    redirect_uris: string[];
    grant_types: ('authorization_code' | 'refresh_token')[];
    response_types: ['code'];
    token_endpoint_auth_method: 'none';
    created_at: string;
}
export interface OAuthGatewayConfig {
    issuer: string;
    resource: string;
    signing_key_id: string;
    private_key_pem: string;
    public_key_pem: string;
    storage_directory: string;
    scopes_supported: string[];
    baseline_scopes: string[];
    access_token_ttl_seconds: number;
    refresh_token_ttl_seconds: number;
    authorization_code_ttl_seconds: number;
    allow_dynamic_client_registration: boolean;
    users: OAuthUser[];
    workspaces: OAuthWorkspace[];
    clients: OAuthClient[];
}
export interface OAuthAuthorizationCodeRecord {
    code_digest: string;
    client_id: string;
    redirect_uri: string;
    resource: string;
    subject: string;
    workspace_ref: string;
    scopes: string[];
    code_challenge: string;
    created_at: string;
    expires_at: string;
    consumed_at: string | null;
}
export interface OAuthRefreshTokenRecord {
    token_digest: string;
    client_id: string;
    resource: string;
    subject: string;
    workspace_ref: string;
    scopes: string[];
    created_at: string;
    expires_at: string;
    revoked_at: string | null;
    replaced_by_digest: string | null;
}
export interface OAuthStoreState {
    version: 1;
    clients: OAuthClient[];
    authorization_codes: OAuthAuthorizationCodeRecord[];
    refresh_tokens: OAuthRefreshTokenRecord[];
    revoked_access_jti: string[];
}
export interface OAuthTokenResponse {
    access_token: string;
    token_type: 'Bearer';
    expires_in: number;
    refresh_token: string;
    scope: string;
}
