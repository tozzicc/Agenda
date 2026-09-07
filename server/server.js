import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { rateLimit } from 'express-rate-limit';
import { createCredentialFingerprint, credentialFingerprintMatches, validatePassword } from './password-policy.js';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import 'dotenv/config';
import { databaseReady, query } from './db.js';
import { sendPasswordResetEmail, sendBookingConfirmationEmail } from './mailer.js';
import { hasAppointmentConflict, listAvailableTimes, validateScheduleAvailability } from './availability-v2.js';
import { requireEnvironmentVariables } from './environment.js';
import { cancelDemoAppointment, createDemoAppointment, deleteDemoAppointment, getDemoBookedTimes, getDemoSettings, isDemoModeValue, listDemoAppointments, listDemoAvailableTimes, listDemoProfessionals, listDemoServices, resetDemoAppointments, updateDemoAppointment } from './demo-mode.js';
import { parsePositiveId, validateActiveStatus, validateProfessional, validateService } from './catalog-validation.js';
import { aggregateDashboard, dashboardToday, resolveDashboardPeriod } from './dashboard.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
requireEnvironmentVariables(process.env, ['JWT_SECRET', 'APP_URL']);
await databaseReady;

const JWT_SECRET = process.env.JWT_SECRET;
const APP_URL = process.env.APP_URL.replace(/\/$/, '');
const authRateLimitWindowMs = 15 * 60 * 1000;
const createAuthRateLimiter = (limit) => rateLimit({ windowMs: authRateLimitWindowMs, limit, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' } });
const loginRateLimiter = createAuthRateLimiter(20);
const registerRateLimiter = createAuthRateLimiter(10);
const forgotPasswordRateLimiter = createAuthRateLimiter(10);
const resetPasswordRateLimiter = createAuthRateLimiter(10);

async function isDemoModeActive() {
    const result = await query("SELECT value FROM settings WHERE key = 'demo_mode'");
    return isDemoModeValue(result.rows[0]?.value);
}
app.use(cors({ origin: APP_URL }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '5mb', extended: true }));

// Configure Multer for Logo Uploads (Memory Storage for Base64)
const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|webp/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Apenas imagens (jpeg, jpg, png, webp) são permitidas!'));
    }
});

// Request logging middleware (request bodies may contain credentials or tokens)
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
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

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error('JWT Verify Error:', err.message);
            return res.status(403).json({ error: 'Sessão inválida ou expirada. Por favor, faça login novamente.' });
        }
        req.user = user;
        next();
    });
};

const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso restrito a administradores' });
    next();
};

async function ensureOperationalMode(res) {
    if (await isDemoModeActive()) {
        res.status(409).json({ error: 'Desative o modo demonstração para alterar cadastros operacionais' });
        return false;
    }
    return true;
}

async function validateCatalogSelection(serviceIdValue, professionalIdValue) {
    const serviceId = parsePositiveId(serviceIdValue);
    const professionalId = parsePositiveId(professionalIdValue);
    if (!serviceId || !professionalId) return { error: 'Servico e profissional sao obrigatorios' };
    if (await isDemoModeActive()) {
        const service = listDemoServices().find(({ id }) => id === serviceId);
        const professional = listDemoProfessionals(serviceId).find(({ id }) => id === professionalId);
        return service && professional ? { serviceId, professionalId, professionalName: professional.name, durationMinutes: service.duration_minutes, price: service.price } : { error: 'Servico ou profissional indisponivel' };
    }
    const result = await query(`SELECT p.name AS professional_name, s.duration_minutes, s.price::text AS price FROM professional_services ps
        JOIN services s ON s.id = ps.service_id AND s.active = TRUE
        JOIN professionals p ON p.id = ps.professional_id AND p.active = TRUE
        WHERE ps.service_id = $1 AND ps.professional_id = $2`, [serviceId, professionalId]);
    return result.rows.length ? { serviceId, professionalId, professionalName: result.rows[0].professional_name, durationMinutes: result.rows[0].duration_minutes, price: result.rows[0].price } : { error: 'Servico ou profissional indisponivel' };
}

async function listCatalogCandidates(serviceIdValue) {
    const serviceId = parsePositiveId(serviceIdValue);
    if (!serviceId) return { error: 'Servico invalido' };
    if (await isDemoModeActive()) {
        const service = listDemoServices().find(({ id }) => id === serviceId);
        if (!service) return { error: 'Servico indisponivel' };
        const professionals = listDemoProfessionals(serviceId).sort((a, b) => a.id - b.id);
        return { serviceId, durationMinutes: service.duration_minutes, price: service.price, professionals };
    }
    const result = await query(`SELECT p.id, p.name, s.duration_minutes, s.price::text AS price
        FROM professional_services ps
        JOIN services s ON s.id = ps.service_id AND s.active = TRUE
        JOIN professionals p ON p.id = ps.professional_id AND p.active = TRUE
        WHERE ps.service_id = $1 ORDER BY p.id`, [serviceId]);
    if (!result.rows.length) return { error: 'Servico ou profissional indisponivel' };
    return { serviceId, durationMinutes: result.rows[0].duration_minutes, price: result.rows[0].price, professionals: result.rows.map(({ id, name }) => ({ id, name })) };
}
// --- Auth Routes ---

