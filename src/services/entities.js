// services/entities.js — mapeo entre colecciones de dominio, stores locales
// (IndexedDB) y entidades del backend. Fuente única para dataService y
// syncEngine, de modo que el contrato se mantenga consistente.

export const ENTITIES = {
  accounts:     { store: 'accounts',     entity: 'Accounts',              read: 'getAccounts' },
  transactions: { store: 'transactions', entity: 'Transactions',          read: 'getTransactions' },
  categories:   { store: 'categories',   entity: 'Categories',            read: 'getCategories' },
  budgets:      { store: 'budgets',      entity: 'Budgets',               read: 'getBudgets' },
  goals:        { store: 'goals',        entity: 'Goals',                 read: 'getGoals' },
  investments:  { store: 'investments',  entity: 'Investments',           read: 'getInvestments' },
  assets:       { store: 'assets',       entity: 'Assets',                read: 'getAssets' },
  liabilities:  { store: 'liabilities',  entity: 'Liabilities',           read: 'getLiabilities' },
  recurring:    { store: 'recurring',    entity: 'RecurringTransactions', read: 'getRecurring' },
  netWorthSnapshots: { store: 'netWorthSnapshots', entity: 'NetWorthSnapshots', read: 'getNetWorthSnapshots' },
  settings:     { store: 'settings',     entity: 'Settings',              read: 'getSettings' },
};

// Entidad del backend -> store local de IndexedDB.
export const ENTITY_TO_STORE = {};
Object.keys(ENTITIES).forEach((k) => {
  ENTITY_TO_STORE[ENTITIES[k].entity] = ENTITIES[k].store;
});
