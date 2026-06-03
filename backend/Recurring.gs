/**
 * Recurring.gs — CRUD de transacciones recurrentes (próximos pagos).
 * FinanceOS · Fase 2.
 */

function listRecurring_(p) {
  var rows = repoReadAll_('RecurringTransactions');
  if (p && (p.activeOnly === 'true' || p.activeOnly === true)) {
    rows = rows.filter(function (r) { return r.isActive === true; });
  }
  rows.sort(function (a, b) { return (a.nextRunDate < b.nextRunDate) ? -1 : 1; });
  return rows;
}

function createRecurring_(d) {
  requireFields_(d, ['type', 'amount', 'frequency', 'nextRunDate']);
  requireEnum_(d.type, ENUMS.txType, 'type');
  requireEnum_(d.frequency, ENUMS.frequency, 'frequency');
  if (!isIsoDate_(d.nextRunDate)) throw new Error('nextRunDate inválida (ISO 8601).');
  var dup = idempotentHit_('RecurringTransactions', d.id);
  if (dup) return dup;
  var rec = repoCreate_('RecurringTransactions', {
    id: d.id ? sanitizeString_(d.id, 40) : undefined,
    type: d.type,
    amount: toAmount_(d.amount, 'amount'),
    currency: sanitizeString_(d.currency || APP.baseCurrency, 3),
    accountId: sanitizeString_(d.accountId || '', 40),
    toAccountId: d.type === 'transfer' ? sanitizeString_(d.toAccountId || '', 40) : '',
    categoryId: d.type === 'transfer' ? '' : sanitizeString_(d.categoryId || '', 40),
    description: sanitizeString_(d.description || '', 240),
    frequency: d.frequency,
    nextRunDate: d.nextRunDate,
    isActive: d.isActive !== false,
  });
  logAudit_('create', 'RecurringTransactions', rec.id, 'Recurrente: ' + rec.description);
  return rec;
}

function updateRecurring_(d) {
  requireFields_(d, ['id']);
  if (d.type !== undefined) requireEnum_(d.type, ENUMS.txType, 'type');
  if (d.frequency !== undefined) requireEnum_(d.frequency, ENUMS.frequency, 'frequency');
  if (d.nextRunDate !== undefined && !isIsoDate_(d.nextRunDate)) {
    throw new Error('nextRunDate inválida (ISO 8601).');
  }
  var patch = {};
  if (d.type !== undefined) patch.type = d.type;
  if (d.amount !== undefined) patch.amount = toAmount_(d.amount, 'amount');
  if (d.currency !== undefined) patch.currency = sanitizeString_(d.currency, 3);
  if (d.accountId !== undefined) patch.accountId = sanitizeString_(d.accountId, 40);
  if (d.toAccountId !== undefined) patch.toAccountId = sanitizeString_(d.toAccountId, 40);
  if (d.categoryId !== undefined) patch.categoryId = sanitizeString_(d.categoryId, 40);
  if (d.description !== undefined) patch.description = sanitizeString_(d.description, 240);
  if (d.frequency !== undefined) patch.frequency = d.frequency;
  if (d.nextRunDate !== undefined) patch.nextRunDate = d.nextRunDate;
  if (d.isActive !== undefined) patch.isActive = d.isActive === true;
  var rec = repoUpdate_('RecurringTransactions', d.id, patch);
  logAudit_('update', 'RecurringTransactions', rec.id, 'Recurrente actualizado');
  return rec;
}

function deleteRecurring_(d) {
  requireFields_(d, ['id']);
  repoSoftDelete_('RecurringTransactions', d.id);
  logAudit_('delete', 'RecurringTransactions', d.id, 'Recurrente eliminado');
  return { id: d.id, deleted: true };
}
