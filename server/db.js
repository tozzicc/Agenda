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

        const duplicateSlots = await pool.query(`
            SELECT date, time, array_agg(id ORDER BY id) AS ids
            FROM appointments
            WHERE status = 'active'
            GROUP BY date, time
            HAVING COUNT(*) > 1
        `);

        if (duplicateSlots.rows.length === 0) {
            await pool.query(`
                CREATE UNIQUE INDEX IF NOT EXISTS appointments_active_date_time_unique
                ON appointments (date, time)
                WHERE status = 'active'
            `);
        } else {
            console.error(
                'Índice de exclusividade não criado: existem horários ativos duplicados.',
                duplicateSlots.rows
            );
        }

        console.log('Connected to PostgreSQL database. Tables initialized.');
    } catch (err) {
        console.error('Error initializing database:', err.message);
        process.exit(1);
    }
}

export const databaseReady = initializeDatabase();

export default pool;
