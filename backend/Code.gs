/**
 * Code.gs — punto de entrada del Web App y router por `action`.
 * FinanceOS · Fase 2.
 *
 * Lecturas  -> doGet(?action=...&...params)
 * Escrituras-> doPost(body JSON: { action, data })
 *
 * Respuesta estándar (docs/Architecture.md §7.2):
 *   { success: true,  data: {...} }
 *   { success: false, error: "..." }
 *
 * NOTA CORS (Fase 3): el frontend hará POST con content-type text/plain
 * para evitar el preflight; el cuerpo se lee de e.postData.contents.
 */

// Mapa de acciones -> función handler. Las funciones viven en los .gs por
// entidad y son globales, por lo que están disponibles al despachar.
var ROUTES = {
  // Dashboard / reportes
  getDashboard: function (p) { return getDashboard_(p); },
  getNetWorth: function (p) { return getNetWorth_(p); },
  getNetWorthSnapshots: function (p) { return listNetWorthSnapshots_(p); },
  saveNetWorthSnapshot: function (d) { return saveNetWorthSnapshot_(d); },
  deleteNetWorthSnapshot: function (d) { return deleteNetWorthSnapshot_(d); },
  getReports: function (p) { return getReports_(p); },
  getBootstrap: function (p) { return getBootstrap_(p); }, // TD-15: 12 colecciones en 1 request

  // Accounts
  getAccounts: function (p) { return listAccounts_(p); },
  createAccount: function (d) { return createAccount_(d); },
  updateAccount: function (d) { return updateAccount_(d); },
  deleteAccount: function (d) { return deleteAccount_(d); },

  // Transactions
  getTransactions: function (p) { return listTransactions_(p); },
  createTransaction: function (d) { return createTransaction_(d); },
  updateTransaction: function (d) { return updateTransaction_(d); },
  deleteTransaction: function (d) { return deleteTransaction_(d); },

  // Categories
  getCategories: function (p) { return listCategories_(p); },
  createCategory: function (d) { return createCategory_(d); },
  updateCategory: function (d) { return updateCategory_(d); },
  deleteCategory: function (d) { return deleteCategory_(d); },

  // Budgets
  getBudgets: function (p) { return listBudgets_(p); },
  createBudget: function (d) { return createBudget_(d); },
  updateBudget: function (d) { return updateBudget_(d); },
  deleteBudget: function (d) { return deleteBudget_(d); },

  // Goals
  getGoals: function (p) { return listGoals_(p); },
  createGoal: function (d) { return createGoal_(d); },
  updateGoal: function (d) { return updateGoal_(d); },
  deleteGoal: function (d) { return deleteGoal_(d); },

  // Investments
  getInvestments: function (p) { return listInvestments_(p); },
  createInvestment: function (d) { return createInvestment_(d); },
  updateInvestment: function (d) { return updateInvestment_(d); },
  deleteInvestment: function (d) { return deleteInvestment_(d); },

  // Assets
  getAssets: function (p) { return listAssets_(p); },
  createAsset: function (d) { return createAsset_(d); },
  updateAsset: function (d) { return updateAsset_(d); },
  deleteAsset: function (d) { return deleteAsset_(d); },

  // Liabilities
  getLiabilities: function (p) { return listLiabilities_(p); },
  createLiability: function (d) { return createLiability_(d); },
  updateLiability: function (d) { return updateLiability_(d); },
  deleteLiability: function (d) { return deleteLiability_(d); },

  // Recurring
  getRecurring: function (p) { return listRecurring_(p); },
  createRecurring: function (d) { return createRecurring_(d); },
  updateRecurring: function (d) { return updateRecurring_(d); },
  deleteRecurring: function (d) { return deleteRecurring_(d); },

  // Journal
  getJournal: function (p) { return listJournal_(p); },
  createJournal: function (d) { return createJournal_(d); },
  updateJournal: function (d) { return updateJournal_(d); },
  deleteJournal: function (d) { return deleteJournal_(d); },

  // Settings
  getSettings: function (p) { return listSettings_(p); },
  setSetting: function (d) { return setSetting_(d); },

  // Migración (TD-01)
  recalculateBalances: function (d) { return recalculateAccountBalances_(d); },

  // Cotizaciones en tiempo real (Yahoo Finance)
  getQuotes: function (p) { return getQuotes_(p); },

  // Import (proxy Gemini API)
  parseStatement: function (d) { return parseStatement_(d); },

  // TD-28: purga física de filas soft-deleted (acción de administración).
  purgeDeleted: function () { return purgeDeleted_(); },

  // TD-26: escritura por lotes — N ops en 1 request, reduciendo invocaciones para colas offline.
  // Formato: { ops: [{ action, data, entityId? }, ...] }. Devuelve { results: [...] }.
  batchWrite: function (d) {
    var ops = Array.isArray(d.ops) ? d.ops : [];
    var results = [];
    for (var i = 0; i < ops.length; i++) {
      var op = ops[i];
      var handler = ROUTES[op.action];
      if (!handler || READ_ACTIONS[op.action]) {
        results.push({ action: op.action, entityId: op.entityId, ok: false, error: 'Acción no permitida en batchWrite: ' + op.action });
        continue;
      }
      try {
        var result = handler(op.data || {});
        results.push({ action: op.action, entityId: op.entityId, ok: true, data: result });
      } catch (err) {
        results.push({ action: op.action, entityId: op.entityId, ok: false, error: err.message || String(err) });
      }
    }
    return { results: results };
  },

  // Meta
  ping: function () { return { pong: true, app: APP.name, apiVersion: APP.apiVersion, time: nowIso_() }; },
};

