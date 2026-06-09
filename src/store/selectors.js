// store/selectors.js — derivaciones financieras sobre el estado.
// Los valores derivados NO se persisten (docs/Database.md §5): se calculan aquí.

import { priceService } from '../services/priceService.js';
import { roundMoney } from '../utils/format.js';

// Normalizes a periodKey that Google Sheets may auto-convert from 'YYYY-MM' to a Date object.
export function normPeriodKey(raw, len) {
  const s = String(raw);
  if (/^\d{4}/.test(s)) return s.slice(0, len);
  const d = new Date(s);
  return isNaN(d) ? s.slice(0, len) : `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`.slice(0, len);
}

function sameMonth(iso, ref = new Date()) {
  const isoKey = String(iso).slice(0, 7);
  const refKey = ref instanceof Date
    ? `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}`
    : String(ref).slice(0, 7);
  return isoKey === refKey;
}

// Retorna el Set de IDs de cuentas de tipo deuda (credit_card).
// Una transferencia cuyo toAccountId esté en este Set se trata como gasto en el flujo de caja.
function debtAccountIds(s) {
  const ids = new Set();
  for (const a of s.accounts) {
    if (a.type === 'credit_card') ids.add(a.id);
  }
  return ids;
}

// true si la transacción es un gasto directo o un pago a cuenta de deuda.
export function isExpenseLike(t, debtIds) {
  if (t.type === 'expense') return true;
  return t.type === 'transfer' && !!t.toAccountId && debtIds.has(t.toAccountId);
}

const MONTH_ABBR = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
function ymKey(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
function lastMonths(n) {
  const now = new Date();
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ key: ymKey(d), label: MONTH_ABBR[d.getMonth()] });
  }
  return out;
}

