import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from './db.js';

const app = express();
const PORT = 3000;
const SECRET_KEY = 'your_secret_key'; // In production, use environment variable

app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
    if (['POST', 'PUT'].includes(req.method)) {
        console.log('Body:', JSON.stringify(req.body));
    }
    next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Auth Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Token de autenticação ausente' });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            console.error('JWT Verify Error:', err.message);
            return res.status(403).json({ error: 'Sessão inválida ou expirada. Por favor, faça login novamente.' });
        }
        req.user = user;
        next();
    });
};

// --- Auth Routes ---

app.post('/api/auth/register', (req, res, next) => {
    const { name, email, password } = req.body;
    console.log(`Registration attempt for email: ${email}`);

    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }

    try {
        const hashedPassword = bcrypt.hashSync(password, 10);
        db.run('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', [name, email, hashedPassword], function (err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(409).json({ error: 'Este email já está cadastrado.' });
                }
                console.error('Registration DB Error:', err);
                return res.status(500).json({ error: 'Erro ao salvar no banco de dados', message: err.message });
            }

            try {
                const userId = this.lastID;
                const token = jwt.sign({ id: userId, name, email, role: 'user' }, SECRET_KEY, { expiresIn: '24h' });
                console.log(`Registration successful for ID: ${userId}`);
                res.status(201).json({ token, user: { id: userId, name, email, role: 'user' } });
            } catch (tokenErr) {
                next(tokenErr);
            }
        });
    } catch (hashErr) {
        next(hashErr);
    }
});

app.post('/api/auth/login', (req, res, next) => {
    const { email, password } = req.body;
    console.log(`Login attempt for email: ${email}`);

    if (!email || !password) {
        return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
        if (err) {
            console.error('Login DB Error:', err);
            return res.status(500).json({ error: 'Erro ao consultar banco de dados', message: err.message });
        }

        if (!user) {
            console.log(`Login failed: User not found (${email})`);
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        try {
            const passwordIsValid = bcrypt.compareSync(password, user.password);
            if (!passwordIsValid) {
                console.log(`Login failed: Invalid password (${email})`);
                return res.status(401).json({ error: 'Senha incorreta' });
            }

            const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, SECRET_KEY, { expiresIn: '24h' });
            console.log(`Login successful for user: ${email} (Role: ${user.role})`);
            res.status(200).json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
        } catch (authErr) {
            next(authErr);
        }
    });
});

// --- Booking Routes ---

// Get booked slots for a specific date
app.get('/api/bookings', (req, res) => {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'Data é obrigatória' });

    db.all("SELECT time FROM appointments WHERE date = ? AND status = 'active'", [date], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.map(row => row.time));
    });
});

// Get user's bookings
app.get('/api/my-bookings', authenticateToken, (req, res) => {
    const isAdmin = req.user.role === 'admin';
    const query = isAdmin
        ? "SELECT a.*, u.name as user_name FROM appointments a JOIN users u ON a.user_id = u.id ORDER BY a.date DESC, a.time DESC"
        : "SELECT * FROM appointments WHERE user_id = ? ORDER BY date DESC, time DESC";
    const params = isAdmin ? [] : [req.user.id];

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Create new booking
app.post('/api/bookings', authenticateToken, (req, res) => {
    const { date, time, name, phone, notes } = req.body;
    const userId = req.user.id;

    if (!date || !time || !name || !phone) {
        return res.status(400).json({ error: 'Campos obrigatórios faltando' });
    }

    // Check for double booking
    db.get("SELECT * FROM appointments WHERE date = ? AND time = ? AND status = 'active'", [date, time], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (row) return res.status(409).json({ error: 'Este horário já foi reservado' });

        const stmt = db.prepare('INSERT INTO appointments (user_id, date, time, name, phone, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?)');
        stmt.run([userId, date, time, name, phone, notes, 'active'], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ id: this.lastID, message: 'Agendamento realizado com sucesso' });
        });
        stmt.finalize();
    });
});

// Update booking
app.put('/api/bookings/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const { date, time, notes } = req.body;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    db.get("SELECT * FROM appointments WHERE id = ?", [id], (err, booking) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!booking) return res.status(404).json({ error: 'Agendamento não encontrado' });

        // Allowed if owner OR admin
        if (booking.user_id !== userId && !isAdmin) return res.status(403).json({ error: 'Não autorizado' });

        // Check availability if date/time changed
        db.get("SELECT * FROM appointments WHERE date = ? AND time = ? AND status = 'active' AND id != ?", [date, time, id], (err, existing) => {
            if (existing) return res.status(409).json({ error: 'Este horário já está ocupado' });

            const stmt = db.prepare('UPDATE appointments SET date = ?, time = ?, notes = ? WHERE id = ?');
            stmt.run([date, time, notes, id], function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'Agendamento atualizado com sucesso' });
            });
            stmt.finalize();
        });
    });
});

// Cancel booking (Soft Delete)
app.delete('/api/bookings/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    db.get("SELECT * FROM appointments WHERE id = ?", [id], (err, booking) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!booking) return res.status(404).json({ error: 'Agendamento não encontrado' });

        // Allowed if owner OR admin
        if (booking.user_id !== userId && !isAdmin) return res.status(403).json({ error: 'Não autorizado' });

        const stmt = db.prepare("UPDATE appointments SET status = 'cancelled' WHERE id = ?");
        stmt.run([id], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Agendamento cancelado com sucesso' });
        });
        stmt.finalize();
    });
});

// Hard Delete booking
app.delete('/api/bookings/:id/force', authenticateToken, (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    db.get("SELECT * FROM appointments WHERE id = ?", [id], (err, booking) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!booking) return res.status(404).json({ error: 'Agendamento não encontrado' });

        // Allowed if owner OR admin
        if (booking.user_id !== userId && !isAdmin) return res.status(403).json({ error: 'Não autorizado' });

        const stmt = db.prepare("DELETE FROM appointments WHERE id = ?");
        stmt.run([id], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Agendamento removido permanentemente' });
        });
        stmt.finalize();
    });
});

// Global error handling middleware
app.use((err, req, res, next) => {
    console.error('SERVER ERROR:', err.stack);
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message,
        stack: err.stack
    });
});

process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('UNHANDLED REJECTION:', reason);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
