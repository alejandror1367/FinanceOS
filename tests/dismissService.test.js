/**
 * Tests del servicio de dismiss de pagos próximos — src/services/dismissService.js
 * Ejecutar: node --test tests/dismissService.test.js
 * Requiere Node 18+. Sin dependencias npm (node:test nativo).
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { dismiss, isDismissed, clearStale, _setStorage } from '../src/services/dismissService.js';

// ── Mock de localStorage para Node.js ────────────────────────────────────────

function makeMockStorage() {
  const store = {};
  return {
    getItem(key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
    setItem(key, value) { store[key] = String(value); },
    removeItem(key) { delete store[key]; },
    clear() { for (const k of Object.keys(store)) delete store[k]; },
    _raw() { return store; },
  };
}

// Fecha helper: devuelve una fecha ISO YYYY-MM-DD relativa a hoy.
function dateOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ── Setup: cada describe usa su propio storage limpio ─────────────────────────

describe('dismiss + isDismissed', () => {
  let mock;

  beforeEach(() => {
    mock = makeMockStorage();
    _setStorage(mock);
  });

  test('dismiss con fecha futura → isDismissed retorna true', () => {
    const futureDate = dateOffset(5); // 5 días adelante
    dismiss('pago-001', futureDate);
    assert.equal(isDismissed('pago-001'), true);
  });

  test('dismiss con fecha pasada → isDismissed retorna false (ya expiró)', () => {
    const pastDate = dateOffset(-1); // ayer
    dismiss('pago-002', pastDate);
    assert.equal(isDismissed('pago-002'), false);
  });

  test('dismiss con fecha de hoy → isDismissed retorna false (until es exclusive: until > today)', () => {
    const today = new Date().toISOString().slice(0, 10);
    dismiss('pago-003', today);
    assert.equal(isDismissed('pago-003'), false);
  });

  test('isDismissed retorna false para id no registrado', () => {
    assert.equal(isDismissed('pago-inexistente'), false);
  });

  test('dismiss de id ya registrado actualiza la fecha', () => {
    const futureDate = dateOffset(3);
    const pastDate   = dateOffset(-2);
    dismiss('pago-004', futureDate);
    assert.equal(isDismissed('pago-004'), true);
    // sobreescribir con fecha pasada: debe dejar de estar dismissed
    dismiss('pago-004', pastDate);
    assert.equal(isDismissed('pago-004'), false);
  });

  test('múltiples pagos dismissed son independientes', () => {
    dismiss('pago-A', dateOffset(7));
    dismiss('pago-B', dateOffset(-1));
    dismiss('pago-C', dateOffset(2));
    assert.equal(isDismissed('pago-A'), true);
    assert.equal(isDismissed('pago-B'), false);
    assert.equal(isDismissed('pago-C'), true);
  });
});

describe('clearStale', () => {
  let mock;

  beforeEach(() => {
    mock = makeMockStorage();
    _setStorage(mock);
  });

  test('clearStale elimina entradas cuyo untilDate ya pasó', () => {
    dismiss('viejo-1', dateOffset(-3));
    dismiss('viejo-2', dateOffset(-1));
    dismiss('vigente', dateOffset(5));
    clearStale();
    // Los viejos ya no deben estar dismissed
    assert.equal(isDismissed('viejo-1'), false);
    assert.equal(isDismissed('viejo-2'), false);
    // El vigente sigue activo
    assert.equal(isDismissed('vigente'), true);
  });

  test('clearStale elimina también entradas con untilDate = hoy (exclusive: until <= today)', () => {
    const today = new Date().toISOString().slice(0, 10);
    dismiss('hoy-exact', today);
    clearStale();
    assert.equal(isDismissed('hoy-exact'), false);
  });

  test('clearStale no hace nada si todas las entradas son vigentes', () => {
    dismiss('futuro-1', dateOffset(2));
    dismiss('futuro-2', dateOffset(10));
    clearStale();
    assert.equal(isDismissed('futuro-1'), true);
    assert.equal(isDismissed('futuro-2'), true);
  });

  test('clearStale con storage vacío no lanza error', () => {
    assert.doesNotThrow(() => clearStale());
  });
});
