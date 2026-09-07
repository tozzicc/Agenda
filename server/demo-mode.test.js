import assert from 'node:assert/strict';
import test from 'node:test';
import {
    DEMO_ADMIN,
    DEMO_CLIENTS,
    cancelDemoAppointment,
    createDemoAppointment,
    getDemoBookedTimes,
    getDemoSettings,
    listDemoAvailableTimes,
    listDemoAppointments,
    resetDemoAppointments,
    updateDemoAppointment,
} from './demo-mode.js';

const admin = { id: 99, role: 'admin' };
const user = { id: 1, role: 'user', email: 'real@example.com' };
const futureWeekday = () => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + 20);
    while ([0, 6].includes(date.getUTCDay())) date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString().slice(0, 10);
};

test.beforeEach(() => resetDemoAppointments(new Date('2030-06-10T12:00:00Z')));

test('demo identity and profiles are explicitly fictitious', () => {
    assert.equal(getDemoSettings().companyName, 'Espaço Bem-Estar');
    assert.equal(getDemoSettings().demoMode, true);
    assert.equal(DEMO_ADMIN.email, 'admin@demo.local');
    assert.equal(DEMO_CLIENTS.length, 4);
    assert.ok(DEMO_CLIENTS.every((client) => client.email.endsWith('@demo.local')));
});

test('initial dataset has relative, varied and isolated appointments', () => {
    const appointments = listDemoAppointments(admin);
    assert.equal(appointments.length, 14);
    assert.ok(appointments.every((item) => String(item.id).startsWith('demo-')));
    assert.ok(appointments.some((item) => item.status === 'active'));
    assert.ok(appointments.some((item) => item.status === 'cancelled'));
    assert.ok(new Set(appointments.map((item) => item.user_name)).size >= 4);
    assert.ok(new Set(appointments.map((item) => item.date)).size >= 10);
    assert.ok(listDemoAppointments(user).length > 0);
    assert.ok(listDemoAppointments(user).length < appointments.length);
});

test('create, update, cancel and reset operate only on memory records', () => {
    const date = futureWeekday();
    const created = createDemoAppointment(user, { date, time: '09:00', name: 'Visitante Demo', phone: '000', notes: 'Teste', service_id: 1, professional_id: 1 });
    assert.equal(created.valid, true);
    assert.match(created.appointment.id, /^demo-/);
    assert.deepEqual(getDemoBookedTimes(date), ['09:00']);

    const updated = updateDemoAppointment(created.appointment.id, user, { date, time: '10:00', notes: 'Alterado' });
    assert.equal(updated.appointment.time, '10:00');
    assert.equal(cancelDemoAppointment(created.appointment.id, user).appointment.status, 'cancelled');
    assert.equal(getDemoBookedTimes(date).length, 0);

    assert.equal(updateDemoAppointment('42', user, { date, time: '11:00' }).status, 404);
    assert.equal(resetDemoAppointments(new Date('2030-06-10T12:00:00Z')), 14);
    assert.equal(listDemoAppointments(admin).length, 14);
});

test('demo availability uses duration and isolates professionals', () => {
    const date = futureWeekday();
    assert.equal(createDemoAppointment(user, { date, time: '09:00', service_id: 2, professional_id: 1 }).valid, true);
    assert.equal(createDemoAppointment(user, { date, time: '09:00', service_id: 2, professional_id: 1 }).status, 409);
    assert.equal(createDemoAppointment(user, { date, time: '09:00', service_id: 2, professional_id: 2 }).valid, true);
    assert.ok(!listDemoAvailableTimes(date, 60, 1).includes('09:00'));
    assert.ok(!listDemoAvailableTimes(date, 120, 2).includes('11:00'));
});
