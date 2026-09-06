import assert from 'node:assert/strict';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import { createFirstAdministrator, validateAdminEnvironment } from './create-default-admin.js';

const validEnvironment = {
    DATABASE_URL: 'postgresql://example.invalid/database',
    ADMIN_NAME: '  Administradora  ',
    ADMIN_EMAIL: '  ADMIN@example.com ',
    ADMIN_PASSWORD: 'segredo-forte',
};

test('admin creation validates, normalizes and inserts a new administrator', async () => {
    const queries = [];
    const messages = [];
    const pool = {
        async query(sql, params) {
            queries.push({ sql, params });
            if (sql.startsWith('SELECT')) return { rows: [] };
            return { rowCount: 1 };
        },
    };

    const result = await createFirstAdministrator({
        pool,
        env: validEnvironment,
        logger: { log: (message) => messages.push(message), error: (message) => messages.push(message) },
    });

    assert.deepEqual(result, { created: true });
    const inserted = queries.find(({ sql }) => sql.startsWith('INSERT'));
    assert.equal(inserted.params[0], 'Administradora');
    assert.equal(inserted.params[1], 'admin@example.com');
    assert.equal(inserted.params[3], 'admin');
    assert.notEqual(inserted.params[2], validEnvironment.ADMIN_PASSWORD);
    assert.equal(await bcrypt.compare(validEnvironment.ADMIN_PASSWORD, inserted.params[2]), true);
    assert.ok(messages.some((message) => message.includes('criado com sucesso')));
    assert.ok(messages.every((message) => !message.includes(validEnvironment.ADMIN_PASSWORD)));
});

test('short password and invalid email are rejected before database access', async () => {
    assert.throws(
        () => validateAdminEnvironment({ ...validEnvironment, ADMIN_PASSWORD: '12345' }),
        /pelo menos 6 caracteres/
    );
    assert.throws(
        () => validateAdminEnvironment({ ...validEnvironment, ADMIN_EMAIL: 'email-invalido' }),
        /ADMIN_EMAIL inválido/
    );
});

test('all admin variables are required and have no fallback', () => {
    for (const variable of ['DATABASE_URL', 'ADMIN_NAME', 'ADMIN_EMAIL', 'ADMIN_PASSWORD']) {
        assert.throws(
            () => validateAdminEnvironment({ ...validEnvironment, [variable]: '' }),
            new RegExp(variable)
        );
    }
});

test('existing user is reported without insert, password change or role promotion', async () => {
    const queries = [];
    const messages = [];
    const pool = {
        async query(sql, params) {
            queries.push({ sql, params });
            return { rows: [{ id: 42 }] };
        },
    };

    const result = await createFirstAdministrator({
        pool,
        env: validEnvironment,
        logger: { log: (message) => messages.push(message), error: (message) => messages.push(message) },
    });

    assert.deepEqual(result, { created: false, reason: 'already-exists' });
    assert.equal(queries.length, 1);
    assert.ok(queries[0].sql.startsWith('SELECT'));
    assert.ok(queries.every(({ sql }) => !/UPDATE|INSERT/i.test(sql)));
    assert.ok(messages.some((message) => message.includes('Nenhuma senha ou permissão foi alterada')));
    assert.ok(messages.every((message) => !message.includes(validEnvironment.ADMIN_PASSWORD)));
});
