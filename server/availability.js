import { query } from './db.js';

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const SETTING_KEYS = ['schedule_start', 'schedule_end', 'schedule_interval', 'allow_saturday', 'allow_sunday', 'blocked_periods', 'enable_lunch', 'lunch_start', 'lunch_end'];

function parseCalendarDate(value) {
    if (typeof value !== 'string') return null;
    const match = DATE_PATTERN.exec(value);
    if (!match) return null;
    const [year, month, day] = match.slice(1).map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null;
    return { dayOfWeek: parsed.getUTCDay() };
}

function timeToMinutes(value) {
    if (typeof value !== 'string' || !TIME_PATTERN.test(value)) return null;
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
}

function currentCalendarDate() {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: process.env.APP_TIME_ZONE || 'America/Sao_Paulo',
        year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    return `${values.year}-${values.month}-${values.day}`;
}

async function getScheduleSettings() {
    const result = await query('SELECT key, value FROM settings WHERE key = ANY($1::text[])', [SETTING_KEYS]);
    return Object.fromEntries(result.rows.map(({ key, value }) => [key, value]));
}

export async function validateScheduleAvailability(date, time) {
    const parsedDate = parseCalendarDate(date);
    if (!parsedDate) return { valid: false, status: 400, error: 'Data inválida' };
    if (date < currentCalendarDate()) return { valid: false, status: 400, error: 'Não é possível agendar em data passada' };

    const requested = timeToMinutes(time);
    if (requested === null) return { valid: false, status: 400, error: 'Horário inválido' };

    const settings = await getScheduleSettings();
    const start = timeToMinutes(settings.schedule_start || '09:00');
    const end = timeToMinutes(settings.schedule_end || '17:00');
    const interval = Number(settings.schedule_interval || '30');
    if (start === null || end === null || ![15, 30, 45, 60].includes(interval) || requested < start || requested >= end || (requested - start) % interval !== 0) {
        return { valid: false, status: 400, error: 'Horário fora do funcionamento' };
    }
    if (parsedDate.dayOfWeek === 6 && settings.allow_saturday !== 'true') return { valid: false, status: 400, error: 'Agendamento não permitido aos sábados' };
    if (parsedDate.dayOfWeek === 0 && settings.allow_sunday !== 'true') return { valid: false, status: 400, error: 'Agendamento não permitido aos domingos' };

    if (settings.enable_lunch === 'true') {
        const lunchStart = timeToMinutes(settings.lunch_start || '12:00');
        const lunchEnd = timeToMinutes(settings.lunch_end || '13:00');
        if (lunchStart !== null && lunchEnd !== null && requested >= lunchStart && requested < lunchEnd) {
            return { valid: false, status: 400, error: 'Horário indisponível' };
        }
    }

    let blockedPeriods = [];
    try { blockedPeriods = JSON.parse(settings.blocked_periods || '[]'); } catch { blockedPeriods = []; }
    const blocked = Array.isArray(blockedPeriods) && blockedPeriods.some((period) =>
        parseCalendarDate(period?.start) && parseCalendarDate(period?.end) && date >= period.start && date <= period.end
    );
    if (blocked) return { valid: false, status: 400, error: 'Data bloqueada para agendamento' };
    return { valid: true };
}
