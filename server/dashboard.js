const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

function validDate(value) {
    if (!DATE_PATTERN.test(value || '')) return false;
    const parsed = new Date(`${value}T12:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

const isoDate = (date) => date.toISOString().slice(0, 10);

export function dashboardToday(now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: process.env.APP_TIME_ZONE || 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    return `${values.year}-${values.month}-${values.day}`;
}

export function resolveDashboardPeriod(input = {}, now = dashboardToday()) {
    const today = typeof now === 'string'
        ? new Date(`${now}T12:00:00Z`)
        : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    let start;
    let end = new Date(today);
    const preset = input.preset || '30d';
    if (input.start !== undefined || input.end !== undefined) {
        if (!validDate(input.start) || !validDate(input.end) || input.start > input.end) return { error: 'Período inválido' };
        return { start: input.start, end: input.end, preset: 'custom' };
    }
    if (preset === 'today') start = new Date(today);
    else if (preset === '7d' || preset === '30d') {
        start = new Date(today);
        start.setUTCDate(start.getUTCDate() - (preset === '7d' ? 6 : 29));
    } else if (preset === 'month') start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    else return { error: 'Filtro de período inválido' };
    return { start: isoDate(start), end: isoDate(end), preset };
}

export function aggregateDashboard(appointments, { start, end }, counts = {}) {
    const filtered = appointments.filter((item) => item.date >= start && item.date <= end);
    const increment = (map, key) => map.set(key, (map.get(key) || 0) + 1);
    const byDate = new Map(), byProfessional = new Map(), byService = new Map(), byWeekday = new Map(), byTime = new Map(), byClient = new Map(), byStatus = new Map();
    for (const item of filtered) {
        increment(byDate, item.date);
        increment(byProfessional, item.professional_name || 'Não informado');
        increment(byService, item.service_name || 'Não informado');
        increment(byWeekday, WEEKDAYS[new Date(`${item.date}T12:00:00Z`).getUTCDay()]);
        increment(byTime, String(item.time).slice(0, 5));
        const clientKey = item.user_id ?? `legacy:${item.user_name || item.name || 'Não informado'}`;
        const client = byClient.get(clientKey) || { label: item.user_name || item.name || 'Não informado', count: 0 };
        client.count += 1;
        byClient.set(clientKey, client);
        increment(byStatus, item.status);
    }
    const ranked = (map) => [...map].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    const today = counts.today || 0;
    const cancelled = byStatus.get('cancelled') || 0;
    return {
        period: { start, end },
        kpis: {
            appointmentsToday: today,
            appointmentsInPeriod: filtered.length,
            cancellationsInPeriod: cancelled,
            clientsInPeriod: byClient.size,
            activeProfessionals: counts.activeProfessionals || 0,
            activeServices: counts.activeServices || 0,
            cancellationRate: filtered.length ? Number(((cancelled / filtered.length) * 100).toFixed(1)) : 0,
        },
        appointmentsByDay: ranked(byDate).sort((a, b) => a.label.localeCompare(b.label)),
        appointmentsByProfessional: ranked(byProfessional),
        appointmentsByService: ranked(byService),
        appointmentsByWeekday: WEEKDAYS.slice(1).concat(WEEKDAYS[0]).map((label) => ({ label, count: byWeekday.get(label) || 0 })),
        appointmentsByTime: ranked(byTime),
        topClients: [...byClient.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).slice(0, 10),
        statusDistribution: ['active', 'cancelled', ...[...byStatus.keys()].filter((status) => !['active', 'cancelled'].includes(status))]
            .map((status) => ({ status, count: byStatus.get(status) || 0 })),
    };
}
