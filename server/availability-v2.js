import { query } from './db.js';

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
const KEYS = ['schedule_start', 'schedule_end', 'schedule_interval', 'allow_saturday', 'allow_sunday', 'blocked_periods', 'enable_lunch', 'lunch_start', 'lunch_end'];

export const timeToMinutes = (value) => TIME.test(value || '') ? value.split(':').map(Number).reduce((h, m) => h * 60 + m) : null;
export const intervalsOverlap = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && aEnd > bStart;

export function parseCalendarDate(value) {
    const match = typeof value === 'string' && DATE.exec(value);
    if (!match) return null;
    const [year, month, day] = match.slice(1).map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day ? { dayOfWeek: parsed.getUTCDay() } : null;
}

function today() {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: process.env.APP_TIME_ZONE || 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    return `${values.year}-${values.month}-${values.day}`;
}

export function validateScheduleCandidate(date, time, durationMinutes, settings, options = {}) {
    const parsed = parseCalendarDate(date);
    if (!parsed) return { valid: false, status: 400, error: 'Data invalida' };
    if (!options.allowPast && date < today()) return { valid: false, status: 400, error: 'Nao e possivel agendar em data passada' };
    const requested = timeToMinutes(time), duration = Number(durationMinutes);
    if (requested === null) return { valid: false, status: 400, error: 'Horario invalido' };
    if (!Number.isInteger(duration) || duration <= 0) return { valid: false, status: 400, error: 'Duracao do servico invalida' };
    const start = timeToMinutes(settings.schedule_start || settings.start || '09:00');
    const end = timeToMinutes(settings.schedule_end || settings.end || '17:00');
    const interval = Number(settings.schedule_interval || settings.interval || 30), requestedEnd = requested + duration;
    if (start === null || end === null || ![15, 30, 45, 60].includes(interval) || requested < start || requestedEnd > end || (requested - start) % interval) return { valid: false, status: 400, error: 'Horario fora do funcionamento' };
    if (parsed.dayOfWeek === 6 && String(settings.allow_saturday) !== 'true') return { valid: false, status: 400, error: 'Sabado indisponivel' };
    if (parsed.dayOfWeek === 0 && String(settings.allow_sunday) !== 'true') return { valid: false, status: 400, error: 'Domingo indisponivel' };
    if (String(settings.enable_lunch) === 'true' && intervalsOverlap(requested, requestedEnd, timeToMinutes(settings.lunch_start || '12:00'), timeToMinutes(settings.lunch_end || '13:00'))) return { valid: false, status: 400, error: 'Horario indisponivel' };
    let blocked = settings.blockedPeriods || [];
    if (!Array.isArray(blocked)) { try { blocked = JSON.parse(settings.blocked_periods || '[]'); } catch { blocked = []; } }
    if (blocked.some((p) => parseCalendarDate(p?.start) && parseCalendarDate(p?.end) && date >= p.start && date <= p.end)) return { valid: false, status: 400, error: 'Data bloqueada para agendamento' };
    return { valid: true };
}

export async function getScheduleSettings() {
    const result = await query('SELECT key, value FROM settings WHERE key = ANY($1::text[])', [KEYS]);
    return Object.fromEntries(result.rows.map(({ key, value }) => [key, value]));
}

export async function validateScheduleAvailability(date, time, duration) { return validateScheduleCandidate(date, time, duration, await getScheduleSettings()); }

export async function hasAppointmentConflict({ date, time, durationMinutes, professionalId, ignoredId = null }) {
    const result = await query(`SELECT 1 FROM appointments a LEFT JOIN services s ON s.id = a.service_id
      WHERE a.date = $1 AND a.status = 'active' AND ($5::integer IS NULL OR a.id <> $5)
      AND (((a.professional_id IS NULL OR a.service_id IS NULL) AND a.time = $2)
        OR (a.professional_id = $3 AND $2::time < a.time::time + make_interval(mins => s.duration_minutes)
          AND $2::time + make_interval(mins => $4) > a.time::time)) LIMIT 1`, [date, time, professionalId, durationMinutes, ignoredId]);
    return result.rows.length > 0;
}

export async function listAvailableTimes({ date, durationMinutes, professionalId, ignoredId = null }) {
    const settings = await getScheduleSettings(), start = timeToMinutes(settings.schedule_start || '09:00'), end = timeToMinutes(settings.schedule_end || '17:00'), interval = Number(settings.schedule_interval || 30);
    if (start === null || end === null || ![15, 30, 45, 60].includes(interval)) return [];
    const candidates = [];
    for (let minute = start; minute < end; minute += interval) {
        const time = `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
        if (validateScheduleCandidate(date, time, durationMinutes, settings).valid) candidates.push(time);
    }
    const conflicts = await Promise.all(candidates.map((time) => hasAppointmentConflict({ date, time, durationMinutes, professionalId, ignoredId })));
    return candidates.filter((_, index) => !conflicts[index]);
}
