import { createPrivateKey, createPublicKey, randomUUID, sign, verify } from 'node:crypto';
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

export function signAccessToken(input: SignAccessTokenInput): string {
  const nowSeconds = Math.floor(Date.parse(input.now ?? new Date().toISOString()) / 1000);
  const claims: OAuthAccessTokenClaims = {
    iss: input.issuer,
    sub: input.subject,
    aud: input.resource,
    exp: nowSeconds + input.ttlSeconds,
    iat: nowSeconds,
    jti: randomUUID(),
    client_id: input.clientId,
    workspace_ref: input.workspaceRef,
    scope: [...new Set(input.scopes)].sort(),
    token_use: 'access'
  };
  const header = { alg: 'EdDSA', typ: 'JWT', kid: input.keyId };
  const signingInput = `${encodeJson(header)}.${encodeJson(claims)}`;
  const signature = sign(null, Buffer.from(signingInput, 'utf8'), createPrivateKey(input.privateKeyPem)).toString('base64');
  return `${signingInput}.${base64Url(signature)}`;
}

export function verifyAccessToken(token: string, options: VerifyAccessTokenOptions): OAuthAccessTokenClaims {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('TOKEN_FORMAT_INVALID');
  const [encodedHeader, encodedPayload, encodedSignature] = parts as [string, string, string];
  const header = decodeJson(encodedHeader);
  if (!isRecord(header) || header.alg !== 'EdDSA' || typeof header.kid !== 'string') throw new Error('TOKEN_HEADER_INVALID');
  const publicKeyPem = options.publicKeys[header.kid];
  if (!publicKeyPem) throw new Error('TOKEN_KEY_UNKNOWN');
  const signature = Buffer.from(fromBase64Url(encodedSignature), 'base64');
  const valid = verify(null, Buffer.from(`${encodedHeader}.${encodedPayload}`, 'utf8'), createPublicKey(publicKeyPem), signature);
  if (!valid) throw new Error('TOKEN_SIGNATURE_INVALID');
  const claims = decodeJson(encodedPayload);
  if (!isAccessClaims(claims)) throw new Error('TOKEN_CLAIMS_INVALID');
  const nowSeconds = Math.floor(Date.parse(options.now ?? new Date().toISOString()) / 1000);
  if (claims.iss !== options.issuer) throw new Error('TOKEN_ISSUER_MISMATCH');
  if (claims.aud !== options.resource) throw new Error('TOKEN_AUDIENCE_MISMATCH');
  if (claims.exp <= nowSeconds) throw new Error('TOKEN_EXPIRED');
  if (claims.iat > nowSeconds + 60) throw new Error('TOKEN_IAT_IN_FUTURE');
  if (options.revokedJti?.has(claims.jti) === true) throw new Error('TOKEN_REVOKED');
  return { ...claims, scope: [...new Set(claims.scope)].sort() };
}

export function publicJwk(publicKeyPem: string, keyId: string): OAuthPublicJwk {
  const value = createPublicKey(publicKeyPem).export({ format: 'jwk' });
  if (value.kty !== 'OKP' || value.crv !== 'Ed25519' || typeof value.x !== 'string') throw new Error('OAUTH_PUBLIC_KEY_NOT_ED25519');
  return { kty: 'OKP', crv: 'Ed25519', x: value.x, kid: keyId, use: 'sig', alg: 'EdDSA' };
}

function encodeJson(value: unknown): string {
  return base64Url(Buffer.from(JSON.stringify(value), 'utf8').toString('base64'));
}

function decodeJson(value: string): unknown {
  try { return JSON.parse(Buffer.from(fromBase64Url(value), 'base64').toString('utf8')) as unknown; }
  catch { throw new Error('TOKEN_JSON_INVALID'); }
}

function base64Url(value: string): string {
  return value.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function fromBase64Url(value: string): string {
  const base = value.replace(/-/g, '+').replace(/_/g, '/');
  return base + '='.repeat((4 - base.length % 4) % 4);
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isAccessClaims(value: unknown): value is OAuthAccessTokenClaims {
  return isRecord(value)
    && typeof value.iss === 'string' && typeof value.sub === 'string' && typeof value.aud === 'string'
    && typeof value.exp === 'number' && typeof value.iat === 'number' && typeof value.jti === 'string'
    && typeof value.client_id === 'string' && typeof value.workspace_ref === 'string'
    && Array.isArray(value.scope) && value.scope.every((scope) => typeof scope === 'string')
    && value.token_use === 'access';
}
