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
// d puede incluir valores del frontend (que tiene precios en vivo vía priceService);
// se usan si vienen, y se cae en la computación del backend como fallback.
function saveNetWorthSnapshot_(d) {
  var ctx = loadContext_();
  var nw = computeNetWorth_(ctx);
  var date = (d && d.date) ? String(d.date).slice(0, 10) : new Date().toISOString().slice(0, 10);

  // Frontend values take precedence: Apps Script no puede consultar Yahoo Finance,
  // así que currentPrice en Sheets es stale y lleva a investmentsValue ≈ 0.
  var investmentsValue = (d && d.investmentsValue != null) ? Number(d.investmentsValue) : nw.investmentsValue;
  var accountsValue    = (d && d.accountsValue    != null) ? Number(d.accountsValue)    : nw.accountsValue;
  var otherAssets      = (d && d.otherAssets      != null) ? Number(d.otherAssets)      : nw.otherAssets;
  var ccDebt           = (d && d.ccDebt           != null) ? Number(d.ccDebt)           : nw.ccDebt;
  var liabilitiesDebt  = (d && d.liabilitiesDebt  != null) ? Number(d.liabilitiesDebt)  : nw.liabilitiesDebt;
  var totalAssets      = accountsValue + investmentsValue + otherAssets;
  var totalLiabilities = ccDebt + liabilitiesDebt;
  var netWorth         = totalAssets - totalLiabilities;

  // Sheets auto-convierte 'YYYY-MM-DD' a Date object; coerce_ lo devuelve como ISO completo.
  // Comparar solo los primeros 10 chars para que la idempotencia por fecha funcione.
  var existing = repoReadAll_('NetWorthSnapshots').filter(function (s) { return String(s.date).slice(0, 10) === date; })[0];
  var payload = {
    date:             date,
    totalAssets:      totalAssets,
    totalLiabilities: totalLiabilities,
    netWorth:         netWorth,
    currency:         getBaseCurrency_(),
    investmentsValue: investmentsValue,
    investmentsCost:  nw.investmentsCost || 0,
    accountsValue:    accountsValue,
    otherAssets:      otherAssets,
    ccDebt:           ccDebt,
    liabilitiesDebt:  liabilitiesDebt,
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
