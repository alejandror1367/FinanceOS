/**
 * Tests de la lógica de recurrencia — src/services/recurringService.js
 * Ejecutar: node --test tests/recurring.test.js
 * Solo cubre las funciones PURAS (nextRunFrom, dueRuns); runDueRecurring tiene
 * efectos (IndexedDB/red) y se valida en vivo.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { nextRunFrom, dueRuns } from '../src/services/recurringService.js';

describe('nextRunFrom', () => {
  test('daily suma 1 día', () => {
    assert.equal(nextRunFrom('2026-06-09', 'daily'), '2026-06-10');
  });
  test('weekly suma 7 días', () => {
    assert.equal(nextRunFrom('2026-06-09', 'weekly'), '2026-06-16');
  });
  test('monthly suma 1 mes conservando el día', () => {
    assert.equal(nextRunFrom('2026-06-15', 'monthly'), '2026-07-15');
  });
  test('yearly suma 1 año', () => {
    assert.equal(nextRunFrom('2026-06-15', 'yearly'), '2027-06-15');
  });
  test('monthly desde el 31 topa al último día del mes destino (no desborda)', () => {
    assert.equal(nextRunFrom('2026-01-31', 'monthly'), '2026-02-28'); // 2026 no bisiesto
  });
  test('monthly desde el 31 a un mes de 30 días → día 30', () => {
    assert.equal(nextRunFrom('2026-03-31', 'monthly'), '2026-04-30');
  });
  test('cruza fin de año', () => {
    assert.equal(nextRunFrom('2026-12-15', 'monthly'), '2027-01-15');
  });
});

describe('dueRuns', () => {
  const rec = (over = {}) => ({ id: 'r1', frequency: 'monthly', nextRunDate: '2026-06-01', isActive: true, ...over });

  test('nextRunDate en el futuro → sin ejecuciones', () => {
    const { runs, nextRunDate } = dueRuns(rec({ nextRunDate: '2026-12-01' }), '2026-06-09');
    assert.deepEqual(runs, []);
    assert.equal(nextRunDate, '2026-12-01');
  });

  test('una ocurrencia vencida → 1 run y avanza al siguiente período', () => {
    const { runs, nextRunDate } = dueRuns(rec({ nextRunDate: '2026-06-01' }), '2026-06-09');
    assert.deepEqual(runs, ['2026-06-01']);
    assert.equal(nextRunDate, '2026-07-01');
  });

  test('varios períodos atrasados (catch-up) → todas las ocurrencias hasta hoy', () => {
    const { runs, nextRunDate } = dueRuns(rec({ nextRunDate: '2026-03-10', frequency: 'monthly' }), '2026-06-09');
    // 03-10, 04-10, 05-10 ≤ hoy; 06-10 > hoy (06-09) → no se incluye.
    assert.deepEqual(runs, ['2026-03-10', '2026-04-10', '2026-05-10']);
    assert.equal(nextRunDate, '2026-06-10');
  });

  test('recurrente pausado → sin ejecuciones', () => {
    const { runs } = dueRuns(rec({ isActive: false, nextRunDate: '2026-01-01' }), '2026-06-09');
    assert.deepEqual(runs, []);
  });

  test('ocurrencia exactamente hoy se incluye', () => {
    const { runs } = dueRuns(rec({ nextRunDate: '2026-06-09', frequency: 'daily' }), '2026-06-09');
    assert.deepEqual(runs, ['2026-06-09']);
  });

  test('respeta el tope de catch-up (cap)', () => {
    const { runs } = dueRuns(rec({ nextRunDate: '2020-01-01', frequency: 'daily' }), '2026-06-09', 5);
    assert.equal(runs.length, 5);
  });
});
