import pg from 'pg';
import bcrypt from 'bcryptjs';
import 'dotenv/config';
import { pathToFileURL } from 'url';
import { validatePassword } from './password-policy.js';

const { Pool } = pg;
const REQUIRED_VARIABLES = ['DATABASE_URL', 'ADMIN_NAME', 'ADMIN_EMAIL', 'ADMIN_PASSWORD'];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateAdminEnvironment(env) {
    const missing = REQUIRED_VARIABLES.filter((name) => typeof env[name] !== 'string' || env[name].trim() === '');
    if (missing.length > 0) {
        throw new Error(`Variáveis obrigatórias não configuradas: ${missing.join(', ')}`);
    }

    const name = env.ADMIN_NAME.trim();
    const email = env.ADMIN_EMAIL.trim().toLowerCase();
    const password = env.ADMIN_PASSWORD;

    if (name.length > 200) throw new Error('ADMIN_NAME deve ter no máximo 200 caracteres');
    if (email.length > 254 || !EMAIL_PATTERN.test(email)) throw new Error('ADMIN_EMAIL inválido');

    const passwordError = validatePassword(password);
    if (passwordError) throw new Error(`ADMIN_PASSWORD inválida: ${passwordError}`);

    return { name, email, password };
}

export async function createFirstAdministrator({ pool, env = process.env, logger = console }) {
    const { name, email, password } = validateAdminEnvironment(env);
    const existing = await pool.query(
        'SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
        [email]
    );

    if (existing.rows.length > 0) {
        logger.error(`Usuário já existe para o e-mail ${email}. Nenhuma senha ou permissão foi alterada.`);
        return { created: false, reason: 'already-exists' };
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        await pool.query(
            'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)',
            [name, email, hashedPassword, 'admin']
        );
    } catch (error) {
        if (error.code === '23505') {
            logger.error(`Usuário já existe para o e-mail ${email}. Nenhuma senha ou permissão foi alterada.`);
            return { created: false, reason: 'already-exists' };
        }
        throw error;
    }

    logger.log(`Administrador criado com sucesso para o e-mail ${email}.`);
    return { created: true };
}

async function main() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });

    try {
        const result = await createFirstAdministrator({ pool });
        if (!result.created) process.exitCode = 1;
    } catch (error) {
        console.error(`Não foi possível criar o administrador: ${error.message}`);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

const isDirectExecution = process.argv[1]
    && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
    await main();
}
