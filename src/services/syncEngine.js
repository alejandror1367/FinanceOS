// services/syncEngine.js — motor de sincronización offline-first.
// Procesa la cola en orden, con reintentos y backoff, y reconcilia el
// resultado canónico del backend en la caché local (IndexedDB) y el store.
// (docs/Architecture.md §6)

import { apiClient } from './apiClient.js';
import { syncQueue } from './syncQueue.js';
import { db } from './db.js';
import { store } from '../store/store.js';
import { ENTITY_TO_STORE } from './entities.js';

const MAX_ATTEMPTS = 6;
const PERIODIC_MS = 30000;

let running = false;
let timer = null;

function setStatus(patch) {
  const current = store.get().sync || {};
  // PERF: no emitir si ningún campo cambia. Sin esto, el flush periódico (30 s)
  // con la cola vacía disparaba store.set → re-render completo de la vista activa
  // cada 30 s para nada.
  let changed = false;
  for (const k in patch) { if (current[k] !== patch[k]) { changed = true; break; } }
  if (!changed) return;
  store.set({ sync: { ...current, ...patch } });
}

async function refreshPending() {
  try {
    const n = await syncQueue.count();
    const failed = await syncQueue.deadCount();
    setStatus({ pending: n, failed });
    return n;
  } catch (e) {
    return 0;
  }
}

// TD-10: distingue un error TRANSITORIO (sin red, timeout, 5xx) —que conviene reintentar—
// de un error de NEGOCIO (4xx, validación, autorización) —que no se resolverá reintentando
// y debe ir a dead-letter para no bloquear la cola (head-of-line blocking)—.
// BE-011: "No autorizado" es un error de negocio (401/403): el backend rechazó la operación
// por credenciales inválidas o permisos insuficientes. Reintentarlo infinitamente solo atasca
// la cola; debe ir a dead-letter para que el usuario sea notificado y decida si reintentar.
function isTransient(err) {
  if (!navigator.onLine) return true;
  if (err && err.name === 'AbortError') return true;                 // timeout del cliente
  const msg = String((err && err.message) || err || '');
  if (/Failed to fetch|NetworkError|load failed|ERR_NETWORK|network/i.test(msg)) return true;
  if (/HTTP 5\d\d/.test(msg)) return true;                            // error del servidor
  return false;                                                       // 4xx / auth / negocio → dead-letter
}

// Reemplaza la colección de un store en memoria desde IndexedDB.
async function reloadCollection(storeName) {
  const items = await db.getAll(storeName);
  const patch = {};
  patch[storeName] = items;
  store.set(patch);
}

async function reconcile(op, record) {
  const storeName = ENTITY_TO_STORE[op.entity];
  if (!storeName) return;

  if (op.action.indexOf('delete') === 0) {
    if (op.entityId) await db.delete(storeName, op.entityId);
  } else if (record && record.id) {
    // Si el backend asignó un id distinto al optimista, limpia el temporal.
    if (op.entityId && op.entityId !== record.id) await db.delete(storeName, op.entityId);
    await db.put(storeName, record);
  }
  await reloadCollection(storeName);
}

// TD-26: intenta enviar N ops en 1 request batchWrite; si falla (backend sin batchWrite
// o error de red), hace fallback a envío individual op por op.
// BE-010: el emparejamiento op↔resultado se hace por entityId, no por índice posicional.
// El backend puede devolver resultados en distinto orden o con gaps; el índice [i] sería
// incorrecto en esos casos. entityId es la clave estable que ambos lados comparten.
async function flushBatch(ops) {
  const payload = ops.map((op) => ({ action: op.action, data: op.data, entityId: op.entityId }));
  const { results } = await apiClient.post('batchWrite', { ops: payload });
  // Construir un mapa entityId → resultado para emparejar por clave, no por posición.
  const resultMap = {};
  for (const res of results) {
    if (res.entityId) resultMap[res.entityId] = res;
  }
  for (const op of ops) {
    const res = resultMap[op.entityId] || { ok: false, error: 'sin resultado del servidor' };
    if (res.ok) {
      await reconcile(op, res.data);
      await syncQueue.remove(op.seq);
    } else {
      await syncQueue.markDead(op.seq, res.error || 'error en batchWrite');
    }
  }
}

