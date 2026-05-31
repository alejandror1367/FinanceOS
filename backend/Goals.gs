/**
 * Goals.gs — CRUD de metas financieras.
 * Avance/tiempo estimado/aporte recomendado se calculan en Reports.
 * FinanceOS · Fase 2.
 */

function listGoals_(p) {
  var rows = repoReadAll_('Goals');
  if (p && p.status) return rows.filter(function (g) { return g.status === p.status; });
  return rows;
}

function createGoal_(d) {
  requireFields_(d, ['name', 'targetAmount']);
  if (d.status !== undefined) requireEnum_(d.status, ENUMS.goalStatus, 'status');
  if (d.targetDate !== undefined && d.targetDate !== '' && !isIsoDate_(d.targetDate)) {
    throw new Error('targetDate inválida (ISO 8601).');
  }
  var rec = repoCreate_('Goals', {
    name: sanitizeString_(d.name, 80),
    type: sanitizeString_(d.type || 'other', 30),
    targetAmount: toAmount_(d.targetAmount, 'targetAmount'),
    currentAmount: toAmount_(d.currentAmount || 0, 'currentAmount'),
    currency: sanitizeString_(d.currency || APP.baseCurrency, 3),
    targetDate: d.targetDate || '',
    linkedAccountId: sanitizeString_(d.linkedAccountId || '', 40),
    status: d.status || 'active',
  });
  logAudit_('create', 'Goals', rec.id, 'Meta: ' + rec.name);
  return rec;
}

function updateGoal_(d) {
  requireFields_(d, ['id']);
  if (d.status !== undefined) requireEnum_(d.status, ENUMS.goalStatus, 'status');
  var patch = {};
  if (d.name !== undefined) patch.name = sanitizeString_(d.name, 80);
  if (d.type !== undefined) patch.type = sanitizeString_(d.type, 30);
  if (d.targetAmount !== undefined) patch.targetAmount = toAmount_(d.targetAmount, 'targetAmount');
  if (d.currentAmount !== undefined) patch.currentAmount = toAmount_(d.currentAmount, 'currentAmount');
  if (d.currency !== undefined) patch.currency = sanitizeString_(d.currency, 3);
  if (d.targetDate !== undefined) patch.targetDate = d.targetDate;
  if (d.linkedAccountId !== undefined) patch.linkedAccountId = sanitizeString_(d.linkedAccountId, 40);
  if (d.status !== undefined) patch.status = d.status;
  var rec = repoUpdate_('Goals', d.id, patch);
  logAudit_('update', 'Goals', rec.id, 'Meta actualizada: ' + rec.name);
  return rec;
}

function deleteGoal_(d) {
  requireFields_(d, ['id']);
  repoSoftDelete_('Goals', d.id);
  logAudit_('delete', 'Goals', d.id, 'Meta eliminada');
  return { id: d.id, deleted: true };
}
