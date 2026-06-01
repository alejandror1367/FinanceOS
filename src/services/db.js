// services/db.js — capa de persistencia local con IndexedDB.
// IndexedDB es la fuente local principal (docs/Architecture.md §5).
// Wrapper minimalista con promesas, sin dependencias.

import { CONFIG } from '../core/config.js';

const DB_NAME = CONFIG.dbName;
const DB_VERSION = 2;

// Stores locales (espejo de las entidades de dominio).
export const STORES = [
  'accounts', 'transactions', 'categories', 'budgets', 'goals',
  'investments', 'assets', 'liabilities', 'recurring',
  'netWorthSnapshots', 'auditLog', 'settings', 'journal', 'syncQueue', 'kv',
];

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) {
      reject(new Error('IndexedDB no disponible'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) {
          const keyPath = name === 'kv' ? 'k' : 'id';
          const autoInc = name === 'syncQueue';
          db.createObjectStore(name, autoInc ? { keyPath: 'seq', autoIncrement: true } : { keyPath });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(storeName, mode = 'readonly') {
  return openDB().then((db) => {
    const t = db.transaction(storeName, mode);
    return t.objectStore(storeName);
  });
}

function reqToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const db = {
  async getAll(store) {
    const os = await tx(store);
    return reqToPromise(os.getAll());
  },
  async get(store, id) {
    const os = await tx(store);
    return reqToPromise(os.get(id));
  },
  async put(store, value) {
    const os = await tx(store, 'readwrite');
    await reqToPromise(os.put(value));
    return value;
  },
  async bulkPut(store, values = []) {
    const os = await tx(store, 'readwrite');
    await Promise.all(values.map((v) => reqToPromise(os.put(v))));
    return values.length;
  },
  async delete(store, id) {
    const os = await tx(store, 'readwrite');
    return reqToPromise(os.delete(id));
  },
  async clear(store) {
    const os = await tx(store, 'readwrite');
    return reqToPromise(os.clear());
  },
  async count(store) {
    const os = await tx(store);
    return reqToPromise(os.count());
  },
  // kv helpers (banderas locales: seed, etc.)
  async kvGet(k) {
    const os = await tx('kv');
    const row = await reqToPromise(os.get(k));
    return row ? row.v : undefined;
  },
  async kvSet(k, v) {
    const os = await tx('kv', 'readwrite');
    return reqToPromise(os.put({ k, v }));
  },
  available() {
    return 'indexedDB' in globalThis;
  },
};