// Procesa la cola completa. Usa batchWrite cuando hay ≥2 ops pendientes;
// si el backend no lo soporta, hace fallback a envío individual.
// Se detiene ante el primer fallo de red para reintentar más tarde.
async function flush() {
  if (running) return;
  if (!apiClient.isConfigured() || !navigator.onLine) {
    await refreshPending();
    return;
  }
  // PERF: si no hay nada en la cola (estado normal en reposo), no entrar en el
  // flujo "syncing → idle" ni tocar lastSync — eso re-renderizaba la vista activa
  // cada 30 s sin sincronizar nada. refreshPending va guardado (no emite si los
  // contadores no cambian).
  const ops = await syncQueue.all();
  if (!ops.length) {
    await refreshPending();
    return;
  }
  running = true;
  setStatus({ state: 'syncing' });
  try {
    if (ops.length >= 2) {
      try {
        await flushBatch(ops);
      } catch (batchErr) {
        if (!isTransient(batchErr)) {
          // El backend rechazó el lote como negocio: procesa op a op
          for (const op of ops) await flushSingle(op);
        } else {
          // Error transitorio (timeout, red, token frío): cuenta intentos por op.
          // Antes se dejaba la cola intacta SIN contar intentos → si el fallo era
          // persistente (p. ej. el lote excede el timeout), reintentaba en bucle
          // infinito ("sincronizando" eterno). Ahora se acota a MAX_ATTEMPTS y luego
          // va a dead-letter, igual que flushSingle.
          const msg = String((batchErr && batchErr.message) || batchErr);
          for (const op of ops) {
            const attempts = (op.attempts || 0) + 1;
            if (attempts >= MAX_ATTEMPTS) await syncQueue.markDead(op.seq, msg);
            else await syncQueue.update(op.seq, { attempts, lastError: msg });
          }
        }
      }
    } else {
      for (const op of ops) await flushSingle(op);
    }
    const pending = await refreshPending();
    const failed = (store.get().sync || {}).failed || 0;
    setStatus({ state: failed > 0 ? 'error' : (pending > 0 ? 'pending' : 'idle'), lastSync: new Date().toISOString() });
  } finally {
    running = false;
  }
}

async function flushSingle(op) {
  try {
    const record = await apiClient.post(op.action, op.data);
    await reconcile(op, record);
    await syncQueue.remove(op.seq);
  } catch (err) {
    const msg = String(err && err.message || err);
    if (!isTransient(err)) {
      await syncQueue.markDead(op.seq, msg);
      return;
    }
    const attempts = (op.attempts || 0) + 1;
    await syncQueue.update(op.seq, { attempts: attempts, lastError: msg });
    if (attempts >= MAX_ATTEMPTS) {
      await syncQueue.markDead(op.seq, msg);
    }
  }
}

export const syncEngine = {
  flush,
  refreshPending,

  // TD-10: gestión de dead-letter desde Ajustes.
  listFailed() { return syncQueue.deadLetters(); },
  async retryFailed() {
    const dead = await syncQueue.deadLetters();
    for (const op of dead) await syncQueue.requeue(op.seq);
    await refreshPending();
    await flush();
  },
  async discardFailed() {
    const dead = await syncQueue.deadLetters();
    for (const op of dead) await syncQueue.discard(op.seq);
    await refreshPending();
  },

  start() {
    setStatus({ online: navigator.onLine, state: 'idle' });
    addEventListener('online', () => { setStatus({ online: true }); flush(); });
    addEventListener('offline', () => setStatus({ online: false }));
    refreshPending();
    flush();
    if (!timer) timer = setInterval(flush, PERIODIC_MS);
  },

  stop() {
    if (timer) { clearInterval(timer); timer = null; }
  },
};