export const selectors = {
  liquidAccounts(s) {
    return s.accounts.filter((a) => !a.isArchived && a.type !== 'investment' && a.type !== 'credit_card');
  },

  totalLiquidity(s) {
    return selectors.liquidAccounts(s).reduce((sum, a) => sum + (a.balance || 0), 0);
  },

  investmentsValue(s) {
    const fx   = priceService.fxRates;
    const base = s.baseCurrency || 'COP';
    // FIN-005 (TD-02): si falta la tasa FX para la divisa de una posición, excluirla
    // de la suma en lugar de sumar el valor nativo 1:1 (error silencioso ×~4000).
    const sum = s.investments.filter((i) => !i.isDeleted && !i.soldDate).reduce((acc, i) => {
      const lp    = priceService.priceFor(i.symbol);
      const price = lp?.price || i.currentPrice || 0;
      // CDTs: usar el valor capitalizado (interés compuesto) en lugar de qty×price (face value).
      // Fondos FIC: almacenan el valor total en currentValue (no qty×price).
      // Fallback a costBasis cuando no hay precio vivo ni currentValue (p. ej. FIC sin Yahoo).
      const native = i.assetType === 'cdt'
        ? selectors.cdtCurrentValue(i)
        : i.currentValue || ((i.quantity || 0) * price) || i.costBasis || 0;
      if (!native) return acc;
      const cur = i.currency || base;
      if (cur === base) return acc + native;
      if (!fx[cur]) return acc; // excluir — no sumar nativo sin tasa (sería error ×~4000)
      return acc + native * fx[cur];
    }, 0);
    return roundMoney(sum, base);
  },

  // FIN-005 (TD-02): devuelve el conteo de posiciones activas cuya divisa carece de
  // tasa FX en priceService. La vista debe mostrar un aviso cuando > 0.
  investmentsIncompleteCount(s) {
    const fx   = priceService.fxRates;
    const base = s.baseCurrency || 'COP';
    return s.investments.filter((i) => {
      if (i.isDeleted || i.soldDate) return false;
      const cur = i.currency || base;
      if (cur === base) return false;
      const lp    = priceService.priceFor(i.symbol);
      const price = lp?.price || i.currentPrice || 0;
      const native = (i.quantity || 0) * price;
      return native > 0 && !fx[cur];
    }).length;
  },

  investmentsCost(s) {
    const fx   = priceService.fxRates;
    const base = s.baseCurrency || 'COP';
    // FIN-005 (TD-02): misma política que investmentsValue — excluir posiciones sin tasa FX.
    const sum = s.investments.filter((i) => !i.isDeleted && !i.soldDate).reduce((acc, i) => {
      // Cost basis = (cantidad × precio de compra) + comisión de la operación (Sprint 5).
      const native = (i.quantity || 0) * (i.avgCost || i.purchasePrice || 0) + (Number(i.commission) || 0);
      if (!native) return acc;
      const cur = i.currency || base;
      if (cur === base) return acc + native;
      if (!fx[cur]) return acc; // excluir — no sumar nativo sin tasa
      return acc + native * fx[cur];
    }, 0);
    return roundMoney(sum, base);
  },

  investmentsReturnPct(s) {
    const cost = selectors.investmentsCost(s);
    if (!cost) return 0;
    return ((selectors.investmentsValue(s) - cost) / cost) * 100;
  },

  totalAssets(s) {
    // Excluye cuentas investment (doble conteo con posiciones, TD-03) y credit_card (son pasivos).
    const accountsValue = s.accounts
      .filter((a) => !a.isArchived && a.type !== 'investment' && a.type !== 'credit_card')
      .reduce((sum, a) => sum + (a.balance || 0), 0);
    const otherAssets = s.assets.reduce((sum, a) => sum + (a.value || 0), 0);
    return accountsValue + selectors.investmentsValue(s) + otherAssets;
  },

  totalLiabilities(s) {
    // Excluye liabilities de tipo credit_card: las cuentas CC ya las cubren vía fromCC.
    // Sin este filtro, registrar la misma CC como cuenta Y como liability la contaría doble.
    const fromLiabilities = s.liabilities
      .filter((l) => l.type !== 'credit_card')
      .reduce((sum, l) => sum + (l.balance || 0), 0);
    const fromCC = selectors.creditCardAccounts(s)
      .reduce((sum, a) => sum + Math.abs(a.balance || 0), 0);
    return fromLiabilities + fromCC;
  },

  // Patrimonio Neto = Activos - Pasivos (docs/PRD.md §8.6)
  netWorth(s) {
    return selectors.totalAssets(s) - selectors.totalLiabilities(s);
  },

  monthlyIncome(s, ref) {
    return s.transactions
      .filter((t) => t.type === 'income' && sameMonth(t.date, ref))
      .reduce((sum, t) => sum + (t.amount || 0), 0);
  },

  monthlyExpense(s, ref) {
    const debtIds = debtAccountIds(s);
    return s.transactions
      .filter((t) => isExpenseLike(t, debtIds) && sameMonth(t.date, ref))
      .reduce((sum, t) => sum + (t.amount || 0), 0);
  },

  monthlySavings(s, ref) {
    return selectors.monthlyIncome(s, ref) - selectors.monthlyExpense(s, ref);
  },

  // Promedio de ahorro de los últimos n meses completos (excluye el mes en curso).
  // FIN-012 (TD-53): solo promedia meses con actividad (income>0 || expense>0) para
  // no diluir el promedio en históricos cortos donde la mayoría de meses son vacíos.
  monthlySavingsAvg(s, n = 3) {
    const cf = selectors.cashflow(s, n + 1).slice(0, n); // n meses completos, sin el actual
    const active = cf.filter((m) => m.income > 0 || m.expense > 0);
    if (!active.length) return 0;
    return active.reduce((sum, m) => sum + m.savings, 0) / active.length;
  },

  savingsRate(s, ref) {
    const inc = selectors.monthlyIncome(s, ref);
    if (!inc) return 0;
    return (selectors.monthlySavings(s, ref) / inc) * 100;
  },

  recentTransactions(s, n = 6) {
    return [...s.transactions]
      .sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        // Tiebreaker estable por createdAt o id (evita reordenamiento aleatorio el mismo día).
        return (a.createdAt || a.id || '') < (b.createdAt || b.id || '') ? 1 : -1;
      })
      .slice(0, n);
  },

  activeGoals(s) {
    return s.goals.filter((g) => g.status === 'active');
  },

  upcomingPayments(s, n = 4) {
    const recurring = [...s.recurring]
      .filter((r) => r.isActive)
      .map((r) => ({ ...r, _source: 'recurring' }));

    // Vencimientos de tarjetas de crédito con paymentDay configurado.
    const today = new Date();
    const todayDay = today.getDate();
    const ccPayments = selectors.creditCardAccounts(s)
      .filter((a) => a.paymentDay && Math.abs(a.balance || 0) > 0)
      .map((a) => {
        const day = Number(a.paymentDay);
        const y = today.getFullYear();
        const m = today.getMonth();
        const dueDate = todayDay <= day
          ? new Date(y, m, day).toISOString().slice(0, 10)
          : new Date(y, m + 1, day).toISOString().slice(0, 10);
        return {
          id: a.id, description: a.name, nextRunDate: dueDate,
          amount: Math.abs(a.balance || 0), currency: a.currency,
          categoryId: null, _source: 'credit_card',
        };
      });

    return [...recurring, ...ccPayments]
      .sort((a, b) => new Date(a.nextRunDate) - new Date(b.nextRunDate))
      .slice(0, n);
  },

  categoryById(s, id) {
    return s.categories.find((c) => c.id === id);
  },

  accountById(s, id) {
    return s.accounts.find((a) => a.id === id);
  },

  // ---- Deudas (unifica Liabilities con las tarjetas de crédito que son cuentas) ----
  creditCardAccounts(s) {
    return (s.accounts || []).filter((a) => a.type === 'credit_card' && !a.isArchived);
  },

  // Lista unificada de deudas: pasivos (Liabilities con saldo > 0) + tarjetas de crédito
  // registradas como cuentas (su saldo, negativo, es deuda). Normaliza el campo de cuota
  // (account.minPayment ↔ liability.minimumPayment) para que los KPIs sean únicos.
  // Los créditos/hipotecas son Liabilities con balance, interestRate y minimumPayment.
  debtList(s) {
    const out = [];
    // credit_card liabilities excluidas: las CCs se gestionan como cuentas (source:'account').
    // Incluirlas aquí causa doble conteo con creditCardAccounts (distintos saldos → KPIs inconsistentes).
    (s.liabilities || []).filter((l) => (l.balance || 0) > 0 && l.type !== 'credit_card').forEach((l) => out.push({
      id: l.id, source: 'liability', name: l.name, type: l.type || 'other',
      balance: l.balance || 0, interestRate: l.interestRate || 0,
      minPayment: l.minimumPayment || 0, currency: l.currency, dueDate: l.dueDate || null, raw: l,
    }));
    selectors.creditCardAccounts(s).forEach((a) => {
      const balance = Math.abs(a.balance || 0);
      if (balance <= 0) return; // tarjeta sin deuda (saldo a favor o en cero)
      out.push({
        id: a.id, source: 'account', name: a.name, type: 'credit_card',
        balance, interestRate: a.interestRate || 0, minPayment: a.minPayment || 0,
        currency: a.currency, dueDate: null, raw: a,
      });
    });
    return out;
  },

  // KPIs de deudas: deuda total, cuota mínima mensual (suma de los pagos mínimos manuales)
  // y tasa promedio ponderada por saldo — incluyendo tarjetas y créditos/hipotecas.
  // FIN-006 (TD-02): convierte saldos a moneda base antes de ponderar; evita sesgo en
  // portfolios multi-moneda (sin conversión, una deuda USD pesaría 1:1 con una COP).
  debtStats(s) {
    const list = selectors.debtList(s);
    const fx   = priceService.fxRates;
    const base = s.baseCurrency || 'COP';
    const toBase = (amount, cur) => {
      if (!cur || cur === base) return amount;
      const rate = fx[cur];
      return rate ? amount * rate : amount; // fallback 1:1 si no hay tasa
    };
    const total      = list.reduce((sum, d) => sum + toBase(d.balance, d.currency), 0);
    const minPayment = list.reduce((sum, d) => sum + toBase(d.minPayment, d.currency), 0);
    const weighted   = list.reduce((sum, d) => sum + d.interestRate * toBase(d.balance, d.currency), 0);
    const avgRate    = total ? weighted / total : 0;
    return { total, minPayment, avgRate, count: list.length, list };
  },

  // Total adeudado en tarjetas (solo cuentas credit_card — liabilities tipo credit_card excluidas).
  creditCardDebt(s) {
    return selectors.creditCardAccounts(s)
      .reduce((sum, a) => sum + Math.abs(a.balance || 0), 0);
  },

  // ---- Presupuestos (valores derivados, no persistidos) ----
  budgetConsumed(s, budget) {
    const isMonthly = budget.period === 'monthly';
    const pKey = normPeriodKey(budget.periodKey, isMonthly ? 7 : 4);
    return s.transactions
      .filter((t) => {
        if (t.type !== 'expense' || t.categoryId !== budget.categoryId) return false;
        const key = isMonthly ? String(t.date).slice(0, 7) : String(t.date).slice(0, 4);
        return key === pKey;
      })
      .reduce((sum, t) => sum + (t.amount || 0), 0);
  },

  budgetStats(s, budget) {
    const amount = budget.amount || 0;
    const consumed = selectors.budgetConsumed(s, budget);
    const available = amount - consumed;
    const pct = amount ? (consumed / amount) * 100 : 0;

    // Proyección al cierre solo para el mes en curso.
    // TD-36: no proyectar en días 1–3 (datos insuficientes → extrapolación engañosa).
    let projected = consumed;
    const now = new Date();
    const curMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (budget.period === 'monthly' && normPeriodKey(budget.periodKey, 7) === curMonthKey) {
      const day = now.getDate();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      projected = day > 3 ? (consumed / day) * daysInMonth : consumed;
    }
    return { amount, consumed, available, pct, projected };
  },

  // ---- Series temporales (Analítica) ----
  // Flujo de caja por mes (últimos n meses, incluye el actual).
  cashflow(s, n = 6) {
    const months = lastMonths(n);
    const debtIds = debtAccountIds(s);
    const acc = {};
    months.forEach((m) => { acc[m.key] = { key: m.key, label: m.label, income: 0, expense: 0 }; });
    for (const t of s.transactions) {
      const key = String(t.date).slice(0, 7);
      if (!acc[key]) continue;
      if (t.type === 'income') acc[key].income += t.amount || 0;
      else if (isExpenseLike(t, debtIds)) acc[key].expense += t.amount || 0;
    }
    return months.map((m) => {
      const r = acc[m.key];
      return { ...r, savings: r.income - r.expense };
    });
  },

  // Gasto por categoría para un mes dado (YYYY-MM).
  categorySpend(s, monthKey) {
    const map = new Map();
    for (const t of s.transactions) {
      if (t.type !== 'expense' || String(t.date).slice(0, 7) !== monthKey) continue;
      map.set(t.categoryId, (map.get(t.categoryId) || 0) + t.amount);
    }
    return [...map.entries()]
      .map(([id, amount]) => ({ category: selectors.categoryById(s, id), amount }))
      .sort((a, b) => b.amount - a.amount);
  },

  // Mayor variación de gasto por categoría (mes actual vs anterior).
  topCategoryChange(s) {
    const months = lastMonths(2);
    if (months.length < 2) return null;
    const cur = new Map(); const prev = new Map();
    for (const t of s.transactions) {
      if (t.type !== 'expense') continue;
      const key = String(t.date).slice(0, 7);
      if (key === months[1].key) cur.set(t.categoryId, (cur.get(t.categoryId) || 0) + t.amount);
      else if (key === months[0].key) prev.set(t.categoryId, (prev.get(t.categoryId) || 0) + t.amount);
    }
    let best = null;
    for (const [id, curAmt] of cur.entries()) {
      const prevAmt = prev.get(id) || 0;
      if (prevAmt <= 0) continue;
      const pct = ((curAmt - prevAmt) / prevAmt) * 100;
      if (!best || Math.abs(pct) > Math.abs(best.pct)) {
        best = { category: selectors.categoryById(s, id), pct, curAmt, prevAmt };
      }
    }
    return best;
  },

  // Tendencias de gasto por categoría: top topN categorías por total acumulado en los
  // últimos n meses. Devuelve [{category, total, months:[{key,label,amount}]}] desc.
  categoryTrends(s, n = 6, topN = 5) {
    const months = lastMonths(n);
    const monthKeys = new Set(months.map((m) => m.key));
    const totals = new Map();
    const byMonth = new Map();
    for (const t of s.transactions) {
      if (t.type !== 'expense') continue;
      const key = String(t.date).slice(0, 7);
      if (!monthKeys.has(key)) continue;
      totals.set(t.categoryId, (totals.get(t.categoryId) || 0) + t.amount);
      if (!byMonth.has(t.categoryId)) byMonth.set(t.categoryId, new Map());
      byMonth.get(t.categoryId).set(key, (byMonth.get(t.categoryId).get(key) || 0) + t.amount);
    }
    return [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([id, total]) => ({
        category: selectors.categoryById(s, id),
        total,
        months: months.map((m) => ({ ...m, amount: byMonth.get(id)?.get(m.key) || 0 })),
      }));
  },

  // Gasto por categoría del mes (para analítica ligera)
  expenseByCategory(s, ref) {
    const map = new Map();
    for (const t of s.transactions) {
      if (t.type !== 'expense' || !sameMonth(t.date, ref)) continue;
      map.set(t.categoryId, (map.get(t.categoryId) || 0) + t.amount);
    }
    return [...map.entries()]
      .map(([categoryId, amount]) => ({ category: selectors.categoryById(s, categoryId), amount }))
      .sort((a, b) => b.amount - a.amount);
  },

  // Score financiero mensual 0–100 (Dashboard).
  // 4 componentes: ahorro (30), presupuestos (30), metas (20), liquidez (20).
  financialScore(s) {
    let score = 0;
    const now = new Date();
    const curMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Tasa de ahorro — 30 pts
    const rate = selectors.savingsRate(s);
    score += rate >= 20 ? 30 : rate >= 10 ? 20 : rate >= 0 ? Math.max(0, rate * 1.5) : 0;

    // Presupuestos del mes — 30 pts
    const budgets = (s.budgets || []).filter((b) => b.period === 'monthly' && normPeriodKey(b.periodKey, 7) === curMonthKey);
    if (budgets.length > 0) {
      const over = budgets.filter((b) => selectors.budgetStats(s, b).pct > 100).length;
      const avgPct = budgets.reduce((sum, b) => sum + selectors.budgetStats(s, b).pct, 0) / budgets.length;
      score += over === 0 ? (avgPct < 80 ? 30 : 20) : Math.max(0, 30 - over * 10);
    } else {
      score += 15;
    }

    // Metas activas — 20 pts (promedio de avance)
    const goals = selectors.activeGoals(s);
    if (goals.length > 0) {
      const avg = goals.reduce((sum, g) => sum + (g.targetAmount ? Math.min(100, ((g.currentAmount || 0) / g.targetAmount) * 100) : 0), 0) / goals.length;
      score += (avg / 100) * 20;
    } else {
      score += 10;
    }

    // Cobertura de liquidez — 20 pts (meses de gastos cubiertos)
    const monthExp = selectors.monthlyExpense(s);
    const liq = selectors.totalLiquidity(s);
    if (monthExp > 0) {
      const coverage = liq / monthExp;
      score += coverage >= 3 ? 20 : coverage >= 1 ? 12 : coverage >= 0.5 ? 5 : 0;
    } else {
      score += 10;
    }

    return Math.round(Math.min(100, Math.max(0, score)));
  },

  // Desglose de los 4 factores del score para mostrar en el desplegable del KPI.
  financialScoreBreakdown(s) {
    const now = new Date();
    const curMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const rate = selectors.savingsRate(s);
    const rateScore = rate >= 20 ? 30 : rate >= 10 ? 20 : rate >= 0 ? Math.max(0, rate * 1.5) : 0;

    const budgets = (s.budgets || []).filter((b) => b.period === 'monthly' && normPeriodKey(b.periodKey, 7) === curMonthKey);
    let budgetScore = 15;
    if (budgets.length > 0) {
      const over = budgets.filter((b) => selectors.budgetStats(s, b).pct > 100).length;
      const avgPct = budgets.reduce((sum, b) => sum + selectors.budgetStats(s, b).pct, 0) / budgets.length;
      budgetScore = over === 0 ? (avgPct < 80 ? 30 : 20) : Math.max(0, 30 - over * 10);
    }

    const goals = selectors.activeGoals(s);
    let goalsScore = 10;
    if (goals.length > 0) {
      const avg = goals.reduce((sum, g) => sum + (g.targetAmount ? Math.min(100, ((g.currentAmount || 0) / g.targetAmount) * 100) : 0), 0) / goals.length;
      goalsScore = (avg / 100) * 20;
    }

    const monthExp = selectors.monthlyExpense(s);
    const liq = selectors.totalLiquidity(s);
    let liquidScore = 10;
    if (monthExp > 0) {
      const cov = liq / monthExp;
      liquidScore = cov >= 3 ? 20 : cov >= 1 ? 12 : cov >= 0.5 ? 5 : 0;
    }

    return [
      { factor: 'Tasa de ahorro', pts: Math.round(rateScore), max: 30 },
      { factor: 'Presupuestos', pts: Math.round(budgetScore), max: 30 },
      { factor: 'Metas activas', pts: Math.round(goalsScore), max: 20 },
      { factor: 'Cobertura liquidez', pts: Math.round(liquidScore), max: 20 },
    ];
  },

  // ---- Vista Hoy: copiloto diario ----

  // Semáforo de salud del día: green / yellow / red + razones legibles.
  dailyHealth(s) {
    const todayKey = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowKey = tomorrow.toISOString().slice(0, 10);
    let status = 'green';
    const reasons = [];

    const urgent = (s.recurring || []).filter(
      (r) => r.isActive && r.nextRunDate && r.nextRunDate.slice(0, 10) <= tomorrowKey
    );
    if (urgent.length) {
      if (status === 'green') status = 'yellow';
      reasons.push(`${urgent.length} pago${urgent.length > 1 ? 's' : ''} vence${urgent.length === 1 ? '' : 'n'} hoy/mañana`);
    }

    const now = new Date();
    const curMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    for (const b of (s.budgets || [])) {
      if (b.period !== 'monthly' || normPeriodKey(b.periodKey, 7) !== curMonthKey) continue;
      const stats = selectors.budgetStats(s, b);
      if (stats.pct >= 100) { status = 'red'; reasons.push(`${b.name || 'Presupuesto'} superado`); }
      else if (stats.pct >= 80 && status !== 'red') { status = 'yellow'; reasons.push(`${b.name || 'Presupuesto'} al ${stats.pct.toFixed(0)}%`); }
    }

    const monthExp = selectors.monthlyExpense(s);
    const liq = selectors.totalLiquidity(s);
    if (monthExp > 0 && liq < monthExp * 0.5) { status = 'red'; reasons.push('Liquidez crítica'); }
    else if (monthExp > 0 && liq < monthExp && status !== 'red') { status = 'yellow'; reasons.push('Liquidez baja'); }

    return { status, reasons };
  },

  // Items accionables del día: pagos urgentes, presupuestos al límite, metas activas.
  actionItems(s) {
    const items = [];
    const todayKey = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowKey = tomorrow.toISOString().slice(0, 10);

    (s.recurring || [])
      .filter((r) => r.isActive && r.nextRunDate && r.nextRunDate.slice(0, 10) <= tomorrowKey)
      .sort((a, b) => a.nextRunDate.localeCompare(b.nextRunDate))
      .forEach((r) => items.push({
        type: 'payment', id: r.id,
        title: r.description,
        meta: r.nextRunDate.slice(0, 10) <= todayKey ? 'Vence hoy' : 'Vence mañana',
        amount: r.amount, currency: r.currency, raw: r,
      }));

    const now = new Date();
    const curMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    (s.budgets || [])
      .filter((b) => b.period === 'monthly' && normPeriodKey(b.periodKey, 7) === curMonthKey)
      .map((b) => ({ b, stats: selectors.budgetStats(s, b) }))
      .filter(({ stats }) => stats.pct >= 80)
      .sort((a, b) => b.stats.pct - a.stats.pct)
      .forEach(({ b, stats }) => items.push({
        type: 'budget', id: b.id, title: b.name,
        meta: `${stats.pct.toFixed(0)}% del presupuesto`, pct: stats.pct, raw: b,
      }));

    (s.goals || [])
      .filter((g) => g.status === 'active' && (g.targetAmount || 0) > (g.currentAmount || 0))
      .sort((a, b) => new Date(a.targetDate || '2999') - new Date(b.targetDate || '2999'))
      .slice(0, 2)
      .forEach((g) => {
        const pct = g.targetAmount ? Math.min(100, ((g.currentAmount || 0) / g.targetAmount) * 100) : 0;
        items.push({
          type: 'goal', id: g.id, title: g.name,
          meta: `${pct.toFixed(0)}% completado`,
          amount: (g.targetAmount || 0) - (g.currentAmount || 0),
          currency: g.currency, raw: g,
        });
      });

    return items;
  },

  // Progreso del mes: días transcurridos, gasto actual vs presupuesto total mensual.
  monthProgress(s) {
    const now = new Date();
    const day = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const curMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const totalBudget = (s.budgets || [])
      .filter((b) => b.period === 'monthly' && normPeriodKey(b.periodKey, 7) === curMonthKey)
      .reduce((sum, b) => sum + (b.amount || 0), 0);
    return {
      day, daysInMonth,
      pct: (day / daysInMonth) * 100,
      monthlyExpense: selectors.monthlyExpense(s),
      totalBudget,
    };
  },

  // FIN-002 (TD-42): aplica la retención en fuente sobre una ganancia realizada.
  // La retención solo descuenta sobre ganancias (pnl > 0); las pérdidas no se ven afectadas.
  // Semántica: el estado retiene withholdingRate% del ingreso al vender con ganancia.
  // Ejemplo: ganancia bruta $1M, rate 4% → P&L neto $960.000.
  applyWithholding(pnlBruto, withholdingRate) {
    const rate = Number(withholdingRate) || 0;
    if (!rate || pnlBruto <= 0) return pnlBruto;
    return pnlBruto - pnlBruto * (rate / 100);
  },

  // ── FIN-003/004 (TD-43): P&L de un lote de venta (función pura, testeable sin DOM) ──
  // Recibe el objeto de posición vendida (p) con:
  //   soldQuantity  — cantidad realmente vendida
  //   quantity      — cantidad original del lote (para prorratear comisión de compra)
  //   soldPrice     — precio de venta por unidad
  //   purchasePrice / avgCost — precio de compra por unidad
  //   commission    — comisión de compra del lote completo (se prorrateo)
  //   soldCommission — comisión de la operación de venta
  //   withholdingRate — retención en fuente (%)
  // Devuelve el P&L neto (ya con retención aplicada).
  lotRealizedPnL(p, fallbackWithholdingRate = 0) {
    const qtyVendida  = Number(p.soldQuantity || p.quantity) || 0;
    const qtyLotTotal = Number(p.quantity) || qtyVendida || 1;
    const buyPrice    = Number(p.purchasePrice || p.avgCost) || 0;
    const buyComm     = Number(p.commission) || 0;
    // FIN-004: comisión de compra prorateada a la fracción vendida
    const buyCommProrateada = buyComm * (qtyVendida / qtyLotTotal);
    const costBasis   = qtyVendida * buyPrice + buyCommProrateada;
    const soldComm    = Number(p.soldCommission) || 0;
    const grossPnL    = qtyVendida * (Number(p.soldPrice) || 0) - costBasis - soldComm;
    const rate        = Number(p.withholdingRate) || fallbackWithholdingRate;
    return selectors.applyWithholding(grossPnL, rate);
  },

  // ── FIN-008 (TD-44): valor actual de un CDT/renta fija (función pura, testeable sin DOM) ──
  // Recibe el objeto de posición de tipo CDT:
  //   quantity      — capital puro invertido
  //   interestRate  — tasa E.A. en %
  //   purchaseDate  — fecha de compra (ISO YYYY-MM-DD)
  //   maturityDate  — fecha de vencimiento (ISO, opcional). Si se omite, no hay tope.
  //   todayMs       — timestamp de "hoy" en ms (permite tests deterministas; por defecto Date.now())
  // Devuelve el valor actual capitalizado.
  cdtCurrentValue(inv, todayMs) {
    if (!inv?.interestRate || !inv?.purchaseDate) return Number(inv?.quantity) || 0;
    const now = todayMs !== undefined ? todayMs : Date.now();
    const capital = Number(inv.quantity) || 0;
    const diasDesdeCompra = (now - new Date(inv.purchaseDate).getTime()) / 86400000;
    let days = diasDesdeCompra;
    if (inv.maturityDate) {
      const diasHastaVencimiento = (new Date(inv.maturityDate).getTime() - new Date(inv.purchaseDate).getTime()) / 86400000;
      days = Math.min(diasDesdeCompra, Math.max(0, diasHastaVencimiento));
    }
    return capital * Math.pow(1 + inv.interestRate / 100, days / 365);
  },

  // ── FIN-007 (TD-23 ext): amortización mes a mes de una deuda (función pura, testeable) ──
  // balance: saldo inicial. eaRate: tasa E.A. en %. payment: cuota fija por mes.
  // Opciones: paymentPct (%) si la cuota es un % del saldo residual (ej. tarjetas: 2%);
  //           paymentFloor: piso mínimo cuando se usa paymentPct.
  // Devuelve { months, totalInterest }; months=Infinity si la cuota no cubre intereses.
  amortize(balance, eaRate, payment, { paymentPct = 0, paymentFloor = 0 } = {}) {
    if (!balance || balance <= 0) return { months: 0, totalInterest: 0 };
    const usePct = paymentPct > 0;
    if (!usePct && (!payment || payment <= 0)) return { months: null, totalInterest: null };
    const r = eaRate > 0 ? Math.pow(1 + eaRate / 100, 1 / 12) - 1 : 0;
    let bal = balance; let totalInterest = 0; let months = 0;
    while (bal > 0.01 && months < 600) {
      const interest   = bal * r;
      const monthlyPay = usePct ? Math.max(bal * paymentPct / 100, paymentFloor) : payment;
      const capital    = monthlyPay - interest;
      if (capital <= 0) return { months: Infinity, totalInterest: Infinity };
      totalInterest += interest;
      bal = Math.max(0, bal - capital);
      months++;
    }
    return { months, totalInterest: Math.round(totalInterest) };
  },

  // ── FIN-007: simulación encadenada Snowball/Avalanche ──
  // debtList debe estar ya ordenado por estrategia: [{ balance, interestRate, minPayment }].
  // Cuando una deuda queda en cero, su cuota mínima se redirige a la siguiente en lista.
  // Devuelve { months, totalInterest } del portafolio completo.
  chainedPayoff(debtList) {
    const valid = debtList.filter((d) => d.balance > 0 && d.minPayment > 0);
    if (!valid.length) return { months: 0, totalInterest: 0 };
    const debts = valid.map((d) => ({
      bal:  d.balance,
      rate: d.interestRate > 0 ? Math.pow(1 + d.interestRate / 100, 1 / 12) - 1 : 0,
      pay:  d.minPayment,
      done: false,
    }));
    let months = 0; let totalInterest = 0; let freedBudget = 0;
    while (debts.some((d) => !d.done) && months < 600) {
      months++;
      const prioIdx = debts.findIndex((d) => !d.done);
      for (let i = 0; i < debts.length; i++) {
        const d = debts[i];
        if (d.done) continue;
        const interest = d.bal * d.rate;
        totalInterest += interest;
        const payment = i === prioIdx ? d.pay + freedBudget : d.pay;
        const capital  = payment - interest;
        if (capital <= 0) return { months: Infinity, totalInterest: Infinity };
        d.bal = Math.max(0, d.bal - capital);
        if (d.bal <= 0.01 && !d.done) { d.done = true; freedBudget += d.pay; }
      }
    }
    return { months, totalInterest: Math.round(totalInterest) };
  },

  // ── FIN-013 (TD-38): rentabilidad anualizada — XIRR y CAGR ───────────────────

  // XIRR — Tasa Interna de Retorno extendida para flujos en fechas irregulares.
  // cashFlows: [{ amount: number, date: string YYYY-MM-DD }]
  //   amount < 0 = salida (inversión), amount > 0 = entrada (venta o valor actual).
  // Usa Newton-Raphson con hasta 100 iteraciones. Devuelve tasa E.A. o null.
  xirr(cashFlows, guess = 0.1) {
    if (!cashFlows || cashFlows.length < 2) return null;
    const t0    = Math.min(...cashFlows.map((cf) => new Date(cf.date).getTime()));
    const days  = cashFlows.map((cf) => (new Date(cf.date).getTime() - t0) / 86400000);
    const amts  = cashFlows.map((cf) => cf.amount);
    const npv   = (r) => amts.reduce((s, a, i) => s + a / Math.pow(1 + r, days[i] / 365), 0);
    const dnpv  = (r) => amts.reduce((s, a, i) => s - (days[i] / 365) * a / Math.pow(1 + r, days[i] / 365 + 1), 0);
    let r = guess;
    for (let i = 0; i < 100; i++) {
      const f = npv(r); const df = dnpv(r);
      if (!isFinite(f) || !isFinite(df) || Math.abs(df) < 1e-12) break;
      const next = r - f / df;
      if (Math.abs(next - r) < 1e-8) return next;
      r = next;
      if (r < -0.9999) r = -0.5; // evitar divergencia
    }
    return null;
  },

  // CAGR — tasa de crecimiento anual compuesto.
  // costBasis: coste total de compra. currentValue: valor actual (o de venta).
  // Devuelve la tasa E.A. o null si los datos son insuficientes.
  cagr(costBasis, currentValue, purchaseDateIso, todayMs) {
    if (!costBasis || costBasis <= 0 || !currentValue || !purchaseDateIso) return null;
    const now  = todayMs !== undefined ? todayMs : Date.now();
    const days = (now - new Date(purchaseDateIso).getTime()) / 86400000;
    if (days <= 0) return null;
    return Math.pow(currentValue / costBasis, 365 / days) - 1;
  },

  // XIRR de una posición individual (compra → valor actual o venta).
  investmentXIRR(inv, currentPrice, todayMs) {
    const now     = todayMs !== undefined ? todayMs : Date.now();
    const today   = new Date(now).toISOString().slice(0, 10);
    const buyPx   = Number(inv.purchasePrice || inv.avgCost) || 0;
    const qty     = Number(inv.quantity) || 0;
    const cost    = qty * buyPx + (Number(inv.commission) || 0);
    if (!cost || !inv.purchaseDate) return null;
    const curVal  = inv.soldDate
      ? qty * (Number(inv.soldPrice) || 0) - (Number(inv.soldCommission) || 0)
      : qty * (Number(currentPrice) || 0);
    return selectors.xirr([
      { amount: -cost,   date: inv.purchaseDate },
      { amount: curVal,  date: inv.soldDate || today },
    ]);
  },

  // CAGR de una posición individual.
  investmentCAGR(inv, currentPrice, todayMs) {
    const buyPx  = Number(inv.purchasePrice || inv.avgCost) || 0;
    const qty    = Number(inv.quantity) || 0;
    const cost   = qty * buyPx + (Number(inv.commission) || 0);
    const now    = todayMs !== undefined ? todayMs : Date.now();
    const curVal = inv.soldDate
      ? qty * (Number(inv.soldPrice) || 0)
      : qty * (Number(currentPrice) || 0);
    return selectors.cagr(cost, curVal, inv.purchaseDate, now);
  },

  // XIRR del portafolio completo (agrega todos los flujos de compra y valor actual).
  // Solo incluye posiciones no borradas con datos suficientes.
  portfolioXIRR(s, todayMs) {
    const fx   = priceService.fxRates;
    const base = s.baseCurrency || 'COP';
    const now  = todayMs !== undefined ? todayMs : Date.now();
    const today = new Date(now).toISOString().slice(0, 10);
    const toBase = (v, cur) => {
      if (!cur || cur === base) return v;
      const rate = fx[cur]; return rate ? v * rate : v;
    };
    const flows = [];
    for (const inv of (s.investments || [])) {
      if (inv.isDeleted || !inv.purchaseDate) continue;
      const buyPx = Number(inv.purchasePrice || inv.avgCost) || 0;
      const qty   = Number(inv.quantity) || 0;
      const cost  = qty * buyPx + (Number(inv.commission) || 0);
      if (!cost) continue;
      const cur = inv.currency || base;
      const lp  = priceService.priceFor(inv.symbol);
      const px  = lp?.price || inv.currentPrice || 0;
      const curVal = inv.soldDate
        ? qty * (Number(inv.soldPrice) || 0) - (Number(inv.soldCommission) || 0)
        : qty * px;
      flows.push({ amount: -toBase(cost, cur),   date: inv.purchaseDate });
      flows.push({ amount:  toBase(curVal, cur),  date: inv.soldDate || today });
    }
    return flows.length >= 2 ? selectors.xirr(flows) : null;
  },

  // Cuántos meses de gastos cubre la liquidez actual.
  // Usa el promedio de gastos de los últimos 3 meses completos (excluye el mes en curso,
  // que puede ser parcial y sobreestimaría la cobertura).
  // Solo promedia meses con actividad (mismo criterio que monthlySavingsAvg / FIN-012).
  // Retorna null si no hay datos de gasto.
  liquidityCoverageMonths(s) {
    // cashflow(s, 4) → [mes_actual, mes-1, mes-2, mes-3]; slice(0,3) = 3 completos
    // Nota: cashflow devuelve meses en orden cronológico (más antiguo primero),
    // por lo que el mes actual es el ÚLTIMO elemento (índice n-1), no el primero.
    const cf = selectors.cashflow(s, 4);
    // Los 3 primeros son los meses completos (cf[0]=más antiguo, cf[3]=actual).
    const completos = cf.slice(0, 3);
    const activos = completos.filter((m) => m.income > 0 || m.expense > 0);
    if (!activos.length) return null;
    const avgExpense = activos.reduce((sum, m) => sum + m.expense, 0) / activos.length;
    if (avgExpense === 0) return null;
    return selectors.totalLiquidity(s) / avgExpense;
  },

  // Cuántos meses consecutivos recientes el usuario ahorró (savings > 0),
  // EXCLUYENDO el mes en curso (puede no estar completo).
  // Retorna 0 si no hay racha o no hay datos.
  savingsStreak(s) {
    // cashflow(s, 13) → 12 meses completos + el actual (el último en el array).
    const cf = selectors.cashflow(s, 13);
    // Excluir el último elemento (mes en curso).
    const completos = cf.slice(0, cf.length - 1); // 12 meses completos
    // Contar desde el más reciente hacia el más antiguo.
    let streak = 0;
    for (let i = completos.length - 1; i >= 0; i--) {
      if (completos[i].savings > 0) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  },

  // Paridad Dashboard↔Inversiones: replica la lógica de groupByTicker + groupValue + toCOP
  // de investments.js para que el KPI del dashboard use exactamente los mismos valores
  // que muestra la sección de Inversiones (mismo tratamiento de CDT, FIC, FX y fallbacks).
  investmentsSummary(s) {
    const fx   = priceService.fxRates;
    const base = s.baseCurrency || 'COP';
    const toBase = (amount, cur) => {
      if (amount === null || amount === undefined) return null;
      if (!cur || cur === base) return amount;
      const r = fx[cur];
      return r ? amount * r : null;
    };

    // Agrupar por ticker (igual que groupByTicker en investments.js)
    const map = {};
    for (const inv of (s.investments || [])) {
      if (inv.isDeleted) continue;
      const trivial = inv.assetType === 'cdt' || inv.assetType === 'fund';
      const key = trivial && !inv.symbol ? inv.id : ((inv.symbol || inv.name) || inv.id || '').toUpperCase();
      if (!map[key]) map[key] = { key, symbol: inv.symbol, name: inv.name, assetType: inv.assetType, currency: inv.currency || base, purchases: [], sold: [] };
      if (inv.soldDate) map[key].sold.push(inv);
      else              map[key].purchases.push(inv);
      if (inv.name)      map[key].name     = inv.name;
      if (inv.assetType) map[key].assetType = inv.assetType;
      if (inv.currency)  map[key].currency  = inv.currency;
    }

    let totalValue = 0, totalCost = 0;
    for (const g of Object.values(map)) {
      if (!g.purchases.length) continue;
      const sorted   = [...g.purchases].sort((a, b) => (b.purchaseDate || '').localeCompare(a.purchaseDate || ''));
      const totalQty = g.purchases.reduce((acc, p) => acc + (Number(p.quantity) || 0), 0);
      const totalComm = g.purchases.reduce((acc, p) => acc + (Number(p.commission) || 0), 0);
      const gc = g.purchases.reduce((acc, p) => acc + (Number(p.quantity) || 0) * (Number(p.purchasePrice || p.avgCost) || 0), 0) + totalComm;
      const storedPrice = Number(sorted[0]?.currentPrice) || 0;

      // groupValue equivalente (igual prioridad de campos que investments.js)
      let value, hasPrice;
      if (g.assetType === 'cdt') {
        value = sorted[0] ? selectors.cdtCurrentValue(sorted[0]) : gc;
        hasPrice = true;
      } else if (g.assetType === 'fund') {
        const cv = sorted[0]?.currentValue || 0;
        value = cv || null;
        hasPrice = !!cv;
      } else {
        const lp    = priceService.priceFor((g.symbol || '').toUpperCase());
        const price = lp?.price || storedPrice || 0;
        value    = price ? totalQty * price : null;
        hasPrice = !!price;
      }

      const rawVal = hasPrice && value !== null ? value : gc;
      totalValue += toBase(rawVal, g.currency) ?? rawVal;
      totalCost  += toBase(gc,     g.currency) ?? gc;
    }

    const pTotal = roundMoney(totalValue, base);
    const cTotal = roundMoney(totalCost,  base);
    const gTotal = roundMoney(pTotal - cTotal, base);
    return { value: pTotal, cost: cTotal, gain: gTotal, returnPct: cTotal ? gTotal / cTotal * 100 : 0 };
  },

  // R4 helper: value in base currency of a single active investment position.
  // Mirrors investmentsValue logic (FIN-005/TD-02): returns null if the position's
  // foreign currency has no FX rate (cannot be valued without risking silent ×~4000 error).
  positionValue(inv, base) {
    if (!inv || inv.isDeleted || inv.soldDate) return null;
    const fx     = priceService.fxRates;
    const lp     = priceService.priceFor(inv.symbol);
    const price  = lp?.price || inv.currentPrice || 0;
    const native = inv.assetType === 'cdt'
      ? selectors.cdtCurrentValue(inv)
      : inv.currentValue || ((Number(inv.quantity) || 0) * price) || inv.costBasis || 0;
    if (!native) return null;
    const cur = inv.currency || base;
    if (cur === base) return native;
    if (!fx[cur]) return null;
    return native * fx[cur];
  },

  // R4 — portfolio alerts (I7a): deterministic rules, no AI.
  // Returns [{ type, severity, message, isApproximate?, inv? }].
  // Types: 'concentration' (>30%), 'maturity' (CDT≤30d), 'loss' (P&L<−20%), 'diversification' (1 ticker).
  portfolioAlerts(s) {
    const base   = s.baseCurrency || 'COP';
    const active = (s.investments || []).filter((i) => !i.isDeleted && !i.soldDate);
    if (!active.length) return [];

    const alerts = [];
    const total  = selectors.investmentsValue(s);

    // Sin diversificación: solo 1 ticker único activo
    const tickers = new Set(active.map((i) => (i.symbol || i.name || i.id || '').toUpperCase()));
    if (tickers.size === 1) {
      alerts.push({ type: 'diversification', severity: 'warning',
        message: 'Portafolio no diversificado: solo 1 activo activo.' });
    }

    const now = Date.now();
    for (const inv of active) {
      const name = inv.name || inv.symbol || inv.id || '?';

      // Concentración > 30%
      if (total > 0) {
        const val = selectors.positionValue(inv, base);
        if (val !== null) {
          const pct = (val / total) * 100;
          if (pct > 30) {
            alerts.push({
              type: 'concentration', severity: 'warning',
              message: `${name} concentra ${pct.toFixed(1)}% del portafolio (umbral: 30%)`,
              isApproximate: !priceService.priceFor(inv.symbol), inv,
            });
          }
        }
      }

      // CDT vence en ≤ 30 días
      if (inv.assetType === 'cdt' && inv.maturityDate) {
        const daysLeft = (new Date(inv.maturityDate).getTime() - now) / 86400000;
        if (daysLeft >= 0 && daysLeft <= 30) {
          const d = Math.ceil(daysLeft);
          alerts.push({
            type: 'maturity', severity: 'info',
            message: `CDT "${name}" vence en ${d} día${d === 1 ? '' : 's'}`,
            inv,
          });
        }
      }

      // P&L no realizado < −20% (en moneda nativa; porcentaje no requiere FX)
      const lp        = priceService.priceFor(inv.symbol);
      const px        = lp?.price || inv.currentPrice || 0;
      const curVal    = inv.currentValue || ((Number(inv.quantity) || 0) * px) || 0;
      const costBasis = (Number(inv.quantity) || 0) * (Number(inv.purchasePrice || inv.avgCost) || 0)
                      + (Number(inv.commission) || 0);
      if (costBasis > 0 && curVal > 0) {
        const pnlPct = ((curVal - costBasis) / costBasis) * 100;
        if (pnlPct < -20) {
          alerts.push({
            type: 'loss', severity: 'error',
            message: `${name}: P&L ${pnlPct.toFixed(1)}% (por debajo de −20%)`,
            isApproximate: !lp, inv,
          });
        }
      }
    }

    return alerts;
  },

  // Detecta si hay entidades con divisas distintas a baseCurrency (TD-02).
  // Úsalo para mostrar un aviso en la UI antes de implementar conversión FX.
  hasMixedCurrencies(s) {
    const base = s.baseCurrency;
    const currencies = [
      ...s.accounts.map((a) => a.currency),
      ...s.transactions.map((t) => t.currency),
      ...s.investments.map((i) => i.currency),
      ...s.assets.map((a) => a.currency),
      ...s.liabilities.map((l) => l.currency),
    ];
    return currencies.some((c) => c && c !== base);
  },
};
