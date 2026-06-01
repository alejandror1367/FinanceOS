// views/exports.js — Exportaciones y Backups.
// CSV por colección, respaldo JSON completo y resúmenes imprimibles (PDF).

import { el } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { store } from '../store/store.js';
import { selectors } from '../store/selectors.js';
import { formatMoney, formatDate } from '../utils/format.js';
import { Card, Button } from '../components/ui.js';
import { downloadFile, toCSV, stamp, printHTML } from '../utils/export.js';
import { toast } from '../services/toast.js';

const COLLECTIONS = [
  { key: 'transactions', label: 'Transacciones' },
  { key: 'accounts', label: 'Cuentas' },
  { key: 'categories', label: 'Categorías' },
  { key: 'budgets', label: 'Presupuestos' },
  { key: 'goals', label: 'Metas' },
  { key: 'investments', label: 'Inversiones' },
  { key: 'assets', label: 'Activos' },
  { key: 'liabilities', label: 'Pasivos' },
  { key: 'recurring', label: 'Recurrentes' },
  { key: 'journal', label: 'Diario' },
];

const now = new Date();
const curMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function exportCSV(key, label) {
  const rows = store.get()[key] || [];
  if (!rows.length) { toast(`Sin datos en ${label}`, { type: 'warning' }); return; }
  downloadFile(`financeos-${key}-${stamp()}.csv`, toCSV(rows), 'text/csv');
  toast(`${label} exportado (CSV)`);
}

function exportBackup() {
  const s = store.get();
  const backup = { app: 'FinanceOS', exportedAt: new Date().toISOString(), baseCurrency: s.baseCurrency, data: {} };
  COLLECTIONS.forEach(({ key }) => { backup.data[key] = s[key] || []; });
  backup.data.netWorthSnapshots = s.netWorthSnapshots || [];
  downloadFile(`financeos-backup-${stamp()}.json`, JSON.stringify(backup, null, 2), 'application/json');
  toast('Respaldo descargado (JSON)');
}

// ---------- Reportes imprimibles ----------
const reportStyles = `
  <style>
    .rep { font-family: Inter, system-ui, sans-serif; color:#111; max-width:720px; margin:0 auto; }
    .rep h1 { font-size:24px; margin:0 0 4px; }
    .rep h2 { font-size:15px; margin:24px 0 8px; border-bottom:1px solid #ddd; padding-bottom:4px; }
    .rep .muted { color:#666; font-size:13px; }
    .rep table { width:100%; border-collapse:collapse; font-size:13px; margin-top:6px; }
    .rep th, .rep td { text-align:left; padding:6px 4px; border-bottom:1px solid #eee; }
    .rep td.num, .rep th.num { text-align:right; font-variant-numeric:tabular-nums; }
    .rep .kpis { display:flex; gap:16px; flex-wrap:wrap; margin-top:8px; }
    .rep .kpi { flex:1; min-width:130px; border:1px solid #eee; border-radius:8px; padding:10px 12px; }
    .rep .kpi b { display:block; font-size:18px; }
  </style>`;

function monthlyReport(s) {
  const cur = s.baseCurrency;
  const income = selectors.monthlyIncome(s);
  const expense = selectors.monthlyExpense(s);
  const savings = income - expense;
  const rate = income ? (savings / income) * 100 : 0;
  const byCat = selectors.categorySpend(s, curMonthKey).slice(0, 10);
  const catRows = byCat.map((c) => `<tr><td>${c.category ? c.category.name : 'Sin categoría'}</td><td class="num">${formatMoney(c.amount, cur)}</td></tr>`).join('');
  const accRows = (s.accounts || []).filter((a) => !a.isArchived)
    .map((a) => `<tr><td>${a.name}</td><td class="num">${formatMoney(a.balance, a.currency || cur)}</td></tr>`).join('');

  return `${reportStyles}<div class="rep">
    <h1>Resumen mensual</h1>
    <div class="muted">${MONTHS[now.getMonth()]} ${now.getFullYear()} · ${s.user} · Generado ${formatDate(new Date().toISOString(), 'long')}</div>
    <div class="kpis">
      <div class="kpi">Ingresos<b>${formatMoney(income, cur)}</b></div>
      <div class="kpi">Gastos<b>${formatMoney(expense, cur)}</b></div>
      <div class="kpi">Ahorro<b>${formatMoney(savings, cur)}</b></div>
      <div class="kpi">Tasa de ahorro<b>${rate.toFixed(1)}%</b></div>
    </div>
    <h2>Gastos por categoría</h2>
    <table><thead><tr><th>Categoría</th><th class="num">Monto</th></tr></thead><tbody>${catRows || '<tr><td>—</td><td class="num">0</td></tr>'}</tbody></table>
    <h2>Cuentas</h2>
    <table><thead><tr><th>Cuenta</th><th class="num">Saldo</th></tr></thead><tbody>${accRows}</tbody></table>
  </div>`;
}

