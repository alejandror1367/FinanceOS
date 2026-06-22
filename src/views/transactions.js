// views/transactions.js — módulo de Transacciones (CRUD + búsqueda/filtro).
// Tipos: ingreso, gasto, transferencia. Usa dataService (Optimistic UI + sync).

import { el, mount } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { store } from '../store/store.js';
import { dataService } from '../services/dataService.js';
import { formatMoney, formatDate } from '../utils/format.js';
import { isExpenseLike } from '../store/selectors.js';
import { Button, EmptyState, ProgressBar, Fab } from '../components/ui.js';
import { openModal, confirmDialog, openActionSheet } from '../components/modal.js';
import { field, textInput, numberInput, textarea, select, segmented, setFieldError, focusFieldError } from '../components/forms.js';
import { toast } from '../services/toast.js';
import { guardedOp, guardedSave } from '../components/crud.js';

// Estado de filtro a nivel de módulo (persiste entre re-renders).
function currentMonth() { return new Date().toISOString().slice(0, 7); }
const PAGE_SIZE = 50; // R1: paginación — antes se renderizaba TODO el historial
const FILTER = { q: '', type: 'all', accountId: 'all', month: currentMonth(), categoryId: 'all', limit: PAGE_SIZE };

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

function groupNet(txList, m, cur) {
  const debtIds = new Set(
    Object.values(m.acc).filter((a) => a.type === 'credit_card').map((a) => a.id),
  );
  let net = 0;
  for (const t of txList) {
    if (t.type === 'income') net += t.amount;
    else if (isExpenseLike(t, debtIds)) net -= t.amount;
  }
  if (net === 0) return '';
  return formatMoney(net, cur, { signed: true });
}

// ---------- Resumen vivo del filtro (R1): barras ingresos/gastos + neto ----------
function buildFlowSummary(filtered, m, cur) {
  if (!filtered.length) return null;
  const debtIds = new Set(
    Object.values(m.acc).filter((a) => a.type === 'credit_card').map((a) => a.id),
  );
  let income = 0, expense = 0;
  for (const t of filtered) {
    if (t.type === 'income') income += t.amount;
    else if (isExpenseLike(t, debtIds)) expense += t.amount;
  }
  const net = income - expense;
  const max = Math.max(income, expense, 1);
  const count = filtered.length === 1 ? '1 transacción' : `${filtered.length} transacciones`;
  const bar = (label, value, pct, variant) => el('div', { class: 'dash-flow__item' }, [
    el('div', { class: 'dash-flow__top' }, [
      el('span', { class: 't-caption', text: label }),
      el('span', { class: 'tabular dash-flow__amt', text: formatMoney(value, cur) }),
    ]),
    ProgressBar(pct, variant, { ariaLabel: label }),
  ]);
  return el('div', { class: 'card card--pad-sm tx-flow' }, [
    el('div', { class: 'dash-flow' }, [
      bar('Ingresos', income, (income / max) * 100, 'positive'),
      bar('Gastos', expense, (expense / max) * 100, 'negative'),
      el('div', { class: 'dash-flow__net' }, [
        el('span', { class: 't-caption', text: count }),
        el('span', { class: `tabular dash-flow__netval ${net >= 0 ? 'text-positive' : 'text-negative'}`,
          text: formatMoney(net, cur, { signed: true }) }),
      ]),
    ]),
  ]);
}

// ---------- Actualizar opciones de <select> sin recrear el elemento ----------
function updateOpts(selectEl, opts) {
  const cur = selectEl.value;
  selectEl.replaceChildren(...opts.map((o) =>
    el('option', { value: o.value, selected: String(o.value) === String(cur) ? true : null, text: o.label })
  ));
}

// ---------- Acciones de una transacción (compartidas: iconos desktop + sheet móvil) ----------
function txActions(t) {
  return [
    { label: 'Editar', iconName: 'edit', onClick: () => openTxModal({ tx: t, mode: 'edit' }) },
    { label: 'Duplicar', iconName: 'copy', onClick: () => openTxModal({ tx: { ...t, id: undefined, date: today() }, mode: 'create' }) },
    { label: 'Eliminar', iconName: 'trash', danger: true, onClick: () => confirmDialog({
      title: 'Eliminar transacción', message: '¿Eliminar esta transacción?',
      onConfirm: () => guardedOp(() => dataService.remove('transactions', t.id), 'Transacción eliminada', 'Error al eliminar'),
    }) },
  ];
}

