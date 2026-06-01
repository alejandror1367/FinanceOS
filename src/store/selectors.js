// store/selectors.js — derivaciones financieras puras sobre el estado.
// Los valores derivados NO se persisten (docs/Database.md §5): se calculan aquí.

function sameMonth(iso, ref = new Date()) {
  const d = new Date(iso);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
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
    return s.accounts.filter((a) => !a.isArchived && a.type !== 'investment');
  },

  totalLiquidity(s) {
    return selectors.liquidAccounts(s).reduce((sum, a) => sum + (a.balance || 0), 0);
  },

  investmentsValue(s) {
    return s.investments.reduce((sum, i) => sum + (i.quantity || 0) * (i.currentPrice || 0), 0);
  },

  investmentsCost(s) {
    return s.investments.reduce((sum, i) => sum + (i.quantity || 0) * (i.avgCost || 0), 0);
  },

  investmentsReturnPct(s) {
    const cost = selectors.investmentsCost(s);
    if (!cost) return 0;
    return ((selectors.investmentsValue(s) - cost) / cost) * 100;
  },

  totalAssets(s) {
    const accountsValue = s.accounts.filter((a) => !a.isArchived).reduce((sum, a) => sum + (a.balance || 0), 0);
    const otherAssets = s.assets.reduce((sum, a) => sum + (a.value || 0), 0);
    return accountsValue + selectors.investmentsValue(s) + otherAssets;
  },

  totalLiabilities(s) {
    return s.liabilities.reduce((sum, l) => sum + (l.balance || 0), 0);
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
      .sort((a, b) => new Date(b.date) - new Date(a.date))
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

  // ---- Presupuestos (valores derivados, no persistidos) ----
  budgetConsumed(s, budget) {
    const isMonthly = budget.period === 'monthly';
    return s.transactions
      .filter((t) => {
        if (t.type !== 'expense' || t.categoryId !== budget.categoryId) return false;
        const key = isMonthly ? String(t.date).slice(0, 7) : String(t.date).slice(0, 4);
        return key === budget.periodKey;
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
    if (budget.period === 'monthly' && budget.periodKey === curMonthKey) {
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
};
