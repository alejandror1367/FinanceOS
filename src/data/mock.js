// data/mock.js — datos de ejemplo para la Fase 1 (sin backend).
// Estructura alineada con docs/Database.md. Fechas ISO 8601.
// NOTA: estos datos son locales y se cargan en IndexedDB/Store. El frontend
// NO conoce Google Sheets; en fases posteriores el dataService los reemplaza
// por respuestas de Apps Script con el mismo shape de entidades.

const now = new Date();
const iso = (d) => new Date(d).toISOString();
const daysAgo = (n) => iso(new Date(now.getTime() - n * 86400000));
const daysAhead = (n) => iso(new Date(now.getTime() + n * 86400000));
const ymd = (d) => new Date(d).toISOString().slice(0, 10);

export const mockData = {
  meta: {
    user: 'Alejo',
    baseCurrency: 'COP',
    generatedAt: iso(now),
    isMock: true,
  },

  accounts: [
    { id: 'acc_bancol', name: 'Bancolombia', type: 'bank', currency: 'COP', balance: 12450000, institution: 'Bancolombia', isArchived: false },
    { id: 'acc_nu', name: 'Nu', type: 'digital_wallet', currency: 'COP', balance: 3820000, institution: 'Nu', isArchived: false },
    { id: 'acc_cash', name: 'Efectivo', type: 'cash', currency: 'COP', balance: 640000, institution: '', isArchived: false },
    { id: 'acc_ahorro', name: 'Ahorro Meta', type: 'savings', currency: 'COP', balance: 8900000, institution: 'Bancolombia', isArchived: false },
    { id: 'acc_invest', name: 'Trii Inversiones', type: 'investment', currency: 'COP', balance: 15600000, institution: 'Trii', isArchived: false },
  ],

  categories: [
    { id: 'cat_salary', name: 'Salario', kind: 'income', color: 'emerald', icon: 'briefcase' },
    { id: 'cat_freelance', name: 'Freelance', kind: 'income', color: 'emerald', icon: 'bolt' },
    { id: 'cat_food', name: 'Restaurantes', kind: 'expense', color: 'amber', icon: 'food' },
    { id: 'cat_grocery', name: 'Mercado', kind: 'expense', color: 'blue', icon: 'shopping' },
    { id: 'cat_rent', name: 'Arriendo', kind: 'expense', color: 'slate', icon: 'home' },
    { id: 'cat_transport', name: 'Transporte', kind: 'expense', color: 'blue', icon: 'car' },
    { id: 'cat_subs', name: 'Suscripciones', kind: 'expense', color: 'red', icon: 'cloud' },
    { id: 'cat_otros', name: 'Otros', kind: 'expense', color: 'slate', icon: 'wallet' },
  ],

  transactions: [
    { id: 't1', type: 'income', date: daysAgo(1), amount: 6200000, currency: 'COP', accountId: 'acc_bancol', categoryId: 'cat_salary', description: 'Salario mayo' },
    { id: 't2', type: 'expense', date: daysAgo(1), amount: 2100000, currency: 'COP', accountId: 'acc_bancol', categoryId: 'cat_rent', description: 'Arriendo' },
    { id: 't3', type: 'expense', date: daysAgo(2), amount: 86000, currency: 'COP', accountId: 'acc_nu', categoryId: 'cat_food', description: 'Almuerzo con equipo' },
    { id: 't4', type: 'expense', date: daysAgo(2), amount: 240000, currency: 'COP', accountId: 'acc_nu', categoryId: 'cat_grocery', description: 'Mercado quincenal' },
    { id: 't5', type: 'income', date: daysAgo(4), amount: 1800000, currency: 'COP', accountId: 'acc_nu', categoryId: 'cat_freelance', description: 'Proyecto landing' },
    { id: 't6', type: 'expense', date: daysAgo(5), amount: 52000, currency: 'COP', accountId: 'acc_cash', categoryId: 'cat_transport', description: 'Taxis' },
    { id: 't7', type: 'expense', date: daysAgo(6), amount: 44900, currency: 'COP', accountId: 'acc_bancol', categoryId: 'cat_subs', description: 'Spotify + iCloud' },
    { id: 't8', type: 'expense', date: daysAgo(8), amount: 132000, currency: 'COP', accountId: 'acc_nu', categoryId: 'cat_food', description: 'Cena aniversario' },
    { id: 't9', type: 'transfer', date: daysAgo(9), amount: 1500000, currency: 'COP', accountId: 'acc_bancol', toAccountId: 'acc_ahorro', description: 'Aporte ahorro' },
    { id: 't10', type: 'expense', date: daysAgo(12), amount: 98000, currency: 'COP', accountId: 'acc_nu', categoryId: 'cat_grocery', description: 'Fruver' },
  ],

  goals: [
    { id: 'g1', name: 'Fondo de emergencia', type: 'emergency_fund', targetAmount: 18000000, currentAmount: 8900000, currency: 'COP', targetDate: daysAhead(210), status: 'active' },
    { id: 'g2', name: 'Viaje Japón', type: 'travel', targetAmount: 12000000, currentAmount: 4200000, currency: 'COP', targetDate: daysAhead(320), status: 'active' },
    { id: 'g3', name: 'Cuota inicial vivienda', type: 'housing', targetAmount: 60000000, currentAmount: 15600000, currency: 'COP', targetDate: daysAhead(720), status: 'active' },
  ],

  investments: [
    { id: 'inv1', name: 'S&P 500 ETF', assetType: 'etf', symbol: 'VOO', accountId: 'acc_invest', quantity: 12, avgCost: 1650000, currentPrice: 1820000, currency: 'COP' },
    { id: 'inv2', name: 'Ecopetrol', assetType: 'stock', symbol: 'ECO', accountId: 'acc_invest', quantity: 200, avgCost: 2100, currentPrice: 1950, currency: 'COP' },
    { id: 'inv3', name: 'Bitcoin', assetType: 'crypto', symbol: 'BTC', accountId: 'acc_invest', quantity: 0.05, avgCost: 240000000, currentPrice: 268000000, currency: 'COP' },
  ],

  assets: [
    { id: 'as1', name: 'Vehículo', category: 'vehicle', value: 42000000, currency: 'COP' },
  ],

  liabilities: [
    { id: 'lb1', name: 'Tarjeta de crédito', type: 'credit_card', balance: 3400000, interestRate: 28.5, minimumPayment: 420000, dueDate: daysAhead(9), currency: 'COP' },
    { id: 'lb2', name: 'Crédito vehículo', type: 'loan', balance: 18500000, interestRate: 14.2, minimumPayment: 980000, dueDate: daysAhead(16), currency: 'COP' },
  ],

  recurring: [
    { id: 'r1', type: 'expense', amount: 2100000, currency: 'COP', accountId: 'acc_bancol', categoryId: 'cat_rent', description: 'Arriendo', frequency: 'monthly', nextRunDate: daysAhead(3), isActive: true },
    { id: 'r2', type: 'expense', amount: 420000, currency: 'COP', accountId: 'acc_bancol', categoryId: 'cat_subs', description: 'Pago tarjeta', frequency: 'monthly', nextRunDate: daysAhead(9), isActive: true },
    { id: 'r3', type: 'expense', amount: 44900, currency: 'COP', accountId: 'acc_bancol', categoryId: 'cat_subs', description: 'Spotify + iCloud', frequency: 'monthly', nextRunDate: daysAhead(14), isActive: true },
  ],

  // Serie de patrimonio para mini-gráfico (últimos 6 meses)
  netWorthSeries: [
    { label: 'Dic', value: 58200000 },
    { label: 'Ene', value: 60100000 },
    { label: 'Feb', value: 62800000 },
    { label: 'Mar', value: 61500000 },
    { label: 'Abr', value: 64900000 },
    { label: 'May', value: 67310000 },
  ],

  settings: [
    { id: 's_theme', key: 'theme', value: 'dark' },
    { id: 's_currency', key: 'baseCurrency', value: 'COP' },
  ],

  _helpers: { ymd },
};