app.post('/api/auth/register', registerRateLimiter, async (req, res, next) => {
    const { name, email, password } = req.body;
    console.log(`Registration attempt for email: ${email}`);

    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }

    const passwordError = validatePassword(password);
    if (passwordError) return res.status(400).json({ error: passwordError });

    try {
        const hashedPassword = bcrypt.hashSync(password, 10);
        const result = await query(
            'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id',
            [name, email, hashedPassword]
        );

        const userId = result.rows[0].id;
        const token = jwt.sign({ id: userId, name, email, role: 'user' }, JWT_SECRET, { expiresIn: '24h' });
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

app.post('/api/auth/login', loginRateLimiter, async (req, res, next) => {
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

        const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
        console.log(`Login successful for user: ${email} (Role: ${user.role})`);
        res.status(200).json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (err) {
        console.error('Login DB Error:', err);
        next(err);
    }
});

app.post('/api/auth/change-password', authenticateToken, async (req, res, next) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias' });
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) return res.status(400).json({ error: passwordError });

    try {
        const result = await query('SELECT password FROM users WHERE id = $1', [userId]);
        const user = result.rows[0];

        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        const passwordIsValid = bcrypt.compareSync(currentPassword, user.password);
        if (!passwordIsValid) {
            return res.status(401).json({ error: 'Senha atual incorreta' });
        }

        const hashedPassword = bcrypt.hashSync(newPassword, 10);
        await query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, userId]);

        res.json({ message: 'Senha alterada com sucesso' });
    } catch (err) {
        console.error('Change Password Error:', err);
        next(err);
    }
});

// Forgot Password - Generate reset token and log link
app.post('/api/auth/forgot-password', forgotPasswordRateLimiter, async (req, res, next) => {
    const { email } = req.body;
    console.log(`Forgot password request for: ${email}`);

    if (!email) {
        return res.status(400).json({ error: 'Email é obrigatório' });
    }

    try {
        const result = await query('SELECT id, name, password FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user) {
            // For security reasons, don't reveal if user exists, but we can log it
            console.log(`Reset requested for non-existent email: ${email}`);
            return res.json({ message: 'Se este email estiver cadastrado, um link de recuperação será enviado.' });
        }

        // Generate a reset token (short-lived: 1 hour)
        const resetToken = jwt.sign(
            { id: user.id, type: 'reset', credential: createCredentialFingerprint(user.password, JWT_SECRET) },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        const resetLink = `${APP_URL}/reset-password?token=${encodeURIComponent(resetToken)}`;

        try {
            await sendPasswordResetEmail(email, resetLink);
            console.log(`Email de recuperação enviado para: ${email}`);
        } catch (mailErr) {
            console.error('Failed to send email:', mailErr);
            // We don't necessarily want to fail the whole request for the user, 
            // but we could return an error if we prefer.
        }

        res.json({ message: 'Se este email estiver cadastrado, um link de recuperação será enviado.' });
    } catch (err) {
        console.error('Forgot Password Error:', err);
        next(err);
    }
});

// Reset Password - Verify token and update password
app.post('/api/auth/reset-password', resetPasswordRateLimiter, async (req, res, next) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
        return res.status(400).json({ error: 'Token e nova senha são obrigatórios' });
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) return res.status(400).json({ error: passwordError });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        if (decoded.type !== 'reset') {
            return res.status(400).json({ error: 'Token inválido para redefinição de senha' });
        }

        const userResult = await query('SELECT password FROM users WHERE id = $1', [decoded.id]);
        const user = userResult.rows[0];
        if (!user || !credentialFingerprintMatches(decoded.credential, user.password, JWT_SECRET)) {
            return res.status(400).json({ error: 'Link de recuperação inválido ou já utilizado' });
        }
        const hashedPassword = bcrypt.hashSync(newPassword, 10);
        const updateResult = await query('UPDATE users SET password = $1 WHERE id = $2 AND password = $3', [hashedPassword, decoded.id, user.password]);
        if (updateResult.rowCount !== 1) {
            return res.status(400).json({ error: 'Link de recuperação inválido ou já utilizado' });
        }

        console.log(`Password reset successfully for user ID: ${decoded.id}`);
        res.json({ message: 'Senha redefinida com sucesso' });
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(400).json({ error: 'O link de recuperação expirou. Por favor, solicite um novo.' });
        }
        console.error('Reset Password Error:', err);
        res.status(400).json({ error: 'Link de recuperação inválido' });
    }
});

