import assert from 'node:assert/strict';
import test from 'node:test';
import {
    DEMO_COMPANY_NAME,
    DEMO_USERS,
    buildDemoAppointments,
    seedDemo,
    validateDemoEnvironment,
} from './seed-demo.js';

const validEnvironment = {
    DATABASE_URL: 'postgresql://example.invalid/agenda_demo',
    DEMO_MODE: 'true',
    DEMO_PASSWORD: 'senha-demo-segura',
};

function createFakeClient() {
    const queries = [];
    let nextUserId = 1;
    let seeded = false;

    return {
        queries,
        async query(sql, params = []) {
            const normalized = sql.replaceAll(String.fromCharCode(10), ' ').trim();
            queries.push({ sql: normalized, params });

            if (normalized.includes("key = 'demo_seed_version'")) {
                return { rows: seeded ? [{ value: '1' }] : [] };
            }
            if (normalized.startsWith('INSERT INTO users')) {
                return { rows: [{ id: nextUserId++ }], rowCount: 1 };
            }
            if (normalized.startsWith("INSERT INTO settings") && normalized.includes("'demo_seed_version'")) {
                seeded = true;
            }
            return { rows: [], rowCount: 1 };
        },
    };
}

test('seed refuses missing demo mode, password, invalid password and non-demo database before queries', async () => {
    const client = createFakeClient();
    await assert.rejects(() => seedDemo({ client, env: { ...validEnvironment, DEMO_MODE: 'false' } }), /DEMO_MODE=true/);
    await assert.rejects(() => seedDemo({ client, env: { ...validEnvironment, DEMO_PASSWORD: '' } }), /DEMO_PASSWORD é obrigatória/);
    await assert.rejects(() => seedDemo({ client, env: { ...validEnvironment, DEMO_PASSWORD: '12345' } }), /pelo menos 6 caracteres/);
    await assert.rejects(() => seedDemo({ client, env: { ...validEnvironment, DATABASE_URL: 'postgresql://example.invalid/agenda' } }), /deve conter "demo"/);
    assert.equal(client.queries.length, 0);
});

test('empty demo database receives fictional identity, users and appointments atomically', async () => {
    const client = createFakeClient();
    const messages = [];
    const now = new Date('2030-05-15T12:00:00Z');
    const result = await seedDemo({
        client,
        env: validEnvironment,
        now,
        logger: { log: (message) => messages.push(message), error: (message) => messages.push(message) },
    });

    assert.deepEqual(result, { seeded: true, users: 4, appointments: 12 });
    assert.equal(client.queries[0].sql, 'BEGIN');
    assert.equal(client.queries.at(-1).sql, 'COMMIT');

    const settings = client.queries.filter(({ sql }) => sql.startsWith('INSERT INTO settings'));
    assert.ok(settings.some(({ params }) => params[0] === 'company_name' && params[1] === DEMO_COMPANY_NAME));
    assert.ok(settings.some(({ params }) => params[0] === 'schedule_start' && params[1] === '09:00'));
    assert.ok(settings.some(({ params }) => params[0] === 'enable_lunch' && params[1] === 'true'));

    const users = client.queries.filter(({ sql }) => sql.startsWith('INSERT INTO users'));
    assert.equal(users.length, DEMO_USERS.length);
    assert.deepEqual(users.map(({ params }) => params[1]), DEMO_USERS.map(({ email }) => email));
    assert.deepEqual(users.map(({ params }) => params[3]), ['admin', 'user', 'user', 'user']);
    assert.ok(users.every(({ params }) => params[2] !== validEnvironment.DEMO_PASSWORD));

    const appointments = client.queries.filter(({ sql }) => sql.startsWith('INSERT INTO appointments'));
    assert.equal(appointments.length, 12);
    assert.ok(appointments.some(({ params }) => params[6] === 'cancelled'));
    assert.ok(appointments.some(({ params }) => params[6] === 'active'));
    assert.ok(messages.every((message) => !message.includes(validEnvironment.DEMO_PASSWORD)));
});

test('relative appointments include history and future while active future slots obey schedule', () => {
    const now = new Date('2030-05-15T12:00:00Z');
    const today = '2030-05-15';
    const appointments = buildDemoAppointments({
        'mariana@demo.local': 1,
        'lucas@demo.local': 2,
        'juliana@demo.local': 3,
    }, now);

    assert.ok(appointments.some(({ date }) => date < today));
    assert.ok(appointments.some(({ date }) => date > today));

    const activeKeys = new Set();
    for (const appointment of appointments.filter(({ status }) => status === 'active')) {
        const key = `${appointment.date} ${appointment.time}`;
        assert.equal(activeKeys.has(key), false);
        activeKeys.add(key);

        if (appointment.date > today) {
            const day = new Date(`${appointment.date}T12:00:00Z`).getUTCDay();
            assert.notEqual(day, 0);
            assert.notEqual(day, 6);
            assert.ok(appointment.time >= '09:00' && appointment.time < '18:00');
            assert.ok(appointment.time < '12:00' || appointment.time >= '13:00');
        }
    }

    const sharedSlot = appointments.filter(({ date, time }) => date === appointments[0].date && time === appointments[0].time);
    assert.deepEqual(sharedSlot.map(({ status }) => status).sort(), ['active', 'cancelled']);
});

test('second execution detects the marker and does not duplicate demo records', async () => {
    const client = createFakeClient();
    await seedDemo({ client, env: validEnvironment, now: new Date('2030-05-15T12:00:00Z'), logger: { log() {}, error() {} } });
    const queryCount = client.queries.length;
    const result = await seedDemo({ client, env: validEnvironment, now: new Date('2030-05-15T12:00:00Z'), logger: { log() {}, error() {} } });

    assert.deepEqual(result, { seeded: false, reason: 'already-seeded' });
    const secondRun = client.queries.slice(queryCount);
    assert.deepEqual(secondRun.map(({ sql }) => sql), [
        'BEGIN',
        "SELECT value FROM settings WHERE key = 'demo_seed_version' FOR UPDATE",
        'ROLLBACK',
    ]);
});

test('demo definitions contain only neutral fictional identities', () => {
    assert.equal(DEMO_COMPANY_NAME, 'Espaço Bem-Estar');
    assert.ok(DEMO_USERS.every(({ email }) => email.endsWith('@demo.local')));
    const serialized = JSON.stringify({ company: DEMO_COMPANY_NAME, users: DEMO_USERS });
    assert.ok(!serialized.includes('Camilo'));
    assert.ok(!serialized.includes('Fastwork'));
});

test('environment validation exposes no database connection details', () => {
    const result = validateDemoEnvironment(validEnvironment);
    assert.deepEqual(result, { password: validEnvironment.DEMO_PASSWORD });
});