function netWorthStatement(s) {
  const cur = s.baseCurrency;
  const accountsValue = (s.accounts || []).filter((a) => !a.isArchived).reduce((sum, a) => sum + (a.balance || 0), 0);
  const invValue = selectors.investmentsValue(s);
  const otherAssets = (s.assets || []).reduce((sum, a) => sum + (a.value || 0), 0);
  const totalAssets = selectors.totalAssets(s);
  const totalLiab = selectors.totalLiabilities(s);
  const netWorth = totalAssets - totalLiab;
  const liabRows = (s.liabilities || []).map((l) => `<tr><td>${l.name}</td><td class="num">${formatMoney(l.balance, l.currency || cur)}</td></tr>`).join('');

  return `${reportStyles}<div class="rep">
    <h1>Estado patrimonial</h1>
    <div class="muted">${s.user} · Generado ${formatDate(new Date().toISOString(), 'long')}</div>
    <div class="kpis">
      <div class="kpi">Activos<b>${formatMoney(totalAssets, cur)}</b></div>
      <div class="kpi">Pasivos<b>${formatMoney(totalLiab, cur)}</b></div>
      <div class="kpi">Patrimonio neto<b>${formatMoney(netWorth, cur)}</b></div>
    </div>
    <h2>Activos</h2>
    <table><tbody>
      <tr><td>Cuentas</td><td class="num">${formatMoney(accountsValue, cur)}</td></tr>
      <tr><td>Inversiones</td><td class="num">${formatMoney(invValue, cur)}</td></tr>
      <tr><td>Otros activos</td><td class="num">${formatMoney(otherAssets, cur)}</td></tr>
    </tbody></table>
    <h2>Pasivos</h2>
    <table><tbody>${liabRows || '<tr><td>Sin deudas</td><td class="num">0</td></tr>'}</tbody></table>
  </div>`;
}

function tile(iconName, label, onClick) {
  return el('button', { class: 'btn btn--ghost', type: 'button', style: { justifyContent: 'flex-start', width: '100%' }, on: { click: onClick } }, [
    el('span', { html: icon(iconName) }), el('span', { text: label }),
  ]);
}

export function renderExports() {
  const csvCard = Card({
    title: 'Exportar a CSV',
    body: el('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' } },
      COLLECTIONS.map((c) => tile('exports', c.label, () => exportCSV(c.key, c.label)))),
  });

  const backupCard = Card({
    title: 'Respaldo completo',
    body: el('div', {}, [
      el('p', { class: 't-caption text-secondary', text: 'Descarga todos tus datos en un único archivo JSON (útil para conservar o migrar).' }),
      el('div', { class: 'mt-4' }, [Button('Descargar respaldo (JSON)', { variant: 'primary', iconName: 'exports', onClick: exportBackup })]),
    ]),
  });

  const reportCard = Card({
    title: 'Resúmenes (PDF)',
    body: el('div', {}, [
      el('p', { class: 't-caption text-secondary', text: 'Genera un resumen imprimible. En el diálogo de impresión elige “Guardar como PDF”.' }),
      el('div', { class: 'row-flex mt-4', style: { flexWrap: 'wrap' } }, [
        Button('Resumen mensual', { variant: 'ghost', iconName: 'journal', onClick: () => printHTML(monthlyReport(store.get())) }),
        Button('Estado patrimonial', { variant: 'ghost', iconName: 'networth', onClick: () => printHTML(netWorthStatement(store.get())) }),
      ]),
    ]),
  });

  return el('div', {}, [
    el('div', { class: 'page-header' }, [
      el('h2', { class: 't-h1', text: 'Exportaciones' }),
      el('p', { class: 'page-header__sub', text: 'CSV, respaldos y resúmenes en PDF.' }),
    ]),
    el('div', { class: 'stack' }, [csvCard, el('div', { class: 'grid grid--2' }, [backupCard, reportCard])]),
  ]);
}
