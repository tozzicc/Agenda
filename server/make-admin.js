import { query } from './db.js';
import pool from './db.js';

const email = process.argv[2];

if (!email) {
    console.error('Uso: node server/make-admin.js seu@email.com');
    process.exit(1);
}

try {
    const result = await query("UPDATE users SET role = 'admin' WHERE email = $1", [email]);
    if (result.rowCount === 0) {
        console.error('Usuário não encontrado:', email);
    } else {
        console.log(`Sucesso: O usuário ${email} agora é ADMINISTRADOR.`);
    }
} catch (err) {
    console.error('Erro ao atualizar:', err.message);
} finally {
    await pool.end();
}
