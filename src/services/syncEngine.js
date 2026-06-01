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
  store.set({ sync: { ...current, ...patch } });
}

async function refreshPending() {
  try {
    const n = await syncQueue.count();
    setStatus({ pending: n });
    return n;
  } catch (e) {
    return 0;
  }
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

// Procesa la cola completa. Se detiene ante el primer fallo de red para
// reintentar más tarde (preserva el orden de las operaciones).
async function flush() {
  if (running) return;
  if (!apiClient.isConfigured() || !navigator.onLine) {
    await refreshPending();
    return;
  }
  running = true;
  setStatus({ state: 'syncing' });
  try {
    const ops = await syncQueue.all();
    for (const op of ops) {
      try {
        const record = await apiClient.post(op.action, op.data);
        await reconcile(op, record);
        await syncQueue.remove(op.seq);
      } catch (err) {
        const attempts = (op.attempts || 0) + 1;
        await syncQueue.update(op.seq, { attempts: attempts, lastError: String(err && err.message || err) });
        if (attempts >= MAX_ATTEMPTS) {
          // Operación en error persistente: se deja en la cola y se marca.
          setStatus({ state: 'error' });
          continue;
        }
        break; // probablemente sin conexión: reintentar en el próximo ciclo
      }
    }
    const pending = await refreshPending();
    setStatus({ state: pending > 0 ? 'pending' : 'idle', lastSync: new Date().toISOString() });
  } finally {
    running = false;
  }
}

export const syncEngine = {
  flush,
  refreshPending,

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
