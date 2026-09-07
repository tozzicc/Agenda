import pg from 'pg';
import { requireEnvironmentVariables } from './environment.js';

const { Pool } = pg;

requireEnvironmentVariables(process.env, ['DATABASE_URL']);

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

// Helper function for queries
export async function query(text, params) {
    return pool.query(text, params);
}

// Initialize database tables
export async function initializeDatabase() {
    try {
        // Create users table with role
        await pool.query(`CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'user'
        )`);

        // Create professionals and services without seeding operational data
        await pool.query(`CREATE TABLE IF NOT EXISTS professionals (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
            specialty TEXT,
            active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`);

        await pool.query(`CREATE TABLE IF NOT EXISTS services (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
            description TEXT,
            duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0 AND duration_minutes <= 1440),
            price NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (price >= 0),
            active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`);
        await pool.query('ALTER TABLE services ADD COLUMN IF NOT EXISTS price NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (price >= 0)');

        await pool.query(`CREATE TABLE IF NOT EXISTS professional_services (
            professional_id INTEGER NOT NULL REFERENCES professionals(id),
            service_id INTEGER NOT NULL REFERENCES services(id),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (professional_id, service_id)
        )`);
        // Create appointments table
        await pool.query(`CREATE TABLE IF NOT EXISTS appointments (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            date TEXT NOT NULL,
            time TEXT NOT NULL,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            notes TEXT,
            status TEXT DEFAULT 'active'
        )`);

        // Nullable references preserve all appointments created before ET-07.
        await pool.query('ALTER TABLE appointments ADD COLUMN IF NOT EXISTS professional_id INTEGER');
        await pool.query('ALTER TABLE appointments ADD COLUMN IF NOT EXISTS service_id INTEGER');
        await pool.query('ALTER TABLE appointments ADD COLUMN IF NOT EXISTS service_price NUMERIC(12,2) CHECK (service_price >= 0)');
        await pool.query(`DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_professional_id_fkey' AND conrelid = 'appointments'::regclass) THEN
                ALTER TABLE appointments ADD CONSTRAINT appointments_professional_id_fkey
                    FOREIGN KEY (professional_id) REFERENCES professionals(id);
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_service_id_fkey' AND conrelid = 'appointments'::regclass) THEN
                ALTER TABLE appointments ADD CONSTRAINT appointments_service_id_fkey
                    FOREIGN KEY (service_id) REFERENCES services(id);
            END IF;
        END $$`);
        // Create settings table
        await pool.query(`CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )`);

        // Insert default schedule settings if they don't exist
        const defaults = [
            ['schedule_start', '09:00'],
            ['schedule_end', '17:00'],
            ['schedule_interval', '30'],
            ['allow_saturday', 'false'],
            ['allow_sunday', 'false'],
            ['blocked_periods', '[]'],
            ['admin_email', ''],
            ['enable_lunch', 'false'],
            ['lunch_start', '12:00'],
            ['lunch_end', '13:00'],
            ['company_name', 'Agenda'],
            ['demo_mode', 'false'],
            ['whatsapp_number', '']
        ];
        for (const [key, value] of defaults) {
            await pool.query(
                'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
                [key, value]
            );
        }

        // ET-10: remove only the former global exact-slot index. A trigger serializes
        // writes by date and rejects real interval overlaps for the same professional.
        await pool.query('DROP INDEX IF EXISTS appointments_active_date_time_unique');
        await pool.query(`CREATE OR REPLACE FUNCTION prevent_appointment_overlap() RETURNS trigger AS $$
        DECLARE new_duration INTEGER;
        BEGIN
            IF NEW.status <> 'active' THEN RETURN NEW; END IF;
            PERFORM pg_advisory_xact_lock(hashtext(NEW.date));
            IF NEW.professional_id IS NULL OR NEW.service_id IS NULL THEN
                IF EXISTS (SELECT 1 FROM appointments a WHERE a.id IS DISTINCT FROM NEW.id AND a.status = 'active' AND a.date = NEW.date AND a.time = NEW.time) THEN
                    RAISE EXCEPTION 'appointment_overlap' USING ERRCODE = '23P01', CONSTRAINT = 'appointments_no_active_overlap';
                END IF;
                RETURN NEW;
            END IF;
            SELECT duration_minutes INTO new_duration FROM services WHERE id = NEW.service_id;
            IF new_duration IS NULL THEN RAISE EXCEPTION 'invalid_service'; END IF;
            IF EXISTS (SELECT 1 FROM appointments a LEFT JOIN services s ON s.id = a.service_id
                WHERE a.id IS DISTINCT FROM NEW.id AND a.status = 'active' AND a.date = NEW.date
                  AND (((a.professional_id IS NULL OR a.service_id IS NULL) AND a.time = NEW.time)
                    OR (a.professional_id = NEW.professional_id
                      AND NEW.time::time < a.time::time + make_interval(mins => s.duration_minutes)
                      AND NEW.time::time + make_interval(mins => new_duration) > a.time::time))) THEN
                RAISE EXCEPTION 'appointment_overlap' USING ERRCODE = '23P01', CONSTRAINT = 'appointments_no_active_overlap';
            END IF;
            RETURN NEW;
        END $$ LANGUAGE plpgsql`);
        await pool.query('DROP TRIGGER IF EXISTS appointments_prevent_overlap ON appointments');
        await pool.query(`CREATE TRIGGER appointments_prevent_overlap
            BEFORE INSERT OR UPDATE OF date, time, status, professional_id, service_id ON appointments
            FOR EACH ROW EXECUTE FUNCTION prevent_appointment_overlap()`);

        console.log('Connected to PostgreSQL database. Tables initialized.');
    } catch (err) {
        console.error('Error initializing database:', err.message);
        process.exit(1);
    }
}

export const databaseReady = initializeDatabase();

export default pool;
