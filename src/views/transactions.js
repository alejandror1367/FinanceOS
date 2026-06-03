// views/transactions.js — módulo de Transacciones (CRUD + búsqueda/filtro).
// Tipos: ingreso, gasto, transferencia. Usa dataService (Optimistic UI + sync).

import { el, mount } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { store } from '../store/store.js';
import { dataService } from '../services/dataService.js';
import { formatMoney, formatDate } from '../utils/format.js';
import { Button, EmptyState } from '../components/ui.js';
import { openModal, confirmDialog } from '../components/modal.js';
import { field, textInput, numberInput, textarea, select, segmented, setFieldError, focusFieldError } from '../components/forms.js';
import { toast } from '../services/toast.js';
import { guardedOp, guardedSave } from '../components/crud.js';

// Estado de filtro a nivel de módulo (persiste entre re-renders).
function currentMonth() { return new Date().toISOString().slice(0, 7); }
const FILTER = { q: '', type: 'all', accountId: 'all', month: currentMonth(), categoryId: 'all' };

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

// Devuelve { name, message } del primer campo inválido (para marcado inline), o null.
function validateTx(d) {
  if (!d.amount || d.amount <= 0) return { name: 'amount', message: 'El monto debe ser mayor a cero.' };
  if (!d.accountId) return { name: 'accountId', message: 'Selecciona una cuenta.' };
  if (!d.date) return { name: 'date', message: 'Selecciona una fecha.' };
  if (d.type === 'transfer') {
    if (!d.toAccountId) return { name: 'toAccountId', message: 'Selecciona la cuenta destino.' };
    if (d.toAccountId === d.accountId) return { name: 'toAccountId', message: 'Las cuentas deben ser distintas.' };
  } else if (!d.categoryId) {
    return { name: 'categoryId', message: 'Selecciona una categoría.' };
  }
  return null;
}

export function openTxModal({ tx = {}, mode = 'create' }) {
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
      if (err) {
        const ctrl = formCtl.body.querySelector(`[name="${err.name}"]`);
        if (ctrl) { focusFieldError(ctrl); return setFieldError(ctrl, err.message); }
        toast(err.message, { type: 'negative' }); return false;
      }
      return guardedSave(
        () => mode === 'edit' ? dataService.update('transactions', tx.id, data) : dataService.create('transactions', data),
        mode === 'edit' ? 'Transacción actualizada' : 'Transacción creada',
      );
    },
  });
}

