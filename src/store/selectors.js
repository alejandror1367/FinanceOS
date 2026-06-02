// store/selectors.js — derivaciones financieras sobre el estado.
// Los valores derivados NO se persisten (docs/Database.md §5): se calculan aquí.

import { priceService } from '../services/priceService.js';
import { roundMoney } from '../utils/format.js';

// Normalizes a periodKey that Google Sheets may auto-convert from 'YYYY-MM' to a Date object.
function normPeriodKey(raw, len) {
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
    const sum = s.investments.filter((i) => !i.isDeleted).reduce((acc, i) => {
      const lp    = priceService.priceFor(i.symbol);
      const price = lp?.price || i.currentPrice || 0;
      const native = (i.quantity || 0) * price;
      if (!native) return acc;
      const cur = i.currency || base;
      if (cur === base) return acc + native;
      return fx[cur] ? acc + native * fx[cur] : acc + native;
    }, 0);
    return roundMoney(sum, base);
  },

  investmentsCost(s) {
    const fx   = priceService.fxRates;
    const base = s.baseCurrency || 'COP';
    const sum = s.investments.filter((i) => !i.isDeleted).reduce((acc, i) => {
      const native = (i.quantity || 0) * (i.avgCost || i.purchasePrice || 0);
      if (!native) return acc;
      const cur = i.currency || base;
      if (cur === base) return acc + native;
      return fx[cur] ? acc + native * fx[cur] : acc + native;
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
    const fromLiabilities = s.liabilities.reduce((sum, l) => sum + (l.balance || 0), 0);
    // Las tarjetas de crédito registradas como cuentas también son pasivos.
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
    return s.transactions
      .filter((t) => t.type === 'expense' && sameMonth(t.date, ref))
      .reduce((sum, t) => sum + (t.amount || 0), 0);
  },

  monthlySavings(s, ref) {
    return selectors.monthlyIncome(s, ref) - selectors.monthlyExpense(s, ref);
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
    return [...s.recurring]
      .filter((r) => r.isActive)
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
    (s.liabilities || []).filter((l) => (l.balance || 0) > 0).forEach((l) => out.push({
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
  debtStats(s) {
    const list = selectors.debtList(s);
    const total = list.reduce((sum, d) => sum + d.balance, 0);
    const minPayment = list.reduce((sum, d) => sum + d.minPayment, 0);
    const weighted = list.reduce((sum, d) => sum + d.interestRate * d.balance, 0);
    const avgRate = total ? weighted / total : 0;
    return { total, minPayment, avgRate, count: list.length, list };
  },

  // Total adeudado solo en tarjetas (cuentas credit_card + Liabilities type credit_card).
  creditCardDebt(s) {
    const fromAccounts = selectors.creditCardAccounts(s)
      .reduce((sum, a) => sum + Math.abs(a.balance || 0), 0);
    const fromLiabilities = (s.liabilities || [])
      .filter((l) => l.type === 'credit_card' && (l.balance || 0) > 0)
      .reduce((sum, l) => sum + (l.balance || 0), 0);
    return fromAccounts + fromLiabilities;
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
    let projected = consumed;
    const now = new Date();
    const curMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (budget.period === 'monthly' && normPeriodKey(budget.periodKey, 7) === curMonthKey) {
      const day = now.getDate();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      projected = day > 0 ? (consumed / day) * daysInMonth : consumed;
    }
    return { amount, consumed, available, pct, projected };
  },

  // ---- Series temporales (Analítica) ----
  // Flujo de caja por mes (últimos n meses, incluye el actual).
  cashflow(s, n = 6) {
    const months = lastMonths(n);
    const acc = {};
    months.forEach((m) => { acc[m.key] = { key: m.key, label: m.label, income: 0, expense: 0 }; });
    for (const t of s.transactions) {
      const key = String(t.date).slice(0, 7);
      if (!acc[key]) continue;
      if (t.type === 'income') acc[key].income += t.amount || 0;
      else if (t.type === 'expense') acc[key].expense += t.amount || 0;
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
