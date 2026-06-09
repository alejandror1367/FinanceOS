// views/networth.js — módulo de Patrimonio.
// Patrimonio Neto = Activos − Pasivos. Desglose, evolución (snapshots) y
// CRUD de "Otros activos" (Assets) y "Deudas" (Liabilities).

import { el, mount } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { store } from '../store/store.js';
import { selectors } from '../store/selectors.js';
import { dataService } from '../services/dataService.js';
import { formatMoney, formatDate } from '../utils/format.js';
import { Card, KpiCard, Badge, BarChart, EmptyState, Button } from '../components/ui.js';
import { Donut, Legend, CHART_PALETTE } from '../components/charts.js';
import { openModal, confirmDialog } from '../components/modal.js';
import { field, textInput, numberInput, select, setFieldError, focusFieldError } from '../components/forms.js';
import { toast } from '../services/toast.js';
import { guardedOp, guardedSave } from '../components/crud.js';

const ASSET_CATEGORIES = [
  { value: 'real_estate', label: 'Inmueble' },
  { value: 'land', label: 'Terreno' },
  { value: 'vehicle', label: 'Vehículo' },
  { value: 'business', label: 'Negocio / Participación' },
  { value: 'valuables', label: 'Objetos de valor' },
  { value: 'jewelry', label: 'Joyería' },
  { value: 'art', label: 'Arte' },
  { value: 'electronics', label: 'Electrónica' },
  { value: 'collectible', label: 'Coleccionables' },
  { value: 'receivable', label: 'Cuentas por cobrar' },
  { value: 'other', label: 'Otro' },
];
const LIABILITY_TYPES = [
  // credit_card excluido: las CCs se registran como cuentas (tipo credit_card) en Cuentas,
  // no como liabilities — evita doble conteo en totalLiabilities.
  { value: 'loan', label: 'Préstamo personal' },
  { value: 'mortgage', label: 'Hipoteca' },
  { value: 'auto_loan', label: 'Crédito vehículo' },
  { value: 'student_loan', label: 'Crédito educativo' },
  { value: 'line_of_credit', label: 'Línea de crédito' },
  { value: 'installment', label: 'Compra a cuotas' },
  { value: 'tax_debt', label: 'Deuda tributaria' },
  { value: 'personal_debt', label: 'Deuda personal' },
  { value: 'other', label: 'Otra' },
];

// ---------- Otros activos (Assets) ----------
function openAssetModal({ asset = {}, mode = 'create' }) {
  const body = el('div', {}, [
    field('Nombre', textInput({ name: 'name', value: asset.name || '', placeholder: 'Apartamento' })),
    el('div', { class: 'field-row' }, [
      field('Categoría', select({ name: 'category', value: asset.category || 'other', options: ASSET_CATEGORIES })),
      field('Valor', numberInput({ name: 'value', value: asset.value ?? '' })),
    ]),
  ]);
  openModal({
    title: mode === 'edit' ? 'Editar activo' : 'Nuevo activo',
    body,
    submitLabel: mode === 'edit' ? 'Guardar' : 'Crear',
    onSubmit: async () => {
      const data = {
        name: body.querySelector('[name="name"]').value.trim(),
        category: body.querySelector('[name="category"]').value,
        value: Number(body.querySelector('[name="value"]').value) || 0,
      };
      if (!data.name) { const c = body.querySelector('[name="name"]'); focusFieldError(c); return setFieldError(c, 'El nombre es obligatorio'); }
      return guardedSave(
        () => mode === 'edit' ? dataService.update('assets', asset.id, data) : dataService.create('assets', data),
        mode === 'edit' ? 'Activo actualizado' : 'Activo creado',
      );
    },
  });
}