// --- Schedule Settings Routes ---

app.get('/api/admin/dashboard', authenticateToken, requireAdmin, async (req, res, next) => {
    const period = resolveDashboardPeriod(req.query);
    if (period.error) return res.status(400).json({ error: period.error });
    try {
        if (await isDemoModeActive()) {
            const appointments = listDemoAppointments({ role: 'admin' });
            const today = dashboardToday();
            return res.json(aggregateDashboard(appointments, period, {
                today: appointments.filter((item) => item.date === today).length,
                activeProfessionals: listDemoProfessionals().filter((item) => item.active).length,
                activeServices: listDemoServices().filter((item) => item.active).length,
            }));
        }
        const today = dashboardToday();
        const [appointments, todayCount, professionalCount, serviceCount] = await Promise.all([
            query(`SELECT a.date, a.time, a.status, a.name, a.user_id, u.name AS user_name,
                p.name AS professional_name, s.name AS service_name
                FROM appointments a
                LEFT JOIN users u ON u.id = a.user_id
                LEFT JOIN professionals p ON p.id = a.professional_id
                LEFT JOIN services s ON s.id = a.service_id
                WHERE a.date BETWEEN $1 AND $2`, [period.start, period.end]),
            query('SELECT COUNT(*)::integer AS count FROM appointments WHERE date = $1', [today]),
            query('SELECT COUNT(*)::integer AS count FROM professionals WHERE active = TRUE'),
            query('SELECT COUNT(*)::integer AS count FROM services WHERE active = TRUE'),
        ]);
        res.json(aggregateDashboard(appointments.rows, period, {
            today: todayCount.rows[0]?.count,
            activeProfessionals: professionalCount.rows[0]?.count,
            activeServices: serviceCount.rows[0]?.count,
        }));
    } catch (error) { next(error); }
});

// --- Administrative catalog routes (ET-07) ---
app.get('/api/admin/professionals', authenticateToken, requireAdmin, async (req, res, next) => {
    try {
        const result = await query('SELECT id, name, specialty, active, created_at, updated_at FROM professionals ORDER BY name, id');
        res.json(result.rows);
    } catch (error) { next(error); }
});

app.post('/api/admin/professionals', authenticateToken, requireAdmin, async (req, res, next) => {
    const validation = validateProfessional(req.body);
    if (validation.error) return res.status(400).json({ error: validation.error });
    try {
        if (!await ensureOperationalMode(res)) return;
        const { name, specialty, active } = validation.value;
        const result = await query('INSERT INTO professionals (name, specialty, active) VALUES ($1, $2, $3) RETURNING *', [name, specialty, active]);
        res.status(201).json(result.rows[0]);
    } catch (error) { next(error); }
});

app.put('/api/admin/professionals/:id', authenticateToken, requireAdmin, async (req, res, next) => {
    const id = parsePositiveId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID de profissional inválido' });
    const validation = validateProfessional(req.body);
    if (validation.error) return res.status(400).json({ error: validation.error });
    try {
        if (!await ensureOperationalMode(res)) return;
        const { name, specialty, active } = validation.value;
        const result = await query('UPDATE professionals SET name = $1, specialty = $2, active = $3, updated_at = NOW() WHERE id = $4 RETURNING *', [name, specialty, active, id]);
        if (!result.rows[0]) return res.status(404).json({ error: 'Profissional não encontrado' });
        res.json(result.rows[0]);
    } catch (error) { next(error); }
});

app.patch('/api/admin/professionals/:id/status', authenticateToken, requireAdmin, async (req, res, next) => {
    const id = parsePositiveId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID de profissional inválido' });
    const validation = validateActiveStatus(req.body);
    if (validation.error) return res.status(400).json({ error: validation.error });
    try {
        if (!await ensureOperationalMode(res)) return;
        const result = await query('UPDATE professionals SET active = $1, updated_at = NOW() WHERE id = $2 RETURNING *', [validation.value, id]);
        if (!result.rows[0]) return res.status(404).json({ error: 'Profissional não encontrado' });
        res.json(result.rows[0]);
    } catch (error) { next(error); }
});

app.get('/api/admin/services', authenticateToken, requireAdmin, async (req, res, next) => {
    try {
        const result = await query('SELECT id, name, description, duration_minutes, price::text AS price, active, created_at, updated_at FROM services ORDER BY name, id');
        res.json(result.rows);
    } catch (error) { next(error); }
});

