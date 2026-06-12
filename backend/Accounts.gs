/**
 * Accounts.gs — CRUD de cuentas.
 * FinanceOS · Fase 2.
 */

function listAccounts_(p) {
  var rows = repoReadAll_('Accounts');
  if (p && (p.includeArchived === 'true' || p.includeArchived === true)) return rows;
  return rows.filter(function (a) { return a.isArchived !== true; });
}

function createAccount_(d) {
  requireFields_(d, ['name', 'type']);
  requireEnum_(d.type, ENUMS.accountType, 'type');
  // Preserva el id (ULID) del cliente e idempotencia (ver idempotentHit_): evita
  // que un broker creado inline quede con la referencia colgada y que un reintento
  // de sync duplique la cuenta.
  var dup = idempotentHit_('Accounts', d.id);
  if (dup) return dup;
  var rec = repoCreate_('Accounts', {
    id: d.id ? sanitizeString_(d.id, 40) : undefined,
    name: sanitizeString_(d.name, 80),
    type: d.type,
    currency: sanitizeString_(d.currency || APP.baseCurrency, 3),
    balance: toSignedAmount_(d.balance || 0, 'balance'),
    institution: sanitizeString_(d.institution || '', 80),
    isArchived: d.isArchived === true,
    creditLimit:  toAmount_(d.creditLimit  || 0, 'creditLimit'),
    interestRate: toAmount_(d.interestRate || 0, 'interestRate'),
    cutoffDay:    toAmount_(d.cutoffDay    || 0, 'cutoffDay'),
    paymentDay:   toAmount_(d.paymentDay   || 0, 'paymentDay'),
    minPayment:   toAmount_(d.minPayment   || 0, 'minPayment'),
    totalDue:     toAmount_(d.totalDue     || 0, 'totalDue'),
    subtype:      validateSubtype_(d.subtype),
  });
  logAudit_('create', 'Accounts', rec.id, 'Cuenta creada: ' + rec.name);
  return rec;
}

function updateAccount_(d) {
  requireFields_(d, ['id']);
  if (d.type !== undefined) requireEnum_(d.type, ENUMS.accountType, 'type');
  var patch = {};
  if (d.name !== undefined) patch.name = sanitizeString_(d.name, 80);
  if (d.type !== undefined) patch.type = d.type;
  if (d.currency !== undefined) patch.currency = sanitizeString_(d.currency, 3);
  if (d.balance !== undefined) patch.balance = toSignedAmount_(d.balance, 'balance');
  if (d.institution !== undefined) patch.institution = sanitizeString_(d.institution, 80);
  if (d.isArchived    !== undefined) patch.isArchived    = d.isArchived === true;
  if (d.creditLimit   !== undefined) patch.creditLimit   = toAmount_(d.creditLimit,  'creditLimit');
  if (d.interestRate  !== undefined) patch.interestRate  = toAmount_(d.interestRate, 'interestRate');
  if (d.cutoffDay     !== undefined) patch.cutoffDay     = toAmount_(d.cutoffDay,    'cutoffDay');
  if (d.paymentDay    !== undefined) patch.paymentDay    = toAmount_(d.paymentDay,   'paymentDay');
  if (d.minPayment    !== undefined) patch.minPayment    = toAmount_(d.minPayment,   'minPayment');
  if (d.totalDue      !== undefined) patch.totalDue      = toAmount_(d.totalDue,     'totalDue');
  if (d.subtype       !== undefined) patch.subtype       = validateSubtype_(d.subtype);
  var rec = repoUpdate_('Accounts', d.id, patch);
  logAudit_('update', 'Accounts', rec.id, 'Cuenta actualizada: ' + rec.name);
  return rec;
}

// Subtipos permitidos de cuenta. 'cesantias' (fondo bloqueado, p. ej. Porvenir):
// el saldo NO cuenta en liquidez pero SÍ en patrimonio (lógica en el frontend).
function validateSubtype_(v) {
  var s = sanitizeString_(v || '', 30).toLowerCase();
  if (!s) return '';
  if (['cesantias'].indexOf(s) === -1) throw new Error('Subtipo de cuenta inválido: ' + s);
  return s;
}

function deleteAccount_(d) {
  requireFields_(d, ['id']);
  var rec = repoSoftDelete_('Accounts', d.id);
  logAudit_('delete', 'Accounts', d.id, 'Cuenta eliminada: ' + (rec.name || d.id));
  return { id: d.id, deleted: true };
}

// ── Modelo híbrido de saldos (TD-01) ─────────────────────────────────────────

// Suma delta al saldo de una cuenta. Llamado por applyTxBalanceDelta_.
// BE-005: repoGet_ usa repoReadAll_ que ya está cacheado; la primera lectura de
// Accounts en el request es la única que va a Sheets. Tras la escritura, repoUpdate_
// invalida la caché para que lecturas posteriores de Accounts vean el saldo actualizado.
function adjustBalance_(accountId, delta) {
  if (!accountId || !delta || delta === 0) return;
  var account = repoGet_('Accounts', accountId);
  if (!account || account.isDeleted) return;
  // BE-013 (TD-22): redondeo según divisa — COP/CLP/JPY sin decimales; resto con 2.
  var cur = String(account.currency || APP.baseCurrency || 'COP').toUpperCase();
  var noCents = ['COP', 'CLP', 'JPY', 'KRW', 'VND', 'IDR'];
  var decimals = noCents.indexOf(cur) !== -1 ? 0 : 2;
  var factor   = Math.pow(10, decimals);
  var newBalance = Math.round(((account.balance || 0) + delta) * factor) / factor;
  repoUpdate_('Accounts', accountId, { balance: newBalance });
}

// Aplica (+1) o revierte (-1) el efecto contable de una transacción en los saldos.
// Llamado desde Transactions.gs al crear, editar y borrar transacciones.
function applyTxBalanceDelta_(tx, sign) {
  if (!tx || !tx.amount || !tx.type) return;
  var amt = tx.amount || 0;
  if (tx.type === 'income') {
    adjustBalance_(tx.accountId, sign * amt);
  } else if (tx.type === 'expense') {
    adjustBalance_(tx.accountId, -(sign * amt));
  } else if (tx.type === 'transfer') {
    adjustBalance_(tx.accountId, -(sign * amt));
    if (tx.toAccountId) adjustBalance_(tx.toAccountId, sign * amt);
  }
}