// ---------- Deudas (Liabilities) ----------
export const LIABILITY_TYPE_LIST = LIABILITY_TYPES;
export function openLiabilityModal({ liability = {}, mode = 'create' }) {
  const body = el('div', {}, [
    field('Nombre', textInput({ name: 'name', value: liability.name || '', placeholder: 'Tarjeta de crédito' })),
    el('div', { class: 'field-row' }, [
      field('Tipo', select({ name: 'type', value: liability.type || 'credit_card', options: LIABILITY_TYPES })),
      field('Saldo', numberInput({ name: 'balance', value: liability.balance ?? '' })),
    ]),
    el('div', { class: 'field-row' }, [
      field('Tasa E.A. (%)', numberInput({ name: 'interestRate', value: liability.interestRate ?? '' })),
      field('Cuota mínima ($)', numberInput({ name: 'minimumPayment', value: liability.minimumPayment ?? '' })),
    ]),
    field('Vencimiento', textInput({ name: 'dueDate', value: (liability.dueDate || '').slice(0, 10), type: 'date' })),
  ]);
  openModal({
    title: mode === 'edit' ? 'Editar deuda' : 'Nueva deuda',
    body,
    submitLabel: mode === 'edit' ? 'Guardar' : 'Crear',
    onSubmit: async () => {
      const data = {
        name: body.querySelector('[name="name"]').value.trim(),
        type: body.querySelector('[name="type"]').value,
        balance: Number(body.querySelector('[name="balance"]').value) || 0,
        interestRate: Number(body.querySelector('[name="interestRate"]').value) || 0,
        minimumPayment: Number(body.querySelector('[name="minimumPayment"]').value) || 0,
        dueDate: body.querySelector('[name="dueDate"]').value,
      };
      if (!data.name) { const c = body.querySelector('[name="name"]'); focusFieldError(c); return setFieldError(c, 'El nombre es obligatorio'); }
      return guardedSave(
        () => mode === 'edit' ? dataService.update('liabilities', liability.id, data) : dataService.create('liabilities', data),
        mode === 'edit' ? 'Deuda actualizada' : 'Deuda creada',
      );
    },
  });
}

function actionButtons(onEdit, onDelete) {
  return el('div', { class: 'row__actions' }, [
    el('button', { class: 'icon-btn', 'aria-label': 'Editar', title: 'Editar', on: { click: onEdit }, html: icon('edit') }),
    el('button', { class: 'icon-btn icon-btn--danger', 'aria-label': 'Eliminar', title: 'Eliminar', on: { click: onDelete }, html: icon('trash') }),
  ]);
}

function simpleRow(iconName, title, sub, amount, cls, actions) {
  return el('div', { class: 'row' }, [
    el('div', { class: 'row__avatar', html: icon(iconName) }),
    el('div', { class: 'row__main' }, [
      el('div', { class: 'row__title', text: title }),
      sub ? el('div', { class: 'row__sub', text: sub }) : null,
    ].filter(Boolean)),
    el('div', { class: `row__amount tabular ${cls || ''}`, text: amount }),
    actions || null,
  ].filter(Boolean));
}

async function doSaveSnapshot() {
  toast('Guardando snapshot…', { type: 'info' });
  // Pass live-price values to the backend — priceService runs in the frontend,
  // not in Apps Script, so the backend can't compute investmentsValue accurately.
  const s = store.get();
  const payload = {
    investmentsValue: selectors.investmentsValue(s),
    accountsValue: s.accounts
      .filter((a) => !a.isArchived && a.type !== 'investment' && a.type !== 'credit_card')
      .reduce((sum, a) => sum + (a.balance || 0), 0),
    otherAssets: (s.assets || []).reduce((sum, a) => sum + (a.value || 0), 0),
    ccDebt: selectors.creditCardAccounts(s).reduce((sum, a) => sum + Math.abs(a.balance || 0), 0),
    liabilitiesDebt: (s.liabilities || [])
      .filter((l) => l.type !== 'credit_card')
      .reduce((sum, l) => sum + (l.balance || 0), 0),
  };
  await guardedOp(() => dataService.saveSnapshot(payload), 'Snapshot guardado', 'No se pudo guardar');
}

function outlierIds(snaps) {
  if (snaps.length < 4) return new Set();
  const vals = snaps.map((sn) => sn.netWorth);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const std = Math.sqrt(vals.reduce((sum, v) => sum + (v - mean) ** 2, 0) / vals.length);
  if (std === 0) return new Set();
  return new Set(snaps.filter((sn) => Math.abs(sn.netWorth - mean) > 2 * std).map((sn) => sn.id));
}

