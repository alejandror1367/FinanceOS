/**
 * Liabilities.gs — CRUD de pasivos/deudas.
 * Estrategias Snowball/Avalanche se calculan en Reports (fase de módulo).
 * FinanceOS · Fase 2.
 */

function listLiabilities_(p) {
  return repoReadAll_('Liabilities');
}

function createLiability_(d) {
  requireFields_(d, ['name', 'balance']);
  if (d.dueDate !== undefined && d.dueDate !== '' && !isIsoDate_(d.dueDate)) {
    throw new Error('dueDate inválida (ISO 8601).');
  }
  var dup = idempotentHit_('Liabilities', d.id);
  if (dup) return dup;
  var rec = repoCreate_('Liabilities', {
    id: d.id ? sanitizeString_(d.id, 40) : undefined,
    name: sanitizeString_(d.name, 80),
    type: sanitizeString_(d.type || '', 40),
    balance: toAmount_(d.balance, 'balance'),
    interestRate: Number(d.interestRate) || 0,
    minimumPayment: toAmount_(d.minimumPayment || 0, 'minimumPayment'),
    dueDate: d.dueDate || '',
    currency: sanitizeString_(d.currency || APP.baseCurrency, 3),
  });
  logAudit_('create', 'Liabilities', rec.id, 'Deuda: ' + rec.name);
  return rec;
}

function updateLiability_(d) {
  requireFields_(d, ['id']);
  var patch = {};
  if (d.name !== undefined) patch.name = sanitizeString_(d.name, 80);
  if (d.type !== undefined) patch.type = sanitizeString_(d.type, 40);
  if (d.balance !== undefined) patch.balance = toAmount_(d.balance, 'balance');
  if (d.interestRate !== undefined) patch.interestRate = Number(d.interestRate) || 0;
  if (d.minimumPayment !== undefined) patch.minimumPayment = toAmount_(d.minimumPayment, 'minimumPayment');
  if (d.dueDate !== undefined) patch.dueDate = d.dueDate;
  if (d.currency !== undefined) patch.currency = sanitizeString_(d.currency, 3);
  var rec = repoUpdate_('Liabilities', d.id, patch);
  logAudit_('update', 'Liabilities', rec.id, 'Deuda actualizada: ' + rec.name);
  return rec;
}

function deleteLiability_(d) {
  requireFields_(d, ['id']);
  repoSoftDelete_('Liabilities', d.id);
  logAudit_('delete', 'Liabilities', d.id, 'Deuda eliminada');
  return { id: d.id, deleted: true };
}
