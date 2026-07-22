import { createPrivateKey, sign } from 'node:crypto';
import { sha256ArtifactPayload } from '../runtime/canonical.js';
import type { RuntimeIntegrity, RuntimeSignature } from '../runtime/types.js';

export interface RuntimeSigner {
  keyId: string;
  privateKeyPem: string;
}

export function signArtifact<T extends Record<string, unknown>>(
  base: T,
  signer: RuntimeSigner
): T & { integrity: RuntimeIntegrity; signature: RuntimeSignature } {
  const integrity: RuntimeIntegrity = { algorithm: 'sha256', digest: sha256ArtifactPayload(base) };
  const signature: RuntimeSignature = {
    algorithm: 'ed25519',
    key_id: signer.keyId,
    value: sign(null, integrity.digest, createPrivateKey(signer.privateKeyPem)).toString('base64')
  };
  return { ...base, integrity, signature };
}
