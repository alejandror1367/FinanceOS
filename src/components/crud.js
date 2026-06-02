// components/crud.js — helpers para operaciones CRUD en vistas.
// TD-19: extrae el patrón repetido en ~11 vistas (try/catch/toast).

import { toast } from '../services/toast.js';

/**
 * Envuelve la operación `op` con manejo uniforme de errores.
 * Para manejadores de `onConfirm` en confirmDialog (fire-and-forget).
 * @param {() => Promise<any>} op
 * @param {string} [successMsg] — toast verde al éxito
 * @param {string} [errorMsg]   — prefijo del toast rojo; se antepone al mensaje del error
 */
export async function guardedOp(op, successMsg = '', errorMsg = 'Error') {
  try {
    await op();
    if (successMsg) toast(successMsg);
  } catch (e) {
    toast(e?.message || errorMsg, { type: 'negative' });
  }
}

/**
 * Versión para manejadores de `onSave` en modales: devuelve true/false para
 * controlar si el modal se cierra (false mantiene el modal abierto).
 * @param {() => Promise<any>} op
 * @param {string} [successMsg]
 * @param {string} [errorMsg]
 * @returns {Promise<boolean>}
 */
export async function guardedSave(op, successMsg = '', errorMsg = 'Error al guardar') {
  try {
    await op();
    if (successMsg) toast(successMsg);
    return true;
  } catch (e) {
    toast(e?.message || errorMsg, { type: 'negative' });
    return false;
  }
}
