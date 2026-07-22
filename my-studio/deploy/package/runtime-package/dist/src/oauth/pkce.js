import { createHash, timingSafeEqual } from 'node:crypto';
export function createPkceChallenge(verifier) {
    if (verifier.length < 43 || verifier.length > 128)
        throw new Error('PKCE_VERIFIER_LENGTH_INVALID');
    if (!/^[A-Za-z0-9\-._~]+$/.test(verifier))
        throw new Error('PKCE_VERIFIER_CHARACTERS_INVALID');
    return base64Url(createHash('sha256').update(verifier).digest('base64'));
}
export function verifyPkceS256(verifier, expectedChallenge) {
    let actual;
    try {
        actual = createPkceChallenge(verifier);
    }
    catch {
        return false;
    }
    const left = Buffer.from(actual, 'utf8');
    const right = Buffer.from(expectedChallenge, 'utf8');
    return left.byteLength === right.byteLength && timingSafeEqual(left, right);
}
function base64Url(value) {
    return value.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
//# sourceMappingURL=pkce.js.map