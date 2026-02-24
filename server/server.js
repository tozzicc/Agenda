import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from './db.js';

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

app.post('/api/auth/register', async (req, res, next) => {
    const { name, email, password } = req.body;
    console.log(`Registration attempt for email: ${email}`);

    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }

    try {
        const hashedPassword = bcrypt.hashSync(password, 10);
        const result = await query(
            'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id',
            [name, email, hashedPassword]
        );

        const userId = result.rows[0].id;
        const token = jwt.sign({ id: userId, name, email, role: 'user' }, SECRET_KEY, { expiresIn: '24h' });
        console.log(`Registration successful for ID: ${userId}`);
        res.status(201).json({ token, user: { id: userId, name, email, role: 'user' } });
    } catch (err) {
        if (err.code === '23505') { // unique_violation
            return res.status(409).json({ error: 'Este email já está cadastrado.' });
        }
        console.error('Registration DB Error:', err);
        next(err);
    }
});

app.post('/api/auth/login', async (req, res, next) => {
    const { email, password } = req.body;
    console.log(`Login attempt for email: ${email}`);

    if (!email || !password) {
        return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    try {
        const result = await query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user) {
            console.log(`Login failed: User not found (${email})`);
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        const passwordIsValid = bcrypt.compareSync(password, user.password);
        if (!passwordIsValid) {
            console.log(`Login failed: Invalid password (${email})`);
            return res.status(401).json({ error: 'Senha incorreta' });
        }

        const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, SECRET_KEY, { expiresIn: '24h' });
        console.log(`Login successful for user: ${email} (Role: ${user.role})`);
        res.status(200).json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (err) {
        console.error('Login DB Error:', err);
        next(err);
    }
});

// --- Schedule Settings Routes ---

// Get schedule settings (public)
app.get('/api/settings/schedule', async (req, res, next) => {
    try {
        const result = await query(
            "SELECT key, value FROM settings WHERE key IN ('schedule_start', 'schedule_end', 'schedule_interval', 'allow_saturday', 'allow_sunday', 'blocked_periods')"
        );
        const settings = {};
        result.rows.forEach(row => { settings[row.key] = row.value; });
        res.json({
            start: settings.schedule_start || '09:00',
            end: settings.schedule_end || '17:00',
            interval: parseInt(settings.schedule_interval || '30', 10),
            allow_saturday: settings.allow_saturday === 'true',
            allow_sunday: settings.allow_sunday === 'true',
            blockedPeriods: JSON.parse(settings.blocked_periods || '[]')
        });
    } catch (err) {
        next(err);
    }
});

// Update schedule settings (admin only)
app.put('/api/settings/schedule', authenticateToken, async (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Apenas administradores podem alterar configurações' });
    }

    const { start, end, interval, allow_saturday, allow_sunday, blockedPeriods } = req.body;

    if (!start || !end || !interval) {
        return res.status(400).json({ error: 'Campos obrigatórios: start, end, interval' });
    }

    // Validate time format HH:MM
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(start) || !timeRegex.test(end)) {
        return res.status(400).json({ error: 'Formato de horário inválido. Use HH:MM' });
    }

    if (![15, 30, 60].includes(Number(interval))) {
        return res.status(400).json({ error: 'Intervalo deve ser 15, 30 ou 60 minutos' });
    }

    try {
        const updates = [
            ['schedule_start', start],
            ['schedule_end', end],
            ['schedule_interval', String(interval)],
            ['allow_saturday', String(!!allow_saturday)],
            ['allow_sunday', String(!!allow_sunday)],
            ['blocked_periods', JSON.stringify(blockedPeriods || [])]
        ];

        for (const [key, value] of updates) {
            await query(
                'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
                [key, value]
            );
        }

        res.json({
            message: 'Configurações salvas com sucesso',
            start,
            end,
            interval: Number(interval),
            allow_saturday,
            allow_sunday,
            blockedPeriods
        });
    } catch (err) {
        next(err);
    }
});

// --- Booking Routes ---

// Get booked slots for a specific date
app.get('/api/bookings', async (req, res, next) => {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'Data é obrigatória' });

    try {
        const result = await query(
            "SELECT time FROM appointments WHERE date = $1 AND status = 'active'",
            [date]
        );
        res.json(result.rows.map(row => row.time));
    } catch (err) {
        next(err);
    }
});

