/**
 * Transactions.gs — CRUD de transacciones con reglas de negocio.
 * Reglas (docs/Database.md §5):
 *  - transfer: requiere accountId y toAccountId distintos; sin categoryId.
 *  - income/expense: requieren categoryId cuyo kind coincida con el tipo.
 *  - amount >= 0; el signo lo determina el tipo.
 * FinanceOS · Fase 2.
 */

function listTransactions_(p) {
  var rows = repoReadAll_('Transactions');
  // Orden descendente por fecha.
  rows.sort(function (a, b) { return (a.date < b.date) ? 1 : (a.date > b.date ? -1 : 0); });
  if (p && p.limit) return rows.slice(0, Number(p.limit) || rows.length);
  return rows;
}

function validateTransaction_(d, isUpdate) {
  if (!isUpdate || d.type !== undefined) requireEnum_(d.type, ENUMS.txType, 'type');

  if (d.type === 'transfer') {
    requireFields_(d, ['accountId', 'toAccountId']);
    if (String(d.accountId) === String(d.toAccountId)) {
      throw new Error('Una transferencia requiere cuentas distintas.');
    }
  } else if (d.type === 'income' || d.type === 'expense') {
    requireFields_(d, ['accountId', 'categoryId']);
    var cat = repoGet_('Categories', d.categoryId);
    if (!cat || cat.isDeleted) throw new Error('Categoría inexistente: ' + d.categoryId);
    if (cat.kind !== d.type) {
      throw new Error('La categoría (' + cat.kind + ') no coincide con el tipo ' + d.type + '.');
    }
  }

  if (d.date !== undefined && !isIsoDate_(d.date)) {
    throw new Error('Fecha inválida (se espera ISO 8601).');
  }
}

function createTransaction_(d) {
  requireFields_(d, ['type', 'date', 'amount', 'accountId']);
  validateTransaction_(d, false);
  var rec = repoCreate_('Transactions', {
    type: d.type,
    date: d.date,
    amount: toAmount_(d.amount, 'amount'),
    currency: sanitizeString_(d.currency || APP.baseCurrency, 3),
    accountId: d.accountId,
    toAccountId: d.type === 'transfer' ? d.toAccountId : '',
    categoryId: d.type === 'transfer' ? '' : d.categoryId,
    description: sanitizeString_(d.description || '', 240),
    status: 'synced',
  });
  logAudit_('create', 'Transactions', rec.id, rec.type + ' ' + rec.amount + ' ' + rec.currency);
  return rec;
}

function updateTransaction_(d) {
  requireFields_(d, ['id']);
  var existing = repoGet_('Transactions', d.id);
  if (!existing || existing.isDeleted) throw new Error('Transacción inexistente: ' + d.id);
  // Mezcla para validar el resultado final.
  var merged = {
    type: d.type !== undefined ? d.type : existing.type,
    date: d.date !== undefined ? d.date : existing.date,
    accountId: d.accountId !== undefined ? d.accountId : existing.accountId,
    toAccountId: d.toAccountId !== undefined ? d.toAccountId : existing.toAccountId,
    categoryId: d.categoryId !== undefined ? d.categoryId : existing.categoryId,
  };
  validateTransaction_(merged, false);

  var patch = {};
  if (d.type !== undefined) patch.type = d.type;
  if (d.date !== undefined) patch.date = d.date;
  if (d.amount !== undefined) patch.amount = toAmount_(d.amount, 'amount');
  if (d.currency !== undefined) patch.currency = sanitizeString_(d.currency, 3);
  if (d.accountId !== undefined) patch.accountId = d.accountId;
  patch.toAccountId = merged.type === 'transfer' ? merged.toAccountId : '';
  patch.categoryId = merged.type === 'transfer' ? '' : merged.categoryId;
  if (d.description !== undefined) patch.description = sanitizeString_(d.description, 240);

  var rec = repoUpdate_('Transactions', d.id, patch);
  logAudit_('update', 'Transactions', rec.id, 'Transacción actualizada');
  return rec;
}

function deleteTransaction_(d) {
  requireFields_(d, ['id']);
  repoSoftDelete_('Transactions', d.id);
  logAudit_('delete', 'Transactions', d.id, 'Transacción eliminada');
  return { id: d.id, deleted: true };
}
