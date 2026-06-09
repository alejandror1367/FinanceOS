// services/dataService.js — orquesta persistencia local, carga y mutaciones.
//
// Dos modos:
//  - LOCAL/MOCK (config.api.baseUrl == null): siembra datos mock en IndexedDB
//    y trabaja 100% offline (comportamiento de Fase 1).
//  - CONECTADO (baseUrl configurada): hidrata desde caché local para render
//    instantáneo, arranca el motor de sync, vacía la cola pendiente y luego
//    descarga datos frescos del backend (Apps Script). Las escrituras pasan
//    por mutate(): Optimistic UI -> cola -> sincronización.
//
// El frontend NUNCA conoce Google Sheets; solo el contrato action-based.

import { db } from './db.js';
import { store } from '../store/store.js';
import { mockData } from '../data/mock.js';
import { apiClient } from './apiClient.js';
import { syncQueue } from './syncQueue.js';
import { syncEngine } from './syncEngine.js';
import { ENTITIES } from './entities.js';
import { newId } from '../utils/id.js';
import { roundMoney } from '../utils/format.js';

const SEED_FLAG = 'seed:v1';

function stamp(record) {
  const ts = new Date().toISOString();
  return { createdAt: ts, updatedAt: ts, isDeleted: false, ...record };
}

function baseCurrencyFrom(settings) {
  const row = (settings || []).find((s) => s.key === 'baseCurrency');
  return row ? row.value : mockData.meta.baseCurrency;
}

// Hidrata el store en memoria desde IndexedDB.
async function loadFromLocal() {
  const colls = Object.keys(ENTITIES);
  const lists = await Promise.all(colls.map((c) => db.getAll(ENTITIES[c].store)));
  const patch = {};
  colls.forEach((c, i) => { patch[c] = lists[i]; });
  patch.netWorthSeries = mockData.netWorthSeries; // placeholder hasta snapshots
  patch.baseCurrency = baseCurrencyFrom(patch.settings);
  store.hydrate(patch);
}

// Convención: saldo CC siempre negativo (−200k = debes 200k). Balance positivo en CC
// invierte el signo de transferencias y gastos. Normaliza datos anteriores al cambio.
async function normalizeCCBalancesInDB() {
  if (!db.available()) return;
  try {
    const accounts = await db.getAll('accounts');
    const positiveCC = accounts.filter((a) => a.type === 'credit_card' && (a.balance || 0) > 0);
    if (!positiveCC.length) return;
    for (const a of positiveCC) {
      await db.put('accounts', { ...a, balance: -Math.abs(a.balance), updatedAt: new Date().toISOString() });
    }
    const updated = await db.getAll('accounts');
    store.hydrate({ accounts: updated });
  } catch (e) {
    console.warn('[dataService] normalizeCCBalancesInDB falló:', e.message);
  }
}

// Siembra mock una sola vez (solo modo local).
async function seedMockIfNeeded() {
  const seeded = await db.kvGet(SEED_FLAG);
  if (seeded) return;
  for (const c of Object.keys(ENTITIES)) {
    const rows = (mockData[c] || []).map(stamp);
    if (rows.length) await db.bulkPut(ENTITIES[c].store, rows);
  }
  await db.kvSet(SEED_FLAG, true);
}

// Envuelve una promesa en la forma {status, value|reason} de Promise.allSettled.
function settle(promise) {
  return promise.then(
    (value) => ({ status: 'fulfilled', value }),
    (reason) => ({ status: 'rejected', reason }),
  );
}

// Reaplica la cola pendiente sobre patch + IndexedDB y finaliza el hydrate del store.
// TD-13: tras un pull (clear+replace) re-aplicamos las operaciones encoladas para que
// los creates/updates locales no se pierdan hasta que el backend los confirme.
// BE-004: para ops de tipo `update`, op.data contiene solo el PATCH (campos modificados),
// no el registro completo. Guardarlo directamente con db.put sobreescribiría el registro
// eliminando los campos no incluidos en el patch. Se lee el registro existente y se mergea.
async function reconcileAndHydrate(patch, colls) {
  try {
    const { ENTITY_TO_STORE } = await import('./entities.js');
    const pending = await syncQueue.all();
    for (const op of pending) {
      const storeName = ENTITY_TO_STORE[op.entity];
      if (!storeName) continue;
      const coll = colls.find((c) => ENTITIES[c].store === storeName);
      if (op.action.includes('delete') && op.entityId) {
        await db.delete(storeName, op.entityId);
        if (patch[coll]) patch[coll] = patch[coll].filter((r) => r.id !== op.entityId);
      } else if (op.data && op.data.id) {
        // BE-004: para updates, mergear el patch sobre el registro existente para no perder
        // campos no modificados. Para creates, op.data ya es el registro completo.
        const isUpdate = op.action && op.action.toLowerCase().includes('update');
        let record = op.data;
        if (isUpdate) {
          const existing = await db.get(storeName, op.data.id);
          if (existing) record = { ...existing, ...op.data };
        }
        await db.put(storeName, record);
        if (patch[coll]) {
          const idx = patch[coll].findIndex((r) => r.id === record.id);
          if (idx >= 0) patch[coll][idx] = record;
          else patch[coll].push(record);
        }
      }
    }
  } catch (e) {
    console.warn('[dataService] re-apply queue falló:', e.message);
  }

  patch.netWorthSeries = mockData.netWorthSeries;
  patch.baseCurrency = baseCurrencyFrom(patch.settings);
  store.hydrate(patch);
}

