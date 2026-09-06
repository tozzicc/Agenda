export const DEMO_ADMIN = { key: 'demo-admin', name: 'Administrador Demo', email: 'admin@demo.local', role: 'admin' };

export const DEMO_CLIENTS = [
    { key: 'demo-client-1', name: 'Mariana Alves', email: 'mariana@demo.local', phone: '00000000001' },
    { key: 'demo-client-2', name: 'Lucas Ferreira', email: 'lucas@demo.local', phone: '00000000002' },
    { key: 'demo-client-3', name: 'Juliana Costa', email: 'juliana@demo.local', phone: '00000000003' },
    { key: 'demo-client-4', name: 'Rafael Martins', email: 'rafael@demo.local', phone: '00000000004' },
];

const DEMO_SETTINGS = {
    start: '09:00',
    end: '18:00',
    interval: 60,
    allow_saturday: false,
    allow_sunday: false,
    blockedPeriods: [],
    adminEmail: 'admin@demo.local',
    enable_lunch: true,
    lunch_start: '12:00',
    lunch_end: '13:00',
    appLogo: '',
    whatsappNumber: '',
    companyName: 'Espaço Bem-Estar',
    demoMode: true,
};

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

function createInitialAppointments(now = new Date()) {
    const entries = [
        [0, -15, '09:00', 'active', 'Avaliação inicial'],
        [1, -12, '10:00', 'cancelled', 'Reagendamento solicitado'],
        [2, -10, '11:00', 'active', 'Consulta de acompanhamento'],
        [3, -7, '14:00', 'cancelled', 'Cancelamento fictício'],
        [0, -5, '15:00', 'active', 'Retorno'],
        [1, -2, '16:00', 'active', 'Atendimento de rotina'],
        [2, 1, '09:00', 'active', 'Avaliação inicial'],
        [3, 2, '10:00', 'active', 'Consulta de acompanhamento'],
        [0, 3, '11:00', 'active', 'Retorno'],
        [1, 4, '13:00', 'active', 'Atendimento de rotina'],
        [2, 5, '14:00', 'active', 'Retorno'],
        [3, 6, '15:00', 'active', 'Avaliação inicial'],
        [0, 8, '16:00', 'active', 'Consulta de acompanhamento'],
        [1, 10, '17:00', 'cancelled', 'Cancelamento fictício'],
    ];

    return entries.map(([clientIndex, offset, time, status, notes], index) => {
        const client = DEMO_CLIENTS[clientIndex];
        return {
            id: `demo-${index + 1}`,
            user_id: client.key,
            user_name: client.name,
            name: client.name,
            email: client.email,
            phone: client.phone,
            date: addBusinessDays(now, offset),
            time,
            notes,
            status,
        };
    });
}

let demoAppointments = createInitialAppointments();
let nextDemoId = demoAppointments.length + 1;

export function getDemoSettings() {
    return { ...DEMO_SETTINGS, blockedPeriods: [...DEMO_SETTINGS.blockedPeriods] };
}

export function isDemoModeValue(value) {
    return value === 'true';
}

function ownerKeyForUser(user) {
    const numericId = Number(user?.id);
    const index = Number.isFinite(numericId) ? Math.abs(numericId) % DEMO_CLIENTS.length : 0;
    return DEMO_CLIENTS[index].key;
}

export function listDemoAppointments(user) {
    const appointments = user?.role === 'admin'
        ? demoAppointments
        : demoAppointments.filter(({ user_id }) => user_id === ownerKeyForUser(user));
    return appointments.map((appointment) => ({ ...appointment }));
}

export function getDemoBookedTimes(date) {
    return demoAppointments
        .filter((appointment) => appointment.date === date && appointment.status === 'active')
        .map(({ time }) => time);
}

export function validateDemoAvailability(date, time, ignoredId) {
    const parsed = new Date(`${date}T12:00:00Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
        return { valid: false, status: 400, error: 'Data inválida' };
    }
    const today = new Date().toISOString().slice(0, 10);
    if (date < today) return { valid: false, status: 400, error: 'Não é possível agendar em data passada' };
    const day = parsed.getUTCDay();
    if (day === 0 || day === 6) return { valid: false, status: 400, error: 'Agendamento não permitido aos finais de semana' };
    const allowedTimes = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
    if (!allowedTimes.includes(time)) return { valid: false, status: 400, error: 'Horário fora do funcionamento' };
    const conflict = demoAppointments.some((appointment) =>
        appointment.id !== ignoredId && appointment.date === date && appointment.time === time && appointment.status === 'active'
    );
    if (conflict) return { valid: false, status: 409, error: 'Este horário já está ocupado' };
    return { valid: true };
}

export function createDemoAppointment(user, details) {
    const availability = validateDemoAvailability(details.date, details.time);
    if (!availability.valid) return availability;
    const ownerKey = ownerKeyForUser(user);
    const client = DEMO_CLIENTS.find(({ key }) => key === ownerKey);
    const appointment = {
        id: `demo-${nextDemoId++}`,
        user_id: ownerKey,
        user_name: details.name || client.name,
        name: details.name || client.name,
        email: details.email || client.email,
        phone: details.phone || client.phone,
        date: details.date,
        time: details.time,
        notes: details.notes || '',
        status: 'active',
    };
    demoAppointments.push(appointment);
    return { valid: true, appointment: { ...appointment } };
}

function findAuthorizedAppointment(id, user) {
    if (!String(id).startsWith('demo-')) return { error: 'Identificador de demonstração inválido', status: 404 };
    const appointment = demoAppointments.find((item) => item.id === id);
    if (!appointment) return { error: 'Agendamento de demonstração não encontrado', status: 404 };
    if (user?.role !== 'admin' && appointment.user_id !== ownerKeyForUser(user)) {
        return { error: 'Não autorizado', status: 403 };
    }
    return { appointment };
}

export function updateDemoAppointment(id, user, details) {
    const found = findAuthorizedAppointment(id, user);
    if (!found.appointment) return found;
    const availability = validateDemoAvailability(details.date, details.time, id);
    if (!availability.valid) return availability;
    found.appointment.date = details.date;
    found.appointment.time = details.time;
    found.appointment.notes = details.notes || '';
    return { appointment: { ...found.appointment } };
}

export function cancelDemoAppointment(id, user) {
    const found = findAuthorizedAppointment(id, user);
    if (!found.appointment) return found;
    found.appointment.status = 'cancelled';
    return { appointment: { ...found.appointment } };
}

export function deleteDemoAppointment(id, user) {
    if (user?.role !== 'admin') return { error: 'Apenas administradores podem excluir agendamentos permanentemente', status: 403 };
    if (!String(id).startsWith('demo-')) return { error: 'Identificador de demonstração inválido', status: 404 };
    const index = demoAppointments.findIndex((item) => item.id === id);
    if (index < 0) return { error: 'Agendamento de demonstração não encontrado', status: 404 };
    demoAppointments.splice(index, 1);
    return { deleted: true };
}

export function resetDemoAppointments(now = new Date()) {
    demoAppointments = createInitialAppointments(now);
    nextDemoId = demoAppointments.length + 1;
    return demoAppointments.length;
}
