/**
 * Budgets.gs — CRUD de presupuestos.
 * Consumido/disponible/proyectado se calculan en Reports, no se persisten.
 * FinanceOS · Fase 2.
 */

function listBudgets_(p) {
  var rows = repoReadAll_('Budgets');
  if (p && p.periodKey) return rows.filter(function (b) { return b.periodKey === p.periodKey; });
  return rows;
}

function createBudget_(d) {
  requireFields_(d, ['categoryId', 'period', 'periodKey', 'amount']);
  requireEnum_(d.period, ENUMS.budgetPeriod, 'period');
  var cat = repoGet_('Categories', d.categoryId);
  if (!cat || cat.isDeleted) throw new Error('Categoría inexistente: ' + d.categoryId);
  var dup = idempotentHit_('Budgets', d.id);
  if (dup) return dup;
  var rec = repoCreate_('Budgets', {
    id: d.id ? sanitizeString_(d.id, 40) : undefined,
    categoryId: d.categoryId,
    period: d.period,
    periodKey: sanitizeString_(d.periodKey, 7),
    amount: toAmount_(d.amount, 'amount'),
    currency: sanitizeString_(d.currency || APP.baseCurrency, 3),
  });
  logAudit_('create', 'Budgets', rec.id, 'Presupuesto ' + rec.period + ' ' + rec.periodKey);
  return rec;
}

function updateBudget_(d) {
  requireFields_(d, ['id']);
  if (d.period !== undefined) requireEnum_(d.period, ENUMS.budgetPeriod, 'period');
  var patch = {};
  if (d.categoryId !== undefined) patch.categoryId = d.categoryId;
  if (d.period !== undefined) patch.period = d.period;
  if (d.periodKey !== undefined) patch.periodKey = sanitizeString_(d.periodKey, 7);
  if (d.amount !== undefined) patch.amount = toAmount_(d.amount, 'amount');
  if (d.currency !== undefined) patch.currency = sanitizeString_(d.currency, 3);
  var rec = repoUpdate_('Budgets', d.id, patch);
  logAudit_('update', 'Budgets', rec.id, 'Presupuesto actualizado');
  return rec;
}

function deleteBudget_(d) {
  requireFields_(d, ['id']);
  repoSoftDelete_('Budgets', d.id);
  logAudit_('delete', 'Budgets', d.id, 'Presupuesto eliminado');
  return { id: d.id, deleted: true };
}