// Acciones permitidas vía GET (solo lectura).
var READ_ACTIONS = {
  getDashboard: 1, getNetWorth: 1, getNetWorthSnapshots: 1, getReports: 1,
  getBootstrap: 1,
  getAccounts: 1, getTransactions: 1, getCategories: 1, getBudgets: 1,
  getGoals: 1, getInvestments: 1, getAssets: 1, getLiabilities: 1,
  getRecurring: 1, getJournal: 1, getSettings: 1, getQuotes: 1, ping: 1,
};

function doGet(e) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    var action = params.action;
    if (!action) return jsonOut_({ success: true, data: ROUTES.ping() });
    assertAuthorized_(action, params.idToken);
    if (!READ_ACTIONS[action]) {
      throw new Error('Acción de solo lectura no válida en GET: ' + action);
    }
    return dispatch_(action, params);
  } catch (err) {
    return jsonErr_(err);
  }
}

// TD-27: LockService garantiza exclusión mutua en escrituras (multi-dispositivo / reintentos).
// El lock abarca toda la ejecución del handler para evitar carreras entre dispositivos.
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000); // espera hasta 30 s; lanza si no puede adquirir
  } catch (lockErr) {
    return jsonErr_(new Error('Servidor ocupado. Intenta de nuevo en unos segundos.'));
  }
  try {
    var body = parseBody_(e);
    var action = body.action;
    if (!action) throw new Error('Falta "action" en la solicitud.');
    assertAuthorized_(action, body.idToken);
    var handler = ROUTES[action];
    if (!handler) throw new Error('Acción desconocida: ' + action);
    var result = handler(body.data || {});
    return jsonOut_({ success: true, data: result });
  } catch (err) {
    return jsonErr_(err);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Autorización por Google ID Token (TD-09 opción C).
 * Toda acción (salvo "ping") requiere un id_token válido de patitosalmir@gmail.com.
 * La verificación se delega a verifyGoogleToken_() en Auth.gs.
 */
function assertAuthorized_(action, idToken) {
  if (action === 'ping') return;
  if (!verifyGoogleToken_(idToken)) {
    throw new Error('No autorizado.');
  }
}

function dispatch_(action, payload) {
  var handler = ROUTES[action];
  if (!handler) throw new Error('Acción desconocida: ' + action);
  var result = handler(payload || {});
  return jsonOut_({ success: true, data: result });
}

// ---------- Helpers de I/O ----------

function parseBody_(e) {
  if (e && e.postData && e.postData.contents) {
    try {
      return JSON.parse(e.postData.contents);
    } catch (err) {
      throw new Error('Cuerpo JSON inválido.');
    }
  }
  // Fallback: action/data por querystring (data como JSON string).
  if (e && e.parameter && e.parameter.action) {
    var data = {};
    if (e.parameter.data) {
      try { data = JSON.parse(e.parameter.data); } catch (x) { data = {}; }
    }
    return { action: e.parameter.action, data: data };
  }
  throw new Error('Solicitud vacía.');
}

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonErr_(err) {
  var msg = (err && err.message) ? err.message : String(err);
  return jsonOut_({ success: false, error: msg });
}
