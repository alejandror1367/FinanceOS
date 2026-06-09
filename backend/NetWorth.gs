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
  // Soft delete: rápido (setValues de 1 fila, sin deleteRow ni shift). Funciona
  // porque NetWorthSnapshots ya tiene columna isDeleted; listNetWorthSnapshots_ /
  // repoReadAll_ filtran isDeleted=true por defecto. Limpieza física vía purgeDeleted.
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
    // R3: desglose enriquecido
    investmentsValue: nw.investmentsValue || 0,
    investmentsCost:  nw.investmentsCost  || 0,
    accountsValue:    nw.accountsValue    || 0,
    otherAssets:      nw.otherAssets      || 0,
    ccDebt:           nw.ccDebt           || 0,
    liabilitiesDebt:  nw.liabilitiesDebt  || 0,
  };

  var rec;
  if (existing) {
    rec = repoUpdate_('NetWorthSnapshots', existing.id, payload);
    logAudit_('update', 'NetWorthSnapshots', rec.id, 'Snapshot ' + date);
  } else {
    rec = repoCreate_('NetWorthSnapshots', payload);
    logAudit_('create', 'NetWorthSnapshots', rec.id, 'Snapshot ' + date);
  }
  // ⚠ requiere deploy — R3
  // Pasos tras deploy: 1) desplegar Config.gs + NetWorth.gs  2) ejecutar setupDatabase()
  // desde el editor Apps Script (añade columnas al sheet, idempotente).
  // Los snapshots anteriores quedarán con campos vacíos — el frontend los muestra con '—'.
  return rec;
}
