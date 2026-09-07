import assert from 'node:assert/strict';
import test from 'node:test';
import { aggregateDashboard, resolveDashboardPeriod } from './dashboard.js';

const now = new Date('2030-06-15T12:00:00Z');

test('dashboard quick filters and custom range resolve inclusively', () => {
    assert.deepEqual(resolveDashboardPeriod({ preset: 'today' }, now), { start: '2030-06-15', end: '2030-06-15', preset: 'today' });
    assert.deepEqual(resolveDashboardPeriod({ preset: '7d' }, now), { start: '2030-06-09', end: '2030-06-15', preset: '7d' });
    assert.deepEqual(resolveDashboardPeriod({ preset: '30d' }, now), { start: '2030-05-17', end: '2030-06-15', preset: '30d' });
    assert.deepEqual(resolveDashboardPeriod({ preset: 'month' }, now), { start: '2030-06-01', end: '2030-06-15', preset: 'month' });
    assert.deepEqual(resolveDashboardPeriod({ start: '2030-06-02', end: '2030-06-10' }, now), { start: '2030-06-02', end: '2030-06-10', preset: 'custom' });
});

test('dashboard rejects invalid dates, reversed periods and unknown presets', () => {
    assert.ok(resolveDashboardPeriod({ start: '2030-02-30', end: '2030-03-01' }, now).error);
    assert.ok(resolveDashboardPeriod({ start: '2030-06-10', end: '2030-06-01' }, now).error);
    assert.ok(resolveDashboardPeriod({ preset: 'year' }, now).error);
});

test('aggregations cover KPIs, rankings, status and legacy records', () => {
    const appointments = [
        { date: '2030-06-10', time: '09:00', status: 'active', user_id: 1, user_name: 'Ana', professional_name: 'Dra. Lia', service_name: 'Consulta' },
        { date: '2030-06-10', time: '09:00', status: 'cancelled', user_id: 1, user_name: 'Ana', professional_name: null, service_name: null },
        { date: '2030-06-11', time: '14:00', status: 'active', user_id: 2, user_name: 'Beto', professional_name: 'Dr. Rui', service_name: 'Retorno' },
        { date: '2030-05-01', time: '10:00', status: 'active', user_name: 'Fora', professional_name: 'Fora', service_name: 'Fora' },
    ];
    const result = aggregateDashboard(appointments, { start: '2030-06-01', end: '2030-06-30' }, { today: 2, activeProfessionals: 3, activeServices: 4 });
    assert.deepEqual(result.kpis, { appointmentsToday: 2, appointmentsInPeriod: 3, cancellationsInPeriod: 1, clientsInPeriod: 2, activeProfessionals: 3, activeServices: 4, cancellationRate: 33.3 });
    assert.deepEqual(result.appointmentsByDay.map((item) => item.count), [2, 1]);
    assert.ok(result.appointmentsByProfessional.some((item) => item.label === 'Não informado' && item.count === 1));
    assert.ok(result.appointmentsByService.some((item) => item.label === 'Não informado' && item.count === 1));
    assert.equal(result.appointmentsByWeekday.length, 7);
    assert.equal(result.appointmentsByTime[0].label, '09:00');
    assert.deepEqual(result.topClients[0], { label: 'Ana', count: 2 });
    assert.ok(result.statusDistribution.some((item) => item.status === 'cancelled' && item.count === 1));
});

test('empty periods return stable zero-valued structures', () => {
    const result = aggregateDashboard([], { start: '2030-01-01', end: '2030-01-02' });
    assert.equal(result.kpis.appointmentsInPeriod, 0);
    assert.equal(result.kpis.cancellationRate, 0);
    assert.equal(result.appointmentsByWeekday.length, 7);
    assert.deepEqual(result.appointmentsByProfessional, []);
});
