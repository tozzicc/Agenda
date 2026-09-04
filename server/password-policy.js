import crypto from 'crypto';

export const MIN_PASSWORD_LENGTH = 6;

export function validatePassword(password) {
    if (typeof password !== 'string' || password.length === 0) return 'Senha é obrigatória';
    if (password.length < MIN_PASSWORD_LENGTH) return `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres`;
    return null;
}

export function createCredentialFingerprint(passwordHash, secret) {
    return crypto.createHmac('sha256', secret).update(passwordHash).digest('base64url');
}

export function credentialFingerprintMatches(fingerprint, passwordHash, secret) {
    if (typeof fingerprint !== 'string') return false;
    const expected = Buffer.from(createCredentialFingerprint(passwordHash, secret));
    const received = Buffer.from(fingerprint);
    return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

export function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}