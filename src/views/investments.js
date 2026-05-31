// views/investments.js — módulo de Inversiones (CRUD + valor/rentabilidad/distribución).
// Valores derivados (no persistidos): valor = cantidad × precio actual, etc.

import { el } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { store } from '../store/store.js';
import { selectors } from '../store/selectors.js';
import { dataService } from '../services/dataService.js';
import { formatMoney, formatPercent } from '../utils/format.js';
import { Card, KpiCard, Badge, Trend, ProgressBar, EmptyState, Button } from '../components/ui.js';
import { openModal, confirmDialog } from '../components/modal.js';
import { field, textInput, numberInput, select } from '../components/forms.js';
import { toast } from '../services/toast.js';

const ASSET_TYPES = [
  { value: 'stock', label: 'Acción' },
  { value: 'etf', label: 'ETF' },
  { value: 'fund', label: 'Fondo' },
  { value: 'bond', label: 'Bono' },
  { value: 'cdt', label: 'CDT' },
  { value: 'crypto', label: 'Cripto' },
];
const typeLabel = (v) => (ASSET_TYPES.find((t) => t.value === v) || {}).label || v;

function posStats(p) {
  const value = (p.quantity || 0) * (p.currentPrice || 0);
  const cost = (p.quantity || 0) * (p.avgCost || 0);
  const gain = value - cost;
  const ret = cost ? (gain / cost) * 100 : 0;
  return { value, cost, gain, ret };
}

// ---------- Formulario ----------
function openInvestmentModal({ inv = {}, mode = 'create' }) {
  const s = store.get();
  const accountOpts = [{ value: '', label: '— Sin cuenta —' }]
    .concat((s.accounts || []).filter((a) => !a.isArchived).map((a) => ({ value: a.id, label: a.name })));

  const body = el('div', {}, [
    field('Nombre', textInput({ name: 'name', value: inv.name || '', placeholder: 'S&P 500 ETF' })),
    el('div', { class: 'field-row' }, [
      field('Tipo', select({ name: 'assetType', value: inv.assetType || 'etf', options: ASSET_TYPES })),
      field('Símbolo', textInput({ name: 'symbol', value: inv.symbol || '', placeholder: 'VOO' })),
    ]),
    field('Cuenta', select({ name: 'accountId', value: inv.accountId || '', options: accountOpts })),
    el('div', { class: 'field-row' }, [
      field('Cantidad', numberInput({ name: 'quantity', value: inv.quantity ?? '' })),
      field('Costo promedio', numberInput({ name: 'avgCost', value: inv.avgCost ?? '' })),
    ]),
    field('Precio actual', numberInput({ name: 'currentPrice', value: inv.currentPrice ?? '' })),
  ]);

  openModal({
    title: mode === 'edit' ? 'Editar inversión' : 'Nueva inversión',
    body,
    submitLabel: mode === 'edit' ? 'Guardar' : 'Crear',
    onSubmit: async () => {
      const g = (n) => body.querySelector(`[name="${n}"]`).value;
      const data = {
        name: g('name').trim(),
        assetType: g('assetType'),
        symbol: g('symbol').trim().toUpperCase(),
        accountId: g('accountId'),
        quantity: Number(g('quantity')) || 0,
        avgCost: Number(g('avgCost')) || 0,
        currentPrice: Number(g('currentPrice')) || 0,
      };
      if (!data.name) { toast('El nombre es obligatorio', { type: 'negative' }); return false; }
      if (data.quantity <= 0) { toast('La cantidad debe ser mayor a cero', { type: 'negative' }); return false; }
      try {
        if (mode === 'edit') { await dataService.update('investments', inv.id, data); toast('Inversión actualizada'); }
        else { await dataService.create('investments', data); toast('Inversión creada'); }
      } catch (e) { toast('Error al guardar', { type: 'negative' }); return false; }
    },
  });
}