// Aplica un mapa { coll: rows[] } del backend a IndexedDB + store: sustituye la caché
// de cada colección con datos frescos; las que falten/fallen conservan su caché local.
async function applyCollections(data, colls) {
  const patch = {};
  let ok = 0;
  for (const c of colls) {
    const rows = data && Array.isArray(data[c]) ? data[c] : null;
    if (rows) {
      await db.clear(ENTITIES[c].store);
      if (rows.length) await db.bulkPut(ENTITIES[c].store, rows);
      patch[c] = rows;
      ok++;
    } else {
      patch[c] = await db.getAll(ENTITIES[c].store);
    }
  }
  await reconcileAndHydrate(patch, colls);
  return { pulled: ok, total: colls.length };
}

// TD-15: descarga las 12 colecciones en UNA sola petición (getBootstrap).
// Una sola request autenticada → sin "estampida" de verificación de token (raíz de BUG-C1).
async function pullBootstrap() {
  const colls = Object.keys(ENTITIES);
  const data = await apiClient.get('getBootstrap');
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('getBootstrap: respuesta inválida');
  }
  return applyCollections(data, colls);
}

// Fallback (backend sin getBootstrap): descarga cada colección por separado (12 requests).
// BUG-C1: warm-up secuencial de la primera petición para que el backend cachee la
// verificación del token (verifyGoogleToken_, 25 min) antes de la ráfaga concurrente,
// evitando la estampida de verificaciones contra Google tokeninfo. Reintentamos el
// warm-up un par de veces porque es la petición que "abre la puerta".
async function pullAll() {
  const colls = Object.keys(ENTITIES);
  let head = await settle(apiClient.get(ENTITIES[colls[0]].read));
  for (let i = 0; i < 2 && head.status === 'rejected'; i++) {
    await new Promise((r) => setTimeout(r, 600));
    head = await settle(apiClient.get(ENTITIES[colls[0]].read));
  }
  const tail = await Promise.allSettled(colls.slice(1).map((c) => apiClient.get(ENTITIES[c].read)));
  const results = [head, ...tail];
  const data = {};
  for (let i = 0; i < colls.length; i++) {
    const res = results[i];
    if (res.status === 'fulfilled' && Array.isArray(res.value)) {
      data[colls[i]] = res.value;
    } else {
      console.warn(`[dataService] pull "${colls[i]}" falló:`, res.reason && res.reason.message);
    }
  }
  return applyCollections(data, colls);
}

// Ruta de descarga preferida: getBootstrap (1 request) con fallback automático a
// pullAll (12 requests) si el backend aún no expone getBootstrap o falla puntualmente.
async function pullData() {
  try {
    return await pullBootstrap();
  } catch (e) {
    console.warn('[dataService] getBootstrap no disponible → pullAll:', e.message);
    return await pullAll();
  }
}

