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
  var rec = repoCreate_('Accounts', {
    name: sanitizeString_(d.name, 80),
    type: d.type,
    currency: sanitizeString_(d.currency || APP.baseCurrency, 3),
    balance: toAmount_(d.balance || 0, 'balance'),
    institution: sanitizeString_(d.institution || '', 80),
    isArchived: d.isArchived === true,
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
  if (d.balance !== undefined) patch.balance = toAmount_(d.balance, 'balance');
  if (d.institution !== undefined) patch.institution = sanitizeString_(d.institution, 80);
  if (d.isArchived !== undefined) patch.isArchived = d.isArchived === true;
  var rec = repoUpdate_('Accounts', d.id, patch);
  logAudit_('update', 'Accounts', rec.id, 'Cuenta actualizada: ' + rec.name);
  return rec;
}

function deleteAccount_(d) {
  requireFields_(d, ['id']);
  var rec = repoSoftDelete_('Accounts', d.id);
  logAudit_('delete', 'Accounts', d.id, 'Cuenta eliminada: ' + (rec.name || d.id));
  return { id: d.id, deleted: true };
}

// ── Modelo híbrido de saldos (TD-01) ─────────────────────────────────────────

// Suma delta al saldo de una cuenta. Llamado por applyTxBalanceDelta_.
function adjustBalance_(accountId, delta) {
  if (!accountId || !delta || delta === 0) return;
  var account = repoGet_('Accounts', accountId);
  if (!account || account.isDeleted) return;
  repoUpdate_('Accounts', accountId, { balance: Math.round((account.balance || 0) + delta) });
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