app.post('/api/admin/services', authenticateToken, requireAdmin, async (req, res, next) => {
    const validation = validateService(req.body);
    if (validation.error) return res.status(400).json({ error: validation.error });
    try {
        if (!await ensureOperationalMode(res)) return;
        const { name, description, durationMinutes, price, active } = validation.value;
        const result = await query('INSERT INTO services (name, description, duration_minutes, price, active) VALUES ($1, $2, $3, $4, $5) RETURNING *', [name, description, durationMinutes, price, active]);
        res.status(201).json(result.rows[0]);
    } catch (error) { next(error); }
});

app.put('/api/admin/services/:id', authenticateToken, requireAdmin, async (req, res, next) => {
    const id = parsePositiveId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID de serviço inválido' });
    const validation = validateService(req.body);
    if (validation.error) return res.status(400).json({ error: validation.error });
    try {
        if (!await ensureOperationalMode(res)) return;
        const { name, description, durationMinutes, price, active } = validation.value;
        const result = await query('UPDATE services SET name = $1, description = $2, duration_minutes = $3, price = $4, active = $5, updated_at = NOW() WHERE id = $6 RETURNING *', [name, description, durationMinutes, price, active, id]);
        if (!result.rows[0]) return res.status(404).json({ error: 'Serviço não encontrado' });
        res.json(result.rows[0]);
    } catch (error) { next(error); }
});

app.patch('/api/admin/services/:id/status', authenticateToken, requireAdmin, async (req, res, next) => {
    const id = parsePositiveId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID de serviço inválido' });
    const validation = validateActiveStatus(req.body);
    if (validation.error) return res.status(400).json({ error: validation.error });
    try {
        if (!await ensureOperationalMode(res)) return;
        const result = await query('UPDATE services SET active = $1, updated_at = NOW() WHERE id = $2 RETURNING *', [validation.value, id]);
        if (!result.rows[0]) return res.status(404).json({ error: 'Serviço não encontrado' });
        res.json(result.rows[0]);
    } catch (error) { next(error); }
});

