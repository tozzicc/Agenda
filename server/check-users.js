import { query } from './db.js';
import pool from './db.js';

try {
    const r = await query('SELECT id, name, email, role FROM users');
    console.log('USERS_TABLE_DATA:');
    console.log(JSON.stringify(r.rows, null, 2));
} catch (err) {
    console.error('ERROR_QUERYING_USERS:', err);
} finally {
    await pool.end();
}
