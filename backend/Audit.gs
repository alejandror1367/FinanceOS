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
