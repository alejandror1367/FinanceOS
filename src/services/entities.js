// services/entities.js — mapeo entre colecciones de dominio, stores locales
// (IndexedDB) y entidades del backend. Fuente única para dataService y
// syncEngine, de modo que el contrato se mantenga consistente.
// TD-20: las acciones de escritura (create/update/remove) viven aquí junto
// con read, eliminando el mapa WRITE duplicado de dataService.js.

export const ENTITIES = {
  accounts:     { store: 'accounts',     entity: 'Accounts',              read: 'getAccounts',     create: 'createAccount',     update: 'updateAccount',     remove: 'deleteAccount' },
  transactions: { store: 'transactions', entity: 'Transactions',          read: 'getTransactions', create: 'createTransaction', update: 'updateTransaction', remove: 'deleteTransaction' },
  categories:   { store: 'categories',   entity: 'Categories',            read: 'getCategories',   create: 'createCategory',    update: 'updateCategory',    remove: 'deleteCategory' },
  budgets:      { store: 'budgets',      entity: 'Budgets',               read: 'getBudgets',      create: 'createBudget',      update: 'updateBudget',      remove: 'deleteBudget' },
  goals:        { store: 'goals',        entity: 'Goals',                 read: 'getGoals',        create: 'createGoal',        update: 'updateGoal',        remove: 'deleteGoal' },
  investments:  { store: 'investments',  entity: 'Investments',           read: 'getInvestments',  create: 'createInvestment',  update: 'updateInvestment',  remove: 'deleteInvestment' },
  assets:       { store: 'assets',       entity: 'Assets',                read: 'getAssets',       create: 'createAsset',       update: 'updateAsset',       remove: 'deleteAsset' },
  liabilities:  { store: 'liabilities',  entity: 'Liabilities',           read: 'getLiabilities',  create: 'createLiability',   update: 'updateLiability',   remove: 'deleteLiability' },
  recurring:    { store: 'recurring',    entity: 'RecurringTransactions', read: 'getRecurring',    create: 'createRecurring',   update: 'updateRecurring',   remove: 'deleteRecurring' },
  netWorthSnapshots: { store: 'netWorthSnapshots', entity: 'NetWorthSnapshots', read: 'getNetWorthSnapshots' },
  journal:      { store: 'journal',      entity: 'Journal',               read: 'getJournal',      create: 'createJournal',     update: 'updateJournal',     remove: 'deleteJournal' },
  settings:     { store: 'settings',     entity: 'Settings',              read: 'getSettings' },
};

// Entidad del backend -> store local de IndexedDB.
export const ENTITY_TO_STORE = {};
Object.keys(ENTITIES).forEach((k) => {
  ENTITY_TO_STORE[ENTITIES[k].entity] = ENTITIES[k].store;
});
