// store/store.js — estado en memoria reactivo (pub/sub).
// Única fuente de estado de la app. La UI se suscribe; no habla con red ni IDB.
// (docs/Architecture.md §4.1)

const state = {
  ready: false,
  online: navigator.onLine,
  user: 'Alejo',
  baseCurrency: 'COP',

  accounts: [],
  transactions: [],
  categories: [],
  budgets: [],
  goals: [],
  investments: [],
  assets: [],
  liabilities: [],
  recurring: [],
  netWorthSnapshots: [],
  netWorthSeries: [],
  auditLog: [],
  settings: [],

  // Estado del motor de sincronización (Fase 3).
  sync: {
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    pending: 0,
    state: 'idle',      // idle | syncing | error
    lastSync: null,
  },

  ui: {
    navOpen: false,
    route: 'dashboard',
  },
};

const listeners = new Set();

export const store = {
  get() {
    return state;
  },
  // Devuelve un slice puntual.
  select(selectorFn) {
    return selectorFn(state);
  },
  // Mezcla parcial superficial (o profunda en ui) y notifica.
  set(patch) {
    if (patch.ui) {
      Object.assign(state.ui, patch.ui);
      delete patch.ui;
    }
    Object.assign(state, patch);
    emit();
  },
  // Reemplaza colecciones de datos de dominio en bloque.
  hydrate(collections) {
    Object.assign(state, collections);
    state.ready = true;
    emit();
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

function emit() {
  for (const fn of listeners) {
    try { fn(state); } catch (e) { console.error('[store] listener error', e); }
  }
}

// Reaccionar a conectividad (relevante para sincronización en fases futuras).
globalThis.addEventListener?.('online', () => store.set({ online: true }));
globalThis.addEventListener?.('offline', () => store.set({ online: false }));
