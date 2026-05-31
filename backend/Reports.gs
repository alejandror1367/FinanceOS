/**
 * Reports.gs — agregaciones y valores derivados (no persistidos).
 * Replica la lógica de los selectores del frontend en el servidor.
 * FinanceOS · Fase 2.
 */

function monthKey_(isoDate) {
  return String(isoDate || '').slice(0, 7); // YYYY-MM
}

function currentMonthKey_() {
  var d = new Date();
  var m = (d.getMonth() + 1);
  return d.getFullYear() + '-' + (m < 10 ? '0' + m : '' + m);
}

function sum_(arr, fn) {
  return arr.reduce(function (acc, x) { return acc + (fn(x) || 0); }, 0);
}

function computeNetWorth_(ctx) {
  var accountsValue = sum_(ctx.accounts, function (a) { return a.balance; });
  var investmentsValue = sum_(ctx.investments, function (i) { return i.quantity * i.currentPrice; });
  var otherAssets = sum_(ctx.assets, function (a) { return a.value; });
  var totalAssets = accountsValue + investmentsValue + otherAssets;
  var totalLiabilities = sum_(ctx.liabilities, function (l) { return l.balance; });
  return {
    totalAssets: totalAssets,
    totalLiabilities: totalLiabilities,
    netWorth: totalAssets - totalLiabilities,
    investmentsValue: investmentsValue,
    accountsValue: accountsValue,
    otherAssets: otherAssets,
  };
}

function loadContext_() {
  return {
    accounts: repoReadAll_('Accounts').filter(function (a) { return a.isArchived !== true; }),
    transactions: repoReadAll_('Transactions'),
    investments: repoReadAll_('Investments'),
    assets: repoReadAll_('Assets'),
    liabilities: repoReadAll_('Liabilities'),
    goals: repoReadAll_('Goals'),
    recurring: repoReadAll_('RecurringTransactions'),
    categories: repoReadAll_('Categories'),
  };
}

function getNetWorth_(p) {
  var ctx = loadContext_();
  var nw = computeNetWorth_(ctx);
  nw.currency = getBaseCurrency_();
  nw.snapshots = repoReadAll_('NetWorthSnapshots');
  return nw;
}

function getDashboard_(p) {
  var ctx = loadContext_();
  var cur = getBaseCurrency_();
  var mk = currentMonthKey_();

  var nw = computeNetWorth_(ctx);

  var liquidity = sum_(ctx.accounts.filter(function (a) { return a.type !== 'investment'; }),
    function (a) { return a.balance; });

  var monthTx = ctx.transactions.filter(function (t) { return monthKey_(t.date) === mk; });
  var income = sum_(monthTx.filter(function (t) { return t.type === 'income'; }), function (t) { return t.amount; });
  var expense = sum_(monthTx.filter(function (t) { return t.type === 'expense'; }), function (t) { return t.amount; });
  var savings = income - expense;

  var investmentsCost = sum_(ctx.investments, function (i) { return i.quantity * i.avgCost; });
  var investmentsReturnPct = investmentsCost ? ((nw.investmentsValue - investmentsCost) / investmentsCost) * 100 : 0;

  var recent = ctx.transactions.slice().sort(function (a, b) {
    return (a.date < b.date) ? 1 : (a.date > b.date ? -1 : 0);
  }).slice(0, 8);

  var activeGoals = ctx.goals.filter(function (g) { return g.status === 'active'; });

  var upcoming = ctx.recurring.filter(function (r) { return r.isActive === true; })
    .sort(function (a, b) { return (a.nextRunDate < b.nextRunDate) ? -1 : 1; })
    .slice(0, 5);

  // Gasto por categoría (mes actual)
  var byCatMap = {};
  monthTx.forEach(function (t) {
    if (t.type !== 'expense') return;
    byCatMap[t.categoryId] = (byCatMap[t.categoryId] || 0) + t.amount;
  });
  var catIndex = {};
  ctx.categories.forEach(function (c) { catIndex[c.id] = c; });
  var expenseByCategory = Object.keys(byCatMap).map(function (cid) {
    return { categoryId: cid, category: catIndex[cid] || null, amount: byCatMap[cid] };
  }).sort(function (a, b) { return b.amount - a.amount; });

  return {
    currency: cur,
    month: mk,
    netWorth: nw.netWorth,
    totalAssets: nw.totalAssets,
    totalLiabilities: nw.totalLiabilities,
    liquidity: liquidity,
    investmentsValue: nw.investmentsValue,
    investmentsReturnPct: investmentsReturnPct,
    monthlyIncome: income,
    monthlyExpense: expense,
    monthlySavings: savings,
    savingsRate: income ? (savings / income) * 100 : 0,
    recentTransactions: recent,
    activeGoals: activeGoals,
    upcomingPayments: upcoming,
    expenseByCategory: expenseByCategory,
    counts: {
      accounts: ctx.accounts.length,
      transactions: ctx.transactions.length,
      goals: activeGoals.length,
    },
  };
}

function getReports_(p) {
  // Punto de extensión para reportes específicos en fases de módulo.
  return { available: ['getDashboard', 'getNetWorth'], note: 'Reportes avanzados en fases posteriores.' };
}
