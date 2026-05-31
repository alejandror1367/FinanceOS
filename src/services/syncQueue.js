// services/syncQueue.js — cola de operaciones offline persistida en IndexedDB.
// Cada operación: { seq(auto), action, entity, entityId, data, createdAt, attempts, lastError }
// Las acciones se ejecutan primero localmente (Optimistic UI) y se encolan
// para sincronizar con el backend cuando haya conexión.

import { db } from './db.js';

const STORE = 'syncQueue';

export const syncQueue = {
  async enqueue(op) {
    const record = {
      action: op.action,
      entity: op.entity,
      entityId: op.entityId || null,
      data: op.data || {},
      createdAt: new Date().toISOString(),
      attempts: 0,
      lastError: '',
    };
    await db.put(STORE, record); // seq autoincremental
    return record;
  },

  async all() {
    const ops = await db.getAll(STORE);
    return ops.sort((a, b) => a.seq - b.seq);
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

  count() {
    return db.count(STORE);
  },

  clear() {
    return db.clear(STORE);
  },
};
