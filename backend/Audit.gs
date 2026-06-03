/**
 * Audit.gs — bitácora de operaciones de escritura (AuditLog).
 * Toda creación/edición/borrado debe registrarse (docs/Database.md §5).
 * FinanceOS · Fase 2.
 */

function logAudit_(action, entity, entityId, summary) {
  try {
    var ts = nowIso_();
    repoCreate_('AuditLog', {
      timestamp: ts,
      action: action,
      entity: entity,
      entityId: entityId,
      summary: sanitizeString_(summary, 240),
    });
  } catch (err) {
    // La auditoría no debe tumbar la operación principal; se registra en log.
    Logger.log('AuditLog error: ' + err.message);
  }
}

/**
 * truncateAuditLog_ — BE-008 (TD-05, TD-28)
 * Elimina entradas del AuditLog con más de 90 días de antigüedad.
 * AuditLog no tiene isDeleted, por lo que no lo cubre purgeDeleted_.
 * Reconstruye la hoja en bloque (clearContent + setValues) para evitar
 * timeouts con deleteRow en bucle.
 *
 * Expuesta como acción admin 'truncateAuditLog' en Code.gs.
 *
 * @returns {number} Número de entradas eliminadas.
 */
function truncateAuditLog_() {
  var schema = SCHEMAS['AuditLog'];
  var sh = getSheet_('AuditLog');
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return 0;

  // Cutoff: fecha ISO de hace 90 días (solo YYYY-MM-DD para comparación lexicográfica).
  var cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Índice de la columna 'timestamp' en el schema.
  var tsIdx = -1;
  for (var k = 0; k < schema.length; k++) {
    if (schema[k].key === 'timestamp' || schema[k].key === 'createdAt') {
      tsIdx = k;
      break;
    }
  }
  if (tsIdx < 0) return 0; // schema inesperado; no purgar.

  var rows = sh.getRange(2, 1, lastRow - 1, schema.length).getValues();
  var live = rows.filter(function (row) {
    var ts = String(row[tsIdx] || '').slice(0, 10);
    return ts >= cutoff; // conservar entradas dentro del período de retención
  });
  var removed = rows.length - live.length;
  if (removed === 0) return 0;

  // Reescribir la hoja en bloque: clear del rango original + setValues de las vivas.
  sh.getRange(2, 1, lastRow - 1, schema.length).clearContent();
  if (live.length > 0) {
    sh.getRange(2, 1, live.length, schema.length).setValues(live);
  }
  repoCacheInvalidate_('AuditLog');
  Logger.log('truncateAuditLog_: eliminadas ' + removed + ' entradas anteriores a ' + cutoff);
  return removed;
}
