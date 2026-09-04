import pg from 'pg';
import bcrypt from 'bcryptjs';
import 'dotenv/config';
import { validatePassword } from './password-policy.js';

const { Pool } = pg;

const requiredEnvironmentVariables = ['DATABASE_URL', 'ADMIN_EMAIL', 'ADMIN_PASSWORD'];
const missingEnvironmentVariables = requiredEnvironmentVariables.filter((name) => !process.env[name]);

if (missingEnvironmentVariables.length > 0) {
    throw new Error(`Variáveis de ambiente obrigatórias não configuradas: ${missingEnvironmentVariables.join(', ')}`);
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

const name = process.env.ADMIN_NAME || 'Administrador';
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const passwordError = validatePassword(password);
if (passwordError) throw new Error(`ADMIN_PASSWORD inválida: ${passwordError}`);
const hashedPassword = bcrypt.hashSync(password, 10);

try {
    await pool.query(
        "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO UPDATE SET role = 'admin'",
        [name, email, hashedPassword, 'admin']
    );
    console.log('Usuário administrador criado ou atualizado com sucesso.');
} catch (err) {
    console.error('Erro ao criar admin:', err.message);
} finally {
    await pool.end();
}
