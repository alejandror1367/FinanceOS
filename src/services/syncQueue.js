// services/syncQueue.js — cola de operaciones offline persistida en IndexedDB.
// Cada operación: { seq(auto), action, entity, entityId, data, createdAt, attempts, lastError }
// Las acciones se ejecutan primero localmente (Optimistic UI) y se encolan
// para sincronizar con el backend cuando haya conexión.

import { db } from './db.js';

const STORE = 'syncQueue';

export const syncQueue = {
  // Construye el registro de cola (sin persistir). Compartido por enqueue() y por
  // la escritura atómica dato+cola de dataService (TD-14), para una forma única.
  makeRecord(op) {
    return {
      action: op.action,
      entity: op.entity,
      entityId: op.entityId || null,
      data: op.data || {},
      createdAt: new Date().toISOString(),
      attempts: 0,
      lastError: '',
      dead: false, // TD-10: true = en dead-letter (no se reintenta ni bloquea la cola)
    };
  },

  async enqueue(op) {
    const record = this.makeRecord(op);
    await db.put(STORE, record); // seq autoincremental
    return record;
  },

  // Cola ACTIVA (excluye dead-letter): la que flush() procesa y reconcileAndHydrate reaplica.
  async all() {
    const ops = await db.getAll(STORE);
    return ops.filter((o) => !o.dead).sort((a, b) => a.seq - b.seq);
  },

  // TD-10: operaciones que agotaron reintentos o fallaron por error de negocio (4xx).
  async deadLetters() {
    const ops = await db.getAll(STORE);
    return ops.filter((o) => o.dead).sort((a, b) => a.seq - b.seq);
  },

  async remove(seq) {
    return db.delete(STORE, seq);
  },

  async update(seq, patch) {
    const current = await db.get(STORE, seq);
    if (!current) return null;
    const next = { ...current, ...patch };
    await db.put(STORE, next);
    return next;
  },

  // TD-10: mueve una op a dead-letter. Deja de reintentarse y no bloquea la cola;
  // queda visible en Ajustes para reintentar o descartar.
  markDead(seq, error) {
    return this.update(seq, { dead: true, lastError: String(error || ''), failedAt: new Date().toISOString() });
  },

  // Re-encola una op de dead-letter para volver a intentarla desde cero.
  requeue(seq) {
    return this.update(seq, { dead: false, attempts: 0, lastError: '' });
  },

  discard(seq) {
    return db.delete(STORE, seq);
  },

  // Cuenta solo operaciones ACTIVAS (pendientes), excluyendo dead-letter.
  async count() {
    const ops = await db.getAll(STORE);
    return ops.filter((o) => !o.dead).length;
  },

  async deadCount() {
    const ops = await db.getAll(STORE);
    return ops.filter((o) => o.dead).length;
  },

  clear() {
    return db.clear(STORE);
  },
};