// ---------- Filtros ----------
function applyFilters(list, m) {
  const q = FILTER.q.trim().toLowerCase();
  return list.filter((t) => {
    if (FILTER.type !== 'all' && t.type !== FILTER.type) return false;
    if (FILTER.accountId !== 'all' && t.accountId !== FILTER.accountId && t.toAccountId !== FILTER.accountId) return false;
    if (FILTER.month && t.date && t.date.slice(0, 7) !== FILTER.month) return false;
    if (FILTER.categoryId !== 'all' && t.categoryId !== FILTER.categoryId) return false;
    if (q) {
      const cat = m.cat[t.categoryId];
      const acc = m.acc[t.accountId];
      const hay = `${t.description || ''} ${cat ? cat.name : ''} ${acc ? acc.name : ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

// ---------- Agrupación por fecha ----------
function groupByDate(txList) {
  const groups = new Map();
  for (const t of txList) {
    const date = t.date ? t.date.slice(0, 10) : '';
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date).push(t);
  }
  return groups;
}

function dateGroupLabel(isoDate) {
  const todayStr = today();
  const d = new Date(); d.setDate(d.getDate() - 1);
  const yesterdayStr = d.toISOString().slice(0, 10);
  if (isoDate === todayStr) return 'Hoy';
  if (isoDate === yesterdayStr) return 'Ayer';
  return formatDate(isoDate, 'short');
}

function groupNet(txList, cur) {
  let net = 0;
  for (const t of txList) {
    if (t.type === 'income') net += t.amount;
    else if (t.type === 'expense') net -= t.amount;
  }
  if (net === 0) return '';
  return formatMoney(net, cur, { signed: true });
}

// ---------- Resumen de filtro ----------
function buildSummary(filtered, cur) {
  if (!filtered.length) return '';
  let income = 0, expense = 0;
  for (const t of filtered) {
    if (t.type === 'income') income += t.amount;
    else if (t.type === 'expense') expense += t.amount;
  }
  const net = income - expense;
  const count = filtered.length === 1 ? '1 transacción' : `${filtered.length} transacciones`;
  return `${count} · ${formatMoney(net, cur, { signed: true })} neto`;
}

// ---------- Actualizar opciones de <select> sin recrear el elemento ----------
function updateOpts(selectEl, opts) {
  const cur = selectEl.value;
  selectEl.replaceChildren(...opts.map((o) =>
    el('option', { value: o.value, selected: String(o.value) === String(cur) ? true : null, text: o.label })
  ));
}

// ---------- Fila ----------
function txRow(t, m, cur) {
  const isIncome = t.type === 'income';
  const isTransfer = t.type === 'transfer';
  const cat = m.cat[t.categoryId];
  const acc = m.acc[t.accountId];
  const toAcc = m.acc[t.toAccountId];
  const sign = isIncome ? '+' : isTransfer ? '' : '−';
  const cls = isIncome ? 'text-positive' : isTransfer ? '' : 'text-negative';
  const label = isTransfer ? 'Transferencia' : (cat ? cat.name : 'Sin categoría');
  const iconName = isTransfer ? 'transactions' : (cat ? cat.icon : 'wallet');
  const subLabel = isTransfer
    ? `Transferencia · ${acc ? acc.name : '?'} → ${toAcc ? toAcc.name : '?'} · ${formatDate(t.date, 'short')}`
    : `${label} · ${acc ? acc.name : ''} · ${formatDate(t.date, 'short')}`;

  return el('div', { class: 'row' }, [
    el('div', { class: 'row__avatar', html: icon(iconName) }),
    el('div', { class: 'row__main' }, [
      el('div', { class: 'row__title', text: t.description || label }),
      el('div', { class: 'row__sub', text: subLabel }),
    ]),
    el('div', { class: `row__amount ${cls}`, text: `${sign}${formatMoney(t.amount, t.currency || cur)}` }),
    el('div', { class: 'row__actions' }, [
      el('button', { class: 'icon-btn', 'aria-label': 'Editar', title: 'Editar', on: { click: () => openTxModal({ tx: t, mode: 'edit' }) }, html: icon('edit') }),
      el('button', { class: 'icon-btn', 'aria-label': 'Duplicar', title: 'Duplicar', on: { click: () => openTxModal({ tx: { ...t, id: undefined, date: today() }, mode: 'create' }) }, html: icon('copy') }),
      el('button', {
        class: 'icon-btn icon-btn--danger', 'aria-label': 'Eliminar', title: 'Eliminar',
        on: { click: () => confirmDialog({
          title: 'Eliminar transacción', message: '¿Eliminar esta transacción?',
          onConfirm: () => guardedOp(() => dataService.remove('transactions', t.id), 'Transacción eliminada', 'Error al eliminar'),
        }) },
        html: icon('trash'),
      }),
    ]),
  ]);
}

// ---------- Vista ----------
export function renderTransactions() {
  const root = el('div');
  const listMount = el('div');
  const summaryEl = el('p', { class: 'tx-summary' });

  const searchEl = textInput({ name: 'q', value: FILTER.q, placeholder: 'Buscar…' });
  const monthEl = textInput({ name: 'fmonth', value: FILTER.month, type: 'month' });
  const typeEl = select({ name: 'ftype', value: FILTER.type, options: [
    { value: 'all', label: 'Todos los tipos' },
    { value: 'income', label: 'Ingresos' },
    { value: 'expense', label: 'Gastos' },
    { value: 'transfer', label: 'Transferencias' },
  ] });
  // accEl y catEl empiezan vacíos — paint() los puebla reactivamente (TX-6)
  const accEl = select({ name: 'facc', value: FILTER.accountId, options: [] });
  const catEl = select({ name: 'fcat', value: FILTER.categoryId, options: [] });

  searchEl.addEventListener('input', () => { FILTER.q = searchEl.value; paint(); });
  monthEl.addEventListener('change', () => { FILTER.month = monthEl.value; paint(); });
  typeEl.addEventListener('change', () => { FILTER.type = typeEl.value; FILTER.categoryId = 'all'; paint(); });
  accEl.addEventListener('change', () => { FILTER.accountId = accEl.value; paint(); });
  catEl.addEventListener('change', () => { FILTER.categoryId = catEl.value; paint(); });

  function paint() {
    const s = store.get();
    const m = maps(s);
    const cur = s.baseCurrency;

    // Opciones de cuenta reactivas (TX-6)
    updateOpts(accEl, [{ value: 'all', label: 'Todas las cuentas' }]
      .concat((s.accounts || []).filter((a) => !a.isArchived).map((a) => ({ value: a.id, label: a.name }))));

    // Opciones de categoría según tipo seleccionado
    const catKind = FILTER.type === 'income' ? 'income' : FILTER.type === 'expense' ? 'expense' : null;
    updateOpts(catEl, [{ value: 'all', label: 'Todas las categorías' }]
      .concat((s.categories || []).filter((c) => !catKind || c.kind === catKind).map((c) => ({ value: c.id, label: c.name }))));
    catEl.style.display = FILTER.type === 'transfer' ? 'none' : '';

    const all = [...(s.transactions || [])].sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return (a.createdAt || a.id || '') < (b.createdAt || b.id || '') ? 1 : -1;
    });
    const filtered = applyFilters(all, m);

    // Línea de resumen (TX-4)
    summaryEl.textContent = buildSummary(filtered, cur);

    // Lista agrupada por fecha (TX-1)
    const groups = groupByDate(filtered);
    const content = filtered.length
      ? el('div', { class: 'card card--pad-sm' }, [
          el('div', { class: 'row-list' }, [...groups.entries()].flatMap(([date, txs]) => [
            el('div', { class: 'tx-date-header' }, [
              el('span', { class: 'tx-date-label', text: dateGroupLabel(date) }),
              el('span', { class: 'tx-date-total', text: groupNet(txs, cur) }),
            ]),
            ...txs.map((t) => txRow(t, m, cur)),
          ])),
        ])
      : el('div', { class: 'card' }, [EmptyState({
          title: all.length ? 'Sin resultados' : 'Sin transacciones',
          message: all.length ? 'Ajusta la búsqueda o los filtros.' : 'Registra tu primer movimiento.',
          iconName: 'transactions',
        })]);
    mount(listMount, content);
  }

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
      monthEl,
      typeEl,
      accEl,
      catEl,
    ]),
    summaryEl,
    listMount,
  );

  paint();
  return root;
}
