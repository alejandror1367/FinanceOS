/**
 * Setup.gs — inicialización de la base de datos (Google Sheets).
 * Ejecuta setupDatabase() UNA VEZ desde el editor de Apps Script.
 * FinanceOS · Fase 2.
 */

/**
 * Crea el spreadsheet FinanceOS_DB (si no existe), todas las hojas con sus
 * cabeceras y datos semilla (categorías + settings). Guarda el ID en
 * Script Properties para que el resto del backend lo use.
 */
function setupDatabase() {
  var props = PropertiesService.getScriptProperties();
  var existingId = props.getProperty(APP.propKeySpreadsheetId);
  var ss;

  if (existingId) {
    ss = SpreadsheetApp.openById(existingId);
    Logger.log('Usando spreadsheet existente: ' + existingId);
  } else {
    ss = SpreadsheetApp.create(APP.dbFileName);
    props.setProperty(APP.propKeySpreadsheetId, ss.getId());
    Logger.log('Spreadsheet creado: ' + ss.getId());
  }

  // Crear/asegurar cada hoja con sus cabeceras.
  SHEET_NAMES.forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    ensureHeaders_(sh, SCHEMAS[name]);
  });

  // Eliminar la hoja por defecto "Sheet1"/"Hoja 1" si quedó vacía.
  ['Sheet1', 'Hoja 1', 'Hoja1'].forEach(function (def) {
    var s = ss.getSheetByName(def);
    if (s && ss.getSheets().length > 1) ss.deleteSheet(s);
  });

  seedDefaults_();

  Logger.log('setupDatabase() completado. ID: ' + ss.getId());
  return { spreadsheetId: ss.getId(), url: ss.getUrl(), sheets: SHEET_NAMES };
}

function ensureHeaders_(sheet, schema) {
  var headers = schema.map(function (c) { return c.key; });
  var range = sheet.getRange(1, 1, 1, headers.length);
  range.setValues([headers]);
  range.setFontWeight('bold');
  sheet.setFrozenRows(1);
}

/**
 * Datos semilla idempotentes: categorías base y settings.
 * No duplica si ya existen.
 */
function seedDefaults_() {
  var cats = repoReadAll_('Categories', true);
  if (cats.length === 0) {
    var defaults = [
      { name: 'Salario', kind: 'income', color: 'emerald', icon: 'briefcase' },
      { name: 'Freelance', kind: 'income', color: 'emerald', icon: 'bolt' },
      { name: 'Restaurantes', kind: 'expense', color: 'champagne', icon: 'food' },
      { name: 'Mercado', kind: 'expense', color: 'periwinkle', icon: 'shopping' },
      { name: 'Arriendo', kind: 'expense', color: 'slate', icon: 'home' },
      { name: 'Transporte', kind: 'expense', color: 'periwinkle', icon: 'car' },
      { name: 'Suscripciones', kind: 'expense', color: 'red', icon: 'cloud' },
      { name: 'Otros', kind: 'expense', color: 'slate', icon: 'wallet' },
    ];
    defaults.forEach(function (c) {
      c.parentId = '';
      repoCreate_('Categories', c);
    });
    Logger.log('Categorías semilla creadas: ' + defaults.length);
  }

  var settings = repoReadAll_('Settings', true);
  if (settings.length === 0) {
    repoCreate_('Settings', { key: 'baseCurrency', value: APP.baseCurrency });
    repoCreate_('Settings', { key: 'apiVersion', value: APP.apiVersion });
    Logger.log('Settings semilla creados.');
  }
}

/**
 * Utilidad de mantenimiento: devuelve la URL del spreadsheet activo.
 */
function getDatabaseUrl() {
  return getDb_().getUrl();
}

/**
 * PELIGRO: borra el ID guardado (no borra el archivo). Para re-vincular.
 */
function resetDatabaseLink() {
  PropertiesService.getScriptProperties().deleteProperty(APP.propKeySpreadsheetId);
  Logger.log('Vínculo a la base de datos eliminado.');
}
