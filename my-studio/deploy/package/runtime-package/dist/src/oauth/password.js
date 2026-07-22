import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
export function hashPassword(password) {
    if (password.length < 8)
        throw new Error('PASSWORD_TOO_SHORT');
    const salt = randomBytes(16).toString('hex');
    const digest = scryptSync(password, salt, 32).toString('hex');
    return `scrypt$${salt}$${digest}`;
}
export function verifyPassword(password, encoded) {
    const [algorithm, salt, digest] = encoded.split('$');
    if (algorithm !== 'scrypt' || !salt || !digest)
        return false;
    const actual = scryptSync(password, salt, 32);
    const expected = Buffer.from(digest, 'hex');
    return actual.byteLength === expected.byteLength && timingSafeEqual(actual, expected);
}
//# sourceMappingURL=password.js.map