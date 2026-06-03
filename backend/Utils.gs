/**
 * Utils.gs — utilidades transversales: acceso a Sheets, repositorio genérico,
 * mapeo fila<->objeto, validación, sanitización, ids y timestamps.
 * FinanceOS · Fase 2.
 */

// ---------- Spreadsheet ----------

function getSpreadsheetId_() {
  var id = PropertiesService.getScriptProperties().getProperty(APP.propKeySpreadsheetId);
  if (!id) {
    throw new Error('Base de datos no inicializada. Ejecuta setupDatabase() primero.');
  }
  return id;
}

var _db;
function getDb_() {
  return _db || (_db = SpreadsheetApp.openById(getSpreadsheetId_()));
}

function getSheet_(name) {
  var sh = getDb_().getSheetByName(name);
  if (!sh) throw new Error('Hoja inexistente: ' + name);
  return sh;
}

// ---------- IDs y tiempo ----------

var ULID_ENCODING_ = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function newId_() {
  var t = Date.now();
  var timeChars = '';
  for (var i = 0; i < 10; i++) {
    timeChars = ULID_ENCODING_.charAt(t % 32) + timeChars;
    t = Math.floor(t / 32);
  }
  var rand = '';
  for (var j = 0; j < 16; j++) {
    rand += ULID_ENCODING_.charAt(Math.floor(Math.random() * 32));
  }
  return timeChars + rand;
}

function nowIso_() {
  return new Date().toISOString();
}

// ---------- Mapeo fila <-> objeto ----------

function coerce_(value, type) {
  if (value === '' || value === null || value === undefined) {
    if (type === 'n') return 0;
    if (type === 'b') return false;
    return '';
  }
  if (type === 'n') return Number(value) || 0;
  if (type === 'b') return value === true || value === 'true' || value === 'TRUE';
  if (type === 'd' || type === 'ts') {
    if (value instanceof Date) return value.toISOString();
    return String(value);
  }
  return String(value);
}

function toRow_(schema, obj) {
  return schema.map(function (col) {
    var v = obj[col.key];
    if (v === undefined || v === null) {
      return col.type === 'n' ? 0 : (col.type === 'b' ? false : '');
    }
    return v;
  });
}

function rowToObject_(schema, headers, row) {
  var obj = {};
  for (var c = 0; c < headers.length; c++) {
    var col = schema[c] || { key: headers[c], type: 's' };
    obj[col.key] = coerce_(row[c], col.type);
  }
  return obj;
}

// ---------- Repositorio genérico ----------

// TD-25: usa rango explícito en lugar de getDataRange() para saltar la fila de
// cabecera y leer solo las columnas definidas en el schema (más rápido en tablas grandes).
function repoReadAll_(entity, includeDeleted) {
  var schema = SCHEMAS[entity];
  var sh = getSheet_(entity);
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  var rows = sh.getRange(2, 1, lastRow - 1, schema.length).getValues();
  var out = [];
  for (var r = 0; r < rows.length; r++) {
    var obj = {};
    for (var c = 0; c < schema.length; c++) {
      obj[schema[c].key] = coerce_(rows[r][c], schema[c].type);
    }
    if (!includeDeleted && obj.isDeleted === true) continue;
    out.push(obj);
  }
  return out;
}

function repoFindRowIndex_(entity, id) {
  var sh = getSheet_(entity);
  var last = sh.getLastRow();
  if (last < 2) return -1;
  var ids = sh.getRange(1, 1, last, 1).getValues(); // col 1 = id
  for (var r = 1; r < ids.length; r++) {
    if (String(ids[r][0]) === String(id)) return r + 1; // fila 1-based
  }
  return -1;
}

function repoGet_(entity, id) {
  var rows = repoReadAll_(entity, true);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].id) === String(id)) return rows[i];
  }
  return null;
}

function repoCreate_(entity, data) {
  var schema = SCHEMAS[entity];
  var sh = getSheet_(entity);
  var ts = nowIso_();
  var record = {};
  schema.forEach(function (col) {
    if (data[col.key] !== undefined) record[col.key] = data[col.key];
  });
  record.id = record.id || newId_();
  if (hasKey_(schema, 'isDeleted')) record.isDeleted = false;
  if (hasKey_(schema, 'createdAt')) record.createdAt = ts;
  if (hasKey_(schema, 'updatedAt')) record.updatedAt = ts;
  sh.appendRow(toRow_(schema, record));
  // Devuelve el record ya construido en memoria; evita releer la hoja completa (TD-05).
  return record;
}