app.get('/api/admin/professionals/:id/services', authenticateToken, requireAdmin, async (req, res, next) => {
    const id = parsePositiveId(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID de profissional inválido' });
    try {
        const professional = await query('SELECT id FROM professionals WHERE id = $1', [id]);
        if (!professional.rows[0]) return res.status(404).json({ error: 'Profissional não encontrado' });
        const result = await query('SELECT s.id, s.name, s.description, s.duration_minutes, s.price, s.active FROM professional_services ps JOIN services s ON s.id = ps.service_id WHERE ps.professional_id = $1 ORDER BY s.name, s.id', [id]);
        res.json(result.rows);
    } catch (error) { next(error); }
});

app.post('/api/admin/professionals/:professionalId/services/:serviceId', authenticateToken, requireAdmin, async (req, res, next) => {
    const professionalId = parsePositiveId(req.params.professionalId);
    const serviceId = parsePositiveId(req.params.serviceId);
    if (!professionalId || !serviceId) return res.status(400).json({ error: 'IDs de profissional e serviço devem ser válidos' });
    try {
        if (!await ensureOperationalMode(res)) return;
        const [professional, service] = await Promise.all([
            query('SELECT id FROM professionals WHERE id = $1', [professionalId]),
            query('SELECT id FROM services WHERE id = $1', [serviceId]),
        ]);
        if (!professional.rows[0]) return res.status(404).json({ error: 'Profissional não encontrado' });
        if (!service.rows[0]) return res.status(404).json({ error: 'Serviço não encontrado' });
        await query('INSERT INTO professional_services (professional_id, service_id) VALUES ($1, $2)', [professionalId, serviceId]);
        res.status(201).json({ professionalId, serviceId });
    } catch (error) {
        if (error.code === '23505') return res.status(409).json({ error: 'Serviço já vinculado a este profissional' });
        next(error);
    }
});
app.delete('/api/admin/professionals/:professionalId/services/:serviceId', authenticateToken, requireAdmin, async (req, res, next) => {
    const professionalId = parsePositiveId(req.params.professionalId);
    const serviceId = parsePositiveId(req.params.serviceId);
    if (!professionalId || !serviceId) return res.status(400).json({ error: 'IDs de profissional e serviço devem ser válidos' });
    try {
        if (!await ensureOperationalMode(res)) return;
        const result = await query('DELETE FROM professional_services WHERE professional_id = $1 AND service_id = $2', [professionalId, serviceId]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Associação não encontrada' });
        res.json({ message: 'Associação removida com sucesso' });
    } catch (error) { next(error); }
});
// Get schedule settings (public)
app.get('/api/settings/schedule', async (req, res, next) => {
    try {
        const result = await query(
            "SELECT key, value FROM settings WHERE key IN ('schedule_start', 'schedule_end', 'schedule_interval', 'allow_saturday', 'allow_sunday', 'blocked_periods', 'admin_email', 'enable_lunch', 'lunch_start', 'lunch_end', 'app_logo', 'whatsapp_number', 'company_name', 'demo_mode')"
        );
        const settings = {};
        result.rows.forEach(row => { settings[row.key] = row.value; });
        if (isDemoModeValue(settings.demo_mode)) return res.json(getDemoSettings());
        res.json({
            start: settings.schedule_start || '09:00',
            end: settings.schedule_end || '17:00',
            interval: parseInt(settings.schedule_interval || '30', 10),
            allow_saturday: settings.allow_saturday === 'true',
            allow_sunday: settings.allow_sunday === 'true',
            blockedPeriods: JSON.parse(settings.blocked_periods || '[]'),
            adminEmail: settings.admin_email || '',
            enable_lunch: settings.enable_lunch === 'true',
            lunch_start: settings.lunch_start || '12:00',
            lunch_end: settings.lunch_end || '13:00',
            appLogo: settings.app_logo || '',
            whatsappNumber: settings.whatsapp_number || '',
            companyName: settings.company_name?.trim() || 'Agenda',
            demoMode: false
        });
    } catch (err) {
        next(err);
    }
});

// Demo mode controls (admin only)
app.put('/api/settings/demo-mode', authenticateToken, async (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Apenas administradores podem alterar o modo demonstração' });
    }
    if (typeof req.body.enabled !== 'boolean') {
        return res.status(400).json({ error: 'O campo enabled deve ser booleano' });
    }
    try {
        await query(
            'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
            ['demo_mode', String(req.body.enabled)]
        );
        res.json({ demoMode: req.body.enabled });
    } catch (error) {
        next(error);
    }
});

app.post('/api/settings/demo-reset', authenticateToken, async (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Apenas administradores podem restaurar a demonstração' });
    }
    try {
        if (!await isDemoModeActive()) {
            return res.status(409).json({ error: 'O modo demonstração não está ativo' });
        }
        const appointments = resetDemoAppointments();
        res.json({ message: 'Dados da demonstração restaurados', appointments });
    } catch (error) {
        next(error);
    }
});
// Update schedule settings (admin only)
app.put('/api/settings/schedule', authenticateToken, async (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Apenas administradores podem alterar configurações' });
    }

    if (await isDemoModeActive()) {
        return res.status(409).json({ error: 'Desative o modo demonstração para alterar configurações operacionais' });
    }

    const { start, end, interval, allow_saturday, allow_sunday, blockedPeriods, adminEmail, enable_lunch, lunch_start, lunch_end, appLogo, whatsappNumber, companyName } = req.body;
    const normalizedCompanyName = typeof companyName === 'string' ? companyName.trim() : '';

    if (!normalizedCompanyName || normalizedCompanyName.length > 100) {
        return res.status(400).json({ error: 'O nome comercial deve ter entre 1 e 100 caracteres' });
    }

    if (!start || !end || !interval) {
        return res.status(400).json({ error: 'Campos obrigatórios: start, end, interval' });
    }

    // Validate time format HH:MM
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(start) || !timeRegex.test(end)) {
        return res.status(400).json({ error: 'Formato de horário inválido. Use HH:MM' });
    }

    if (![15, 30, 45, 60].includes(Number(interval))) {
        return res.status(400).json({ error: 'Intervalo deve ser 15, 30, 45 ou 60 minutos' });
    }

    try {
        const updates = [
            ['schedule_start', start],
            ['schedule_end', end],
            ['schedule_interval', String(interval)],
            ['allow_saturday', String(!!allow_saturday)],
            ['allow_sunday', String(!!allow_sunday)],
            ['blocked_periods', JSON.stringify(blockedPeriods || [])],
            ['admin_email', adminEmail || ''],
            ['enable_lunch', String(!!enable_lunch)],
            ['lunch_start', lunch_start || '12:00'],
            ['lunch_end', lunch_end || '13:00'],
            ['app_logo', appLogo || ''],
            ['company_name', normalizedCompanyName],
            ['whatsapp_number', whatsappNumber || '']
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
            blockedPeriods,
            adminEmail,
            enable_lunch,
            lunch_start,
            lunch_end,
            appLogo,
            companyName: normalizedCompanyName,
            whatsappNumber
        });
    } catch (err) {
        next(err);
    }
});

