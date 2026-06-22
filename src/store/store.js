// store/store.js — estado en memoria reactivo (pub/sub).
// Única fuente de estado de la app. La UI se suscribe; no habla con red ni IDB.
// (docs/Architecture.md §4.1)

const state = {
  ready: false,
  online: navigator.onLine,
  user: 'Alejo',
  baseCurrency: 'COP',

  // Revisión monótona del estado. La bumpean set()/hydrate() en cada mutación.
  // selectors.js la usa como clave de memoización por render: misma revisión →
  // mismos datos → resultado cacheado. Los estados ad-hoc de los tests no la
  // tienen (undefined) → la memoización se desactiva y siempre recalculan.
  __rev: 0,

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
  journal: [],

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
    state.__rev++;
    emit();
  },
  // Reemplaza colecciones de datos de dominio en bloque.
  hydrate(collections) {
    Object.assign(state, collections);
    state.ready = true;
    state.__rev++;
    emit();
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

function emit() {
  // Snapshot de los listeners: re-renderizar puede crear/destruir suscriptores
  // (las vistas se re-montan), y mutar el Set durante la iteración haría que un
  // suscriptor recién añadido se dispare en el mismo emit (doble render).
  for (const fn of [...listeners]) {
    try { fn(state); } catch (e) { console.error('[store] listener error', e); }
  }
}

// Reaccionar a conectividad (relevante para sincronización en fases futuras).
globalThis.addEventListener?.('online', () => store.set({ online: true }));
globalThis.addEventListener?.('offline', () => store.set({ online: false }));
