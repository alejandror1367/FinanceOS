// services/recurringService.js — ejecución automática de transacciones recurrentes.
// TD-39: al cargar la app, materializa los recurrentes vencidos (nextRunDate <= hoy)
// como transacciones reales y avanza nextRunDate. 100% client-side, offline-first, sin
// deploy de backend. Idempotente: cada ocurrencia usa un id determinista
// `rec_{recurringId}_{fecha}`, así re-ejecutar (mismo día, otro dispositivo) NO duplica
// (createTransaction_ deduplica por id vía idempotentHit_).

import { store } from '../store/store.js';
import { dataService } from './dataService.js';
import { toast } from './toast.js';

const MAX_CATCHUP = 60; // tope de ocurrencias atrasadas por recurrente (evita bucles)

function todayKey() { return new Date().toISOString().slice(0, 10); }

// Parsea 'YYYY-MM-DD' como fecha LOCAL (evita el desfase de zona horaria de Date(ISO)).
function parseLocal(dateStr) {
  const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
function fmtLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Avanza una fecha 'YYYY-MM-DD' según la frecuencia. En monthly/yearly conserva el día
// del mes pero lo topa al último día del mes destino (31 ene + 1 mes → 28/29 feb, sin
// desbordar a marzo). daily/weekly suman días fijos.
export function nextRunFrom(dateStr, frequency) {
  const d = parseLocal(dateStr);
  if (frequency === 'daily')  { d.setDate(d.getDate() + 1); return fmtLocal(d); }
  if (frequency === 'weekly') { d.setDate(d.getDate() + 7); return fmtLocal(d); }
  const day = d.getDate();
  if (frequency === 'yearly') d.setFullYear(d.getFullYear() + 1, d.getMonth(), 1);
  else                        d.setMonth(d.getMonth() + 1, 1); // monthly por defecto
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return fmtLocal(d);
}

// Función PURA (testeable): dadas un recurrente y la fecha de hoy, calcula las fechas
// de ejecución vencidas y el nuevo nextRunDate. No produce efectos.
export function dueRuns(rec, todayStr, cap = MAX_CATCHUP) {
  if (!rec || rec.isActive === false || !rec.nextRunDate) {
    return { runs: [], nextRunDate: rec && rec.nextRunDate };
  }
  const runs = [];
  let cursor = String(rec.nextRunDate).slice(0, 10);
  let i = 0;
  while (cursor <= todayStr && i < cap) {
    runs.push(cursor);
    cursor = nextRunFrom(cursor, rec.frequency || 'monthly');
    i++;
  }
  return { runs, nextRunDate: cursor };
}

// Materializa los recurrentes vencidos: crea las transacciones (optimistic + cola de
// sync) y avanza nextRunDate. Pensado para llamarse una vez al cargar la app.
export async function runDueRecurring() {
  const s = store.get();
  const todayStr = todayKey();
  let created = 0;

  for (const rec of (s.recurring || [])) {
    const { runs, nextRunDate } = dueRuns(rec, todayStr);
    if (!runs.length) continue;
    try {
      for (const runDate of runs) {
        const tx = {
          id: `rec_${rec.id}_${runDate}`, // determinista → idempotente FE/BE
          type: rec.type,
          amount: rec.amount,
          date: runDate,
          accountId: rec.accountId,
          currency: rec.currency || s.baseCurrency || 'COP',
          description: rec.description || 'Recurrente',
        };
        if (rec.type === 'transfer') tx.toAccountId = rec.toAccountId;
        else tx.categoryId = rec.categoryId || '';
        await dataService.create('transactions', tx);
        created++;
      }
      // Solo se avanza tras crear todas las ocurrencias del recurrente.
      await dataService.update('recurring', rec.id, { nextRunDate });
    } catch (e) {
      // Si falla una ocurrencia, NO avanzamos nextRunDate → se reintenta en la próxima
      // carga (los ids deterministas evitan duplicar las ya creadas). Cortamos aquí.
      break;
    }
  }

  if (created > 0) {
    toast(`${created} ${created > 1 ? 'transacciones recurrentes generadas' : 'transacción recurrente generada'}`, { type: 'info' });
  }
  return created;
}
