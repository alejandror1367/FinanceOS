// views/transactions.js — módulo de Transacciones (CRUD + búsqueda/filtro).
// Tipos: ingreso, gasto, transferencia. Usa dataService (Optimistic UI + sync).

import { el, mount } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { store } from '../store/store.js';
import { dataService } from '../services/dataService.js';
import { formatMoney, formatDate } from '../utils/format.js';
import { Button, Badge, EmptyState } from '../components/ui.js';
import { openModal, confirmDialog } from '../components/modal.js';
import { field, textInput, numberInput, textarea, select, segmented } from '../components/forms.js';
import { toast } from '../services/toast.js';

// Estado de filtro a nivel de módulo (persiste entre re-renders).
const FILTER = { q: '', type: 'all', accountId: 'all' };

const TYPE_LABELS = { income: 'Ingreso', expense: 'Gasto', transfer: 'Transferencia' };
const today = () => new Date().toISOString().slice(0, 10);

function maps(s) {
  const acc = {}; (s.accounts || []).forEach((a) => { acc[a.id] = a; });
  const cat = {}; (s.categories || []).forEach((c) => { cat[c.id] = c; });
  return { acc, cat };
}

// ---------- Formulario ----------
function buildTxForm(prefill) {
  const state = { type: prefill.type || 'expense' };
  const s = store.get();
  const accountOpts = (s.accounts || []).filter((a) => !a.isArchived).map((a) => ({ value: a.id, label: a.name }));

  const dateEl = textInput({ name: 'date', value: (prefill.date || today()).slice(0, 10), type: 'date' });
  const amountEl = numberInput({ name: 'amount', value: prefill.amount ?? '' });
  const accountEl = select({ name: 'accountId', value: prefill.accountId || (accountOpts[0] && accountOpts[0].value) || '', options: accountOpts });
  const descEl = textarea({ name: 'description', value: prefill.description || '', placeholder: 'Descripción (opcional)' });
  const dynamic = el('div');

  function paintDynamic() {
    if (state.type === 'transfer') {
      mount(dynamic, field('Cuenta destino', select({
        name: 'toAccountId', value: prefill.toAccountId || '', options: accountOpts,
      })));
    } else {
      const catOpts = (s.categories || []).filter((c) => c.kind === state.type).map((c) => ({ value: c.id, label: c.name }));
      mount(dynamic, field('Categoría', select({
        name: 'categoryId', value: prefill.categoryId || (catOpts[0] && catOpts[0].value) || '', options: catOpts,
      })));
    }
  }
  paintDynamic();

  const seg = segmented({
    value: state.type,
    options: [{ value: 'expense', label: 'Gasto' }, { value: 'income', label: 'Ingreso' }, { value: 'transfer', label: 'Transferencia' }],
    onChange: (v) => { state.type = v; paintDynamic(); },
  });

  const body = el('div', {}, [
    field('Tipo', seg),
    el('div', { class: 'field-row' }, [field('Fecha', dateEl), field('Monto', amountEl)]),
    field('Cuenta', accountEl),
    dynamic,
    field('Descripción', descEl),
  ]);

  function getData() {
    const data = {
      type: state.type,
      date: dateEl.value,
      amount: Number(amountEl.value) || 0,
      accountId: accountEl.value,
      description: descEl.value.trim(),
    };
    if (state.type === 'transfer') data.toAccountId = body.querySelector('[name="toAccountId"]').value;
    else data.categoryId = body.querySelector('[name="categoryId"]').value;
    return data;
  }

  return { body, getData };
}

function validateTx(d) {
  if (!d.amount || d.amount <= 0) return 'El monto debe ser mayor a cero.';
  if (!d.accountId) return 'Selecciona una cuenta.';
  if (!d.date) return 'Selecciona una fecha.';
  if (d.type === 'transfer') {
    if (!d.toAccountId) return 'Selecciona la cuenta destino.';
    if (d.toAccountId === d.accountId) return 'Las cuentas deben ser distintas.';
  } else if (!d.categoryId) {
    return 'Selecciona una categoría.';
  }
  return null;
}

function openTxModal({ tx = {}, mode = 'create' }) {
  const accounts = (store.get().accounts || []).filter((a) => !a.isArchived);
  if (!accounts.length) { toast('Crea una cuenta primero', { type: 'warning' }); return; }

  const formCtl = buildTxForm(tx);
  openModal({
    title: mode === 'edit' ? 'Editar transacción' : 'Nueva transacción',
    body: formCtl.body,
    submitLabel: mode === 'edit' ? 'Guardar' : 'Crear',
    onSubmit: async () => {
      const data = formCtl.getData();
      const err = validateTx(data);
      if (err) { toast(err, { type: 'negative' }); return false; }
      try {
        if (mode === 'edit') { await dataService.update('transactions', tx.id, data); toast('Transacción actualizada'); }
        else { await dataService.create('transactions', data); toast('Transacción creada'); }
      } catch (e) { toast('Error al guardar', { type: 'negative' }); return false; }
    },
  });
}

