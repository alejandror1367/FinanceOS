/**
 * Journal.gs — CRUD del diario financiero.
 * Reflexiones, decisiones, aprendizajes y objetivos.
 * FinanceOS · Fase 10.
 */

function listJournal_(p) {
  var rows = repoReadAll_('Journal');
  rows.sort(function (a, b) { return (a.date < b.date) ? 1 : (a.date > b.date ? -1 : 0); });
  return rows;
}

function createJournal_(d) {
  requireFields_(d, ['title']);
  if (d.category !== undefined && d.category !== '') requireEnum_(d.category, ENUMS.journalCategory, 'category');
  var dup = idempotentHit_('Journal', d.id);
  if (dup) return dup;
  var rec = repoCreate_('Journal', {
    id: d.id ? sanitizeString_(d.id, 40) : undefined,
    date: (d.date && isIsoDate_(d.date)) ? d.date : new Date().toISOString().slice(0, 10),
    category: d.category || 'reflection',
    title: sanitizeString_(d.title, 120),
    content: sanitizeString_(d.content || '', 4000),
  });
  logAudit_('create', 'Journal', rec.id, 'Entrada: ' + rec.title);
  return rec;
}

function updateJournal_(d) {
  requireFields_(d, ['id']);
  if (d.category !== undefined && d.category !== '') requireEnum_(d.category, ENUMS.journalCategory, 'category');
  var patch = {};
  if (d.date !== undefined) patch.date = d.date;
  if (d.category !== undefined) patch.category = d.category;
  if (d.title !== undefined) patch.title = sanitizeString_(d.title, 120);
  if (d.content !== undefined) patch.content = sanitizeString_(d.content, 4000);
  var rec = repoUpdate_('Journal', d.id, patch);
  logAudit_('update', 'Journal', rec.id, 'Entrada actualizada');
  return rec;
}

function deleteJournal_(d) {
  requireFields_(d, ['id']);
  repoSoftDelete_('Journal', d.id);
  logAudit_('delete', 'Journal', d.id, 'Entrada eliminada');
  return { id: d.id, deleted: true };
}
