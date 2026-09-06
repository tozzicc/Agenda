import assert from 'node:assert/strict';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import nodemailer from 'nodemailer';

process.env.NODE_ENV = 'production';
process.env.JWT_SECRET = 'integration-test-secret';
process.env.APP_URL = 'http://127.0.0.1';
process.env.DATABASE_URL = 'postgres://integration.invalid/test';
process.env.SMTP_USER = 'test@example.com';

const users = [{ id: 1, name: 'User', email: 'user@example.com', password: bcrypt.hashSync('secret1', 4), role: 'user' }, { id: 2, name: 'Admin', email: 'admin@example.com', password: bcrypt.hashSync('secret2', 4), role: 'admin' }];
const appointments = [{ id: 10, user_id: 1, date: '2030-01-10', time: '10:00', name: 'User', phone: '123', notes: '', status: 'active' }, { id: 11, user_id: 1, date: '2030-01-11', time: '11:00', name: 'User', phone: '123', notes: '', status: 'cancelled' }, { id: 12, user_id: 1, date: '2030-01-12', time: '12:00', name: 'User', phone: '123', notes: '', status: 'cancelled' }];
const sentMail = [];
let configuredCompanyName = 'Clínica Teste & Filhos';
let demoMode = false;
nodemailer.createTransport = () => ({ sendMail: async (options) => { sentMail.push(options); return { response: 'ok' }; } });
pg.Pool.prototype.query = async function (sql, params = []) {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    if (normalized.startsWith('CREATE TABLE') || normalized.startsWith('CREATE UNIQUE INDEX')) return { rows: [], rowCount: 0 };
    if (normalized.startsWith('INSERT INTO settings')) {
        if (params[0] === 'company_name' && normalized.includes('DO UPDATE')) configuredCompanyName = params[1];
        if (params[0] === 'demo_mode' && normalized.includes('DO UPDATE')) demoMode = params[1] === 'true';
        return { rows: [], rowCount: 1 };
    }
    if (normalized.startsWith('SELECT date, time, array_agg')) return { rows: [] };
    if (normalized === "SELECT value FROM settings WHERE key = 'company_name'") return { rows: [{ value: configuredCompanyName }] };
    if (normalized === "SELECT value FROM settings WHERE key = 'demo_mode'") return { rows: [{ value: String(demoMode) }] };
    if (normalized.startsWith('SELECT key, value FROM settings WHERE key IN')) return { rows: [{ key: 'company_name', value: configuredCompanyName }, { key: 'demo_mode', value: String(demoMode) }] };
    if (normalized === 'SELECT * FROM users WHERE email = $1') return { rows: users.filter((u) => u.email === params[0]) };
    if (normalized === 'SELECT id, name, password FROM users WHERE email = $1') return { rows: users.filter((u) => u.email === params[0]).map(({ id, name, password }) => ({ id, name, password })) };
    if (normalized === 'SELECT password FROM users WHERE id = $1') return { rows: users.filter((u) => u.id === params[0]).map(({ password }) => ({ password })) };
    if (normalized.startsWith('INSERT INTO users')) { const user = { id: users.length + 1, name: params[0], email: params[1], password: params[2], role: 'user' }; users.push(user); return { rows: [{ id: user.id }], rowCount: 1 }; }
    if (normalized === 'UPDATE users SET password = $1 WHERE id = $2') { const user = users.find((u) => u.id === params[1]); if (user) user.password = params[0]; return { rows: [], rowCount: user ? 1 : 0 }; }
    if (normalized === 'UPDATE users SET password = $1 WHERE id = $2 AND password = $3') { const user = users.find((u) => u.id === params[1] && u.password === params[2]); if (user) user.password = params[0]; return { rows: [], rowCount: user ? 1 : 0 }; }
    if (normalized === 'SELECT * FROM appointments WHERE id = $1') return { rows: appointments.filter((a) => a.id === Number(params[0])) };
    if (normalized === "UPDATE appointments SET status = 'cancelled' WHERE id = $1") { const item = appointments.find((a) => a.id === Number(params[0])); if (item) item.status = 'cancelled'; return { rows: [], rowCount: item ? 1 : 0 }; }
    if (normalized === 'DELETE FROM appointments WHERE id = $1') { const index = appointments.findIndex((a) => a.id === Number(params[0])); if (index >= 0) appointments.splice(index, 1); return { rows: [], rowCount: index >= 0 ? 1 : 0 }; }
    throw new Error(`Unexpected query: ${normalized}`);
};

