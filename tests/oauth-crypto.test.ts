import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { generateKeyPairSync } from 'node:crypto';
import { createPkceChallenge, verifyPkceS256 } from '../src/oauth/pkce.js';
import { signAccessToken, verifyAccessToken, publicJwk } from '../src/oauth/jwt.js';
import { hashPassword, verifyPassword } from '../src/oauth/password.js';

function keys() {
  const pair = generateKeyPairSync('ed25519');
  return {
    privateKeyPem: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    publicKeyPem: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString()
  };
}

describe('OAuth cryptographic primitives', () => {
  it('verifies PKCE S256 exactly', () => {
    const verifier = 'verifier-abcdefghijklmnopqrstuvwxyz-0123456789-ABCDEFG';
    const challenge = createPkceChallenge(verifier);
    assert.equal(verifyPkceS256(verifier, challenge), true);
    assert.equal(verifyPkceS256(`${verifier}x`, challenge), false);
  });

  it('signs and validates an audience-bound Ed25519 access token', () => {
    const key = keys();
    const token = signAccessToken({
      issuer: 'https://auth.example.test',
      resource: 'https://mcp.example.test/mcp',
      subject: 'user-1',
      clientId: 'client-1',
      workspaceRef: 'workspace-1',
      scopes: ['mcp:tools', 'customers:read'],
      ttlSeconds: 300,
      keyId: 'oauth-key-1',
      privateKeyPem: key.privateKeyPem,
      now: '2026-07-22T18:00:00.000Z'
    });
    const claims = verifyAccessToken(token, {
      issuer: 'https://auth.example.test',
      resource: 'https://mcp.example.test/mcp',
      publicKeys: { 'oauth-key-1': key.publicKeyPem },
      now: '2026-07-22T18:01:00.000Z'
    });
    assert.equal(claims.sub, 'user-1');
    assert.equal(claims.workspace_ref, 'workspace-1');
    assert.deepEqual(claims.scope, ['customers:read', 'mcp:tools']);
  });

  it('rejects wrong audience, expiry and modified signature', () => {
    const key = keys();
    const token = signAccessToken({
      issuer: 'https://auth.example.test', resource: 'https://mcp.example.test/mcp', subject: 'user-1',
      clientId: 'client-1', workspaceRef: 'workspace-1', scopes: ['mcp:tools'], ttlSeconds: 60,
      keyId: 'oauth-key-1', privateKeyPem: key.privateKeyPem, now: '2026-07-22T18:00:00.000Z'
    });
    assert.throws(() => verifyAccessToken(token, {
      issuer: 'https://auth.example.test', resource: 'https://other.example.test/mcp',
      publicKeys: { 'oauth-key-1': key.publicKeyPem }, now: '2026-07-22T18:00:30.000Z'
    }), /TOKEN_AUDIENCE_MISMATCH/);
    assert.throws(() => verifyAccessToken(token, {
      issuer: 'https://auth.example.test', resource: 'https://mcp.example.test/mcp',
      publicKeys: { 'oauth-key-1': key.publicKeyPem }, now: '2026-07-22T18:02:00.000Z'
    }), /TOKEN_EXPIRED/);
    const tokenParts = token.split('.');
    const sig = tokenParts[2]!;
    const index = Math.floor(sig.length / 2);
    const alteredSig = `${sig.slice(0, index)}${sig[index] === 'A' ? 'B' : 'A'}${sig.slice(index + 1)}`;
    const altered = `${tokenParts[0]}.${tokenParts[1]}.${alteredSig}`;
    assert.throws(() => verifyAccessToken(altered, {
      issuer: 'https://auth.example.test', resource: 'https://mcp.example.test/mcp',
      publicKeys: { 'oauth-key-1': key.publicKeyPem }, now: '2026-07-22T18:00:30.000Z'
    }), /TOKEN_SIGNATURE_INVALID/);
  });

  it('hashes passwords with a salt and verifies without storing plaintext', () => {
    const encoded = hashPassword('correct horse battery staple');
    assert.equal(encoded.includes('correct horse'), false);
    assert.equal(verifyPassword('correct horse battery staple', encoded), true);
    assert.equal(verifyPassword('wrong', encoded), false);
  });

  it('exports an Ed25519 public JWK', () => {
    const key = keys();
    const jwk = publicJwk(key.publicKeyPem, 'oauth-key-1');
    assert.equal(jwk.kty, 'OKP');
    assert.equal(jwk.crv, 'Ed25519');
    assert.equal(jwk.kid, 'oauth-key-1');
    assert.equal(jwk.use, 'sig');
  });
});
