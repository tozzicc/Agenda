import assert from 'node:assert/strict';
import test from 'node:test';
import { requireEnvironmentVariables } from './environment.js';

test('valid runtime configuration is accepted', () => {
    assert.doesNotThrow(() => requireEnvironmentVariables(
        { DATABASE_URL: 'postgresql://example.invalid/db', JWT_SECRET: 'secret', APP_URL: 'https://example.invalid' },
        ['DATABASE_URL', 'JWT_SECRET', 'APP_URL']
    ));
});

test('missing DATABASE_URL fails clearly without exposing configured secrets', () => {
    assert.throws(
        () => requireEnvironmentVariables({ JWT_SECRET: 'do-not-log', APP_URL: 'https://example.invalid' }, ['DATABASE_URL', 'JWT_SECRET', 'APP_URL']),
        (error) => error.message.includes('DATABASE_URL') && !error.message.includes('do-not-log')
    );
});

test('missing JWT_SECRET fails clearly without exposing the database URL', () => {
    assert.throws(
        () => requireEnvironmentVariables({ DATABASE_URL: 'postgresql://user:password@example.invalid/db', APP_URL: 'https://example.invalid' }, ['DATABASE_URL', 'JWT_SECRET', 'APP_URL']),
        (error) => error.message.includes('JWT_SECRET') && !error.message.includes('password')
    );
});
