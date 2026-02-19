import sqlite3 from 'sqlite3';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, 'database.sqlite');

const db = new sqlite3.Database(dbPath);

const name = 'Administrador';
const email = 'admin@admin.com';
const password = 'admin123';
const hashedPassword = bcrypt.hashSync(password, 10);

db.run(
    "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?) ON CONFLICT(email) DO UPDATE SET role='admin'",
    [name, email, hashedPassword, 'admin'],
    function (err) {
        if (err) {
            console.error('Erro ao criar admin:', err.message);
        } else {
            console.log('--- ACESSO ADMINISTRATIVO ---');
            console.log('Email: admin@admin.com');
            console.log('Senha: admin123');
            console.log('-----------------------------');
        }
        db.close();
    }
);
