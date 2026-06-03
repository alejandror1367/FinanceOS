/**
 * Categories.gs — CRUD de categorías.
 * FinanceOS · Fase 2.
 */

function listCategories_(p) {
  var rows = repoReadAll_('Categories');
  if (p && p.kind) return rows.filter(function (c) { return c.kind === p.kind; });
  return rows;
}

function createCategory_(d) {
  requireFields_(d, ['name', 'kind']);
  requireEnum_(d.kind, ENUMS.categoryKind, 'kind');
  // Preserva el id (ULID) del cliente e idempotencia (ver idempotentHit_): evita
  // "Categoría inexistente" cuando una transacción/presupuesto offline la
  // referencia antes de sincronizar, y evita duplicados en reintentos.
  var dup = idempotentHit_('Categories', d.id);
  if (dup) return dup;
  var rec = repoCreate_('Categories', {
    id: d.id ? sanitizeString_(d.id, 40) : undefined,
    name: sanitizeString_(d.name, 60),
    kind: d.kind,
    parentId: sanitizeString_(d.parentId || '', 40),
    color: sanitizeString_(d.color || 'slate', 20),
    icon: sanitizeString_(d.icon || 'shopping', 30),
  });
  logAudit_('create', 'Categories', rec.id, 'Categoría: ' + rec.name);
  return rec;
}

function updateCategory_(d) {
  requireFields_(d, ['id']);
  if (d.kind !== undefined) requireEnum_(d.kind, ENUMS.categoryKind, 'kind');
  var patch = {};
  if (d.name !== undefined) patch.name = sanitizeString_(d.name, 60);
  if (d.kind !== undefined) patch.kind = d.kind;
  if (d.parentId !== undefined) patch.parentId = sanitizeString_(d.parentId, 40);
  if (d.color !== undefined) patch.color = sanitizeString_(d.color, 20);
  if (d.icon !== undefined) patch.icon = sanitizeString_(d.icon, 30);
  var rec = repoUpdate_('Categories', d.id, patch);
  logAudit_('update', 'Categories', rec.id, 'Categoría actualizada: ' + rec.name);
  return rec;
}

function deleteCategory_(d) {
  requireFields_(d, ['id']);
  repoSoftDelete_('Categories', d.id);
  logAudit_('delete', 'Categories', d.id, 'Categoría eliminada');
  return { id: d.id, deleted: true };
}