// ---------- Lista ----------
function applyFilters(list, m) {
  const q = FILTER.q.trim().toLowerCase();
  return list.filter((t) => {
    if (FILTER.type !== 'all' && t.type !== FILTER.type) return false;
    if (FILTER.accountId !== 'all' && t.accountId !== FILTER.accountId && t.toAccountId !== FILTER.accountId) return false;
    if (q) {
      const cat = m.cat[t.categoryId];
      const acc = m.acc[t.accountId];
      const hay = `${t.description || ''} ${cat ? cat.name : ''} ${acc ? acc.name : ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function txRow(t, m, cur) {
  const isIncome = t.type === 'income';
  const isTransfer = t.type === 'transfer';
  const cat = m.cat[t.categoryId];
  const acc = m.acc[t.accountId];
  const sign = isIncome ? '+' : isTransfer ? '' : '−';
  const cls = isIncome ? 'text-positive' : isTransfer ? '' : 'text-negative';
  const label = isTransfer ? 'Transferencia' : (cat ? cat.name : 'Sin categoría');
  const iconName = isTransfer ? 'transactions' : (cat ? cat.icon : 'wallet');

  return el('div', { class: 'row' }, [
    el('div', { class: 'row__avatar', html: icon(iconName) }),
    el('div', { class: 'row__main' }, [
      el('div', { class: 'row__title', text: t.description || label }),
      el('div', { class: 'row__sub', text: `${label} · ${acc ? acc.name : ''} · ${formatDate(t.date, 'short')}` }),
    ]),
    el('div', { class: `row__amount ${cls}`, text: `${sign}${formatMoney(t.amount, t.currency || cur)}` }),
    el('div', { class: 'row__actions' }, [
      el('button', { class: 'icon-btn', 'aria-label': 'Editar', title: 'Editar', on: { click: () => openTxModal({ tx: t, mode: 'edit' }) }, html: icon('edit') }),
      el('button', { class: 'icon-btn', 'aria-label': 'Duplicar', title: 'Duplicar', on: { click: () => openTxModal({ tx: { ...t, id: undefined, date: today() }, mode: 'create' }) }, html: icon('copy') }),
      el('button', {
        class: 'icon-btn icon-btn--danger', 'aria-label': 'Eliminar', title: 'Eliminar',
        on: { click: () => confirmDialog({
          title: 'Eliminar transacción', message: '¿Eliminar esta transacción?',
          onConfirm: async () => { try { await dataService.remove('transactions', t.id); toast('Transacción eliminada'); } catch (e) { toast('Error al eliminar', { type: 'negative' }); } },
        }) },
        html: icon('trash'),
      }),
    ]),
  ]);
}

export function renderTransactions() {
  const root = el('div');
  const listMount = el('div');

  function paint() {
    const s = store.get();
    const m = maps(s);
    const cur = s.baseCurrency;
    const all = [...(s.transactions || [])].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    const filtered = applyFilters(all, m);

    const content = filtered.length
      ? el('div', { class: 'card card--pad-sm' }, [el('div', { class: 'row-list' }, filtered.map((t) => txRow(t, m, cur)))])
      : el('div', { class: 'card' }, [EmptyState({
          title: all.length ? 'Sin resultados' : 'Sin transacciones',
          message: all.length ? 'Ajusta la búsqueda o los filtros.' : 'Registra tu primer movimiento.',
          iconName: 'transactions',
        })]);
    mount(listMount, content);
  }

  const accountOpts = [{ value: 'all', label: 'Todas las cuentas' }]
    .concat((store.get().accounts || []).filter((a) => !a.isArchived).map((a) => ({ value: a.id, label: a.name })));

  const searchEl = textInput({ name: 'q', value: FILTER.q, placeholder: 'Buscar…' });
  searchEl.addEventListener('input', () => { FILTER.q = searchEl.value; paint(); });

  const typeEl = select({ name: 'ftype', value: FILTER.type, options: [
    { value: 'all', label: 'Todos los tipos' },
    { value: 'income', label: 'Ingresos' },
    { value: 'expense', label: 'Gastos' },
    { value: 'transfer', label: 'Transferencias' },
  ] });
  typeEl.addEventListener('change', () => { FILTER.type = typeEl.value; paint(); });

  const accEl = select({ name: 'facc', value: FILTER.accountId, options: accountOpts });
  accEl.addEventListener('change', () => { FILTER.accountId = accEl.value; paint(); });

  root.append(
    el('div', { class: 'page-header' }, [
      el('div', { class: 'row-flex between' }, [
        el('div', {}, [
          el('h2', { class: 't-h1', text: 'Transacciones' }),
          el('p', { class: 'page-header__sub', text: 'Ingresos, gastos y transferencias.' }),
        ]),
        Button('Nueva transacción', { variant: 'primary', iconName: 'plus', onClick: () => openTxModal({ mode: 'create' }) }),
      ]),
    ]),
    el('div', { class: 'toolbar' }, [
      el('div', { class: 'search' }, [el('span', { class: 'search__icon', html: icon('search') }), searchEl]),
      typeEl,
      accEl,
    ]),
    listMount,
  );

  paint();
  return root;
}
