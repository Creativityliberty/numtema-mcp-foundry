import { randomBytes, randomUUID } from 'node:crypto';
import { URL } from 'node:url';
import { sha256 } from '../runtime/canonical.js';
import { signAccessToken, verifyAccessToken, publicJwk } from './jwt.js';
import { verifyPassword } from './password.js';
import { verifyPkceS256 } from './pkce.js';
import { OAuthStore } from './store.js';
export function createOAuthService(config) {
    validateConfig(config);
    const store = new OAuthStore(config.storage_directory, config.clients);
    const publicKeys = { [config.signing_key_id]: config.public_key_pem };
    return {
        config,
        async authorize(input) {
            const now = input.now ?? new Date().toISOString();
            const client = await requireClient(store, input.clientId);
            validateRedirect(client, input.redirectUri);
            requireResource(config, input.resource);
            if (input.codeChallengeMethod !== 'S256')
                throw new Error('PKCE_METHOD_UNSUPPORTED');
            if (input.codeChallenge.length < 43)
                throw new Error('PKCE_CHALLENGE_INVALID');
            const user = requireUser(config, input.username, input.password);
            if (!user.workspace_refs.includes(input.workspaceRef))
                throw new Error('WORKSPACE_NOT_ALLOWED');
            if (!config.workspaces.some((workspace) => workspace.id === input.workspaceRef))
                throw new Error('WORKSPACE_NOT_FOUND');
            const scopes = validateScopes(input.scopes ?? config.baseline_scopes, config.scopes_supported, user.allowed_scopes);
            const code = opaqueToken('code');
            const codeDigest = sha256(code);
            await store.mutate((state) => {
                state.authorization_codes.push({
                    code_digest: codeDigest,
                    client_id: client.client_id,
                    redirect_uri: input.redirectUri,
                    resource: input.resource,
                    subject: user.id,
                    workspace_ref: input.workspaceRef,
                    scopes,
                    code_challenge: input.codeChallenge,
                    created_at: now,
                    expires_at: addSeconds(now, config.authorization_code_ttl_seconds),
                    consumed_at: null
                });
                prune(state, now);
            });
            return { code };
        },
        async exchangeAuthorizationCode(input) {
            const now = input.now ?? new Date().toISOString();
            const refreshToken = opaqueToken('refresh');
            const result = await store.mutate((state) => {
                const record = state.authorization_codes.find((entry) => entry.code_digest === sha256(input.code));
                if (!record)
                    throw new Error('AUTHORIZATION_CODE_INVALID');
                if (record.consumed_at !== null)
                    throw new Error('AUTHORIZATION_CODE_CONSUMED');
                if (Date.parse(record.expires_at) <= Date.parse(now))
                    throw new Error('AUTHORIZATION_CODE_EXPIRED');
                if (record.client_id !== input.clientId)
                    throw new Error('AUTHORIZATION_CODE_CLIENT_MISMATCH');
                if (record.redirect_uri !== input.redirectUri)
                    throw new Error('REDIRECT_URI_MISMATCH');
                if (record.resource !== input.resource)
                    throw new Error('RESOURCE_MISMATCH');
                if (!verifyPkceS256(input.codeVerifier, record.code_challenge))
                    throw new Error('PKCE_VERIFICATION_FAILED');
                record.consumed_at = now;
                state.refresh_tokens.push({
                    token_digest: sha256(refreshToken), client_id: record.client_id, resource: record.resource,
                    subject: record.subject, workspace_ref: record.workspace_ref, scopes: [...record.scopes],
                    created_at: now, expires_at: addSeconds(now, config.refresh_token_ttl_seconds),
                    revoked_at: null, replaced_by_digest: null
                });
                prune(state, now);
                return { subject: record.subject, workspaceRef: record.workspace_ref, scopes: [...record.scopes] };
            });
            return issueTokens(config, result.subject, input.clientId, result.workspaceRef, result.scopes, refreshToken, now);
        },
        async refresh(input) {
            const now = input.now ?? new Date().toISOString();
            const replacement = opaqueToken('refresh');
            const result = await store.mutate((state) => {
                const record = state.refresh_tokens.find((entry) => entry.token_digest === sha256(input.refreshToken));
                if (!record)
                    throw new Error('REFRESH_TOKEN_INVALID');
                if (record.revoked_at !== null)
                    throw new Error('REFRESH_TOKEN_REVOKED');
                if (Date.parse(record.expires_at) <= Date.parse(now))
                    throw new Error('REFRESH_TOKEN_EXPIRED');
                if (record.client_id !== input.clientId)
                    throw new Error('REFRESH_TOKEN_CLIENT_MISMATCH');
                if (record.resource !== input.resource)
                    throw new Error('RESOURCE_MISMATCH');
                const requested = input.scopes ?? record.scopes;
                const scopes = validateScopes(requested, config.scopes_supported, record.scopes);
                const replacementDigest = sha256(replacement);
                record.revoked_at = now;
                record.replaced_by_digest = replacementDigest;
                state.refresh_tokens.push({
                    token_digest: replacementDigest, client_id: record.client_id, resource: record.resource,
                    subject: record.subject, workspace_ref: record.workspace_ref, scopes,
                    created_at: now, expires_at: addSeconds(now, config.refresh_token_ttl_seconds),
                    revoked_at: null, replaced_by_digest: null
                });
                prune(state, now);
                return { subject: record.subject, workspaceRef: record.workspace_ref, scopes };
            });
            return issueTokens(config, result.subject, input.clientId, result.workspaceRef, result.scopes, replacement, now);
        },
        async registerClient(input, now = new Date().toISOString()) {
            if (!config.allow_dynamic_client_registration)
                throw new Error('DYNAMIC_CLIENT_REGISTRATION_DISABLED');
            if (!input.client_name || !Array.isArray(input.redirect_uris) || input.redirect_uris.length === 0)
                throw new Error('CLIENT_METADATA_INVALID');
            for (const redirect of input.redirect_uris)
                validateRedirectUriSecurity(redirect);
            const grants = input.grant_types ?? ['authorization_code', 'refresh_token'];
            if (grants.some((grant) => grant !== 'authorization_code' && grant !== 'refresh_token'))
                throw new Error('GRANT_TYPE_UNSUPPORTED');
            const responses = input.response_types ?? ['code'];
            if (responses.length !== 1 || responses[0] !== 'code')
                throw new Error('RESPONSE_TYPE_UNSUPPORTED');
            if ((input.token_endpoint_auth_method ?? 'none') !== 'none')
                throw new Error('CLIENT_AUTH_METHOD_UNSUPPORTED');
            const client = {
                client_id: `client_${randomUUID()}`,
                client_name: input.client_name,
                redirect_uris: [...new Set(input.redirect_uris)].sort(),
                grant_types: [...new Set(grants)],
                response_types: ['code'], token_endpoint_auth_method: 'none', created_at: now
            };
            await store.mutate((state) => { state.clients.push(client); });
            return client;
        },
        async revoke(token, now = new Date().toISOString()) {
            if (token.includes('.')) {
                const claims = verifyAccessToken(token, { issuer: config.issuer, resource: config.resource, publicKeys, now });
                await store.mutate((state) => { if (!state.revoked_access_jti.includes(claims.jti))
                    state.revoked_access_jti.push(claims.jti); });
                return;
            }
            await store.mutate((state) => {
                const record = state.refresh_tokens.find((entry) => entry.token_digest === sha256(token));
                if (record)
                    record.revoked_at = now;
            });
        },
        async validateAccessToken(token, now = new Date().toISOString()) {
            const state = await store.read();
            return verifyAccessToken(token, {
                issuer: config.issuer, resource: config.resource, publicKeys,
                revokedJti: new Set(state.revoked_access_jti), now
            });
        },
        async getClient(clientId) {
            return (await store.read()).clients.find((client) => client.client_id === clientId);
        },
        getUser(userId) {
            return config.users.find((user) => user.id === userId);
        },
        metadata() {
            const issuer = config.issuer.replace(/\/$/, '');
            return {
                protectedResource: {
                    resource: config.resource,
                    authorization_servers: [config.issuer],
                    scopes_supported: [...config.scopes_supported].sort(),
                    bearer_methods_supported: ['header'],
                    resource_documentation: `${issuer}/docs`
                },
                authorizationServer: {
                    issuer: config.issuer,
                    authorization_endpoint: `${issuer}/oauth/authorize`,
                    token_endpoint: `${issuer}/oauth/token`,
                    registration_endpoint: `${issuer}/oauth/register`,
                    revocation_endpoint: `${issuer}/oauth/revoke`,
                    userinfo_endpoint: `${issuer}/oauth/userinfo`,
                    jwks_uri: `${issuer}/oauth/jwks`,
                    scopes_supported: [...config.scopes_supported].sort(),
                    response_types_supported: ['code'],
                    grant_types_supported: ['authorization_code', 'refresh_token'],
                    token_endpoint_auth_methods_supported: ['none'],
                    code_challenge_methods_supported: ['S256'],
                    client_id_metadata_document_supported: false
                },
                jwks: { keys: [publicJwk(config.public_key_pem, config.signing_key_id)] }
            };
        }
    };
}
async function requireClient(store, clientId) {
    const client = (await store.read()).clients.find((entry) => entry.client_id === clientId);
    if (!client)
        throw new Error('CLIENT_NOT_FOUND');
    return client;
}
function requireUser(config, username, password) {
    const user = config.users.find((entry) => entry.username.toLowerCase() === username.toLowerCase());
    if (!user || user.status !== 'active' || !verifyPassword(password, user.password_hash))
        throw new Error('USER_AUTHENTICATION_FAILED');
    return user;
}
function validateRedirect(client, redirectUri) {
    if (!client.redirect_uris.includes(redirectUri))
        throw new Error('REDIRECT_URI_MISMATCH');
}
function requireResource(config, resource) {
    if (resource !== config.resource)
        throw new Error('RESOURCE_MISMATCH');
}
function validateScopes(requested, supported, allowed) {
    const scopes = [...new Set(requested.filter((scope) => scope.length > 0))].sort();
    for (const scope of scopes) {
        if (!supported.includes(scope))
            throw new Error(`SCOPE_UNSUPPORTED: ${scope}`);
        if (!allowed.includes(scope))
            throw new Error(`SCOPE_NOT_ALLOWED: ${scope}`);
    }
    return scopes;
}
function validateRedirectUriSecurity(value) {
    let url;
    try {
        url = new URL(value);
    }
    catch {
        throw new Error('REDIRECT_URI_INVALID');
    }
    const localhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && localhost))
        throw new Error('REDIRECT_URI_INSECURE');
    if (url.hash)
        throw new Error('REDIRECT_URI_FRAGMENT_FORBIDDEN');
}
function issueTokens(config, subject, clientId, workspaceRef, scopes, refreshToken, now) {
    return {
        access_token: signAccessToken({
            issuer: config.issuer, resource: config.resource, subject, clientId, workspaceRef, scopes,
            ttlSeconds: config.access_token_ttl_seconds, keyId: config.signing_key_id,
            privateKeyPem: config.private_key_pem, now
        }),
        token_type: 'Bearer', expires_in: config.access_token_ttl_seconds,
        refresh_token: refreshToken, scope: [...scopes].sort().join(' ')
    };
}
function opaqueToken(prefix) {
    return `${prefix}_${randomBytes(32).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')}`;
}
function addSeconds(at, seconds) {
    return new Date(Date.parse(at) + seconds * 1000).toISOString();
}
function prune(state, now) {
    const cutoff = Date.parse(now) - 86_400_000;
    state.authorization_codes.splice(0, state.authorization_codes.length, ...state.authorization_codes.filter((record) => Date.parse(record.expires_at) >= cutoff));
    state.refresh_tokens.splice(0, state.refresh_tokens.length, ...state.refresh_tokens.filter((record) => Date.parse(record.expires_at) >= cutoff));
}
function validateConfig(config) {
    const issuer = new URL(config.issuer);
    const resource = new URL(config.resource);
    if (issuer.protocol !== 'https:' && issuer.hostname !== 'localhost' && issuer.hostname !== '127.0.0.1')
        throw new Error('OAUTH_ISSUER_HTTPS_REQUIRED');
    if (resource.hash)
        throw new Error('OAUTH_RESOURCE_FRAGMENT_FORBIDDEN');
    if (!config.scopes_supported.every((scope) => typeof scope === 'string' && scope.length > 0))
        throw new Error('OAUTH_SCOPES_INVALID');
    for (const scope of config.baseline_scopes)
        if (!config.scopes_supported.includes(scope))
            throw new Error('OAUTH_BASELINE_SCOPE_UNSUPPORTED');
}
//# sourceMappingURL=service.js.map