import pg from 'pg';
import bcrypt from 'bcryptjs';
import 'dotenv/config';
import { pathToFileURL } from 'url';
import { validatePassword } from './password-policy.js';

const { Pool } = pg;

export const DEMO_COMPANY_NAME = 'Espaço Bem-Estar';
export const DEMO_SEED_VERSION = '1';
export const DEMO_USERS = [
    { name: 'Administrador Demo', email: 'admin@demo.local', role: 'admin' },
    { name: 'Mariana Alves', email: 'mariana@demo.local', role: 'user' },
    { name: 'Lucas Ferreira', email: 'lucas@demo.local', role: 'user' },
    { name: 'Juliana Costa', email: 'juliana@demo.local', role: 'user' },
];

export function validateDemoEnvironment(env) {
    if (env.DEMO_MODE !== 'true') {
        throw new Error('Seed recusado: defina DEMO_MODE=true exclusivamente no ambiente de demonstração');
    }
    if (typeof env.DEMO_PASSWORD !== 'string' || env.DEMO_PASSWORD.length === 0) {
        throw new Error('Seed recusado: DEMO_PASSWORD é obrigatória');
    }

    const passwordError = validatePassword(env.DEMO_PASSWORD);
    if (passwordError) throw new Error(`DEMO_PASSWORD inválida: ${passwordError}`);

    if (typeof env.DATABASE_URL !== 'string' || env.DATABASE_URL.trim() === '') {
        throw new Error('Seed recusado: DATABASE_URL é obrigatória');
    }

    let databaseName;
    try {
        databaseName = new URL(env.DATABASE_URL).pathname.slice(1).toLowerCase();
    } catch {
        throw new Error('Seed recusado: DATABASE_URL inválida');
    }

    if (!databaseName.includes('demo')) {
        throw new Error('Seed recusado: o nome do banco em DATABASE_URL deve conter "demo"');
    }

    return { password: env.DEMO_PASSWORD };
}

function addBusinessDays(date, amount) {
    const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const direction = amount < 0 ? -1 : 1;
    let remaining = Math.abs(amount);

    while (remaining > 0) {
        result.setUTCDate(result.getUTCDate() + direction);
        const day = result.getUTCDay();
        if (day !== 0 && day !== 6) remaining -= 1;
    }

    return result.toISOString().slice(0, 10);
}

export function buildDemoAppointments(userIds, now = new Date()) {
    const pastSharedDate = addBusinessDays(now, -15);
    return [
        { userId: userIds['mariana@demo.local'], date: pastSharedDate, time: '09:00', name: 'Mariana Alves', status: 'active', notes: 'Avaliação inicial' },
        { userId: userIds['lucas@demo.local'], date: pastSharedDate, time: '09:00', name: 'Lucas Ferreira', status: 'cancelled', notes: 'Reagendamento solicitado' },
        { userId: userIds['juliana@demo.local'], date: addBusinessDays(now, -10), time: '10:00', name: 'Juliana Costa', status: 'cancelled', notes: 'Consulta de acompanhamento' },
        { userId: userIds['mariana@demo.local'], date: addBusinessDays(now, -5), time: '11:00', name: 'Mariana Alves', status: 'active', notes: 'Retorno' },
        { userId: userIds['lucas@demo.local'], date: addBusinessDays(now, -2), time: '14:00', name: 'Lucas Ferreira', status: 'active', notes: 'Atendimento de rotina' },
        { userId: userIds['juliana@demo.local'], date: addBusinessDays(now, 1), time: '09:00', name: 'Juliana Costa', status: 'active', notes: 'Avaliação inicial' },
        { userId: userIds['mariana@demo.local'], date: addBusinessDays(now, 2), time: '10:00', name: 'Mariana Alves', status: 'active', notes: 'Consulta de acompanhamento' },
        { userId: userIds['lucas@demo.local'], date: addBusinessDays(now, 3), time: '11:00', name: 'Lucas Ferreira', status: 'active', notes: 'Retorno' },
        { userId: userIds['juliana@demo.local'], date: addBusinessDays(now, 4), time: '13:00', name: 'Juliana Costa', status: 'active', notes: 'Atendimento de rotina' },
        { userId: userIds['mariana@demo.local'], date: addBusinessDays(now, 5), time: '14:00', name: 'Mariana Alves', status: 'active', notes: 'Retorno' },
        { userId: userIds['lucas@demo.local'], date: addBusinessDays(now, 8), time: '15:00', name: 'Lucas Ferreira', status: 'active', notes: 'Consulta de acompanhamento' },
        { userId: userIds['juliana@demo.local'], date: addBusinessDays(now, 10), time: '16:00', name: 'Juliana Costa', status: 'cancelled', notes: 'Cancelamento fictício' },
    ];
}

