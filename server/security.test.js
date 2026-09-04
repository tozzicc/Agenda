import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import { rateLimit } from 'express-rate-limit';
import { createCredentialFingerprint, credentialFingerprintMatches, escapeHtml, validatePassword } from './password-policy.js';

test('password policy rejects short passwords and accepts six characters', () => {
    assert.match(validatePassword('12345'), /pelo menos 6/);
    assert.equal(validatePassword('123456'), null);
    assert.match(validatePassword(undefined), /obrigatória/);
});

test('reset credential becomes invalid after the password hash changes', () => {
    const fingerprint = createCredentialFingerprint('old-hash', 'secret');
    assert.equal(credentialFingerprintMatches(fingerprint, 'old-hash', 'secret'), true);
    assert.equal(credentialFingerprintMatches(fingerprint, 'new-hash', 'secret'), false);
    assert.equal(credentialFingerprintMatches('invalid', 'old-hash', 'secret'), false);
});

test('JWT invalid and expired tokens are rejected', () => {
    assert.throws(() => jwt.verify('invalid', 'secret'));
    const expired = jwt.sign({ type: 'reset' }, 'secret', { expiresIn: -1 });
    assert.throws(() => jwt.verify(expired, 'secret'), { name: 'TokenExpiredError' });
});

test('HTML supplied by users is escaped', () => {
    assert.equal(escapeHtml(`<script>alert("x")</script><b>'test' & value</b>`), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&lt;b&gt;&#39;test&#39; &amp; value&lt;/b&gt;');
});

test('rate limiter returns HTTP 429 while an unrelated route remains available', async (t) => {
    const app = express();
    app.post('/limited', rateLimit({ windowMs: 60_000, limit: 2, legacyHeaders: false }), (_req, res) => res.sendStatus(204));
    app.get('/normal', (_req, res) => res.sendStatus(204));
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    t.after(() => server.close());
    const { port } = server.address();
    const url = `http://127.0.0.1:${port}`;
    assert.equal((await fetch(`${url}/limited`, { method: 'POST' })).status, 204);
    assert.equal((await fetch(`${url}/limited`, { method: 'POST' })).status, 204);
    assert.equal((await fetch(`${url}/limited`, { method: 'POST' })).status, 429);
    assert.equal((await fetch(`${url}/normal`)).status, 204);
});
