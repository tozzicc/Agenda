import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const sqlite3 = require('sqlite3').verbose();
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, 'database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');

        // Create users table with role
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'user'
        )`, (err) => {
            if (!err) {
                // Try to add role column to existing table if it doesn't exist
                db.run("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'", (alterErr) => {
                    // Ignore error if column already exists
                });
            }
        });

        // Create appointments table
        // Added status column for cancellation (active/cancelled)
        db.run(`CREATE TABLE IF NOT EXISTS appointments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            time TEXT NOT NULL,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            notes TEXT,
            status TEXT DEFAULT 'active',
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`);
    }
});

export default db;
