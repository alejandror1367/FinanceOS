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

// A.2 (BE-003/TD-02): convierte un monto a moneda base usando el mapa de tasas FX.
// Devuelve null si la divisa es extranjera y no hay tasa — el caller debe EXCLUIR
// el monto y contarlo, nunca sumarlo 1:1 (error silencioso ×~4000 con USD→COP).
function toBaseOrNull_(amount, currency, base, fx) {
  var amt = Number(amount) || 0;
  var cur = String(currency || base).toUpperCase();
  if (cur === base) return amt;
  var rate = fx && fx[cur];
  return rate ? amt * rate : null;
}

// true si alguna entidad del contexto tiene divisa distinta a la base.
function hasForeignCurrency_(ctx, base) {
  var all = [].concat(ctx.accounts, ctx.investments, ctx.assets, ctx.liabilities);
  for (var i = 0; i < all.length; i++) {
    var cur = String(all[i].currency || base).toUpperCase();
    if (cur !== base) return true;
  }
  return false;
}

function computeNetWorth_(ctx) {
  // A.2 (BE-003/TD-02): tasas FX → COP desde Quotes.gs (caché ~1h en CacheService).
  // Solo se consultan si hay alguna entidad en divisa extranjera (evita latencia
  // de UrlFetchApp en el caso común todo-COP). Si falta la tasa de una divisa,
  // la entidad se EXCLUYE del total y se cuenta en fxExcludedCount — misma
  // política que el frontend (FIN-005: nunca sumar 1:1 silencioso).
  var base = String(getBaseCurrency_() || 'COP').toUpperCase();
  var fx = {};
  if (hasForeignCurrency_(ctx, base)) {
    try { fx = getFxRates_() || {}; } catch (e) { fx = {}; }
  }
  var fxExcludedCount = 0;
  // Suma montos convertidos a base; los que no tienen tasa se excluyen y cuentan.
  function sumBase_(arr, amountFn, currencyFn) {
    return arr.reduce(function (acc, x) {
      var v = toBaseOrNull_(amountFn(x), currencyFn(x), base, fx);
      if (v === null) { fxExcludedCount++; return acc; }
      return acc + v;
    }, 0);
  }

  // Excluye cuentas de inversión (TD-03) y tarjetas de crédito (son pasivos, no activos).
  var accountsValue = sumBase_(
    ctx.accounts.filter(function (a) { return a.type !== 'investment' && a.type !== 'credit_card'; }),
    function (a) { return a.balance; },
    function (a) { return a.currency; });

  // FIN-001 (TD-41): solo incluir lotes ACTIVOS (sin soldDate y sin isDeleted).
  // Antes sumaba quantity × currentPrice de todas las filas, incluyendo lotes vendidos
  // → patrimonio inflado vs. la vista de Inversiones del frontend.
  var activeInvestments = ctx.investments.filter(function (i) {
    return !i.soldDate && !i.isDeleted;
  });
  var investmentsValue = sumBase_(activeInvestments,
    function (i) { return (i.quantity || 0) * (i.currentPrice || 0); },
    function (i) { return i.currency; });

  // FIN-001: sumar comisión al cost de inversiones activas para paridad con
  // investmentsCost del frontend (que incluye commission desde Sprint 5).
  var investmentsCost = sumBase_(activeInvestments,
    function (i) { return (i.quantity || 0) * (i.avgCost || i.purchasePrice || 0) + (Number(i.commission) || 0); },
    function (i) { return i.currency; });

  var otherAssets = sumBase_(ctx.assets,
    function (a) { return a.value; },
    function (a) { return a.currency; });
  var totalAssets = accountsValue + investmentsValue + otherAssets;

  // FIN-014 (R0-A): paridad con selectors.js:131 — excluir liabilities de tipo
  // 'credit_card' para evitar doble conteo: las cuentas CC ya se capturan en ccDebt.
  var liabilitiesDebt = sumBase_(
    ctx.liabilities.filter(function (l) { return l.type !== 'credit_card'; }),
    function (l) { return l.balance; },
    function (l) { return l.currency; });

  var ccDebt = sumBase_(
    ctx.accounts.filter(function (a) { return a.type === 'credit_card' && !a.isArchived; }),
    function (a) { return Math.abs(a.balance || 0); },
    function (a) { return a.currency; });

  var totalLiabilities = liabilitiesDebt + ccDebt;

  // ⚠ requiere deploy — cambios en computeNetWorth_ (Sprint A.2: conversión FX).
  return {
    totalAssets: totalAssets,
    totalLiabilities: totalLiabilities,
    netWorth: totalAssets - totalLiabilities,
    investmentsValue: investmentsValue,
    investmentsCost: investmentsCost,
    accountsValue: accountsValue,
    otherAssets: otherAssets,
    ccDebt: ccDebt,             // suma de tarjetas de crédito (cuentas CC activas)
    liabilitiesDebt: liabilitiesDebt, // suma de pasivos normales (excluye type=credit_card)
    fxRates: fx,                // tasas aplicadas (vacío si todo está en base)
    // Eventos de exclusión por falta de tasa FX (una inversión sin tasa cuenta 2:
    // valor y costo). Es un flag de integridad: >0 → la cifra está incompleta.
    fxExcludedCount: fxExcludedCount,
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

  var liquidity = sum_(ctx.accounts.filter(function (a) { return a.type !== 'investment' && a.type !== 'credit_card'; }),
    function (a) { return a.balance; });

  var monthTx = ctx.transactions.filter(function (t) { return monthKey_(t.date) === mk; });
  var income = sum_(monthTx.filter(function (t) { return t.type === 'income'; }), function (t) { return t.amount; });
  var expense = sum_(monthTx.filter(function (t) { return t.type === 'expense'; }), function (t) { return t.amount; });
  var savings = income - expense;

  // FIN-001: reutilizar investmentsCost de computeNetWorth_ (ya filtra sold/deleted y suma comisión).
  var investmentsCost = nw.investmentsCost || 0;
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

/**
 * getBootstrap — TD-15: devuelve las 12 colecciones en UNA sola ejecución
 * (un único openById, memoizado en getDb_), en lugar de 12 invocaciones HTTP
 * separadas. Reduce latencia y cuota, y elimina la "estampida" de verificación
 * de token del cold start (BUG-C1) al hacer una sola request autenticada.
 * Reutiliza las mismas funciones list*_ que las acciones individuales para
 * mantener idénticos los filtros (cuentas archivadas, soft-deletes, etc.).
 * Las claves coinciden con ENTITIES del frontend (src/services/entities.js).
 *
 * BE-006 (TD-25): ventana de 24 meses en transacciones para evitar payloads
 * excesivos con años de historial. Historial completo sigue disponible vía
 * getTransactions sin parámetro since. La paginación por cursor queda pendiente
 * para un sprint posterior (L-effort, cambia el contrato del frontend).
 */
function getBootstrap_(p) {
  p = p || {};
  // Calcular el límite de 24 meses atrás como fecha ISO YYYY-MM-DD.
  var since24m = new Date();
  since24m.setMonth(since24m.getMonth() - 24);
  var sinceParam = since24m.toISOString().slice(0, 10);
  // Combinar con cualquier 'since' que venga del cliente (tomar el más restrictivo).
  var txParams = {};
  for (var k in p) { if (Object.prototype.hasOwnProperty.call(p, k)) txParams[k] = p[k]; }
  if (!txParams.since || txParams.since < sinceParam) txParams.since = sinceParam;
  return {
    accounts:          listAccounts_(p),
    transactions:      listTransactions_(txParams),
    categories:        listCategories_(p),
    budgets:           listBudgets_(p),
    goals:             listGoals_(p),
    investments:       listInvestments_(p),
    assets:            listAssets_(p),
    liabilities:       listLiabilities_(p),
    recurring:         listRecurring_(p),
    netWorthSnapshots: listNetWorthSnapshots_(p),
    journal:           listJournal_(p),
    settings:          listSettings_(p),
  };
}