// Logo Upload Endpoint
app.post('/api/settings/logo', authenticateToken, upload.single('logo'), async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Apenas administradores podem enviar logos' });
    }

    if (await isDemoModeActive()) {
        return res.status(409).json({ error: 'O logo real não pode ser alterado no modo demonstração' });
    }

    if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const base64Logo = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

    try {
        await query(
            'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
            ['app_logo', base64Logo]
        );
        res.json({ logoUrl: base64Logo });
    } catch (err) {
        console.error('Logo Upload DB Error:', err);
        res.status(500).json({ error: 'Erro ao salvar o logo no banco de dados' });
    }
});

// --- Booking Routes ---

// Public catalog used by the booking flow. Only active and associated records are exposed.
app.get('/api/services', async (req, res, next) => {
    try {
        if (await isDemoModeActive()) return res.json(listDemoServices());
        const result = await query(`SELECT DISTINCT s.id, s.name, s.description, s.duration_minutes, s.price::text AS price
            FROM services s JOIN professional_services ps ON ps.service_id = s.id
            JOIN professionals p ON p.id = ps.professional_id
            WHERE s.active = TRUE AND p.active = TRUE ORDER BY s.name, s.id`);
        res.json(result.rows);
    } catch (err) { next(err); }
});

app.get('/api/professionals', async (req, res, next) => {
    const serviceId = parsePositiveId(req.query.service_id);
    if (!serviceId) return res.status(400).json({ error: 'Servico invalido' });
    try {
        if (await isDemoModeActive()) return res.json(listDemoProfessionals(serviceId));
        const result = await query(`SELECT p.id, p.name, p.specialty
            FROM professionals p JOIN professional_services ps ON ps.professional_id = p.id
            JOIN services s ON s.id = ps.service_id
            WHERE ps.service_id = $1 AND p.active = TRUE AND s.active = TRUE ORDER BY p.name, p.id`, [serviceId]);
        res.json(result.rows);
    } catch (err) { next(err); }
});

app.get('/api/services/:serviceId/professionals', async (req, res, next) => {
    const serviceId = parsePositiveId(req.params.serviceId);
    if (!serviceId) return res.status(400).json({ error: 'Servico invalido' });
    try {
        if (await isDemoModeActive()) return res.json(listDemoProfessionals(serviceId));
        const result = await query(`SELECT p.id, p.name, p.specialty
            FROM professionals p JOIN professional_services ps ON ps.professional_id = p.id
            JOIN services s ON s.id = ps.service_id
            WHERE ps.service_id = $1 AND p.active = TRUE AND s.active = TRUE ORDER BY p.name, p.id`, [serviceId]);
        res.json(result.rows);
    } catch (err) { next(err); }
});

app.get('/api/availability', async (req, res, next) => {
    const { date } = req.query;
    try {
        if (req.query.professional_id === 'any') {
            const catalog = await listCatalogCandidates(req.query.service_id);
            if (!date || catalog.error) return res.status(400).json({ error: catalog.error || 'Data obrigatoria' });
            const demoMode = await isDemoModeActive();
            const availabilityLists = demoMode
                ? catalog.professionals.map(({ id }) => listDemoAvailableTimes(date, catalog.durationMinutes, id))
                : await Promise.all(catalog.professionals.map(({ id }) => listAvailableTimes({ date, durationMinutes: catalog.durationMinutes, professionalId: id })));
            return res.json([...new Set(availabilityLists.flat())].sort());
        }
        const catalog = await validateCatalogSelection(req.query.service_id, req.query.professional_id);
        if (!date || catalog.error) return res.status(400).json({ error: catalog.error || 'Data obrigatoria' });
        const demoMode = await isDemoModeActive();
        const ignoredId = req.query.ignore_appointment_id === undefined ? null : parsePositiveId(req.query.ignore_appointment_id);
        if (!demoMode && req.query.ignore_appointment_id !== undefined && !ignoredId) return res.status(400).json({ error: 'Agendamento ignorado invalido' });
        if (demoMode) return res.json(listDemoAvailableTimes(date, catalog.durationMinutes, catalog.professionalId, req.query.ignore_appointment_id || null));
        res.json(await listAvailableTimes({ date, durationMinutes: catalog.durationMinutes, professionalId: catalog.professionalId, ignoredId }));
    } catch (err) { next(err); }
});

