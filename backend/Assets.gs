/**
 * Assets.gs — CRUD de activos (componentes de patrimonio fuera de cuentas).
 * FinanceOS · Fase 2.
 */

function listAssets_(p) {
  return repoReadAll_('Assets');
}

function createAsset_(d) {
  requireFields_(d, ['name', 'value']);
  var dup = idempotentHit_('Assets', d.id);
  if (dup) return dup;
  var rec = repoCreate_('Assets', {
    id: d.id ? sanitizeString_(d.id, 40) : undefined,
    name: sanitizeString_(d.name, 80),
    category: sanitizeString_(d.category || '', 40),
    value: toAmount_(d.value, 'value'),
    currency: sanitizeString_(d.currency || APP.baseCurrency, 3),
  });
  logAudit_('create', 'Assets', rec.id, 'Activo: ' + rec.name);
  return rec;
}

function updateAsset_(d) {
  requireFields_(d, ['id']);
  var patch = {};
  if (d.name !== undefined) patch.name = sanitizeString_(d.name, 80);
  if (d.category !== undefined) patch.category = sanitizeString_(d.category, 40);
  if (d.value !== undefined) patch.value = toAmount_(d.value, 'value');
  if (d.currency !== undefined) patch.currency = sanitizeString_(d.currency, 3);
  var rec = repoUpdate_('Assets', d.id, patch);
  logAudit_('update', 'Assets', rec.id, 'Activo actualizado: ' + rec.name);
  return rec;
}

function deleteAsset_(d) {
  requireFields_(d, ['id']);
  repoSoftDelete_('Assets', d.id);
  logAudit_('delete', 'Assets', d.id, 'Activo eliminado');
  return { id: d.id, deleted: true };
}
