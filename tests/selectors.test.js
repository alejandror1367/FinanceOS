/**
 * Tests de lógica financiera — src/store/selectors.js
 * Ejecutar: node --test tests/selectors.test.js
 * Requiere Node 18+. Sin dependencias npm (node:test nativo).
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { selectors } from '../src/store/selectors.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function mkState(overrides = {}) {
  return {
    accounts: [],
    transactions: [],
    categories: [],
    budgets: [],
    goals: [],
    investments: [],
    assets: [],
    liabilities: [],
    recurring: [],
    baseCurrency: 'COP',
    ...overrides,
  };
}

function acc(id, balance, type = 'bank', opts = {}) {
  return { id, name: `Cuenta ${id}`, balance, type, currency: 'COP', isArchived: false, ...opts };
}

function tx(id, type, amount, date, opts = {}) {
  return { id, type, amount, date, currency: 'COP', accountId: 'a1', categoryId: '', ...opts };
}

// ── totalAssets ───────────────────────────────────────────────────────────────

describe('totalAssets', () => {
  test('estado vacío devuelve 0', () => {
    assert.equal(selectors.totalAssets(mkState()), 0);
  });

  test('suma cuentas no-inversión', () => {
    const s = mkState({
      accounts: [acc('1', 1_000_000, 'bank'), acc('2', 500_000, 'savings')],
    });
    assert.equal(selectors.totalAssets(s), 1_500_000);
  });

  test('excluye cuentas de inversión (sin doble conteo con posiciones)', () => {
    const s = mkState({
      accounts: [
        acc('1', 1_000_000, 'bank'),
        acc('2', 999_000, 'investment'), // NO debe sumarse
      ],
      investments: [{ id: 'i1', quantity: 10, currentPrice: 100_000 }],
    });
    // banco (1M) + posiciones (1M) = 2M; balance de cuenta investment ignorado
    assert.equal(selectors.totalAssets(s), 2_000_000);
  });

  test('excluye cuentas archivadas', () => {
    const s = mkState({
      accounts: [acc('1', 1_000_000), acc('2', 500_000, 'bank', { isArchived: true })],
    });
    assert.equal(selectors.totalAssets(s), 1_000_000);
  });

  test('incluye otros activos (Assets)', () => {
    const s = mkState({ assets: [{ id: 'a1', value: 50_000_000 }] });
    assert.equal(selectors.totalAssets(s), 50_000_000);
  });

  test('incluye valor de inversiones (quantity × currentPrice)', () => {
    const s = mkState({
      investments: [{ id: 'i1', quantity: 5, currentPrice: 200_000 }],
    });
    assert.equal(selectors.totalAssets(s), 1_000_000);
  });
});

// ── totalLiabilities ──────────────────────────────────────────────────────────

describe('totalLiabilities', () => {
  test('estado vacío devuelve 0', () => {
    assert.equal(selectors.totalLiabilities(mkState()), 0);
  });

  test('suma balances de pasivos', () => {
    const s = mkState({
      liabilities: [{ id: 'l1', balance: 3_000_000 }, { id: 'l2', balance: 1_500_000 }],
    });
    assert.equal(selectors.totalLiabilities(s), 4_500_000);
  });
});

// ── netWorth ──────────────────────────────────────────────────────────────────

describe('netWorth', () => {
  test('estado vacío devuelve 0', () => {
    assert.equal(selectors.netWorth(mkState()), 0);
  });

  test('activos menos pasivos', () => {
    const s = mkState({
      accounts: [acc('1', 10_000_000)],
      liabilities: [{ id: 'l1', balance: 3_000_000 }],
    });
    assert.equal(selectors.netWorth(s), 7_000_000);
  });

  test('puede ser negativo', () => {
    const s = mkState({ liabilities: [{ id: 'l1', balance: 5_000_000 }] });
    assert.equal(selectors.netWorth(s), -5_000_000);
  });

  test('cuentas de inversión no se cuentan dos veces', () => {
    const s = mkState({
      accounts: [acc('1', 500_000, 'investment')],
      investments: [{ id: 'i1', quantity: 1, currentPrice: 500_000 }],
    });
    // Solo posiciones (500k), no el balance de la cuenta investment
    assert.equal(selectors.netWorth(s), 500_000);
  });
});

// ── totalLiquidity ────────────────────────────────────────────────────────────

describe('totalLiquidity', () => {
  test('excluye cuentas de inversión', () => {
    const s = mkState({
      accounts: [acc('1', 1_000_000, 'bank'), acc('2', 500_000, 'investment')],
    });
    assert.equal(selectors.totalLiquidity(s), 1_000_000);
  });

  test('excluye cuentas archivadas', () => {
    const s = mkState({
      accounts: [acc('1', 1_000_000), acc('2', 500_000, 'bank', { isArchived: true })],
    });
    assert.equal(selectors.totalLiquidity(s), 1_000_000);
  });
});

// ── investmentsValue / investmentsCost / investmentsReturnPct ─────────────────

describe('inversiones', () => {
  test('investmentsValue: vacío devuelve 0', () => {
    assert.equal(selectors.investmentsValue(mkState()), 0);
  });

  test('investmentsValue: quantity × currentPrice', () => {
    const s = mkState({
      investments: [
        { id: 'i1', quantity: 5, currentPrice: 200_000 },
        { id: 'i2', quantity: 2, currentPrice: 100_000 },
      ],
    });
    assert.equal(selectors.investmentsValue(s), 1_200_000);
  });

  test('investmentsReturnPct: sin costo devuelve 0', () => {
    const s = mkState({
      investments: [{ id: 'i1', quantity: 0, currentPrice: 100_000, avgCost: 0 }],
    });
    assert.equal(selectors.investmentsReturnPct(s), 0);
  });

  test('investmentsReturnPct: rentabilidad positiva', () => {
    const s = mkState({
      investments: [{ id: 'i1', quantity: 10, currentPrice: 110_000, avgCost: 100_000 }],
    });
    assert.equal(selectors.investmentsReturnPct(s), 10);
  });

  test('investmentsReturnPct: rentabilidad negativa', () => {
    const s = mkState({
      investments: [{ id: 'i1', quantity: 10, currentPrice: 80_000, avgCost: 100_000 }],
    });
    assert.equal(selectors.investmentsReturnPct(s), -20);
  });
});

// ── monthlyIncome / monthlyExpense / monthlySavings / savingsRate ─────────────

describe('flujo mensual', () => {
  // Usamos ref en medio de mayo para evitar edge cases de timezone en día 1
  const REF = new Date('2026-05-15T12:00:00');

  test('monthlyIncome: suma ingresos del mes', () => {
    const s = mkState({
      transactions: [
        tx('1', 'income', 5_000_000, '2026-05-10'),
        tx('2', 'income', 1_000_000, '2026-05-20'),
        tx('3', 'income', 3_000_000, '2026-04-15'), // mes anterior
      ],
    });
    assert.equal(selectors.monthlyIncome(s, REF), 6_000_000);
  });

  test('monthlyExpense: suma gastos del mes', () => {
    const s = mkState({
      transactions: [
        tx('1', 'expense', 500_000, '2026-05-10'),
        tx('2', 'expense', 200_000, '2026-05-25'),
        tx('3', 'expense', 100_000, '2026-04-01'), // mes anterior
      ],
    });
    assert.equal(selectors.monthlyExpense(s, REF), 700_000);
  });

  test('las transferencias no cuentan como ingreso ni gasto', () => {
    const s = mkState({
      transactions: [tx('1', 'transfer', 1_000_000, '2026-05-15')],
    });
    assert.equal(selectors.monthlyIncome(s, REF), 0);
    assert.equal(selectors.monthlyExpense(s, REF), 0);
  });

  test('monthlySavings = ingreso - gasto', () => {
    const s = mkState({
      transactions: [
        tx('1', 'income', 5_000_000, '2026-05-10'),
        tx('2', 'expense', 2_000_000, '2026-05-10'),
      ],
    });
    assert.equal(selectors.monthlySavings(s, REF), 3_000_000);
  });

  test('savingsRate = (ahorro / ingreso) × 100', () => {
    const s = mkState({
      transactions: [
        tx('1', 'income', 4_000_000, '2026-05-10'),
        tx('2', 'expense', 1_000_000, '2026-05-10'),
      ],
    });
    assert.equal(selectors.savingsRate(s, REF), 75);
  });

  test('savingsRate es 0 sin ingresos (sin división por cero)', () => {
    assert.equal(selectors.savingsRate(mkState(), REF), 0);
  });
});

// ── budgetConsumed / budgetStats ──────────────────────────────────────────────

describe('presupuestos', () => {
  test('budgetConsumed: suma gastos de la categoría y periodo', () => {
    const s = mkState({
      transactions: [
        tx('1', 'expense', 200_000, '2026-05-10', { categoryId: 'cat1' }),
        tx('2', 'expense', 150_000, '2026-05-20', { categoryId: 'cat1' }),
        tx('3', 'expense', 100_000, '2026-04-10', { categoryId: 'cat1' }), // mes distinto
        tx('4', 'expense', 300_000, '2026-05-10', { categoryId: 'cat2' }), // categoría distinta
      ],
    });
    const budget = { categoryId: 'cat1', period: 'monthly', periodKey: '2026-05', amount: 500_000 };
    assert.equal(selectors.budgetConsumed(s, budget), 350_000);
  });

  test('budgetStats: consumido, disponible y porcentaje', () => {
    const s = mkState({
      transactions: [tx('1', 'expense', 300_000, '2026-05-10', { categoryId: 'cat1' })],
    });
    const budget = { categoryId: 'cat1', period: 'monthly', periodKey: '2026-05', amount: 500_000 };
    const st = selectors.budgetStats(s, budget);
    assert.equal(st.consumed, 300_000);
    assert.equal(st.available, 200_000);
    assert.equal(st.pct, 60);
  });

  test('budgetStats: excedido — available negativo', () => {
    const s = mkState({
      transactions: [tx('1', 'expense', 700_000, '2026-05-10', { categoryId: 'cat1' })],
    });
    const budget = { categoryId: 'cat1', period: 'monthly', periodKey: '2026-05', amount: 500_000 };
    const st = selectors.budgetStats(s, budget);
    assert.equal(st.available, -200_000);
    assert.ok(st.pct >= 100);
  });

  test('budgetStats: amount 0 no divide por cero', () => {
    const s = mkState();
    const budget = { categoryId: 'cat1', period: 'monthly', periodKey: '2026-05', amount: 0 };
    const st = selectors.budgetStats(s, budget);
    assert.equal(st.pct, 0);
  });
});

// ── hasMixedCurrencies (TD-02) ────────────────────────────────────────────────

describe('hasMixedCurrencies', () => {
  test('false cuando todo está en la divisa base', () => {
    const s = mkState({ accounts: [acc('1', 1_000_000)] });
    assert.equal(selectors.hasMixedCurrencies(s), false);
  });

  test('true cuando hay una cuenta en divisa extranjera', () => {
    const s = mkState({
      accounts: [acc('1', 1_000_000), acc('2', 500, 'bank', { currency: 'USD' })],
    });
    assert.equal(selectors.hasMixedCurrencies(s), true);
  });

  test('true cuando hay una inversión en divisa extranjera', () => {
    const s = mkState({
      investments: [{ id: 'i1', quantity: 1, currentPrice: 100, currency: 'USD' }],
    });
    assert.equal(selectors.hasMixedCurrencies(s), true);
  });

  test('false con estado vacío', () => {
    assert.equal(selectors.hasMixedCurrencies(mkState()), false);
  });
});
