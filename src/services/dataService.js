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

const SEED_FLAG = 'seed:v1';

// Acciones de escritura del backend por colección.
const WRITE = {
  accounts:     { create: 'createAccount',     update: 'updateAccount',     remove: 'deleteAccount' },
  transactions: { create: 'createTransaction', update: 'updateTransaction', remove: 'deleteTransaction' },
  categories:   { create: 'createCategory',    update: 'updateCategory',    remove: 'deleteCategory' },
  budgets:      { create: 'createBudget',      update: 'updateBudget',      remove: 'deleteBudget' },
  goals:        { create: 'createGoal',        update: 'updateGoal',        remove: 'deleteGoal' },
  investments:  { create: 'createInvestment',  update: 'updateInvestment',  remove: 'deleteInvestment' },
  assets:       { create: 'createAsset',       update: 'updateAsset',       remove: 'deleteAsset' },
  liabilities:  { create: 'createLiability',   update: 'updateLiability',   remove: 'deleteLiability' },
  recurring:    { create: 'createRecurring',   update: 'updateRecurring',   remove: 'deleteRecurring' },
};

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

// Descarga todas las colecciones del backend y refresca caché + store.
// Resiliente: si una acción falla (p. ej. backend sin actualizar), esa
// colección conserva su caché local y las demás sí se refrescan.
async function pullAll() {
  const colls = Object.keys(ENTITIES);
  const results = await Promise.allSettled(colls.map((c) => apiClient.get(ENTITIES[c].read)));
  const patch = {};
  let ok = 0;
  for (let i = 0; i < colls.length; i++) {
    const c = colls[i];
    const res = results[i];
    if (res.status === 'fulfilled' && Array.isArray(res.value)) {
      const rows = res.value;
      await db.clear(ENTITIES[c].store);
      if (rows.length) await db.bulkPut(ENTITIES[c].store, rows);
      patch[c] = rows;
      ok++;
    } else {
      patch[c] = await db.getAll(ENTITIES[c].store); // conserva caché
      console.warn(`[dataService] pull "${c}" falló:`, res.reason && res.reason.message);
    }
  }
  patch.netWorthSeries = mockData.netWorthSeries;
  patch.baseCurrency = baseCurrencyFrom(patch.settings);
  store.hydrate(patch);
  return { pulled: ok, total: colls.length };
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

    syncEngine.start();
    try { await syncEngine.flush(); } catch (e) { /* offline: se reintenta */ }

    if (navigator.onLine) {
      try { await pullAll(); }
      catch (e) { console.warn('[dataService] pull falló (se usa caché):', e); }
    }
    return { source: 'backend', connected: true };
  },

  // -------- API de mutaciones (Optimistic UI) --------
  // coll: clave de ENTITIES. Devuelve el registro optimista.
  async create(coll, data) {
    const cfg = ENTITIES[coll];
    const record = stamp({ id: data.id || newId(), ...data });
    await db.put(cfg.store, record);
    await this._refreshStore(coll);
    await syncQueue.enqueue({ action: WRITE[coll].create, entity: cfg.entity, entityId: record.id, data: record });
    await syncEngine.refreshPending();
    syncEngine.flush();
    return record;
  },

  async update(coll, id, patch) {
    const cfg = ENTITIES[coll];
    const current = await db.get(cfg.store, id);
    const record = { ...(current || { id }), ...patch, id, updatedAt: new Date().toISOString() };
    await db.put(cfg.store, record);
    await this._refreshStore(coll);
    await syncQueue.enqueue({ action: WRITE[coll].update, entity: cfg.entity, entityId: id, data: { id, ...patch } });
    await syncEngine.refreshPending();
    syncEngine.flush();
    return record;
  },

  async remove(coll, id) {
    const cfg = ENTITIES[coll];
    await db.delete(cfg.store, id); // optimista: fuera de la caché local
    await this._refreshStore(coll);
    await syncQueue.enqueue({ action: WRITE[coll].remove, entity: cfg.entity, entityId: id, data: { id } });
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
    await pullAll();
    return { refreshed: true };
  },

  // Guarda un snapshot de patrimonio (calculado en el backend). Requiere conexión.
  async saveSnapshot() {
    if (!apiClient.isConfigured()) throw new Error('Sin backend configurado.');
    if (!navigator.onLine) throw new Error('Sin conexión.');
    const rec = await apiClient.post('saveNetWorthSnapshot', {});
    await db.put('netWorthSnapshots', rec);
    const items = await db.getAll('netWorthSnapshots');
    store.set({ netWorthSnapshots: items });
    return rec;
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