export async function seedDemo({ client, env = process.env, now = new Date(), logger = console }) {
    const { password } = validateDemoEnvironment(env);
    await client.query('BEGIN');

    try {
        const existingSeed = await client.query(
            "SELECT value FROM settings WHERE key = 'demo_seed_version' FOR UPDATE"
        );
        if (existingSeed.rows.length > 0) {
            await client.query('ROLLBACK');
            logger.log('A demonstração já foi populada; nenhuma alteração foi realizada.');
            return { seeded: false, reason: 'already-seeded' };
        }

        const blockedPeriods = JSON.stringify([
            { start: addBusinessDays(now, 15), end: addBusinessDays(now, 16) },
        ]);
        const settings = [
            ['company_name', DEMO_COMPANY_NAME],
            ['schedule_start', '09:00'],
            ['schedule_end', '18:00'],
            ['schedule_interval', '60'],
            ['allow_saturday', 'false'],
            ['allow_sunday', 'false'],
            ['enable_lunch', 'true'],
            ['lunch_start', '12:00'],
            ['lunch_end', '13:00'],
            ['blocked_periods', blockedPeriods],
            ['admin_email', 'admin@demo.local'],
            ['app_logo', ''],
        ];

        for (const [key, value] of settings) {
            await client.query(
                'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
                [key, value]
            );
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const userIds = {};
        for (const user of DEMO_USERS) {
            const result = await client.query(
                'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id',
                [user.name, user.email, passwordHash, user.role]
            );
            userIds[user.email] = result.rows[0].id;
        }

        const appointments = buildDemoAppointments(userIds, now);
        for (const appointment of appointments) {
            await client.query(
                'INSERT INTO appointments (user_id, date, time, name, phone, notes, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                [appointment.userId, appointment.date, appointment.time, appointment.name, '00000000000', appointment.notes, appointment.status]
            );
        }

        await client.query(
            "INSERT INTO settings (key, value) VALUES ('demo_seed_version', $1)",
            [DEMO_SEED_VERSION]
        );
        await client.query('COMMIT');
        logger.log(`Demo "${DEMO_COMPANY_NAME}" populada com ${DEMO_USERS.length} usuários e ${appointments.length} agendamentos fictícios.`);
        return { seeded: true, users: DEMO_USERS.length, appointments: appointments.length };
    } catch (error) {
        await client.query('ROLLBACK');
        if (error.code === '23505') {
            throw new Error('Seed recusado: dados da demonstração já existem no banco de destino');
        }
        throw error;
    }
}

async function main() {
    try {
        validateDemoEnvironment(process.env);
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
        return;
    }

    const { databaseReady } = await import('./db.js');
    await databaseReady;

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });
    const client = await pool.connect();

    try {
        await seedDemo({ client });
    } catch (error) {
        console.error(`Não foi possível popular a demonstração: ${error.message}`);
        process.exitCode = 1;
    } finally {
        client.release();
        await pool.end();
    }
}

const isDirectExecution = process.argv[1]
    && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
    await main();
}
