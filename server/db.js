import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://4791a9f3780af424b46763a08ecf87f249532358dd01d7ff76b3e622b3429de5:sk_Kr6H_sfuBzJRlA-VFnzPu@db.prisma.io:5432/postgres?sslmode=require&pool=true',
    ssl: { rejectUnauthorized: false },
});

// Helper function for queries
export async function query(text, params) {
    return pool.query(text, params);
}

// Initialize database tables
async function initializeDatabase() {
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
            ['schedule_interval', '30']
        ];
        for (const [key, value] of defaults) {
            await pool.query(
                'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
                [key, value]
            );
        }

        console.log('Connected to PostgreSQL database. Tables initialized.');
    } catch (err) {
        console.error('Error initializing database:', err.message);
        process.exit(1);
    }
}

initializeDatabase();

export default pool;