// ---------- Fila ----------
function txRow(t, m, cur) {
  const isIncome = t.type === 'income';
  const isTransfer = t.type === 'transfer';
  const toAcc = m.acc[t.toAccountId];
  const isDebtPayment = isTransfer && toAcc && toAcc.type === 'credit_card';
  const cat = m.cat[t.categoryId];
  const acc = m.acc[t.accountId];
  const sign = isIncome ? '+' : (isTransfer && !isDebtPayment) ? '' : '−';
  const cls = isIncome ? 'text-positive' : (isTransfer && !isDebtPayment) ? '' : 'text-negative';
  const label = isDebtPayment
    ? `Pago ${toAcc.name}`
    : isTransfer ? 'Transferencia' : (cat ? cat.name : 'Sin categoría');
  const iconName = isTransfer ? 'transactions' : (cat ? cat.icon : 'wallet');
  const subLabel = isTransfer
    ? `${isDebtPayment ? 'Pago deuda' : 'Transferencia'} · ${acc ? acc.name : '?'} → ${toAcc ? toAcc.name : '?'} · ${formatDate(t.date, 'short')}`
    : `${label} · ${acc ? acc.name : ''} · ${formatDate(t.date, 'short')}`;

  const actions = txActions(t);

  // R1 móvil: la fila completa abre un bottom sheet (los 3 icon-btn quedan ocultos por CSS).
  return el('div', { class: 'row tx-row', on: { click: (e) => {
    if (!window.matchMedia('(max-width: 920px)').matches) return;
    if (e.target.closest('button, a')) return;
    openActionSheet({ title: t.description || label, actions });
  } } }, [
    el('div', { class: `row__avatar ${isIncome ? 'row__avatar--pos' : isTransfer ? 'row__avatar--accent' : ''}`, html: icon(iconName) }),
    el('div', { class: 'row__main' }, [
      el('div', { class: 'row__title', text: t.description || label }),
      el('div', { class: 'row__sub', text: subLabel }),
    ]),
    el('div', { class: `row__amount ${cls}`, text: `${sign}${formatMoney(t.amount, t.currency || cur)}` }),
    el('div', { class: 'row__actions' }, actions.map((a) =>
      el('button', {
        class: `icon-btn${a.danger ? ' icon-btn--danger' : ''}`,
        'aria-label': a.label, title: a.label,
        on: { click: a.onClick }, html: icon(a.iconName),
      }))),
  ]);
}

// ---------- Vista ----------
export function renderTransactions() {
  const root = el('div');
  const listMount = el('div');
  const summaryMount = el('div');

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

  // Todo cambio de filtro reinicia la paginación (R1).
  const resetAndPaint = () => { FILTER.limit = PAGE_SIZE; paint(); };
  searchEl.addEventListener('input', () => { FILTER.q = searchEl.value; resetAndPaint(); });
  monthEl.addEventListener('change', () => { FILTER.month = monthEl.value; resetAndPaint(); });
  typeEl.addEventListener('change', () => { FILTER.type = typeEl.value; FILTER.categoryId = 'all'; resetAndPaint(); });
  accEl.addEventListener('change', () => { FILTER.accountId = accEl.value; resetAndPaint(); });
  catEl.addEventListener('change', () => { FILTER.categoryId = catEl.value; resetAndPaint(); });

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

    // Resumen vivo con barras (R1) — totales sobre TODO el filtro, no la página.
    mount(summaryMount, buildFlowSummary(filtered, m, cur) || el('span'));

    // Paginación (R1): renderiza hasta FILTER.limit filas.
    const visible = filtered.slice(0, FILTER.limit);
    const remaining = filtered.length - visible.length;

    // Lista agrupada por fecha (TX-1)
    const groups = groupByDate(visible);
    const content = filtered.length
      ? el('div', {}, [
          el('div', { class: 'card card--pad-sm' }, [
            el('div', { class: 'row-list' }, [...groups.entries()].flatMap(([date, txs]) => [
              el('div', { class: 'tx-date-header' }, [
                el('span', { class: 'tx-date-label', text: dateGroupLabel(date) }),
                el('span', { class: 'tx-date-total', text: groupNet(txs, m, cur) }),
              ]),
              ...txs.map((t) => txRow(t, m, cur)),
            ])),
          ]),
          remaining > 0
            ? el('div', { class: 'tx-loadmore' }, [
                Button(`Cargar más (${remaining} restante${remaining === 1 ? '' : 's'})`, {
                  variant: 'ghost',
                  onClick: () => { FILTER.limit += PAGE_SIZE; paint(); },
                }),
              ])
            : null,
        ].filter(Boolean))
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
        el('div', { class: 'u-hide-mobile' }, [
          Button('Nueva transacción', { variant: 'primary', iconName: 'plus', onClick: () => openTxModal({ mode: 'create' }) }),
        ]),
      ]),
    ]),
    // R1: barra de filtros sticky (clase filterbar de R0.5)
    el('div', { class: 'toolbar filterbar' }, [
      el('div', { class: 'search' }, [el('span', { class: 'search__icon', html: icon('search') }), searchEl]),
      monthEl,
      typeEl,
      accEl,
      catEl,
    ]),
    summaryMount,
    listMount,
    Fab('Nueva transacción', { onClick: () => openTxModal({ mode: 'create' }) }),
  );

  paint();
  return root;
}