export function renderNetWorth() {
  const root = el('div');
  const selectedSnapIds = new Set();
  let showAllSnaps = false;

  function repaint() {
    const s = store.get();
    const cur = s.baseCurrency;
    const netWorth = selectors.netWorth(s);
    const totalAssets = selectors.totalAssets(s);
    const totalLiabilities = selectors.totalLiabilities(s);
    // Cuentas líquidas: excluye inversiones (doble conteo) y CC (son pasivos).
    const liquidAccounts = s.accounts.filter((a) => !a.isArchived && a.type !== 'investment' && a.type !== 'credit_card');
    const accountsValue = liquidAccounts.reduce((sum, a) => sum + (a.balance || 0), 0);
    const invValue = selectors.investmentsValue(s);

    // KPIs
    const kpis = el('div', { class: 'grid grid--kpi' }, [
      KpiCard({ label: 'Patrimonio neto', value: formatMoney(netWorth, cur), iconName: 'networth', variant: 'accent', hero: true,
        foot: [el('span', { class: 't-caption', text: `${formatMoney(totalAssets, cur)} activos − ${formatMoney(totalLiabilities, cur)} pasivos` })] }),
      KpiCard({ label: 'Activos', value: formatMoney(totalAssets, cur), iconName: 'investments', variant: 'emerald' }),
      KpiCard({ label: 'Pasivos', value: formatMoney(totalLiabilities, cur), iconName: 'debts', variant: totalLiabilities > 0 ? 'negative' : 'neutral' }),
    ]);

    // ── Composición del patrimonio (Asset Allocation) ────────────────────────
    const physicalValue = (s.assets || []).reduce((sum, a) => sum + (a.value || 0), 0);
    const allocSegments = [
      { label: 'Activos líquidos', value: accountsValue, color: CHART_PALETTE[0] },
      { label: 'Inversiones',      value: invValue,      color: CHART_PALETTE[1] },
      { label: 'Activos físicos',  value: physicalValue, color: CHART_PALETTE[2] },
    ].filter((s) => s.value > 0);

    const allocationCard = allocSegments.length >= 1
      ? Card({
          title: 'Composición del patrimonio',
          body: el('div', { class: 'row-flex', style: 'align-items:center;gap:var(--space-6);flex-wrap:wrap' }, [
            Donut(allocSegments, {
              centerTop: formatMoney(netWorth, cur, { compact: true }),
              centerSub: 'neto',
              valueFormat: (v) => formatMoney(v, cur, { compact: true }),
              ariaLabel: `Composición: ${allocSegments.map((s) => `${s.label} ${formatMoney(s.value, cur, { compact: true })}`).join(', ')}`,
            }),
            Legend(allocSegments.map((seg) => ({
              ...seg,
              value: totalAssets > 0 ? `${((seg.value / totalAssets) * 100).toFixed(1)}%` : '—',
            }))),
          ]),
        })
      : null;

    // Evolución (snapshots reales)
    const allSnaps = [...(s.netWorthSnapshots || [])].sort((a, b) => (a.date < b.date ? -1 : 1));
    const visibleSnaps = showAllSnaps ? allSnaps : allSnaps.slice(-8);
    const outliers = outlierIds(allSnaps);

    const snapRows = visibleSnaps.map((sn) => {
      const isOutlier = outliers.has(sn.id);
      const chk = el('input', { type: 'checkbox', 'aria-label': `Seleccionar snapshot del ${formatDate(sn.date)}` });
      chk.checked = selectedSnapIds.has(sn.id);
      chk.addEventListener('change', () => {
        if (chk.checked) selectedSnapIds.add(sn.id); else selectedSnapIds.delete(sn.id);
        repaint();
      });
      // R3: desglose enriquecido cuando el snapshot tiene los nuevos campos.
      // Snapshots anteriores al deploy no tendrán estos campos → graceful degradation.
      const hasBreakdown = sn.investmentsValue != null || sn.accountsValue != null;
      const breakdownEl = hasBreakdown
        ? el('div', { class: 'row__sub t-micro text-secondary', text:
            `Cuentas ${formatMoney(sn.accountsValue || 0, sn.currency || cur, { compact: true })} · ` +
            `Inv ${formatMoney(sn.investmentsValue || 0, sn.currency || cur, { compact: true })} · ` +
            `Otros ${formatMoney(sn.otherAssets || 0, sn.currency || cur, { compact: true })} · ` +
            `CC ${formatMoney(sn.ccDebt || 0, sn.currency || cur, { compact: true })} · ` +
            `Pasivos ${formatMoney(sn.liabilitiesDebt || 0, sn.currency || cur, { compact: true })}`
          })
        : null;
      return el('div', { class: 'row row--compact' }, [
        el('label', { style: 'display:flex;align-items:center;padding:0 var(--space-2)' }, [chk]),
        el('div', { class: 'row__main' }, [
          el('div', { class: 'row__title' }, [
            formatDate(sn.date, 'short'),
            isOutlier ? el('span', { style: 'margin-left:var(--space-2)' }, [Badge('Dato atípico', 'warning')]) : null,
          ].filter(Boolean)),
          breakdownEl,
        ].filter(Boolean)),
        el('div', { class: `row__amount tabular ${sn.netWorth >= 0 ? '' : 'text-negative'}`, text: formatMoney(sn.netWorth, sn.currency || cur) }),
        el('button', {
          class: 'icon-btn icon-btn--danger', 'aria-label': 'Eliminar snapshot', title: 'Eliminar snapshot',
          html: icon('trash'),
          on: { click: () => confirmDialog({
            title: 'Eliminar snapshot',
            message: `¿Eliminar el snapshot del ${formatDate(sn.date)}?`,
            onConfirm: () => guardedOp(() => dataService.remove('netWorthSnapshots', sn.id), 'Snapshot eliminado'),
          }) },
        }),
      ].filter(Boolean));
    });

    const deleteSelectedBtn = selectedSnapIds.size > 0
      ? Button(`Eliminar ${selectedSnapIds.size} seleccionado${selectedSnapIds.size > 1 ? 's' : ''}`, {
          variant: 'ghost',
          onClick: () => {
            const ids = [...selectedSnapIds];
            confirmDialog({
              title: 'Eliminar snapshots',
              message: `¿Eliminar ${ids.length} snapshot${ids.length > 1 ? 's' : ''} seleccionado${ids.length > 1 ? 's' : ''}?`,
              onConfirm: async () => {
                for (const id of ids) await dataService.remove('netWorthSnapshots', id);
                selectedSnapIds.clear();
                toast(`${ids.length} snapshot${ids.length > 1 ? 's' : ''} eliminado${ids.length > 1 ? 's' : ''}`, { type: 'positive' });
              },
            });
          },
        })
      : null;

    const showMoreBtn = allSnaps.length > 8
      ? Button(showAllSnaps ? 'Ver menos' : `Ver todos (${allSnaps.length})`, {
          variant: 'ghost',
          onClick: () => { showAllSnaps = !showAllSnaps; repaint(); },
        })
      : null;

    const evolution = Card({
      title: 'Evolución del patrimonio',
      action: Button('Guardar snapshot', { variant: 'ghost', iconName: 'plus', onClick: doSaveSnapshot }),
      body: allSnaps.length
        ? el('div', {}, [
            BarChart(visibleSnaps.map((sn) => ({ label: formatDate(sn.date, 'short'), value: sn.netWorth })),
              { valueFormat: (v) => formatMoney(v, cur, { compact: true }) }),
            el('div', { class: 'row-list', style: 'margin-top:var(--space-3)' }, snapRows),
            (deleteSelectedBtn || showMoreBtn)
              ? el('div', { class: 'row-flex', style: 'gap:var(--space-2);padding:var(--space-2) 0 0' },
                  [deleteSelectedBtn, showMoreBtn].filter(Boolean))
              : null,
          ].filter(Boolean))
        : EmptyState({ title: 'Sin histórico', message: 'Guarda un snapshot para empezar a registrar la evolución.', iconName: 'networth' }),
    });

    // Activos: cuentas líquidas, inversiones, otros activos
    const assetItems = [];
    assetItems.push(simpleRow('accounts', 'Cuentas', `${liquidAccounts.length} cuentas`, formatMoney(accountsValue, cur)));
    const activeInv = s.investments.filter((i) => !i.isDeleted);
    assetItems.push(simpleRow('investments', 'Inversiones', `${activeInv.length} posiciones`, formatMoney(invValue, cur)));
    (s.assets || []).forEach((a) => {
      const label = (ASSET_CATEGORIES.find((c) => c.value === a.category) || {}).label || a.category;
      assetItems.push(simpleRow('home', a.name, label, formatMoney(a.value, a.currency || cur), '',
        actionButtons(() => openAssetModal({ asset: a, mode: 'edit' }),
          () => confirmDialog({ title: 'Eliminar activo', message: `¿Eliminar "${a.name}"?`, onConfirm: () => guardedOp(() => dataService.remove('assets', a.id), 'Activo eliminado') }))));
    });

    const assetsCard = Card({
      title: 'Activos',
      action: Button('Otro activo', { variant: 'ghost', iconName: 'plus', onClick: () => openAssetModal({ mode: 'create' }) }),
      body: el('div', { class: 'row-list' }, assetItems),
    });

    // Pasivos: liabilities manuales (excluye credit_card, ya cubiertas por cuentas CC)
    // + filas de cuentas CC con saldo > 0.
    const liabs = (s.liabilities || []).filter((l) => l.type !== 'credit_card');
    const ccAccountRows = selectors.creditCardAccounts(s)
      .filter((a) => Math.abs(a.balance || 0) > 0)
      .map((a) => simpleRow('card', a.name, 'Tarjeta de crédito', formatMoney(Math.abs(a.balance || 0), a.currency || cur), 'text-negative'));

    const liabRows = liabs.map((l) => {
      const typeLabel = (LIABILITY_TYPES.find((t) => t.value === l.type) || {}).label || l.type;
      const sub = `${typeLabel} · ${l.interestRate || 0}%${l.dueDate ? ' · vence ' + formatDate(l.dueDate, 'short') : ''}`;
      return simpleRow('debts', l.name, sub, formatMoney(l.balance, l.currency || cur), 'text-negative',
        actionButtons(() => openLiabilityModal({ liability: l, mode: 'edit' }),
          () => confirmDialog({ title: 'Eliminar deuda', message: `¿Eliminar "${l.name}"?`, onConfirm: () => guardedOp(() => dataService.remove('liabilities', l.id), 'Deuda eliminada') })));
    });

    const allLiabRows = [...liabRows, ...ccAccountRows];
    const liabsBody = allLiabRows.length
      ? el('div', { class: 'row-list' }, allLiabRows)
      : EmptyState({ title: 'Sin pasivos', message: 'Registra hipotecas, créditos u otros pasivos. Las tarjetas de crédito aparecen aquí automáticamente.', iconName: 'debts' });

    const liabsCard = Card({
      title: 'Pasivos',
      action: Button('Nueva deuda', { variant: 'ghost', iconName: 'plus', onClick: () => openLiabilityModal({ mode: 'create' }) }),
      body: liabsBody,
    });

    mount(root,
      el('div', {}, [
        el('div', { class: 'page-header' }, [
          el('div', { class: 'row-flex between' }, [
            el('div', {}, [
              el('h2', { class: 't-h1', text: 'Patrimonio' }),
              el('p', { class: 'page-header__sub', text: 'Activos menos pasivos y su evolución.' }),
            ]),
            Badge('Activos − Pasivos', 'info'),
          ]),
        ]),
        kpis,
        allocationCard ? el('div', { class: 'section' }, [allocationCard]) : null,
        el('div', { class: 'section' }, [evolution]),
        el('div', { class: 'grid grid--2 section' }, [assetsCard, liabsCard]),
      ])
    );
  }

  store.subscribe(() => { if (root.isConnected) repaint(); });
  repaint();
  return root;
}
