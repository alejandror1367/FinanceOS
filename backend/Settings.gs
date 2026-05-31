/**
 * Settings.gs — configuración clave/valor.
 * FinanceOS · Fase 2.
 */

function listSettings_(p) {
  return repoReadAll_('Settings');
}

// Upsert por clave.
function setSetting_(d) {
  requireFields_(d, ['key']);
  var key = sanitizeString_(d.key, 60);
  var value = sanitizeString_(d.value !== undefined ? d.value : '', 240);
  var existing = repoReadAll_('Settings', true).filter(function (s) { return s.key === key && !s.isDeleted; })[0];
  var rec;
  if (existing) {
    rec = repoUpdate_('Settings', existing.id, { value: value });
  } else {
    rec = repoCreate_('Settings', { key: key, value: value });
  }
  logAudit_('update', 'Settings', rec.id, 'Setting ' + key + '=' + value);
  return rec;
}

function getBaseCurrency_() {
  try {
    var s = repoReadAll_('Settings').filter(function (x) { return x.key === 'baseCurrency'; })[0];
    return s ? s.value : APP.baseCurrency;
  } catch (e) {
    return APP.baseCurrency;
  }
}
