import { createPrivateKey, sign } from 'node:crypto';
import { sha256ArtifactPayload } from '../runtime/canonical.js';
export function signArtifact(base, signer) {
    const integrity = { algorithm: 'sha256', digest: sha256ArtifactPayload(base) };
    const signature = {
        algorithm: 'ed25519',
        key_id: signer.keyId,
        value: sign(null, integrity.digest, createPrivateKey(signer.privateKeyPem)).toString('base64')
    };
    return { ...base, integrity, signature };
}
//# sourceMappingURL=signing.js.map