// Get booked slots for a specific date
app.get('/api/bookings', async (req, res, next) => {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'Data é obrigatória' });

    try {
        if (await isDemoModeActive()) return res.json(getDemoBookedTimes(date));
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
        if (await isDemoModeActive()) return res.json(listDemoAppointments(req.user));
        let result;
        if (isAdmin) {
            result = await query(
                "SELECT a.*, u.name as user_name, s.name as service_name, p.name as professional_name FROM appointments a JOIN users u ON a.user_id = u.id LEFT JOIN services s ON s.id = a.service_id LEFT JOIN professionals p ON p.id = a.professional_id ORDER BY a.date DESC, a.time DESC"
            );
        } else {
            result = await query(
                "SELECT a.*, s.name as service_name, p.name as professional_name FROM appointments a LEFT JOIN services s ON s.id = a.service_id LEFT JOIN professionals p ON p.id = a.professional_id WHERE a.user_id = $1 ORDER BY a.date DESC, a.time DESC",
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
    const { date, time, name, phone, notes, service_id, professional_id } = req.body;
    const userId = req.user.id;

    if (!date || !time || !name || !phone) {
        return res.status(400).json({ error: 'Campos obrigatórios faltando' });
    }

    try {
        if (professional_id === 'any') {
            const catalog = await listCatalogCandidates(service_id);
            if (catalog.error) return res.status(400).json({ error: catalog.error });
            if (await isDemoModeActive()) {
                const demoResult = createDemoAppointment(req.user, { date, time, name, phone, notes, service_id: catalog.serviceId, professional_id: 'any', email: req.user.email });
                if (!demoResult.valid) return res.status(demoResult.status).json({ error: demoResult.error });
                return res.status(201).json({ id: demoResult.appointment.id, professional_id: demoResult.appointment.professional_id, professional_name: demoResult.appointment.professional_name, message: 'Agendamento de demonstracao realizado com sucesso' });
            }
            const availability = await validateScheduleAvailability(date, time, catalog.durationMinutes);
            if (!availability.valid) return res.status(availability.status).json({ error: availability.error });
            for (const professional of catalog.professionals) {
                if (await hasAppointmentConflict({ date, time, durationMinutes: catalog.durationMinutes, professionalId: professional.id })) continue;
                try {
                    const result = await query('INSERT INTO appointments (user_id, date, time, name, phone, notes, status, service_id, professional_id, service_price) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id', [userId, date, time, name, phone, notes, 'active', catalog.serviceId, professional.id, catalog.price]);
                    sendBookingConfirmationEmail(req.user.email, { name, date, time, phone, notes }).catch(err => console.error('Error sending confirmation email in route:', err));
                    return res.status(201).json({ id: result.rows[0].id, professional_id: professional.id, professional_name: professional.name, message: 'Agendamento realizado com sucesso' });
                } catch (err) {
                    if (err.code === '23P01' && err.constraint === 'appointments_no_active_overlap') continue;
                    throw err;
                }
            }
            return res.status(409).json({ error: 'Este horario nao esta mais disponivel' });
        }
        const catalog = await validateCatalogSelection(service_id, professional_id);
        if (catalog.error) return res.status(400).json({ error: catalog.error });
        if (await isDemoModeActive()) {
            const demoResult = createDemoAppointment(req.user, { date, time, name, phone, notes, service_id: catalog.serviceId, professional_id: catalog.professionalId, email: req.user.email });
            if (!demoResult.valid) return res.status(demoResult.status).json({ error: demoResult.error });
            return res.status(201).json({ id: demoResult.appointment.id, message: 'Agendamento de demonstração realizado com sucesso' });
        }
        const availability = await validateScheduleAvailability(date, time, catalog.durationMinutes);
        if (!availability.valid) {
            return res.status(availability.status).json({ error: availability.error });
        }

        // The trigger is the final concurrency guard; this check gives an early response.
        if (await hasAppointmentConflict({ date, time, durationMinutes: catalog.durationMinutes, professionalId: catalog.professionalId })) {
            return res.status(409).json({ error: 'Este horário já foi reservado' });
        }

        const result = await query(
            'INSERT INTO appointments (user_id, date, time, name, phone, notes, status, service_id, professional_id, service_price) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id',
            [userId, date, time, name, phone, notes, 'active', catalog.serviceId, catalog.professionalId, catalog.price]
        );

        // Send confirmation email asychronously
        sendBookingConfirmationEmail(req.user.email, { name, date, time, phone, notes })
            .catch(err => console.error('Error sending confirmation email in route:', err));

        res.status(201).json({ id: result.rows[0].id, professional_id: catalog.professionalId, professional_name: catalog.professionalName, message: 'Agendamento realizado com sucesso' });
    } catch (err) {
        if (err.code === '23P01' && err.constraint === 'appointments_no_active_overlap') {
            return res.status(409).json({ error: 'Este horário já foi reservado' });
        }
        next(err);
    }
});

// Update booking
app.put('/api/bookings/:id', authenticateToken, async (req, res, next) => {
    const { id } = req.params;
    const { date, time, notes, service_id, professional_id } = req.body;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    try {
        const demoMode = await isDemoModeActive();
        if (demoMode) {
            let catalog = {};
            if (service_id !== undefined || professional_id !== undefined) {
                catalog = await validateCatalogSelection(service_id, professional_id);
                if (catalog.error) return res.status(400).json({ error: catalog.error });
            }
            const demoResult = updateDemoAppointment(id, req.user, { date, time, notes, service_id: catalog.serviceId, professional_id: catalog.professionalId });
            if (!demoResult.appointment) return res.status(demoResult.status).json({ error: demoResult.error });
            return res.json({ message: 'Agendamento de demonstração atualizado com sucesso' });
        }
        const bookingResult = await query("SELECT * FROM appointments WHERE id = $1", [id]);
        const booking = bookingResult.rows[0];

        if (!booking) return res.status(404).json({ error: 'Agendamento não encontrado' });

        // Allowed if owner OR admin
        if (booking.user_id !== userId && !isAdmin) {
            return res.status(403).json({ error: 'Não autorizado' });
        }

        let selectedServiceId = booking.service_id;
        let selectedProfessionalId = booking.professional_id;
        let selectedServicePrice = booking.service_price;
        let durationMinutes = null;
        if (service_id !== undefined || professional_id !== undefined) {
            const catalog = await validateCatalogSelection(service_id, professional_id);
            if (catalog.error) return res.status(400).json({ error: catalog.error });
            selectedServiceId = catalog.serviceId;
            selectedProfessionalId = catalog.professionalId;
            durationMinutes = catalog.durationMinutes;
            if (Number(booking.service_id) !== catalog.serviceId) selectedServicePrice = catalog.price;
        } else if (selectedServiceId && selectedProfessionalId) {
            const service = await query('SELECT duration_minutes FROM services WHERE id = $1', [selectedServiceId]);
            durationMinutes = service.rows[0]?.duration_minutes;
        }

        const availability = await validateScheduleAvailability(date, time, durationMinutes || 1);
        if (!availability.valid) {
            return res.status(availability.status).json({ error: availability.error });
        }

        const conflict = durationMinutes
            ? await hasAppointmentConflict({ date, time, durationMinutes, professionalId: selectedProfessionalId, ignoredId: Number(id) })
            : (await query("SELECT 1 FROM appointments WHERE date = $1 AND time = $2 AND status = 'active' AND id != $3 LIMIT 1", [date, time, id])).rows.length > 0;
        if (conflict) {
            return res.status(409).json({ error: 'Este horário já está ocupado' });
        }

        await query(
            'UPDATE appointments SET date = $1, time = $2, notes = $3, service_id = $4, professional_id = $5, service_price = $6 WHERE id = $7',
            [date, time, notes, selectedServiceId, selectedProfessionalId, selectedServicePrice, id]
        );
        res.json({ message: 'Agendamento atualizado com sucesso' });
    } catch (err) {
        if (err.code === '23P01' && err.constraint === 'appointments_no_active_overlap') {
            return res.status(409).json({ error: 'Este horário já está ocupado' });
        }
        next(err);
    }
});

// Cancel booking (Soft Delete)
app.delete('/api/bookings/:id', authenticateToken, async (req, res, next) => {
    const { id } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    try {
        if (await isDemoModeActive()) {
            const demoResult = cancelDemoAppointment(id, req.user);
            if (!demoResult.appointment) return res.status(demoResult.status).json({ error: demoResult.error });
            return res.json({ message: 'Agendamento de demonstração cancelado com sucesso' });
        }
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
    const isAdmin = req.user.role === 'admin';

    if (!isAdmin) {
        return res.status(403).json({ error: 'Apenas administradores podem excluir agendamentos permanentemente' });
    }

    try {
        if (await isDemoModeActive()) {
            const demoResult = deleteDemoAppointment(id, req.user);
            if (!demoResult.deleted) return res.status(demoResult.status).json({ error: demoResult.error });
            return res.json({ message: 'Agendamento de demonstração removido' });
        }
        const bookingResult = await query("SELECT * FROM appointments WHERE id = $1", [id]);
        const booking = bookingResult.rows[0];

        if (!booking) return res.status(404).json({ error: 'Agendamento não encontrado' });

        await query("DELETE FROM appointments WHERE id = $1", [id]);
        res.json({ message: 'Agendamento removido permanentemente' });
    } catch (err) {
        next(err);
    }
});

// Global error handling middleware
app.use((err, req, res, next) => {
    console.error('SERVER ERROR:', err.stack);
    const response = { error: 'Erro interno do servidor' };

    if (process.env.NODE_ENV !== 'production') {
        response.message = String(err.message || 'Erro desconhecido')
            .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[CONNECTION_STRING_REDACTED]');
    }

    res.status(500).json(response);
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
