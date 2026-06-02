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
import { openModal, confirmDialog } from '../components/modal.js';
import { field, textInput, numberInput, select } from '../components/forms.js';
import { toast } from '../services/toast.js';

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
  { value: 'credit_card', label: 'Tarjeta de crédito' },
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
      if (!data.name) { toast('El nombre es obligatorio', { type: 'negative' }); return false; }
      try {
        if (mode === 'edit') { await dataService.update('assets', asset.id, data); toast('Activo actualizado'); }
        else { await dataService.create('assets', data); toast('Activo creado'); }
      } catch (e) { toast('Error al guardar', { type: 'negative' }); return false; }
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
      if (!data.name) { toast('El nombre es obligatorio', { type: 'negative' }); return false; }
      try {
        if (mode === 'edit') { await dataService.update('liabilities', liability.id, data); toast('Deuda actualizada'); }
        else { await dataService.create('liabilities', data); toast('Deuda creada'); }
      } catch (e) { toast('Error al guardar', { type: 'negative' }); return false; }
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
  try { await dataService.saveSnapshot(); toast('Snapshot guardado'); }
  catch (e) { toast(e.message || 'No se pudo guardar', { type: 'negative' }); }
}

export function renderNetWorth() {
  const root = el('div');

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

    // Evolución (snapshots reales)
    const snaps = [...(s.netWorthSnapshots || [])].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-8);
    const evolution = Card({
      title: 'Evolución del patrimonio',
      action: Button('Guardar snapshot', { variant: 'ghost', iconName: 'plus', onClick: doSaveSnapshot }),
      body: snaps.length
        ? BarChart(snaps.map((sn) => ({ label: formatDate(sn.date, 'short'), value: sn.netWorth })))
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
          () => confirmDialog({ title: 'Eliminar activo', message: `¿Eliminar "${a.name}"?`, onConfirm: async () => { try { await dataService.remove('assets', a.id); toast('Activo eliminado'); } catch (e) { toast('Error', { type: 'negative' }); } } }))));
    });

    const assetsCard = Card({
      title: 'Activos',
      action: Button('Otro activo', { variant: 'ghost', iconName: 'plus', onClick: () => openAssetModal({ mode: 'create' }) }),
      body: el('div', { class: 'row-list' }, assetItems),
    });

    // Pasivos
    const liabs = s.liabilities || [];
    const liabsCard = Card({
      title: 'Pasivos',
      action: Button('Nueva deuda', { variant: 'ghost', iconName: 'plus', onClick: () => openLiabilityModal({ mode: 'create' }) }),
      body: liabs.length
        ? el('div', { class: 'row-list' }, liabs.map((l) => {
            const typeLabel = (LIABILITY_TYPES.find((t) => t.value === l.type) || {}).label || l.type;
            const sub = `${typeLabel} · ${l.interestRate || 0}%${l.dueDate ? ' · vence ' + formatDate(l.dueDate, 'short') : ''}`;
            return simpleRow('debts', l.name, sub, formatMoney(l.balance, l.currency || cur), 'text-negative',
              actionButtons(() => openLiabilityModal({ liability: l, mode: 'edit' }),
                () => confirmDialog({ title: 'Eliminar deuda', message: `¿Eliminar "${l.name}"?`, onConfirm: async () => { try { await dataService.remove('liabilities', l.id); toast('Deuda eliminada'); } catch (e) { toast('Error', { type: 'negative' }); } } })));
          }))
        : EmptyState({ title: 'Sin deudas', message: 'Registra tus pasivos para un patrimonio preciso.', iconName: 'debts' }),
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
        el('div', { class: 'section' }, [evolution]),
        el('div', { class: 'grid grid--2 section' }, [assetsCard, liabsCard]),
      ])
    );
  }

  store.subscribe(() => { if (root.isConnected) repaint(); });
  repaint();
  return root;
}
