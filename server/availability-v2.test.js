import assert from 'node:assert/strict';
import test from 'node:test';
import pg from 'pg';

process.env.DATABASE_URL = 'postgres://availability.invalid/test';
pg.Pool.prototype.query = async () => ({ rows: [], rowCount: 0 });

const { intervalsOverlap, validateScheduleCandidate } = await import('./availability-v2.js');

const settings = {
    schedule_start: '09:00',
    schedule_end: '18:00',
    schedule_interval: '30',
    allow_saturday: 'true',
    allow_sunday: 'true',
    blocked_periods: '[]',
    enable_lunch: 'true',
    lunch_start: '12:00',
    lunch_end: '13:00',
};

test('interval overlap follows half-open boundaries', () => {
    assert.equal(intervalsOverlap(600, 660, 630, 690), true);
    assert.equal(intervalsOverlap(600, 660, 660, 720), false);
    assert.equal(intervalsOverlap(660, 720, 600, 660), false);
});

test('service duration must fit the workday and avoid lunch entirely', () => {
    const options = { allowPast: true };
    assert.equal(validateScheduleCandidate('2030-01-10', '17:00', 60, settings, options).valid, true);
    assert.equal(validateScheduleCandidate('2030-01-10', '17:30', 60, settings, options).valid, false);
    assert.equal(validateScheduleCandidate('2030-01-10', '11:30', 60, settings, options).valid, false);
    assert.equal(validateScheduleCandidate('2030-01-10', '13:00', 60, settings, options).valid, true);
});
