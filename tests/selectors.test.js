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

  test('excluye tarjetas de crédito (deuda no es liquidez)', () => {
    const s = mkState({
      accounts: [
        acc('1', 4_250_000, 'bank'),
        acc('2', 200_000, 'cash'),
        acc('3', 3_409_196, 'credit_card'),
      ],
    });
    assert.equal(selectors.totalLiquidity(s), 4_450_000);
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

  // Regresión BUG-A1/TD-12: Google Sheets auto-convierte 'YYYY-MM' en un objeto Date.
  // normPeriodKey debe normalizarlo a 'YYYY-MM' para que el consumido NO sea $0.
  test('budgetConsumed: periodKey como Date (auto-conversión de Sheets) → consumido > 0', () => {
    const s = mkState({
      transactions: [
        tx('1', 'expense', 200_000, '2026-05-10', { categoryId: 'cat1' }),
        tx('2', 'expense', 150_000, '2026-05-20', { categoryId: 'cat1' }),
        tx('3', 'expense', 100_000, '2026-04-10', { categoryId: 'cat1' }), // mes distinto
      ],
    });
    // Lo que llega del backend cuando Sheets coaccionó '2026-05' a fecha:
    const budget = { categoryId: 'cat1', period: 'monthly', periodKey: new Date(Date.UTC(2026, 4, 1)), amount: 500_000 };
    assert.equal(selectors.budgetConsumed(s, budget), 350_000);
    assert.equal(selectors.budgetStats(s, budget).consumed, 350_000);
  });

  // Anual con periodKey como Date → debe bucketizar por año ('YYYY').
  test('budgetConsumed: anual con periodKey Date agrupa por año', () => {
    const s = mkState({
      transactions: [
        tx('1', 'expense', 200_000, '2026-03-10', { categoryId: 'cat1' }),
        tx('2', 'expense', 150_000, '2026-09-20', { categoryId: 'cat1' }),
        tx('3', 'expense', 100_000, '2025-12-10', { categoryId: 'cat1' }), // año distinto
      ],
    });
    const budget = { categoryId: 'cat1', period: 'annual', periodKey: new Date(Date.UTC(2026, 0, 1)), amount: 1_000_000 };
    assert.equal(selectors.budgetConsumed(s, budget), 350_000);
  });
});

// ── Deudas (debtList / debtStats / creditCardDebt) ─────────────────────────────

describe('deudas', () => {
  test('debtList unifica liabilities (saldo>0) y tarjetas de crédito (cuentas)', () => {
    const s = mkState({
      liabilities: [
        { id: 'l1', name: 'Hipoteca', type: 'mortgage', balance: 100_000_000, interestRate: 12, minimumPayment: 1_200_000 },
        { id: 'l2', name: 'Saldada', type: 'loan', balance: 0, interestRate: 20, minimumPayment: 0 }, // saldo 0 → excluida
      ],
      accounts: [
        acc('c1', -3_000_000, 'credit_card', { interestRate: 30, minPayment: 300_000 }),
        acc('c2', 0, 'credit_card', { interestRate: 28, minPayment: 0 }), // sin deuda → excluida
        acc('b1', 5_000_000, 'bank'),
      ],
    });
    const list = selectors.debtList(s);
    assert.equal(list.length, 2);
    const card = list.find((d) => d.id === 'c1');
    assert.equal(card.source, 'account');
    assert.equal(card.balance, 3_000_000);      // valor absoluto del saldo negativo
    assert.equal(card.minPayment, 300_000);      // normaliza minPayment ↔ minimumPayment
  });

  test('debtStats: total, cuota mínima y tasa promedio ponderada (tarjetas + créditos)', () => {
    const s = mkState({
      liabilities: [{ id: 'l1', name: 'Crédito', type: 'loan', balance: 7_000_000, interestRate: 10, minimumPayment: 500_000 }],
      accounts: [acc('c1', -3_000_000, 'credit_card', { interestRate: 30, minPayment: 300_000 })],
    });
    const st = selectors.debtStats(s);
    assert.equal(st.total, 10_000_000);          // 7M + 3M (la tarjeta cuenta como deuda)
    assert.equal(st.minPayment, 800_000);        // suma de pagos mínimos manuales
    // promedio ponderado por saldo: (10*7M + 30*3M) / 10M = (70M+90M)/10M = 16
    assert.equal(st.avgRate, 16);
    assert.equal(st.count, 2);
  });

  test('debtStats: estado sin deudas → 0 sin dividir por cero', () => {
    const st = selectors.debtStats(mkState());
    assert.equal(st.total, 0);
    assert.equal(st.avgRate, 0);
    assert.equal(st.count, 0);
  });

  test('creditCardDebt: consolida cuentas credit_card + liabilities credit_card', () => {
    const s = mkState({
      accounts: [acc('c1', -2_500_000, 'credit_card'), acc('b1', 1_000_000, 'bank')],
      liabilities: [{ id: 'l1', name: 'Tarjeta vieja', type: 'credit_card', balance: 1_330_000 }],
    });
    assert.equal(selectors.creditCardDebt(s), 3_830_000);
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