// Get user's bookings
app.get('/api/my-bookings', authenticateToken, async (req, res, next) => {
    const isAdmin = req.user.role === 'admin';

    try {
        let result;
        if (isAdmin) {
            result = await query(
                "SELECT a.*, u.name as user_name FROM appointments a JOIN users u ON a.user_id = u.id ORDER BY a.date DESC, a.time DESC"
            );
        } else {
            result = await query(
                "SELECT * FROM appointments WHERE user_id = $1 ORDER BY date DESC, time DESC",
                [req.user.id]
            );
        }
        res.json(result.rows);
    } catch (err) {
        next(err);
    }
});

// Create new booking
app.post('/api/bookings', authenticateToken, async (req, res, next) => {
    const { date, time, name, phone, notes } = req.body;
    const userId = req.user.id;

    if (!date || !time || !name || !phone) {
        return res.status(400).json({ error: 'Campos obrigatórios faltando' });
    }

    try {
        // Check for double booking
        const existing = await query(
            "SELECT * FROM appointments WHERE date = $1 AND time = $2 AND status = 'active'",
            [date, time]
        );
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'Este horário já foi reservado' });
        }

        const result = await query(
            'INSERT INTO appointments (user_id, date, time, name, phone, notes, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
            [userId, date, time, name, phone, notes, 'active']
        );
        res.status(201).json({ id: result.rows[0].id, message: 'Agendamento realizado com sucesso' });
    } catch (err) {
        next(err);
    }
});

// Update booking
app.put('/api/bookings/:id', authenticateToken, async (req, res, next) => {
    const { id } = req.params;
    const { date, time, notes } = req.body;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    try {
        const bookingResult = await query("SELECT * FROM appointments WHERE id = $1", [id]);
        const booking = bookingResult.rows[0];

        if (!booking) return res.status(404).json({ error: 'Agendamento não encontrado' });

        // Allowed if owner OR admin
        if (booking.user_id !== userId && !isAdmin) {
            return res.status(403).json({ error: 'Não autorizado' });
        }

        // Check availability if date/time changed
        const conflict = await query(
            "SELECT * FROM appointments WHERE date = $1 AND time = $2 AND status = 'active' AND id != $3",
            [date, time, id]
        );
        if (conflict.rows.length > 0) {
            return res.status(409).json({ error: 'Este horário já está ocupado' });
        }

        await query(
            'UPDATE appointments SET date = $1, time = $2, notes = $3 WHERE id = $4',
            [date, time, notes, id]
        );
        res.json({ message: 'Agendamento atualizado com sucesso' });
    } catch (err) {
        next(err);
    }
});

// Cancel booking (Soft Delete)
app.delete('/api/bookings/:id', authenticateToken, async (req, res, next) => {
    const { id } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    try {
        const bookingResult = await query("SELECT * FROM appointments WHERE id = $1", [id]);
        const booking = bookingResult.rows[0];

        if (!booking) return res.status(404).json({ error: 'Agendamento não encontrado' });

        // Allowed if owner OR admin
        if (booking.user_id !== userId && !isAdmin) {
            return res.status(403).json({ error: 'Não autorizado' });
        }

        await query("UPDATE appointments SET status = 'cancelled' WHERE id = $1", [id]);
        res.json({ message: 'Agendamento cancelado com sucesso' });
    } catch (err) {
        next(err);
    }
});

// Hard Delete booking
app.delete('/api/bookings/:id/force', authenticateToken, async (req, res, next) => {
    const { id } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    try {
        const bookingResult = await query("SELECT * FROM appointments WHERE id = $1", [id]);
        const booking = bookingResult.rows[0];

        if (!booking) return res.status(404).json({ error: 'Agendamento não encontrado' });

        // Allowed if owner OR admin
        if (booking.user_id !== userId && !isAdmin) {
            return res.status(403).json({ error: 'Não autorizado' });
        }

        await query("DELETE FROM appointments WHERE id = $1", [id]);
        res.json({ message: 'Agendamento removido permanentemente' });
    } catch (err) {
        next(err);
    }
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

// For local development
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

export default app;
