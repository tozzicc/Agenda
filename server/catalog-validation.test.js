import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePositiveId, validateActiveStatus, validateProfessional, validateService } from './catalog-validation.js';

test('professional validation requires a bounded name and boolean status', () => {
    assert.match(validateProfessional({}).error, /Nome/);
    assert.match(validateProfessional({ name: 'x'.repeat(121) }).error, /120/);
    assert.match(validateProfessional({ name: 'Ana', active: 'yes' }).error, /booleano/);
    assert.deepEqual(validateProfessional({ name: ' Ana ', specialty: ' Terapia ', active: false }).value, { name: 'Ana', specialty: 'Terapia', active: false });
});

test('service validation requires a reasonable positive integer duration', () => {
    for (const durationMinutes of [0, -1, 1.5, 1441, undefined]) {
        assert.match(validateService({ name: 'Consulta', durationMinutes }).error, /Duração/);
    }
    assert.equal(validateService({ name: 'Consulta', durationMinutes: 60 }).value.durationMinutes, 60);
    assert.match(validateService({ name: 'Consulta', durationMinutes: 60, active: 1 }).error, /booleano/);
});

test('status and route ids reject invalid values', () => {
    assert.equal(validateActiveStatus({ active: true }).value, true);
    assert.match(validateActiveStatus({ active: 'false' }).error, /booleano/);
    assert.match(validateActiveStatus({}).error, /booleano/);
    assert.equal(parsePositiveId('2'), 2);
    assert.equal(parsePositiveId('0'), null);
    assert.equal(parsePositiveId('abc'), null);
});