export const dataService = {
  async init() {
    const connected = apiClient.isConfigured();

    // Modo local/mock (sin backend).
    if (!connected) {
      try {
        if (db.available()) {
          await seedMockIfNeeded();
          await loadFromLocal();
          await normalizeCCBalancesInDB();
          syncEngine.start();
          return { source: 'indexeddb', connected: false };
        }
      } catch (e) {
        console.warn('[dataService] IndexedDB no disponible:', e);
      }
      // Fallback memoria pura.
      const patch = {};
      Object.keys(ENTITIES).forEach((c) => { patch[c] = (mockData[c] || []).map(stamp); });
      patch.netWorthSeries = mockData.netWorthSeries;
      patch.baseCurrency = mockData.meta.baseCurrency;
      store.hydrate(patch);
      syncEngine.start();
      return { source: 'memory', connected: false };
    }

    // Modo conectado.
    try {
      if (db.available()) await loadFromLocal(); // render instantáneo desde caché
    } catch (e) { /* caché vacía, continuamos */ }
    await normalizeCCBalancesInDB(); // normaliza CCs con balance positivo (datos antiguos)

    syncEngine.start();
    try { await syncEngine.flush(); } catch (e) { /* offline: se reintenta */ }

    if (navigator.onLine) {
      try {
        let res = await pullData();
        // BUG-C1: si TODO falló (cold start con la verificación del token todavía
        // fría/transitoria), reintentar una vez tras un breve respiro. El primer
        // intento ya habrá calentado el estado de auth en el backend.
        if (res.pulled === 0) {
          await new Promise((r) => setTimeout(r, 800));
          res = await pullData();
        }
        await normalizeCCBalancesInDB(); // re-normaliza tras sync (backend puede devolver positivo)
        // Backfill: crea categorías base faltantes en instalaciones existentes.
        const cats = store.get().categories || [];
        const hasOtros = cats.some((c) => c.name === 'Otros' && c.kind === 'expense' && !c.isDeleted);
        if (!hasOtros) await this.create('categories', { name: 'Otros', kind: 'expense', color: 'slate', icon: 'wallet' }).catch(() => {});
      }
      catch (e) { console.warn('[dataService] pull falló (se usa caché):', e); }
    }
    return { source: 'backend', connected: true };
  },

  // -------- API de mutaciones (Optimistic UI) --------
  // coll: clave de ENTITIES. Devuelve el registro optimista.
  async create(coll, data) {
    const cfg = ENTITIES[coll];
    const record = stamp({ id: data.id || newId(), ...data });
    // TD-14: el dato y su operación de cola se escriben en UNA transacción atómica,
    // para que nunca quede un registro local sin su op de sync (o viceversa).
    const op = syncQueue.makeRecord({ action: ENTITIES[coll].create, entity: cfg.entity, entityId: record.id, data: record });
    await db.transact([cfg.store, 'syncQueue'], 'readwrite', (s) => {
      s[cfg.store].put(record);
      s.syncQueue.put(op);
    });
    await this._refreshStore(coll);
    if (coll === 'transactions') await this._adjustAccountBalances(record, +1);
    await syncEngine.refreshPending();
    syncEngine.flush();
    return record;
  },

  async update(coll, id, patch) {
    const cfg = ENTITIES[coll];
    const current = await db.get(cfg.store, id);
    const record = { ...(current || { id }), ...patch, id, updatedAt: new Date().toISOString() };
    const op = syncQueue.makeRecord({ action: ENTITIES[coll].update, entity: cfg.entity, entityId: id, data: { id, ...patch } });
    await db.transact([cfg.store, 'syncQueue'], 'readwrite', (s) => {   // TD-14: atómico
      s[cfg.store].put(record);
      s.syncQueue.put(op);
    });
    await this._refreshStore(coll);
    // BE-002 (TD-46): para transacciones, recalcular el saldo de las cuentas afectadas
    // desde las transacciones locales en lugar de aplicar deltas manualmente.
    // La razón: si el usuario edita la misma tx N veces offline antes del flush, el
    // enfoque de deltas acumula N ajustes sobre el saldo; la recalculación desde cero
    // es idempotente ante cualquier número de ediciones entre pulls.
    // Trade-off: requiere leer todas las tx de la cuenta afectada (O(n) local, IndexedDB
    // en memoria); es aceptable porque este path solo ocurre en edición, no en lectura.
    // El optimistic UI para creates NO se ve afectado (usa _adjustAccountBalances).
    if (coll === 'transactions') {
      const accountsToRecalc = new Set();
      if (current)                          accountsToRecalc.add(current.accountId);
      if (current && current.toAccountId)   accountsToRecalc.add(current.toAccountId);
      if (record.accountId)                 accountsToRecalc.add(record.accountId);
      if (record.toAccountId)               accountsToRecalc.add(record.toAccountId);
      for (const accountId of accountsToRecalc) {
        await this._recalcAccountBalance(accountId);
      }
    }
    await syncEngine.refreshPending();
    syncEngine.flush();
    return record;
  },

  async remove(coll, id) {
    const cfg = ENTITIES[coll];
    const existing = coll === 'transactions' ? await db.get(cfg.store, id) : null;
    const op = syncQueue.makeRecord({ action: ENTITIES[coll].remove, entity: cfg.entity, entityId: id, data: { id } });
    await db.transact([cfg.store, 'syncQueue'], 'readwrite', (s) => {   // TD-14: atómico
      s[cfg.store].delete(id); // optimista: fuera de la caché local
      s.syncQueue.put(op);
    });
    await this._refreshStore(coll);
    if (existing) await this._adjustAccountBalances(existing, -1);
    await syncEngine.refreshPending();
    syncEngine.flush();
    return { id, deleted: true };
  },

  async _refreshStore(coll) {
    const items = await db.getAll(ENTITIES[coll].store);
    const patch = {};
    patch[coll] = items;
    store.set(patch);
  },

  // Fuerza una descarga manual (botón "Actualizar").
  async refresh() {
    if (!apiClient.isConfigured()) return { refreshed: false };
    // TD-13: vaciar la cola pendiente ANTES de descargar, para que el pull
    // (clear+replace) no compita con creates/updates locales sin sincronizar.
    // Lo que quede pendiente lo recupera reconcileAndHydrate tras el pull.
    try { await syncEngine.flush(); } catch (e) { /* offline: se reintenta luego */ }
    await pullData();
    return { refreshed: true };
  },

  // Guarda un snapshot de patrimonio. Requiere conexión.
  // frontendValues: desglose calculado en el FE (tiene precios en vivo vía priceService).
  async saveSnapshot(frontendValues = {}) {
    if (!apiClient.isConfigured()) throw new Error('Sin backend configurado.');
    if (!navigator.onLine) throw new Error('Sin conexión.');
    const rec = await apiClient.post('saveNetWorthSnapshot', frontendValues);
    await db.put('netWorthSnapshots', rec);
    const items = await db.getAll('netWorthSnapshots');
    store.set({ netWorthSnapshots: items });
    return rec;
  },

  // ── Modelo híbrido de saldos (TD-01) ──────────────────────────────────────
  // Ajusta el saldo de las cuentas afectadas por una transacción en IndexedDB.
  // sign: +1 para aplicar, -1 para revertir. Solo actualiza local —
  // el backend hace lo mismo al procesar la transacción vía sync.
  // Usado solo por create/remove (donde el delta es siempre idempotente).
  async _adjustAccountBalances(tx, sign) {
    if (!tx || !tx.amount || !tx.type) return;
    const amount = tx.amount || 0;
    if (tx.type === 'income') {
      await this._shiftBalance(tx.accountId, sign * amount);
    } else if (tx.type === 'expense') {
      await this._shiftBalance(tx.accountId, -(sign * amount));
    } else if (tx.type === 'transfer') {
      await this._shiftBalance(tx.accountId, -(sign * amount));
      if (tx.toAccountId) await this._shiftBalance(tx.toAccountId, sign * amount);
    }
  },

  async _shiftBalance(accountId, delta) {
    if (!accountId || !delta) return;
    const account = await db.get('accounts', accountId);
    if (!account) return;
    // BE-013 (TD-22): redondear según divisa — evita centavos fantasma en COP.
    const updated = { ...account, balance: roundMoney((account.balance || 0) + delta, account.currency || 'COP'), updatedAt: new Date().toISOString() };
    await db.put('accounts', updated);
    await this._refreshStore('accounts');
  },

  // BE-002 (TD-46): recalcula el saldo de una cuenta leyendo TODAS sus transacciones
  // locales no borradas. Idempotente: da el mismo resultado sin importar cuántas
  // ediciones offline se hicieron antes del flush. Usado por update() de transacciones.
  async _recalcAccountBalance(accountId) {
    if (!accountId) return;
    const account = await db.get('accounts', accountId);
    if (!account) return;
    const allTx = await db.getAll('transactions');
    let balance = 0;
    for (const tx of allTx) {
      if (tx.isDeleted) continue;
      if (tx.type === 'income' && tx.accountId === accountId) {
        balance += tx.amount || 0;
      } else if (tx.type === 'expense' && tx.accountId === accountId) {
        balance -= tx.amount || 0;
      } else if (tx.type === 'transfer') {
        if (tx.accountId === accountId) balance -= tx.amount || 0;
        if (tx.toAccountId === accountId) balance += tx.amount || 0;
      }
    }
    const updated = { ...account, balance: Math.round(balance), updatedAt: new Date().toISOString() };
    await db.put('accounts', updated);
    await this._refreshStore('accounts');
  },

  // Recalcula todos los saldos desde 0 sumando las transacciones (migración TD-01).
  async recalculateBalances() {
    if (!apiClient.isConfigured()) throw new Error('Sin backend configurado.');
    if (!navigator.onLine) throw new Error('Sin conexión.');
    const result = await apiClient.post('recalculateBalances', {});
    await dataService.refresh(); // sincronizar saldos actualizados desde el backend
    return result;
  },

  // TD-28: purga física de soft-deletes en el backend + refresca caché local.
  async purgeDeleted() {
    if (!apiClient.isConfigured()) throw new Error('Sin backend configurado.');
    if (!navigator.onLine) throw new Error('Sin conexión.');
    const result = await apiClient.post('purgeDeleted', {});
    await dataService.refresh();
    return result;
  },

  // Utilidad de desarrollo: limpia caché local y re-inicializa.
  async reset() {
    if (!db.available()) return;
    for (const c of Object.keys(ENTITIES)) await db.clear(ENTITIES[c].store);
    await syncQueue.clear();
    await db.kvSet(SEED_FLAG, false);
    await this.init();
  },
};
