// services/dismissService.js — Gestiona el dismiss de pagos próximos hasta su próxima ocurrencia.
// Usa localStorage bajo la clave 'financeos_dismissed_payments'.
// Semántica: dismiss(id, untilDate) oculta el pago hasta que untilDate haya pasado.
// Al llegar la fecha, clearStale() limpia el registro y el pago reaparece.
//
// Para testing en Node.js (sin localStorage), usa _setStorage(mockStorage) para
// inyectar un storage alternativo antes de correr los tests.

const STORAGE_KEY = 'financeos_dismissed_payments';

// Storage activo — se puede reemplazar en tests con _setStorage().
let _storage = typeof localStorage !== 'undefined' ? localStorage : null;

/**
 * Inyecta un storage alternativo (para tests en Node.js donde localStorage no existe).
 * El objeto debe implementar getItem(key), setItem(key, value) y removeItem(key).
 * @param {object} storage
 */
export function _setStorage(storage) {
  _storage = storage;
}

function _load() {
  if (!_storage) return {};
  try {
    return JSON.parse(_storage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function _save(data) {
  if (!_storage) return;
  _storage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/**
 * Descarta un pago hasta la fecha dada (exclusive).
 * El pago reaparece cuando la fecha actual alcance untilDate.
 * @param {string} id — id del pago (upcomingPayment.id)
 * @param {string} untilDate — fecha ISO (YYYY-MM-DD) hasta la que está descartado
 */
export function dismiss(id, untilDate) {
  const data = _load();
  data[id] = untilDate;
  _save(data);
}

/**
 * Indica si un pago está descartado hoy.
 * Retorna true solo si untilDate es estrictamente mayor que hoy (exclusive).
 * @param {string} id
 * @returns {boolean}
 */
export function isDismissed(id) {
  const data = _load();
  const until = data[id];
  if (!until) return false;
  const today = new Date().toISOString().slice(0, 10);
  return until > today;
}

/**
 * Elimina entradas cuyo untilDate ya pasó (mantiene localStorage limpio).
 * Llamar al montar las vistas que usan upcomingPayments.
 */
export function clearStale() {
  const data = _load();
  const today = new Date().toISOString().slice(0, 10);
  let changed = false;
  for (const [id, until] of Object.entries(data)) {
    if (until <= today) {
      delete data[id];
      changed = true;
    }
  }
  if (changed) _save(data);
}
