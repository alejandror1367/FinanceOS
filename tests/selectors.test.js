/**
 * Tests de lógica financiera — src/store/selectors.js
 * Ejecutar: node --test tests/selectors.test.js
 * Requiere Node 18+. Sin dependencias npm (node:test nativo).
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { selectors, convertToBase } from '../src/store/selectors.js';
import { priceService } from '../src/services/priceService.js';

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

  test('excluye tarjetas de crédito (son pasivos, no activos)', () => {
    const s = mkState({
      accounts: [
        acc('1', 4_000_000, 'bank'),
        acc('2', 3_000_000, 'credit_card'), // monto de deuda almacenado como positivo
      ],
    });
    assert.equal(selectors.totalAssets(s), 4_000_000);
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

  test('incluye deuda de tarjetas de crédito (cuentas credit_card)', () => {
    const s = mkState({
      accounts: [
        acc('1', 4_000_000, 'bank'),
        acc('2', 3_000_000, 'credit_card'),
      ],
      liabilities: [{ id: 'l1', balance: 1_000_000 }],
    });
    assert.equal(selectors.totalLiabilities(s), 4_000_000); // 3M CC + 1M liability
  });

  test('excluye tarjetas archivadas del total de pasivos', () => {
    const s = mkState({
      accounts: [
        acc('1', 3_000_000, 'credit_card'),
        acc('2', 1_000_000, 'credit_card', { isArchived: true }),
      ],
    });
    assert.equal(selectors.totalLiabilities(s), 3_000_000);
  });

  test('liability de tipo credit_card no se suma (evita doble conteo con cuentas CC)', () => {
    // La misma CC registrada como cuenta Y como liability no debe sumarse dos veces.
    const s = mkState({
      accounts: [acc('cc1', 2_000_000, 'credit_card')],
      liabilities: [{ id: 'l1', balance: 2_000_000, type: 'credit_card' }],
    });
    assert.equal(selectors.totalLiabilities(s), 2_000_000); // solo la cuenta, no 4M
  });

  // FIN-014 (R0-B) — Paridad FE↔BE: totalLiabilities = liabilitiesDebt + ccDebt,
  // donde liabilitiesDebt excluye type='credit_card' y ccDebt viene de cuentas CC.
  // Replica el contrato que computeNetWorth_ en Reports.gs debe respetar.
  test('FIN-014 paridad FE↔BE: mix de liability normal, liability CC y cuenta CC', () => {
    // Hipoteca (normal): 10M → debe sumarse
    // liability type=credit_card: 3M → NO debe sumarse (doble conteo con cuenta CC)
    // cuenta CC: 3M → suma como ccDebt
    // totalLiabilities = 10M (normal) + 3M (CC account) = 13M (no 16M)
    const s = mkState({
      accounts: [acc('cc1', 3_000_000, 'credit_card')],
      liabilities: [
        { id: 'l1', balance: 10_000_000 },                       // hipoteca, sin type
        { id: 'l2', balance: 3_000_000, type: 'credit_card' },   // misma CC como liability
      ],
    });
    assert.equal(selectors.totalLiabilities(s), 13_000_000);
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

  test('tarjeta de crédito cuenta como pasivo, no como activo', () => {
    const s = mkState({
      accounts: [
        acc('1', 5_000_000, 'bank'),
        acc('2', 2_000_000, 'credit_card'),
      ],
    });
    // Activos: 5M (solo banco) − Pasivos: 2M (CC) = 3M
    assert.equal(selectors.netWorth(s), 3_000_000);
  });

  test('patrimonio correcto con banco + CC + liability', () => {
    const s = mkState({
      accounts: [
        acc('1', 10_000_000, 'bank'),
        acc('2', 3_000_000, 'credit_card'),
      ],
      liabilities: [{ id: 'l1', balance: 2_000_000 }],
    });
    // Activos: 10M − Pasivos: 5M (3M CC + 2M liability) = 5M
    assert.equal(selectors.netWorth(s), 5_000_000);
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

  test('investmentsCost: incluye la comisión de compra (Sprint 5)', () => {
    const s = mkState({
      investments: [{ id: 'i1', quantity: 10, avgCost: 100_000, commission: 50_000 }],
    });
    // 10 × 100.000 + 50.000 de comisión
    assert.equal(selectors.investmentsCost(s), 1_050_000);
  });

  test('investmentsCost: sin comisión se comporta como antes', () => {
    const s = mkState({
      investments: [{ id: 'i1', quantity: 10, avgCost: 100_000 }],
    });
    assert.equal(selectors.investmentsCost(s), 1_000_000);
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

  test('creditCardDebt: solo cuentas credit_card (liabilities CC excluidas para evitar doble conteo)', () => {
    const s = mkState({
      accounts: [acc('c1', -2_500_000, 'credit_card'), acc('b1', 1_000_000, 'bank')],
      liabilities: [{ id: 'l1', name: 'Tarjeta vieja', type: 'credit_card', balance: 1_330_000 }],
    });
    assert.equal(selectors.creditCardDebt(s), 2_500_000);
  });
});

// ── monthlySavingsAvg ────────────────────────────────────────────────────────

describe('monthlySavingsAvg', () => {
  function monthAgo(n) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - n);
    return d.toISOString().slice(0, 7) + '-15'; // 15th of that month
  }

  test('devuelve 0 sin transacciones', () => {
    assert.equal(selectors.monthlySavingsAvg(mkState()), 0);
  });

  test('promedio de 3 meses completos — excluye mes actual', () => {
    const s = mkState({
      transactions: [
        // 3 meses atrás: ahorro 300k
        tx('t1', 'income',  500_000, monthAgo(3)),
        tx('t2', 'expense', 200_000, monthAgo(3)),
        // 2 meses atrás: ahorro 200k
        tx('t3', 'income',  400_000, monthAgo(2)),
        tx('t4', 'expense', 200_000, monthAgo(2)),
        // 1 mes atrás: ahorro 100k
        tx('t5', 'income',  300_000, monthAgo(1)),
        tx('t6', 'expense', 200_000, monthAgo(1)),
        // mes actual — NO debe incluirse
        tx('t7', 'income', 1_000_000, monthAgo(0)),
      ],
    });
    // avg(300k, 200k, 100k) = 200k
    assert.equal(selectors.monthlySavingsAvg(s, 3), 200_000);
  });

  test('meses con ahorro negativo bajan el promedio', () => {
    const s = mkState({
      transactions: [
        tx('t1', 'income',  100_000, monthAgo(2)),
        tx('t2', 'expense', 300_000, monthAgo(2)), // -200k
        tx('t3', 'income',  400_000, monthAgo(1)), // +400k
      ],
    });
    // avg(-200k, 400k) con n=2
    assert.equal(selectors.monthlySavingsAvg(s, 2), 100_000);
  });
});

// ── upcomingPayments ─────────────────────────────────────────────────────────

describe('upcomingPayments', () => {
  function recurring(id, nextRunDate, amount = 50_000) {
    return { id, description: `Pago ${id}`, isActive: true, nextRunDate, amount, currency: 'COP', categoryId: '' };
  }

  test('solo recurrentes cuando no hay CC con paymentDay', () => {
    const s = mkState({
      recurring: [
        recurring('r1', '2026-06-10'),
        recurring('r2', '2026-06-05'),
      ],
      accounts: [acc('c1', -1_000_000, 'credit_card')], // sin paymentDay
    });
    const result = selectors.upcomingPayments(s);
    assert.equal(result.length, 2);
    assert.equal(result[0].id, 'r2'); // más próximo primero
  });

  test('incluye CC con paymentDay y balance > 0', () => {
    const s = mkState({
      recurring: [recurring('r1', '2026-06-15', 30_000)],
      accounts: [
        acc('c1', -500_000, 'credit_card', { paymentDay: 3, isArchived: false }),
      ],
    });
    const result = selectors.upcomingPayments(s, 10);
    const cc = result.find((p) => p._source === 'credit_card');
    assert.ok(cc, 'debe incluir el pago de CC');
    assert.equal(cc.amount, 500_000); // Math.abs del balance
  });

  test('excluye CC sin paymentDay o con balance 0', () => {
    const s = mkState({
      accounts: [
        acc('c1', -200_000, 'credit_card'),              // sin paymentDay
        acc('c2', 0, 'credit_card', { paymentDay: 5 }), // saldo 0
      ],
    });
    const result = selectors.upcomingPayments(s, 10);
    assert.equal(result.filter((p) => p._source === 'credit_card').length, 0);
  });

  test('ordena recurrentes y CC por fecha y respeta límite n', () => {
    const s = mkState({
      recurring: [recurring('r1', '2026-06-20', 20_000)],
      accounts: [
        acc('c1', -1_000_000, 'credit_card', { paymentDay: 1 }),
        acc('c2', -2_000_000, 'credit_card', { paymentDay: 2 }),
      ],
    });
    const result = selectors.upcomingPayments(s, 2);
    assert.equal(result.length, 2);
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

// ── FX: investmentsValue con y sin tasas (FIN-005 / TD-02) ────────────────────

describe('inversiones FX (TD-02)', () => {
  // Limpia el estado de priceService antes y después de cada grupo de tests FX
  // para no contaminar otros suites que no inyectan tasas.
  before(() => { priceService.update({}, {}); });
  after(() => { priceService.update({}, {}); });

  function inv(id, qty, price, currency, opts = {}) {
    return { id, quantity: qty, currentPrice: price, currency, avgCost: price, ...opts };
  }

  test('posición USD con fxRates={USD:4000} → contribuye qty×price×4000 COP', () => {
    priceService.update({}, { USD: 4000 });
    const s = mkState({
      investments: [inv('i1', 100, 10, 'USD')], // US$1000 → 4.000.000 COP
      baseCurrency: 'COP',
    });
    assert.equal(selectors.investmentsValue(s), 4_000_000);
  });

  test('posición USD sin fxRates → contribuye 0 COP (no sumar nativo)', () => {
    priceService.update({}, {}); // sin tasas
    const s = mkState({
      investments: [inv('i1', 100, 10, 'USD')],
      baseCurrency: 'COP',
    });
    assert.equal(selectors.investmentsValue(s), 0);
  });

  test('investmentsIncompleteCount > 0 cuando hay posición USD sin tasa', () => {
    priceService.update({}, {}); // sin tasas
    const s = mkState({
      investments: [inv('i1', 100, 10, 'USD')],
      baseCurrency: 'COP',
    });
    assert.ok(selectors.investmentsIncompleteCount(s) > 0, 'debe reportar posiciones incompletas');
  });

  test('investmentsIncompleteCount = 0 cuando todas tienen tasa FX', () => {
    priceService.update({}, { USD: 4000 });
    const s = mkState({
      investments: [inv('i1', 100, 10, 'USD')],
      baseCurrency: 'COP',
    });
    assert.equal(selectors.investmentsIncompleteCount(s), 0);
  });

  test('posición en base (COP) siempre se suma sin importar fxRates', () => {
    priceService.update({}, {}); // sin tasas
    const s = mkState({
      investments: [inv('i1', 100, 10_000, 'COP')],
      baseCurrency: 'COP',
    });
    assert.equal(selectors.investmentsValue(s), 1_000_000);
  });

  test('lote con soldDate excluido de investmentsValue', () => {
    priceService.update({}, { USD: 4000 });
    const s = mkState({
      investments: [
        inv('i1', 10, 100_000, 'COP'),                     // activo → suma
        inv('i2', 10, 100_000, 'COP', { soldDate: '2026-01-01' }), // vendido → excluir
      ],
      baseCurrency: 'COP',
    });
    // Solo el lote activo: 10 × 100.000 = 1.000.000
    assert.equal(selectors.investmentsValue(s), 1_000_000);
  });

  test('investmentsCost excluye lotes con soldDate', () => {
    priceService.update({}, { USD: 4000 });
    const s = mkState({
      investments: [
        inv('i1', 10, 100_000, 'COP'),                     // activo → suma
        inv('i2', 10, 100_000, 'COP', { soldDate: '2026-01-01' }), // vendido → excluir
      ],
      baseCurrency: 'COP',
    });
    assert.equal(selectors.investmentsCost(s), 1_000_000);
  });
});

// ── P&L neto de retención (FIN-002 / TD-42) ───────────────────────────────────

describe('realizedPnLNet (TD-42)', () => {
  test('ganancia bruta $1M con withholdingRate=4% → P&L neto $960.000', () => {
    // La fórmula: pnlNeto = pnlBruto - max(0, pnlBruto) * withholdingRate/100
    // Con pnlBruto=1.000.000 y rate=4% → 1.000.000 - 40.000 = 960.000
    const pnlBruto = 1_000_000;
    const withholdingRate = 4;
    const pnlNeto = selectors.applyWithholding(pnlBruto, withholdingRate);
    assert.equal(pnlNeto, 960_000);
  });

  test('pérdida no descuenta retención (solo aplica sobre ganancia)', () => {
    const pnlBruto = -500_000; // pérdida
    const withholdingRate = 4;
    const pnlNeto = selectors.applyWithholding(pnlBruto, withholdingRate);
    assert.equal(pnlNeto, -500_000); // sin cambio
  });

  test('withholdingRate=0 no cambia el P&L', () => {
    const pnlBruto = 1_000_000;
    assert.equal(selectors.applyWithholding(pnlBruto, 0), 1_000_000);
  });

  test('withholdingRate indefinido no cambia el P&L', () => {
    const pnlBruto = 1_000_000;
    assert.equal(selectors.applyWithholding(pnlBruto, undefined), 1_000_000);
  });
});

// ── P&L por lote — ventas totales y parciales (FIN-003/004 / TD-43) ─────────────

describe('lotRealizedPnL (FIN-003/004)', () => {
  // Caso 1: venta total — soldQuantity === quantity → lote cerrado, P&L correcto
  test('venta total: soldQuantity = qty → P&L usa comisión entera', () => {
    // 10 acciones compradas a $100 con comisión $50. Vendidas a $120 con comisión $20.
    // costBasis = 10*100 + 50*(10/10) = 1050. Ventas = 10*120 - 50 - 1050 = 1200 - 50 - 1050 = 100.
    const lote = {
      quantity: 10, soldQuantity: 10,
      purchasePrice: 100, commission: 50,
      soldPrice: 120, soldCommission: 20,
      withholdingRate: 0,
    };
    // grossPnL = 10*120 - (10*100 + 50) - 20 = 1200 - 1050 - 20 = 130
    assert.equal(selectors.lotRealizedPnL(lote), 130);
  });

  // Caso 2: venta parcial — soldQuantity < qty → comisión de compra prorateada
  test('venta parcial: soldQuantity < qty → comisión de compra prorateada', () => {
    // 10 acciones compradas a $100 con comisión $100 (= $10 por acción).
    // Se venden 4. costBasis = 4*100 + 100*(4/10) = 400 + 40 = 440.
    // Ventas: 4 * $130 - $10 soldComm = 520 - 10 = 510. P&L = 510 - 440 = 70.
    const lote = {
      quantity: 10, soldQuantity: 4,
      purchasePrice: 100, commission: 100,
      soldPrice: 130, soldCommission: 10,
      withholdingRate: 0,
    };
    assert.equal(selectors.lotRealizedPnL(lote), 70);
  });

  // Caso 2b: venta total de ese mismo lote → comisión íntegra
  test('venta total (mismos datos): comisión de compra entera', () => {
    // 10 acciones, todas vendidas: comisión de compra sin prorratear.
    // costBasis = 10*100 + 100*(10/10) = 1100. Ventas: 10*130 - 10 = 1290. P&L = 190.
    const lote = {
      quantity: 10, soldQuantity: 10,
      purchasePrice: 100, commission: 100,
      soldPrice: 130, soldCommission: 10,
      withholdingRate: 0,
    };
    assert.equal(selectors.lotRealizedPnL(lote), 190);
  });

  // Caso con retención aplicada sobre ganancia
  test('venta total con retención 4% sobre la ganancia', () => {
    // grossPnL = 10*120 - (10*100 + 50) - 20 = 130. Retención: 130 * 0.96 = 124.8
    const lote = {
      quantity: 10, soldQuantity: 10,
      purchasePrice: 100, commission: 50,
      soldPrice: 120, soldCommission: 20,
      withholdingRate: 4,
    };
    assert.equal(selectors.lotRealizedPnL(lote), 130 * 0.96);
  });

  // Pérdida: no aplica retención
  test('venta con pérdida: retención no se descuenta', () => {
    const lote = {
      quantity: 10, soldQuantity: 10,
      purchasePrice: 100, commission: 0,
      soldPrice: 80, soldCommission: 0,
      withholdingRate: 4,
    };
    // grossPnL = 10*80 - 10*100 = -200. Sin retención (pérdida).
    assert.equal(selectors.lotRealizedPnL(lote), -200);
  });
});

// ── Valoración CDT con tope de vencimiento (FIN-008 / TD-44) ─────────────────

describe('cdtCurrentValue (FIN-008)', () => {
  // Caso 3: sin maturityDate → capitaliza sin tope
  test('sin maturityDate: capitaliza sin tope de vencimiento', () => {
    // CDT: capital=1.000.000, tasa=10% E.A., comprado hace 365 días exactos.
    const purchaseDate = '2025-01-01';
    const todayMs = new Date('2026-01-01').getTime();
    const inv = { quantity: 1_000_000, interestRate: 10, purchaseDate };
    const value = selectors.cdtCurrentValue(inv, todayMs);
    // 1.000.000 × (1 + 0.10)^(365/365) = 1.100.000
    assert.ok(Math.abs(value - 1_100_000) < 1, `esperaba ~1.100.000, recibí ${value}`);
  });

  // Caso 4: con maturityDate pasada → valor topa en vencimiento
  test('con maturityDate pasada: valor topa en la fecha de vencimiento', () => {
    // CDT: capital=1.000.000, tasa=10%, comprado hace 730 días. Venció hace 365 días.
    // Usamos fechas que no incluyen año bisiesto (2022→2023, 2023→2024 son 365 y 365).
    const purchaseDate = '2022-03-01';
    const maturityDate = '2023-03-01'; // 365 días exactos (fuera de feb bisiesto)
    const todayMs = new Date('2024-03-01').getTime(); // 730 días después de compra
    const inv = { quantity: 1_000_000, interestRate: 10, purchaseDate, maturityDate };
    const value = selectors.cdtCurrentValue(inv, todayMs);
    // El selector topa diasDesdeCompra (730) al diasHastaVencimiento (365).
    // Valor = 1.000.000 × (1.10)^(365/365) = 1.100.000 — no sigue creciendo.
    const diasVencimiento = (new Date(maturityDate).getTime() - new Date(purchaseDate).getTime()) / 86400000;
    const expected = 1_000_000 * Math.pow(1.10, diasVencimiento / 365);
    assert.ok(Math.abs(value - expected) < 1, `esperaba ~${expected.toFixed(0)} (tope), recibí ${value}`);
  });

  // Caso 5: con maturityDate futura → capitaliza solo hasta hoy
  test('con maturityDate futura: capitaliza solo hasta hoy', () => {
    // CDT: capital=1.000.000, tasa=10%, comprado hace 182 días. Vence en 365 días desde compra.
    const purchaseDate = '2025-07-04';
    const maturityDate = '2026-07-04'; // 365 días de plazo
    // "hoy" es 182 días después de la compra
    const todayMs = new Date('2026-01-01').getTime();
    const inv = { quantity: 1_000_000, interestRate: 10, purchaseDate, maturityDate };
    const value = selectors.cdtCurrentValue(inv, todayMs);
    // diasDesdeCompra ≈ 181. diasHastaVencimiento = 365. min(181, 365) = 181.
    const diasDesdeCompra = (todayMs - new Date(purchaseDate).getTime()) / 86400000;
    const expected = 1_000_000 * Math.pow(1.10, diasDesdeCompra / 365);
    assert.ok(Math.abs(value - expected) < 1, `esperaba ~${expected.toFixed(0)}, recibí ${value}`);
  });

  // Caso base: sin tasa o sin fecha → devuelve el capital
  test('sin interestRate: devuelve capital sin capitalizar', () => {
    const inv = { quantity: 500_000, purchaseDate: '2025-01-01' }; // sin interestRate
    assert.equal(selectors.cdtCurrentValue(inv), 500_000);
  });
});

// ── monthlySavingsAvg solo meses con actividad (FIN-012 / TD-53) ──────────────

describe('monthlySavingsAvg (FIN-012)', () => {
  function txMonth(id, type, amount, ym) {
    return tx(id, type, amount, `${ym}-15`);
  }

  test('solo 1 mes activo de 3 → promedia ese mes, no los 3', () => {
    // Ahorro de hace 3 meses: 500k. Hace 2 y 1 meses: nada.
    // monthlySavingsAvg(s, 3) debe devolver 500k (no 500k/3 ≈ 167k).
    const now = new Date();
    const targetMonth = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const ym = `${targetMonth.getFullYear()}-${String(targetMonth.getMonth() + 1).padStart(2, '0')}`;
    const s = mkState({
      transactions: [
        txMonth('i1', 'income',  1_000_000, ym),
        txMonth('e1', 'expense',   500_000, ym),
      ],
    });
    const avg = selectors.monthlySavingsAvg(s, 3);
    assert.equal(avg, 500_000, `esperaba 500000, recibí ${avg}`);
  });

  test('sin transacciones → devuelve 0', () => {
    assert.equal(selectors.monthlySavingsAvg(mkState(), 3), 0);
  });

  test('2 meses activos de 3 → promedia solo esos 2', () => {
    const now = new Date();
    function ym(offset) {
      const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
    // mes-2: ahorro 200k; mes-3: ahorro 400k; mes-1: sin datos
    const s = mkState({
      transactions: [
        txMonth('i2', 'income', 500_000, ym(2)),
        txMonth('e2', 'expense', 300_000, ym(2)), // ahorro 200k
        txMonth('i3', 'income', 600_000, ym(3)),
        txMonth('e3', 'expense', 200_000, ym(3)), // ahorro 400k
      ],
    });
    const avg = selectors.monthlySavingsAvg(s, 3);
    assert.equal(avg, 300_000, `esperaba 300000 ((200k+400k)/2), recibí ${avg}`);
  });
});

// ── amortize cuota fija y cuota % del saldo (FIN-007) ────────────────────────

describe('amortize (FIN-007)', () => {
  test('saldo 0 → 0 meses', () => {
    assert.deepEqual(selectors.amortize(0, 20, 100_000), { months: 0, totalInterest: 0 });
  });

  test('sin cuota → months null', () => {
    assert.deepEqual(selectors.amortize(1_000_000, 20, 0), { months: null, totalInterest: null });
  });

  test('cuota fija: 1M al 0% pagando 100k → 10 meses sin interés', () => {
    const r = selectors.amortize(1_000_000, 0, 100_000);
    assert.equal(r.months, 10);
    assert.equal(r.totalInterest, 0);
  });

  test('cuota insuficiente para cubrir intereses → Infinity', () => {
    // 1M al 24% EA → tasa mensual ≈ 1.81%; interés mes 1 ≈ 18.1k. Pago 10k < interés.
    const r = selectors.amortize(1_000_000, 24, 10_000);
    assert.equal(r.months, Infinity);
  });

  test('cuota % del saldo (paymentPct=20, sin piso): paga en plazo razonable', () => {
    // 20% del saldo residual cada mes al 0% → 1M * 0.8^n < 0.01 → ~83 meses
    const r = selectors.amortize(1_000_000, 0, 0, { paymentPct: 20, paymentFloor: 0 });
    assert.ok(r.months > 0 && r.months < 600, `months=${r.months} debe estar entre 1 y 600`);
    assert.equal(r.totalInterest, 0); // sin tasa no hay interés
  });

  test('cuota % con piso: respeta el piso cuando el saldo es pequeño', () => {
    // Deuda de 50k al 0%, pago 2% saldo o mínimo 10k. Con el piso, se paga más rápido.
    const r = selectors.amortize(50_000, 0, 0, { paymentPct: 2, paymentFloor: 10_000 });
    assert.ok(r.months <= 5, `con piso 10k sobre 50k debería liquidarse en ≤5 meses, got ${r.months}`);
  });
});

// ── chainedPayoff Snowball/Avalanche (FIN-007) ───────────────────────────────

describe('chainedPayoff (FIN-007)', () => {
  test('lista vacía → 0 meses', () => {
    assert.deepEqual(selectors.chainedPayoff([]), { months: 0, totalInterest: 0 });
  });

  test('una sola deuda: idéntico a amortize fija', () => {
    const debt = { balance: 1_200_000, interestRate: 0, minPayment: 100_000 };
    const chained = selectors.chainedPayoff([debt]);
    const direct  = selectors.amortize(debt.balance, debt.interestRate, debt.minPayment);
    assert.equal(chained.months, direct.months);
  });

  test('dos deudas encadenadas: acaba antes que el máximo de las individuales', () => {
    // Deuda A: 500k, 0%, pago 100k → 5 meses
    // Deuda B: 1M,   0%, pago 100k → 10 meses
    // Encadenado: A se paga en 5m, luego B recibe 200k/mes → acaba en 5+5=10m total
    // (igual porque sin interés el encadenado coincide con el independiente en este caso)
    // Caso de interés: con tasas, el encadenado siempre es ≤ max(individuales).
    const debts = [
      { balance: 500_000, interestRate: 0, minPayment: 100_000 },
      { balance: 1_000_000, interestRate: 0, minPayment: 100_000 },
    ];
    const chained = selectors.chainedPayoff(debts);
    const directMax = Math.max(
      selectors.amortize(debts[0].balance, debts[0].interestRate, debts[0].minPayment).months,
      selectors.amortize(debts[1].balance, debts[1].interestRate, debts[1].minPayment).months,
    );
    assert.ok(chained.months <= directMax,
      `chainedPayoff (${chained.months}m) debe ser ≤ max individual (${directMax}m)`);
  });

  test('con tasas: chained paga menos intereses que solo-mínimos', () => {
    // Avalanche: deuda cara primero → menos interés total
    const debts = [
      { balance: 2_000_000, interestRate: 30, minPayment: 150_000 }, // cara → pagar primero
      { balance: 1_000_000, interestRate: 10, minPayment:  80_000 }, // barata
    ];
    const chained   = selectors.chainedPayoff(debts);
    const indivA    = selectors.amortize(debts[0].balance, debts[0].interestRate, debts[0].minPayment);
    const indivB    = selectors.amortize(debts[1].balance, debts[1].interestRate, debts[1].minPayment);
    const indivTotal = indivA.totalInterest + indivB.totalInterest;
    assert.ok(chained.totalInterest <= indivTotal,
      `chainedPayoff (${chained.totalInterest}) debe pagar ≤ interés individual (${indivTotal})`);
    assert.ok(chained.months <= Math.max(indivA.months, indivB.months),
      'chained termina antes o igual que el más largo individual');
  });
});

// ── CAGR y XIRR (FIN-013 / TD-38) ────────────────────────────────────────────

describe('cagr (FIN-013)', () => {
  test('10% de ganancia en exactamente 1 año → CAGR ≈ 10%', () => {
    const purchaseDate = '2025-01-01';
    const todayMs      = new Date('2026-01-01').getTime();
    const r = selectors.cagr(1_000_000, 1_100_000, purchaseDate, todayMs);
    assert.ok(Math.abs(r - 0.1) < 0.001, `esperaba ~0.1, recibí ${r}`);
  });

  test('costBasis 0 → null (evita división por cero)', () => {
    assert.equal(selectors.cagr(0, 1_000_000, '2025-01-01'), null);
  });

  test('sin fecha de compra → null', () => {
    assert.equal(selectors.cagr(1_000_000, 1_100_000, null), null);
  });

  test('pérdida del 50% en 2 años → CAGR negativo', () => {
    const todayMs = new Date('2027-01-01').getTime();
    const r = selectors.cagr(1_000_000, 500_000, '2025-01-01', todayMs);
    // 0.5^(1/2) - 1 ≈ -0.2929
    assert.ok(r < 0, 'CAGR debe ser negativo para pérdida');
    assert.ok(Math.abs(r - (Math.pow(0.5, 0.5) - 1)) < 0.001,
      `esperaba ≈${(Math.pow(0.5, 0.5) - 1).toFixed(4)}, recibí ${r?.toFixed(4)}`);
  });
});

describe('xirr (FIN-013)', () => {
  test('flujo simple 1 año, 10% rentabilidad → XIRR ≈ 10%', () => {
    const flows = [
      { amount: -1_000_000, date: '2025-01-01' },
      { amount:  1_100_000, date: '2026-01-01' },
    ];
    const r = selectors.xirr(flows);
    assert.ok(r !== null, 'debe converger');
    assert.ok(Math.abs(r - 0.1) < 0.001, `esperaba ~0.1, recibí ${r}`);
  });

  test('flujo de 2 años, ganancia 44% total → XIRR ≈ 20% anual', () => {
    // 1.2^2 = 1.44 → 44% en 2 años
    const flows = [
      { amount: -1_000_000, date: '2024-01-01' },
      { amount:  1_440_000, date: '2026-01-01' },
    ];
    const r = selectors.xirr(flows);
    assert.ok(r !== null, 'debe converger');
    assert.ok(Math.abs(r - 0.2) < 0.001, `esperaba ~0.2, recibí ${r}`);
  });

  test('menos de 2 flujos → null', () => {
    assert.equal(selectors.xirr([{ amount: -1_000_000, date: '2025-01-01' }]), null);
  });

  test('lista vacía → null', () => {
    assert.equal(selectors.xirr([]), null);
  });

  test('flujo con pérdida → XIRR negativo', () => {
    const flows = [
      { amount: -1_000_000, date: '2025-01-01' },
      { amount:    800_000, date: '2026-01-01' },
    ];
    const r = selectors.xirr(flows);
    assert.ok(r !== null && r < 0, `XIRR debe ser negativo, recibí ${r}`);
  });
});

// ── liquidityCoverageMonths (R1) ──────────────────────────────────────────────

describe('liquidityCoverageMonths', () => {
  // Genera una fecha ISO en el día 15 de hace `n` meses.
  function monthAgo(n) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - n);
    return d.toISOString().slice(0, 7) + '-15';
  }

  test('liquidez 6M, gastos promedio 2M en 3 meses completos → coverage = 3.0', () => {
    // Los 3 meses completos son hace 1, 2, 3 meses (el mes actual está excluido).
    // cashflow(s,4) → [hace3, hace2, hace1, actual]; slice(0,3) = [hace3, hace2, hace1].
    // Cada mes tiene expense=2M → avgExpense=2M. Liquidez=6M → coverage=3.0.
    const s = mkState({
      accounts: [acc('a1', 6_000_000, 'bank')],
      transactions: [
        tx('t1', 'income',  3_000_000, monthAgo(3)),
        tx('t2', 'expense', 2_000_000, monthAgo(3)),
        tx('t3', 'income',  3_000_000, monthAgo(2)),
        tx('t4', 'expense', 2_000_000, monthAgo(2)),
        tx('t5', 'income',  3_000_000, monthAgo(1)),
        tx('t6', 'expense', 2_000_000, monthAgo(1)),
      ],
    });
    const cov = selectors.liquidityCoverageMonths(s);
    assert.ok(cov !== null, 'debe retornar un valor');
    assert.ok(Math.abs(cov - 3.0) < 0.01, `esperaba 3.0, recibí ${cov}`);
  });

  test('gastos todos 0 en los 3 meses completos → null', () => {
    // Meses sin ingreso ni gasto → activos.length=0 → null.
    const s = mkState({
      accounts: [acc('a1', 6_000_000, 'bank')],
      transactions: [],
    });
    assert.equal(selectors.liquidityCoverageMonths(s), null);
  });

  test('solo 1 mes activo con expense=3M, liquidez=6M → coverage ≈ 2.0', () => {
    // Solo hace 1 mes tiene actividad: expense=3M. Los otros 2 meses no tienen transacciones.
    // activos=[{expense:3M}] → avgExpense=3M. Liquidez=6M → coverage=2.0.
    const s = mkState({
      accounts: [acc('a1', 6_000_000, 'bank')],
      transactions: [
        tx('t1', 'income',  5_000_000, monthAgo(1)),
        tx('t2', 'expense', 3_000_000, monthAgo(1)),
      ],
    });
    const cov = selectors.liquidityCoverageMonths(s);
    assert.ok(cov !== null, 'debe retornar un valor');
    assert.ok(Math.abs(cov - 2.0) < 0.01, `esperaba 2.0, recibí ${cov}`);
  });
});

// ── savingsStreak (R1) ────────────────────────────────────────────────────────

describe('savingsStreak', () => {
  function monthAgo(n) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - n);
    return d.toISOString().slice(0, 7) + '-15';
  }

  test('3 meses completos con savings > 0, mes actual ignorado → streak = 3', () => {
    // cashflow(s,13) → [hace12...hace1, actual]; slice(0,-1) = completos.
    // Los últimos 3 (hace3, hace2, hace1) tienen savings>0 → streak=3.
    const s = mkState({
      transactions: [
        tx('t1', 'income',  500_000, monthAgo(3)),
        tx('t2', 'expense', 200_000, monthAgo(3)), // savings=300k
        tx('t3', 'income',  500_000, monthAgo(2)),
        tx('t4', 'expense', 200_000, monthAgo(2)), // savings=300k
        tx('t5', 'income',  500_000, monthAgo(1)),
        tx('t6', 'expense', 200_000, monthAgo(1)), // savings=300k
        // Mes actual — debe ignorarse
        tx('t7', 'income', 1_000_000, monthAgo(0)),
      ],
    });
    assert.equal(selectors.savingsStreak(s), 3);
  });

  test('2 meses con savings > 0, luego 1 mes negativo más antiguo → streak = 2', () => {
    // hace3: expense>income → savings<0 → rompe la racha.
    // hace2 y hace1: savings>0 → streak=2 (contando desde más reciente).
    const s = mkState({
      transactions: [
        tx('t1', 'income',  100_000, monthAgo(3)),
        tx('t2', 'expense', 400_000, monthAgo(3)), // savings=-300k (rompe)
        tx('t3', 'income',  500_000, monthAgo(2)),
        tx('t4', 'expense', 200_000, monthAgo(2)), // savings=300k
        tx('t5', 'income',  500_000, monthAgo(1)),
        tx('t6', 'expense', 200_000, monthAgo(1)), // savings=300k
      ],
    });
    assert.equal(selectors.savingsStreak(s), 2);
  });

  test('ningún mes con savings > 0 → 0', () => {
    const s = mkState({ transactions: [] });
    assert.equal(selectors.savingsStreak(s), 0);
  });
});

// ── investmentsValue: CDT usa valor accrued (no face value) ──────────────────

describe('investmentsValue CDT accrued', () => {
  before(() => { priceService.update({}, {}); });
  after(() => { priceService.update({}, {}); });

  test('CDT con tasa EA > 0: investmentsValue > capital invertido', () => {
    const purchaseDate = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10); // hace 1 año
    const s = mkState({
      investments: [{
        id: 'c1', assetType: 'cdt', quantity: 1_000_000, interestRate: 10,
        purchaseDate, currentPrice: 1, currency: 'COP',
      }],
      baseCurrency: 'COP',
    });
    const val = selectors.investmentsValue(s);
    // Después de 1 año al 10% EA: valor ≈ 1.100.000
    assert.ok(val > 1_000_000, `CDT capitalizado debe superar capital: ${val}`);
    assert.ok(Math.abs(val - 1_100_000) < 5_000, `esperaba ~1.100.000, recibí ${val}`);
  });

  test('CDT sin interestRate: investmentsValue = capital (face value)', () => {
    const s = mkState({
      investments: [{ id: 'c2', assetType: 'cdt', quantity: 500_000, currency: 'COP', currentPrice: 1 }],
    });
    assert.equal(selectors.investmentsValue(s), 500_000);
  });
});

// ── portfolioAlerts (R4 — I7a) ────────────────────────────────────────────────

describe('portfolioAlerts', () => {
  before(() => { priceService.update({}, {}); });
  after(() => { priceService.update({}, {}); });

  function mkInv(id, opts = {}) {
    return {
      id, name: opts.name || `Pos-${id}`,
      symbol: opts.symbol !== undefined ? opts.symbol : id,
      quantity: opts.qty ?? 1,
      purchasePrice: opts.buyPx ?? 100,
      currentPrice: opts.curPx ?? 100,
      currency: opts.currency || 'COP',
      assetType: opts.assetType || 'stock',
      commission: opts.commission || 0,
      ...(opts.maturityDate ? { maturityDate: opts.maturityDate } : {}),
      ...(opts.currentValue !== undefined ? { currentValue: opts.currentValue } : {}),
    };
  }

  test('portafolio vacío devuelve []', () => {
    assert.deepEqual(selectors.portfolioAlerts(mkState()), []);
  });

  test('solo posiciones vendidas → []', () => {
    const s = mkState({
      investments: [{ ...mkInv('A'), soldDate: '2025-01-01' }],
    });
    assert.deepEqual(selectors.portfolioAlerts(s), []);
  });

  test('sin diversificación: 2 lotes del mismo ticker → alerta diversification', () => {
    const s = mkState({
      investments: [
        mkInv('A1', { symbol: 'AAPL', qty: 2, buyPx: 100, curPx: 100 }),
        mkInv('A2', { symbol: 'AAPL', qty: 1, buyPx: 80,  curPx: 100 }),
      ],
    });
    const al = selectors.portfolioAlerts(s);
    assert.ok(al.some((a) => a.type === 'diversification'));
  });

  test('concentración > 30%: posición que representa ~91% del portafolio', () => {
    // A: 10 × 100 = 1000 COP (≈91%)  B: 1 × 100 = 100 COP (≈9%)
    const s = mkState({
      investments: [
        mkInv('A', { symbol: 'BIG', qty: 10, buyPx: 100, curPx: 100 }),
        mkInv('B', { symbol: 'SML', qty: 1,  buyPx: 100, curPx: 100 }),
      ],
    });
    const al = selectors.portfolioAlerts(s);
    const concA = al.find((a) => a.type === 'concentration' && a.inv?.id === 'A');
    assert.ok(concA, 'debe detectar concentración de la posición A (≈91%)');
    assert.ok(Number(concA.message.match(/([\d.]+)%/)?.[1]) > 30,
      'porcentaje en el mensaje debe ser > 30');
  });

  test('CDT vence en ≤ 30 días → alerta maturity', () => {
    const soon = new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10);
    const s = mkState({
      investments: [
        mkInv('C1', { symbol: '', assetType: 'cdt', maturityDate: soon, qty: 1000, buyPx: 1, curPx: 1 }),
        mkInv('C2', { symbol: 'X', qty: 100, buyPx: 10, curPx: 10 }),
      ],
    });
    const al = selectors.portfolioAlerts(s);
    assert.ok(al.some((a) => a.type === 'maturity'));
  });

  test('CDT vence en > 30 días → sin alerta maturity', () => {
    const far = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
    const s = mkState({
      investments: [mkInv('C3', { assetType: 'cdt', maturityDate: far, qty: 1000, buyPx: 1, curPx: 1 })],
    });
    assert.ok(!selectors.portfolioAlerts(s).some((a) => a.type === 'maturity'));
  });

  test('P&L no realizado < −20% → alerta loss', () => {
    // 1 × buyPx=100, curPx=70 → P&L = −30%
    const s = mkState({ investments: [mkInv('L1', { qty: 1, buyPx: 100, curPx: 70 })] });
    assert.ok(selectors.portfolioAlerts(s).some((a) => a.type === 'loss'));
  });

  test('P&L −10% → sin alerta loss (por encima del umbral −20%)', () => {
    const s = mkState({ investments: [mkInv('L2', { qty: 1, buyPx: 100, curPx: 90 })] });
    assert.ok(!selectors.portfolioAlerts(s).some((a) => a.type === 'loss'));
  });

  test('posición sin precio (curPx=0) → sin alerta loss', () => {
    // curVal=0 → condición (curVal>0) no se cumple → no se calcula P&L
    const s = mkState({ investments: [mkInv('NP', { qty: 1, buyPx: 100, curPx: 0 })] });
    assert.ok(!selectors.portfolioAlerts(s).some((a) => a.type === 'loss'));
  });
});

// ── A.7 (Sprint A): FX en patrimonio, liquidez y deudas — sin suma 1:1 ────────

describe('convertToBase (A.3 / FIN-005)', () => {
  test('divisa base pasa sin conversión (con y sin tasas)', () => {
    assert.equal(convertToBase(1000, 'COP', 'COP', {}), 1000);
    assert.equal(convertToBase(1000, 'COP', 'COP', { USD: 4000 }), 1000);
  });

  test('currency vacío/null se trata como base', () => {
    assert.equal(convertToBase(500, null, 'COP', {}), 500);
    assert.equal(convertToBase(500, undefined, 'COP', {}), 500);
  });

  test('divisa extranjera con tasa → monto × tasa', () => {
    assert.equal(convertToBase(100, 'USD', 'COP', { USD: 4000 }), 400_000);
    assert.equal(convertToBase(10, 'EUR', 'COP', { EUR: 4500 }), 45_000);
  });

  test('divisa extranjera SIN tasa → null (caller excluye, nunca 1:1)', () => {
    assert.equal(convertToBase(100, 'USD', 'COP', {}), null);
    assert.equal(convertToBase(100, 'USD', 'COP', { EUR: 4500 }), null);
  });

  test('monto no numérico se normaliza a 0', () => {
    assert.equal(convertToBase(undefined, 'COP', 'COP', {}), 0);
  });
});

describe('liquidez y patrimonio multi-moneda (A.3 / FIN-005)', () => {
  before(() => { priceService.update({}, {}); });
  after(() => { priceService.update({}, {}); });

  test('totalLiquidity convierte cuenta USD con tasa FX', () => {
    priceService.update({}, { USD: 4000 });
    const s = mkState({
      accounts: [acc('1', 1_000_000, 'bank'), acc('2', 100, 'bank', { currency: 'USD' })],
    });
    // 1.000.000 COP + 100 USD × 4000 = 1.400.000
    assert.equal(selectors.totalLiquidity(s), 1_400_000);
  });

  test('totalLiquidity EXCLUYE cuenta USD sin tasa (no suma 1:1)', () => {
    priceService.update({}, {});
    const s = mkState({
      accounts: [acc('1', 1_000_000, 'bank'), acc('2', 100, 'bank', { currency: 'USD' })],
    });
    assert.equal(selectors.totalLiquidity(s), 1_000_000);
  });

  test('totalAssets convierte asset en USD con tasa y lo excluye sin tasa', () => {
    const s = mkState({
      assets: [{ id: 'a1', value: 10_000_000, currency: 'COP' }, { id: 'a2', value: 5_000, currency: 'USD' }],
    });
    priceService.update({}, { USD: 4000 });
    assert.equal(selectors.totalAssets(s), 10_000_000 + 5_000 * 4000);
    priceService.update({}, {});
    assert.equal(selectors.totalAssets(s), 10_000_000);
  });

  test('totalLiabilities convierte pasivo USD con tasa y lo excluye sin tasa', () => {
    const s = mkState({
      liabilities: [
        { id: 'l1', balance: 2_000_000, type: 'loan', currency: 'COP' },
        { id: 'l2', balance: 1_000, type: 'loan', currency: 'USD' },
      ],
    });
    priceService.update({}, { USD: 4000 });
    assert.equal(selectors.totalLiabilities(s), 2_000_000 + 1_000 * 4000);
    priceService.update({}, {});
    assert.equal(selectors.totalLiabilities(s), 2_000_000);
  });

  test('netWorth multi-moneda con tasa: activos y pasivos convertidos', () => {
    priceService.update({}, { USD: 4000 });
    const s = mkState({
      accounts: [acc('1', 1_000_000, 'bank'), acc('2', 100, 'bank', { currency: 'USD' })],
      liabilities: [{ id: 'l1', balance: 500, type: 'loan', currency: 'USD' }],
    });
    // (1.000.000 + 400.000) − 500 × 4000 = −600.000
    assert.equal(selectors.netWorth(s), 1_400_000 - 2_000_000);
  });

  test('creditCardDebt convierte CC en USD y la excluye sin tasa', () => {
    const s = mkState({
      accounts: [
        acc('cc1', -1_000_000, 'credit_card'),
        acc('cc2', -200, 'credit_card', { currency: 'USD' }),
      ],
    });
    priceService.update({}, { USD: 4000 });
    assert.equal(selectors.creditCardDebt(s), 1_000_000 + 200 * 4000);
    priceService.update({}, {});
    assert.equal(selectors.creditCardDebt(s), 1_000_000);
  });
});

describe('debtStats multi-moneda (A.3 / FIN-005)', () => {
  before(() => { priceService.update({}, {}); });
  after(() => { priceService.update({}, {}); });

  test('deuda USD con tasa se convierte y pondera en base', () => {
    priceService.update({}, { USD: 4000 });
    const s = mkState({
      liabilities: [
        { id: 'l1', balance: 4_000_000, type: 'loan', interestRate: 10, minimumPayment: 100_000, currency: 'COP' },
        { id: 'l2', balance: 1_000, type: 'loan', interestRate: 20, minimumPayment: 50, currency: 'USD' },
      ],
    });
    const st = selectors.debtStats(s);
    assert.equal(st.total, 4_000_000 + 4_000_000);     // 1.000 USD × 4000
    assert.equal(st.minPayment, 100_000 + 200_000);    // 50 USD × 4000
    assert.equal(st.avgRate, 15);                      // ponderado 50/50
    assert.equal(st.unconvertedCount, 0);
  });

  test('deuda USD sin tasa se EXCLUYE de los KPIs y se flaggea (no 1:1)', () => {
    priceService.update({}, {});
    const s = mkState({
      liabilities: [
        { id: 'l1', balance: 4_000_000, type: 'loan', interestRate: 10, minimumPayment: 100_000, currency: 'COP' },
        { id: 'l2', balance: 1_000, type: 'loan', interestRate: 20, minimumPayment: 50, currency: 'USD' },
      ],
    });
    const st = selectors.debtStats(s);
    assert.equal(st.total, 4_000_000);        // solo la deuda COP
    assert.equal(st.minPayment, 100_000);
    assert.equal(st.avgRate, 10);             // sin contaminar por la USD
    assert.equal(st.unconvertedCount, 1);
    assert.equal(st.count, 2);                // la lista completa sigue reportándose
  });
});

describe('investmentsSummary multi-moneda (A.3 / FIN-005)', () => {
  before(() => { priceService.update({}, {}); });
  after(() => { priceService.update({}, {}); });

  function usdInv(id, qty, price) {
    return { id, symbol: 'VOO', name: 'VOO', assetType: 'etf', quantity: qty, currentPrice: price, purchasePrice: price, currency: 'USD', purchaseDate: '2025-01-01' };
  }

  test('grupo USD con tasa se convierte al total', () => {
    priceService.update({}, { USD: 4000 });
    const s = mkState({ investments: [usdInv('i1', 10, 100)] });
    const sum = selectors.investmentsSummary(s);
    assert.equal(sum.value, 10 * 100 * 4000); // 4.000.000
    assert.equal(sum.incompleteCount, 0);
  });

  test('grupo USD sin tasa se EXCLUYE y se flaggea en incompleteCount', () => {
    priceService.update({}, {});
    const s = mkState({
      investments: [
        usdInv('i1', 10, 100),
        { id: 'i2', symbol: 'LOCAL', assetType: 'stock', quantity: 5, currentPrice: 10_000, purchasePrice: 10_000, currency: 'COP', purchaseDate: '2025-01-01' },
      ],
    });
    const sum = selectors.investmentsSummary(s);
    assert.equal(sum.value, 50_000);          // solo el grupo COP
    assert.equal(sum.incompleteCount, 1);
  });
});

describe('portfolioXIRR multi-moneda (A.3 / FIN-005)', () => {
  before(() => { priceService.update({}, {}); });
  after(() => { priceService.update({}, {}); });

  const T = new Date('2026-01-01').getTime();

  test('posición USD sin tasa se omite completa → sin flujos → null', () => {
    priceService.update({}, {});
    const s = mkState({
      investments: [{ id: 'i1', symbol: 'VOO', quantity: 10, currentPrice: 110, purchasePrice: 100, currency: 'USD', purchaseDate: '2025-01-01' }],
    });
    assert.equal(selectors.portfolioXIRR(s, T), null);
  });

  test('posición USD con tasa produce XIRR ≈ 10% (la tasa no altera el retorno)', () => {
    priceService.update({}, { USD: 4000 });
    const s = mkState({
      investments: [{ id: 'i1', symbol: 'VOO', quantity: 10, currentPrice: 110, purchasePrice: 100, currency: 'USD', purchaseDate: '2025-01-01' }],
    });
    const r = selectors.portfolioXIRR(s, T);
    assert.ok(r !== null, 'debe calcular XIRR');
    assert.ok(Math.abs(r - 0.10) < 0.005, `esperaba ≈0.10, recibí ${r}`);
  });
});

describe('fxGaps (A.3 / FIN-005)', () => {
  before(() => { priceService.update({}, {}); });
  after(() => { priceService.update({}, {}); });

  test('sin divisas extranjeras → count 0', () => {
    const s = mkState({ accounts: [acc('1', 1_000_000)] });
    assert.deepEqual(selectors.fxGaps(s), { count: 0, currencies: [] });
  });

  test('entidades en USD/EUR sin tasas → count y currencies poblados', () => {
    priceService.update({}, {});
    const s = mkState({
      accounts: [acc('1', 100, 'bank', { currency: 'USD' })],
      assets: [{ id: 'a1', value: 50, currency: 'EUR' }],
      investments: [{ id: 'i1', quantity: 1, currentPrice: 10, currency: 'USD' }],
    });
    const gaps = selectors.fxGaps(s);
    assert.equal(gaps.count, 3);
    assert.deepEqual([...gaps.currencies].sort(), ['EUR', 'USD']);
  });

  test('con tasas disponibles no hay gaps', () => {
    priceService.update({}, { USD: 4000, EUR: 4500 });
    const s = mkState({
      accounts: [acc('1', 100, 'bank', { currency: 'USD' })],
      assets: [{ id: 'a1', value: 50, currency: 'EUR' }],
    });
    assert.equal(selectors.fxGaps(s).count, 0);
  });

  test('inversiones vendidas o borradas no generan gap', () => {
    priceService.update({}, {});
    const s = mkState({
      investments: [
        { id: 'i1', quantity: 1, currentPrice: 10, currency: 'USD', soldDate: '2026-01-01' },
        { id: 'i2', quantity: 1, currentPrice: 10, currency: 'USD', isDeleted: true },
      ],
    });
    assert.equal(selectors.fxGaps(s).count, 0);
  });
});
