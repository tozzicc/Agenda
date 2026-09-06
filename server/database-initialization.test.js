import assert from 'node:assert/strict';
import test from 'node:test';
import pg from 'pg';

process.env.DATABASE_URL = 'postgresql://integration.invalid/empty';

const executed = [];
pg.Pool.prototype.query = async function (sql, params = []) {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    executed.push({ sql: normalized, params });
    if (normalized.startsWith('SELECT date, time, array_agg')) return { rows: [] };
    return { rows: [], rowCount: 1 };
};
pg.Pool.prototype.end = async function () {};

const { databaseReady, initializeDatabase, default: pool } = await import('./db.js');

function assertCompleteInitialization(queries) {
    assert.ok(queries.some(({ sql }) => sql.startsWith('CREATE TABLE IF NOT EXISTS users')), JSON.stringify(queries));
    assert.ok(queries.some(({ sql }) => sql.startsWith('CREATE TABLE IF NOT EXISTS appointments')));
    assert.ok(queries.some(({ sql }) => sql.startsWith('CREATE TABLE IF NOT EXISTS settings')));
    assert.ok(queries.some(({ sql }) => sql.includes('CREATE UNIQUE INDEX IF NOT EXISTS appointments_active_date_time_unique')));
    assert.ok(queries.some(({ sql, params }) => sql.startsWith('INSERT INTO settings') && params[0] === 'company_name' && params[1] === 'Agenda'));
    assert.ok(queries.every(({ sql }) => !/^(DROP|TRUNCATE|DELETE)/i.test(sql)));
    assert.ok(queries.every(({ sql }) => !/INSERT INTO (users|appointments)/i.test(sql)));
}

test('empty database initialization creates all required structure and defaults', async () => {
    await databaseReady;
    assertCompleteInitialization(executed);
});

test('database reinitialization remains idempotent and non-destructive', async () => {
    executed.length = 0;
    await initializeDatabase();
    assertCompleteInitialization(executed);
    assert.ok(executed.filter(({ sql }) => sql.startsWith('CREATE TABLE IF NOT EXISTS')).length >= 3);
    assert.ok(executed.filter(({ sql }) => sql.startsWith('INSERT INTO settings')).every(({ sql }) => sql.includes('ON CONFLICT (key) DO NOTHING')));
});

test.after(async () => {
    await pool.end();
});