function posRow(p, cur) {
  const st = posStats(p);
  return el('div', { class: 'row' }, [
    el('div', { class: 'row__avatar', html: icon('investments') }),
    el('div', { class: 'row__main' }, [
      el('div', { class: 'row__title' }, [p.name, ' ', Badge(typeLabel(p.assetType), 'info')]),
      el('div', { class: 'row__sub', text: `${p.symbol ? p.symbol + ' · ' : ''}${p.quantity} × ${formatMoney(p.currentPrice, p.currency || cur)}` }),
    ]),
    el('div', { style: { textAlign: 'right' } }, [
      el('div', { class: 'row__amount tabular', text: formatMoney(st.value, p.currency || cur) }),
      el('div', { class: 't-caption' }, [Trend(st.ret)]),
    ]),
    el('div', { class: 'row__actions' }, [
      el('button', { class: 'icon-btn', 'aria-label': 'Editar', title: 'Editar', on: { click: () => openInvestmentModal({ inv: p, mode: 'edit' }) }, html: icon('edit') }),
      el('button', {
        class: 'icon-btn icon-btn--danger', 'aria-label': 'Eliminar', title: 'Eliminar',
        on: { click: () => confirmDialog({ title: 'Eliminar inversión', message: `¿Eliminar "${p.name}"?`, onConfirm: async () => { try { await dataService.remove('investments', p.id); toast('Inversión eliminada'); } catch (e) { toast('Error', { type: 'negative' }); } } }) },
        html: icon('trash'),
      }),
    ]),
  ]);
}

function distribution(positions, totalValue, cur) {
  const byType = {};
  positions.forEach((p) => { const v = posStats(p).value; byType[p.assetType] = (byType[p.assetType] || 0) + v; });
  const rows = Object.keys(byType).map((t) => ({ type: t, value: byType[t] })).sort((a, b) => b.value - a.value);
  return el('div', { class: 'stack mt-2' }, rows.map((r) => {
    const pct = totalValue ? (r.value / totalValue) * 100 : 0;
    return el('div', { class: 'stack' }, [
      el('div', { class: 'row-flex between' }, [
        el('span', { text: typeLabel(r.type) }),
        el('span', { class: 'tabular t-caption', text: `${formatMoney(r.value, cur)} · ${pct.toFixed(0)}%` }),
      ]),
      ProgressBar(pct),
    ]);
  }));
}

export function renderInvestments() {
  const s = store.get();
  const cur = s.baseCurrency;
  const positions = s.investments || [];
  const value = selectors.investmentsValue(s);
  const cost = selectors.investmentsCost(s);
  const gain = value - cost;
  const ret = selectors.investmentsReturnPct(s);

  const kpis = el('div', { class: 'grid grid--kpi' }, [
    KpiCard({ label: 'Valor actual', value: formatMoney(value, cur), iconName: 'investments', variant: 'accent', hero: true,
      foot: [Trend(ret), el('span', { class: 't-caption', text: 'rentabilidad' })] }),
    KpiCard({ label: 'Costo invertido', value: formatMoney(cost, cur), iconName: 'wallet', variant: 'neutral' }),
    KpiCard({ label: 'Ganancia/Pérdida', value: formatMoney(gain, cur, { signed: true }), iconName: gain >= 0 ? 'arrowUp' : 'arrowDown', variant: gain >= 0 ? 'emerald' : 'negative' }),
  ]);

  const listCard = Card({
    title: 'Posiciones',
    action: Button('Nueva inversión', { variant: 'primary', iconName: 'plus', onClick: () => openInvestmentModal({ mode: 'create' }) }),
    body: positions.length
      ? el('div', { class: 'row-list' }, positions.map((p) => posRow(p, cur)))
      : EmptyState({ title: 'Sin inversiones', message: 'Registra tu primera posición.', iconName: 'investments',
          action: Button('Nueva inversión', { variant: 'primary', iconName: 'plus', onClick: () => openInvestmentModal({ mode: 'create' }) }) }),
  });

  const distCard = Card({
    title: 'Distribución',
    body: positions.length ? distribution(positions, value, cur) : EmptyState({ title: 'Sin datos', iconName: 'analytics' }),
  });

  return el('div', {}, [
    el('div', { class: 'page-header' }, [
      el('h2', { class: 't-h1', text: 'Inversiones' }),
      el('p', { class: 'page-header__sub', text: `${positions.length} posiciones · ${formatPercent(ret)} de rentabilidad` }),
    ]),
    kpis,
    el('div', { class: 'grid grid--2 section' }, [listCard, distCard]),
  ]);
}
