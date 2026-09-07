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
    assert.ok(queries.some(({ sql }) => sql.startsWith('CREATE TABLE IF NOT EXISTS professionals')));
    assert.ok(queries.some(({ sql }) => sql.startsWith('CREATE TABLE IF NOT EXISTS services')));
    assert.ok(queries.some(({ sql }) => sql.startsWith('CREATE TABLE IF NOT EXISTS professional_services') && sql.includes('PRIMARY KEY (professional_id, service_id)')));
    assert.ok(queries.some(({ sql }) => sql.startsWith('CREATE TABLE IF NOT EXISTS appointments')));
    assert.ok(queries.some(({ sql }) => sql === 'ALTER TABLE appointments ADD COLUMN IF NOT EXISTS professional_id INTEGER'));
    assert.ok(queries.some(({ sql }) => sql === 'ALTER TABLE appointments ADD COLUMN IF NOT EXISTS service_id INTEGER'));
    assert.ok(queries.some(({ sql }) => sql.includes('ALTER TABLE services ADD COLUMN IF NOT EXISTS price NUMERIC(12,2)')));
    assert.ok(queries.some(({ sql }) => sql.includes('ALTER TABLE appointments ADD COLUMN IF NOT EXISTS service_price NUMERIC(12,2)')));
    assert.ok(queries.some(({ sql }) => sql.startsWith('DO ') && sql.includes('appointments_professional_id_fkey') && sql.includes('appointments_service_id_fkey')));
    assert.ok(queries.some(({ sql }) => sql.startsWith('CREATE TABLE IF NOT EXISTS settings')));
    assert.ok(queries.some(({ sql }) => sql === 'DROP INDEX IF EXISTS appointments_active_date_time_unique'));
    assert.ok(queries.some(({ sql }) => sql.startsWith('CREATE OR REPLACE FUNCTION prevent_appointment_overlap()') && sql.includes('pg_advisory_xact_lock') && sql.includes('IS DISTINCT FROM NEW.id')));
    assert.ok(queries.some(({ sql }) => sql.startsWith('CREATE TRIGGER appointments_prevent_overlap')));
    assert.ok(queries.some(({ sql, params }) => sql.startsWith('INSERT INTO settings') && params[0] === 'company_name' && params[1] === 'Agenda'));
    assert.ok(queries.every(({ sql }) => !/^(TRUNCATE|DELETE)/i.test(sql)));
    assert.ok(queries.filter(({ sql }) => /^DROP/i.test(sql)).every(({ sql }) => sql === 'DROP INDEX IF EXISTS appointments_active_date_time_unique' || sql === 'DROP TRIGGER IF EXISTS appointments_prevent_overlap ON appointments'));
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
    assert.ok(executed.filter(({ sql }) => sql.startsWith('CREATE TABLE IF NOT EXISTS')).length >= 6);
    assert.ok(executed.filter(({ sql }) => sql.startsWith('ALTER TABLE appointments ADD COLUMN IF NOT EXISTS')).every(({ sql }) => !sql.includes('NOT NULL')));
    assert.ok(executed.filter(({ sql }) => sql.startsWith('INSERT INTO settings')).every(({ sql }) => sql.includes('ON CONFLICT (key) DO NOTHING')));
});


test('legacy appointments remain compatible and ET-10 replaces the global index', async () => {
    await databaseReady;
    const professionalColumn = executed.find(({ sql }) => sql === 'ALTER TABLE appointments ADD COLUMN IF NOT EXISTS professional_id INTEGER');
    const serviceColumn = executed.find(({ sql }) => sql === 'ALTER TABLE appointments ADD COLUMN IF NOT EXISTS service_id INTEGER');
    assert.ok(professionalColumn);
    assert.ok(serviceColumn);
    assert.ok(!professionalColumn.sql.includes('NOT NULL'));
    assert.ok(!serviceColumn.sql.includes('NOT NULL'));
    assert.ok(executed.some(({ sql }) => sql === 'DROP INDEX IF EXISTS appointments_active_date_time_unique'));
    const overlapFunction = executed.find(({ sql }) => sql.startsWith('CREATE OR REPLACE FUNCTION prevent_appointment_overlap()'));
    assert.ok(overlapFunction.sql.includes("a.status = 'active'"));
    assert.ok(overlapFunction.sql.includes('a.professional_id = NEW.professional_id'));
    assert.ok(overlapFunction.sql.includes('NEW.time::time < a.time::time + make_interval'));
});
test.after(async () => {
    await pool.end();
});