const { default: app } = await import('./server.js');
const { sendBookingConfirmationEmail } = await import('./mailer.js');
const server = app.listen(0, '127.0.0.1');
await new Promise((resolve) => server.once('listening', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const post = (path, body, token) => fetch(baseUrl + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
const del = (path, token) => fetch(baseUrl + path, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
const put = (path, body, token) => fetch(baseUrl + path, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(body) });

test.after(() => server.close());

test('auth routes enforce password policy and preserve valid register/login/change', async () => {
    assert.equal((await post('/api/auth/register', { name: 'Short', email: 'short@example.com', password: '12345' })).status, 400);
    const registration = await post('/api/auth/register', { name: 'Valid', email: 'valid@example.com', password: '123456' });
    assert.equal(registration.status, 201);
    const login = await post('/api/auth/login', { email: 'valid@example.com', password: '123456' });
    assert.equal(login.status, 200);
    const { token } = await login.json();
    assert.equal((await post('/api/auth/change-password', { currentPassword: '123456', newPassword: '12345' }, token)).status, 400);
});

test('reset is one-time and rejects short, invalid and expired tokens', async () => {
    await post('/api/auth/forgot-password', { email: 'user@example.com' });
    const token = new URL(sentMail.at(-1).html.match(/href="([^"]+)/)[1]).searchParams.get('token');
    assert.equal((await post('/api/auth/reset-password', { token, newPassword: '12345' })).status, 400);
    assert.equal((await post('/api/auth/reset-password', { token, newPassword: 'changed1' })).status, 200);
    assert.equal((await post('/api/auth/reset-password', { token, newPassword: 'changed2' })).status, 400);
    assert.equal((await post('/api/auth/reset-password', { token: 'invalid', newPassword: 'changed2' })).status, 400);
    const expired = jwt.sign({ id: 1, type: 'reset', credential: 'x' }, process.env.JWT_SECRET, { expiresIn: -1 });
    assert.equal((await post('/api/auth/reset-password', { token: expired, newPassword: 'changed2' })).status, 400);
});

test('owner can cancel, only admin can permanently delete', async () => {
    const userToken = jwt.sign({ id: 1, role: 'user' }, process.env.JWT_SECRET);
    const adminToken = jwt.sign({ id: 2, role: 'admin' }, process.env.JWT_SECRET);
    assert.equal((await del('/api/bookings/10', userToken)).status, 200);
    assert.equal(appointments.find((a) => a.id === 10).status, 'cancelled');
    assert.equal((await del('/api/bookings/11/force', userToken)).status, 403);
    assert.equal((await del('/api/bookings/12/force', adminToken)).status, 200);
});

test('booking email escapes user-provided HTML', async () => {
    await sendBookingConfirmationEmail('user@example.com', { name: '<b>Name</b>', date: '2030-01-10', time: '10:00', phone: '<img>', notes: '<script>x</script>' });
    const html = sentMail.at(-1).html;
    assert.ok(html.includes('&lt;b&gt;Name&lt;/b&gt;'));
    assert.ok(html.includes('&lt;img&gt;'));
    assert.ok(html.includes('&lt;script&gt;x&lt;/script&gt;'));
    assert.ok(!html.includes('<script>x</script>'));
    assert.equal(sentMail.at(-1).subject, 'Confirmação de Agendamento - Clínica Teste & Filhos');
    assert.ok(sentMail.at(-1).from.includes('Clínica Teste & Filhos'));
    assert.ok(html.includes('Clínica Teste &amp; Filhos'));
    assert.ok(!html.includes('Agenda. Todos os direitos reservados.'));
});
test('company name is public and only admins can update it', async () => {
    const publicResponse = await fetch(baseUrl + '/api/settings/schedule');
    assert.equal(publicResponse.status, 200);
    assert.equal((await publicResponse.json()).companyName, 'Clínica Teste & Filhos');

    const payload = {
        start: '09:00', end: '17:00', interval: 30,
        allow_saturday: false, allow_sunday: false, blockedPeriods: [],
        adminEmail: '', enable_lunch: false, lunch_start: '12:00',
        lunch_end: '13:00', appLogo: '', whatsappNumber: '',
        companyName: '  Nova Marca  '
    };
    const userToken = jwt.sign({ id: 1, role: 'user' }, process.env.JWT_SECRET);
    const adminToken = jwt.sign({ id: 2, role: 'admin' }, process.env.JWT_SECRET);
    assert.equal((await put('/api/settings/schedule', payload, userToken)).status, 403);
    const adminResponse = await put('/api/settings/schedule', payload, adminToken);
    assert.equal(adminResponse.status, 200);
    assert.equal((await adminResponse.json()).companyName, 'Nova Marca');
    assert.equal(configuredCompanyName, 'Nova Marca');
});
test('integrated demo mode is admin-only, isolated and resettable', async () => {
    const userToken = jwt.sign({ id: 1, role: 'user', email: 'user@example.com' }, process.env.JWT_SECRET);
    const adminToken = jwt.sign({ id: 2, role: 'admin', email: 'admin@example.com' }, process.env.JWT_SECRET);
    const realSettingsBefore = await (await fetch(baseUrl + '/api/settings/schedule')).json();
    assert.equal(realSettingsBefore.demoMode, false);
    assert.equal(realSettingsBefore.companyName, configuredCompanyName);
    assert.equal((await put('/api/settings/demo-mode', { enabled: true }, userToken)).status, 403);
    assert.equal((await put('/api/settings/demo-mode', { enabled: true }, adminToken)).status, 200);
    assert.equal(demoMode, true);

    const publicSettings = await (await fetch(baseUrl + '/api/settings/schedule')).json();
    assert.equal(publicSettings.demoMode, true);
    assert.equal(publicSettings.companyName, 'Espaço Bem-Estar');

    const adminBookings = await (await fetch(baseUrl + '/api/my-bookings', { headers: { Authorization: `Bearer ${adminToken}` } })).json();
    assert.equal(adminBookings.length, 14);
    assert.ok(adminBookings.every((item) => String(item.id).startsWith('demo-')));

    const date = new Date();
    date.setUTCDate(date.getUTCDate() + 30);
    while ([0, 6].includes(date.getUTCDay())) date.setUTCDate(date.getUTCDate() + 1);
    const dateValue = date.toISOString().slice(0, 10);
    const creation = await post('/api/bookings', { date: dateValue, time: '09:00', name: 'Cliente Temporário', phone: '000', notes: 'Demo' }, userToken);
    assert.equal(creation.status, 201);
    const createdId = (await creation.json()).id;
    assert.match(createdId, /^demo-/);
    const bookedTimes = await (await fetch(baseUrl + '/api/bookings?date=' + dateValue)).json();
    assert.ok(bookedTimes.includes('09:00'));
    assert.equal((await put(`/api/bookings/${createdId}`, { date: dateValue, time: '10:00', notes: 'Alterado' }, userToken)).status, 200);
    assert.equal((await del(`/api/bookings/${createdId}`, userToken)).status, 200);
    assert.equal((await post('/api/settings/demo-reset', {}, adminToken)).status, 200);
    assert.equal((await put('/api/settings/demo-mode', { enabled: false }, adminToken)).status, 200);
    assert.equal(demoMode, false);
});
test('actual login route returns 429 after its allowance and health stays unaffected', async () => {
    let response;
    for (let attempt = 0; attempt < 20; attempt += 1) {
        response = await post('/api/auth/login', { email: 'missing@example.com', password: 'secret1' });
    }
    assert.equal(response.status, 429);
    assert.equal((await fetch(`${baseUrl}/api/health`)).status, 200);
});