// TD-24: lee la fila directamente por índice tras localizarla; evita el segundo O(n)
// de repoGet_ (que relería toda la hoja con getDataRange).
function repoUpdate_(entity, id, patch) {
  var schema = SCHEMAS[entity];
  var sh = getSheet_(entity);
  var rowIndex = repoFindRowIndex_(entity, id);
  if (rowIndex < 0) throw new Error(entity + ' no encontrado: ' + id);
  // Lectura puntual: 1 fila × schema.length columnas (1 operación Sheets, no O(n)).
  var rawRow = sh.getRange(rowIndex, 1, 1, schema.length).getValues()[0];
  var current = {};
  for (var c = 0; c < schema.length; c++) {
    current[schema[c].key] = coerce_(rawRow[c], schema[c].type);
  }
  schema.forEach(function (col) {
    if (patch[col.key] !== undefined && col.key !== 'id' && col.key !== 'createdAt') {
      current[col.key] = patch[col.key];
    }
  });
  if (hasKey_(schema, 'updatedAt')) current.updatedAt = nowIso_();
  sh.getRange(rowIndex, 1, 1, schema.length).setValues([toRow_(schema, current)]);
  return current;
}

function repoSoftDelete_(entity, id) {
  return repoUpdate_(entity, id, { isDeleted: true });
}

// Idempotencia de creación: si ya existe un registro con ese id (reintento de
// sync, o una referencia creada en el mismo lote offline), devuelve el existente;
// si no, null. Cada create* lo usa para early-return ANTES de sus efectos
// secundarios (logAudit_, ajuste de saldos) y, junto con preservar el id del
// cliente (ULID) en repoCreate_, evita filas duplicadas y referencias colgadas.
// repoFindRowIndex_ solo lee la columna id → no encarece el create común.
//
// BE-001 (TD-45): si el registro encontrado está marcado como soft-deleted, lo
// tratamos como NO-hit para que el create real continúe y aplique los efectos
// secundarios (ajuste de saldo, auditLog). Devolver el registro borrado causaría
// un fantasma sin saldo aplicado → elegimos continuar al create como si no existiera.
function idempotentHit_(entity, id) {
  if (!id) return null;
  if (repoFindRowIndex_(entity, id) <= 0) return null;
  var hit = repoGet_(entity, id);
  if (hit && hit.isDeleted === true) return null;
  return hit;
}

function hasKey_(schema, key) {
  return schema.some(function (c) { return c.key === key; });
}

// TD-28: elimina físicamente las filas marcadas como isDeleted en todas las entidades.
// Se llama vía acción admin 'purgeDeleted' (solo escrituras POST autorizadas).
function purgeDeleted_() {
  var entities = Object.keys(SCHEMAS);
  var summary = {};
  entities.forEach(function (entity) {
    var schema = SCHEMAS[entity];
    if (!hasKey_(schema, 'isDeleted')) return;
    var sh = getSheet_(entity);
    var lastRow = sh.getLastRow();
    if (lastRow < 2) return;
    // Recorre en orden inverso para no desplazar índices al borrar filas.
    var rows = sh.getRange(2, 1, lastRow - 1, schema.length).getValues();
    var deleted = 0;
    for (var r = rows.length - 1; r >= 0; r--) {
      var obj = {};
      for (var c = 0; c < schema.length; c++) {
        obj[schema[c].key] = coerce_(rows[r][c], schema[c].type);
      }
      if (obj.isDeleted === true) {
        sh.deleteRow(r + 2); // +2: fila 1 = cabecera, índice 0-based → 1-based
        deleted++;
      }
    }
    if (deleted > 0) summary[entity] = deleted;
  });
  return { purged: summary };
}

// ---------- Validación / sanitización ----------

function sanitizeString_(value, maxLen) {
  if (value === undefined || value === null) return '';
  // Elimina caracteres de control (0x00-0x1F y 0x7F) y recorta longitud.
  var s = String(value).replace(/[\x00-\x1F\x7F]/g, '').trim();
  return maxLen ? s.slice(0, maxLen) : s.slice(0, 500);
}

function requireFields_(data, fields) {
  fields.forEach(function (f) {
    if (data[f] === undefined || data[f] === null || data[f] === '') {
      throw new Error('Campo requerido: ' + f);
    }
  });
}

function requireEnum_(value, allowed, field) {
  if (allowed.indexOf(value) < 0) {
    throw new Error('Valor invalido para ' + field + ': ' + value);
  }
}

function toAmount_(value, field) {
  var n = Number(value);
  if (isNaN(n)) throw new Error('Monto invalido en ' + field);
  if (n < 0) throw new Error('El monto no puede ser negativo en ' + field);
  return n;
}

function isIsoDate_(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value);
}
