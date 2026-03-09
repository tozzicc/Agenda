import { query } from './db.js';
import pool from './db.js';

console.log('Running DB Diagnostics...');

try {
    const tables = ['users', 'appointments', 'settings'];

    for (const table of tables) {
        const result = await query(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1",
            [table]
        );
        if (result.rows.length > 0) {
            console.log(`SUCCESS: Table "${table}" exists.`);
        } else {
            console.log(`FAILURE: Table "${table}" DOES NOT exist.`);
        }
    }
} catch (err) {
    console.error('DIAGNOSTIC ERROR:', err.message);
} finally {
    await pool.end();
    console.log('Diagnostics complete.');
}
