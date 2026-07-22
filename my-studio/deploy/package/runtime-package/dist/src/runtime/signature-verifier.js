import { createPublicKey, verify } from 'node:crypto';
import { sha256ArtifactPayload } from './canonical.js';
export function verifySignedArtifact(artifact, trustStore, purpose, at) {
    const errors = [];
    const atMs = Date.parse(at);
    if (Number.isNaN(atMs))
        errors.push({ code: 'INVALID_PREFLIGHT_TIME', message: 'Preflight time must be RFC 3339.' });
    const digest = sha256ArtifactPayload(artifact);
    if (artifact.integrity.algorithm !== 'sha256' || artifact.integrity.digest !== digest) {
        errors.push({ code: 'INTEGRITY_MISMATCH', message: 'Artifact digest does not match the canonical signed payload.' });
    }
    const key = trustStore.keys.find((candidate) => candidate.key_id === artifact.signature.key_id);
    if (!key) {
        errors.push({ code: 'TRUST_KEY_NOT_FOUND', message: `No trusted key exists for ${artifact.signature.key_id}.` });
        return { valid: false, errors };
    }
    if (key.purpose !== purpose)
        errors.push({ code: 'TRUST_KEY_PURPOSE_MISMATCH', message: `Key ${key.key_id} is not trusted for ${purpose}.` });
    if (key.status !== 'active')
        errors.push({ code: 'TRUST_KEY_INACTIVE', message: `Key ${key.key_id} is ${key.status}.` });
    if (key.not_before !== undefined && atMs < Date.parse(key.not_before))
        errors.push({ code: 'TRUST_KEY_NOT_YET_VALID', message: `Key ${key.key_id} is not valid yet.` });
    if (key.expires_at !== undefined && atMs >= Date.parse(key.expires_at))
        errors.push({ code: 'TRUST_KEY_EXPIRED', message: `Key ${key.key_id} has expired.` });
    if (artifact.signature.algorithm !== 'ed25519' || key.algorithm !== 'ed25519') {
        errors.push({ code: 'SIGNATURE_ALGORITHM_UNSUPPORTED', message: 'Only Ed25519 runtime proofs are accepted.' });
    }
    if (errors.some((error) => error.code.startsWith('TRUST_') || error.code === 'SIGNATURE_ALGORITHM_UNSUPPORTED')) {
        return { valid: false, errors };
    }
    let validSignature = false;
    try {
        validSignature = verify(null, artifact.integrity.digest, createPublicKey(key.public_key_pem), Buffer.from(artifact.signature.value, 'base64'));
    }
    catch {
        validSignature = false;
    }
    if (!validSignature)
        errors.push({ code: 'SIGNATURE_INVALID', message: 'Artifact signature is invalid.' });
    return { valid: errors.length === 0, errors };
}
//# sourceMappingURL=signature-verifier.js.map