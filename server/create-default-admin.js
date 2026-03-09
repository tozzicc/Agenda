import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://4791a9f3780af424b46763a08ecf87f249532358dd01d7ff76b3e622b3429de5:sk_wYIl9I2_2ziUJHZ26rmBK@db.prisma.io:5432/postgres?sslmode=require',
    ssl: { rejectUnauthorized: false },
});

const name = 'Administrador';
const email = 'admin@admin.com';
const password = 'admin123';
const hashedPassword = bcrypt.hashSync(password, 10);

try {
    await pool.query(
        "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO UPDATE SET role = 'admin'",
        [name, email, hashedPassword, 'admin']
    );
    console.log('--- ACESSO ADMINISTRATIVO ---');
    console.log('Email: admin@admin.com');
    console.log('Senha: admin123');
    console.log('-----------------------------');
} catch (err) {
    console.error('Erro ao criar admin:', err.message);
} finally {
    await pool.end();
}
