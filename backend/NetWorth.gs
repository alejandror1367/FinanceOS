/**
 * NetWorth.gs — snapshots de patrimonio neto (histórico).
 * Un snapshot captura Activos/Pasivos/Patrimonio en una fecha.
 * FinanceOS · Fase 6.
 */

function listNetWorthSnapshots_(p) {
  return repoReadAll_('NetWorthSnapshots').sort(function (a, b) {
    return (a.date < b.date) ? -1 : (a.date > b.date ? 1 : 0);
  });
}

function deleteNetWorthSnapshot_(d) {
  requireFields_(d, ['id']);
  repoSoftDelete_('NetWorthSnapshots', d.id);
  logAudit_('delete', 'NetWorthSnapshots', d.id, 'Snapshot eliminado');
  return { id: d.id, deleted: true };
}

// Calcula el patrimonio actual y lo guarda como snapshot.
// Idempotente por fecha: si ya existe un snapshot de esa fecha, lo actualiza.
function saveNetWorthSnapshot_(d) {
  var ctx = loadContext_();
  var nw = computeNetWorth_(ctx);
  var date = (d && d.date) ? String(d.date).slice(0, 10) : new Date().toISOString().slice(0, 10);

  var existing = repoReadAll_('NetWorthSnapshots').filter(function (s) { return s.date === date; })[0];
  var payload = {
    date: date,
    totalAssets: nw.totalAssets,
    totalLiabilities: nw.totalLiabilities,
    netWorth: nw.netWorth,
    currency: getBaseCurrency_(),
  };

  var rec;
  if (existing) {
    rec = repoUpdate_('NetWorthSnapshots', existing.id, payload);
    logAudit_('update', 'NetWorthSnapshots', rec.id, 'Snapshot ' + date);
  } else {
    rec = repoCreate_('NetWorthSnapshots', payload);
    logAudit_('create', 'NetWorthSnapshots', rec.id, 'Snapshot ' + date);
  }
  return rec;
}
