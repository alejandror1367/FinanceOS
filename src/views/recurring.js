// views/recurring.js — transacciones recurrentes (próximos pagos).
// CRUD sobre la entidad RecurringTransactions.

import { el, mount } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { store } from '../store/store.js';
import { selectors } from '../store/selectors.js';
import { dataService } from '../services/dataService.js';
import { formatMoney, relativeDay } from '../utils/format.js';
import { Badge, EmptyState, Button, HeroCard, Fab } from '../components/ui.js';
import { openModal, confirmDialog, openActionSheet } from '../components/modal.js';
import { field, numberInput, textarea, select, segmented, setFieldError, focusFieldError } from '../components/forms.js';
import { toast } from '../services/toast.js';
import { guardedOp, guardedSave } from '../components/crud.js';

const FREQ = [
  { value: 'daily', label: 'Diaria' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensual' },
  { value: 'yearly', label: 'Anual' },
];
const freqLabel = (v) => (FREQ.find((f) => f.value === v) || {}).label || v;
const today = () => new Date().toISOString().slice(0, 10);

function buildForm(prefill) {
  const s = store.get();
  const state = { type: prefill.type || 'expense' };
  const accountOpts = (s.accounts || []).filter((a) => !a.isArchived).map((a) => ({ value: a.id, label: a.name }));

  const amountEl = numberInput({ name: 'amount', value: prefill.amount ?? '' });
  const accountEl = select({ name: 'accountId', value: prefill.accountId || (accountOpts[0] && accountOpts[0].value) || '', options: accountOpts });
  const descEl = textarea({ name: 'description', value: prefill.description || '', placeholder: 'Descripción' });
  const freqEl = select({ name: 'frequency', value: prefill.frequency || 'monthly', options: FREQ });
  const dateEl = el('input', { class: 'input', name: 'nextRunDate', type: 'date', value: (prefill.nextRunDate || today()).slice(0, 10) });
  const activeEl = select({ name: 'isActive', value: prefill.isActive === false ? 'false' : 'true', options: [{ value: 'true', label: 'Activa' }, { value: 'false', label: 'Pausada' }] });
  const dynamic = el('div');

  function paintDynamic() {
    if (state.type === 'transfer') {
      dynamic.replaceChildren(field('Cuenta destino', select({ name: 'toAccountId', value: prefill.toAccountId || '', options: accountOpts })));
    } else {
      const catOpts = (s.categories || []).filter((c) => c.kind === state.type).map((c) => ({ value: c.id, label: c.name }));
      dynamic.replaceChildren(field('Categoría', select({ name: 'categoryId', value: prefill.categoryId || (catOpts[0] && catOpts[0].value) || '', options: catOpts })));
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
    el('div', { class: 'field-row' }, [field('Monto', amountEl), field('Frecuencia', freqEl)]),
    field('Cuenta', accountEl),
    dynamic,
    el('div', { class: 'field-row' }, [field('Próxima ejecución', dateEl), field('Estado', activeEl)]),
    field('Descripción', descEl),
  ]);

  function getData() {
    const data = {
      type: state.type,
      amount: Number(amountEl.value) || 0,
      accountId: accountEl.value,
      description: descEl.value.trim(),
      frequency: freqEl.value,
      nextRunDate: dateEl.value,
      isActive: activeEl.value === 'true',
    };
    if (state.type === 'transfer') data.toAccountId = body.querySelector('[name="toAccountId"]').value;
    else data.categoryId = body.querySelector('[name="categoryId"]').value;
    return data;
  }
  return { body, getData };
}

function openRecurringModal({ item = {}, mode = 'create' }) {
  if (!(store.get().accounts || []).filter((a) => !a.isArchived).length) { toast('Crea una cuenta primero', { type: 'warning' }); return; }
  const ctl = buildForm(item);
  openModal({
    title: mode === 'edit' ? 'Editar recurrente' : 'Nuevo recurrente',
    body: ctl.body,
    submitLabel: mode === 'edit' ? 'Guardar' : 'Crear',
    onSubmit: async () => {
      const data = ctl.getData();
      const mark = (name, msg) => {
        const c = ctl.body.querySelector(`[name="${name}"]`);
        if (c) { focusFieldError(c); return setFieldError(c, msg); }
        toast(msg, { type: 'negative' }); return false;
      };
      if (!data.amount || data.amount <= 0) return mark('amount', 'El monto debe ser mayor a cero');
      if (!data.nextRunDate) return mark('nextRunDate', 'Indica la próxima ejecución');
      if (data.type !== 'transfer' && !data.categoryId) return mark('categoryId', 'Selecciona una categoría');
      if (data.type === 'transfer' && (!data.toAccountId || data.toAccountId === data.accountId)) return mark('toAccountId', 'La cuenta destino debe ser distinta');
      return guardedSave(
        () => mode === 'edit' ? dataService.update('recurring', item.id, data) : dataService.create('recurring', data),
        mode === 'edit' ? 'Recurrente actualizado' : 'Recurrente creado',
      );
    },
  });
}

// R2: acciones de un recurrente (iconos desktop + sheet móvil). Incluye
// pausar/activar sin abrir el modal de edición.
function recurringActions(r) {
  const paused = r.isActive === false;
  return [
    { label: paused ? 'Activar' : 'Pausar', iconName: paused ? 'check' : 'close',
      onClick: () => guardedOp(
        () => dataService.update('recurring', r.id, { isActive: paused }),
        paused ? 'Recurrente activado' : 'Recurrente pausado',
      ) },
    { label: 'Editar', iconName: 'edit', onClick: () => openRecurringModal({ item: r, mode: 'edit' }) },
    { label: 'Eliminar', iconName: 'trash', danger: true, onClick: () => confirmDialog({
      title: 'Eliminar recurrente',
      message: `¿Eliminar "${r.description || 'este recurrente'}"?`,
      onConfirm: () => guardedOp(() => dataService.remove('recurring', r.id), 'Eliminado'),
    }) },
  ];
}

function recurringRow(r, cat, cur) {
  const c = cat[r.categoryId];
  const isIncome = r.type === 'income';
  const paused = r.isActive === false;
  const sign = isIncome ? '+' : r.type === 'transfer' ? '' : '−';
  const actions = recurringActions(r);
  return el('div', { class: `row rec-row${paused ? ' rec-row--paused' : ''}`, on: { click: (e) => {
    if (!window.matchMedia('(max-width: 920px)').matches) return;
    if (e.target.closest('button, a')) return;
    openActionSheet({ title: r.description || (c ? c.name : 'Recurrente'), actions });
  } } }, [
    el('div', { class: 'row__avatar', html: icon(r.type === 'transfer' ? 'transactions' : (c ? c.icon : 'calendar')) }),
    el('div', { class: 'row__main' }, [
      el('div', { class: 'row__title' }, [
        r.description || (c ? c.name : 'Recurrente'), ' ',
        Badge(freqLabel(r.frequency), 'info'), ' ',
        paused ? Badge('Pausada', 'warning') : null,
      ].filter(Boolean)),
      el('div', { class: 'row__sub', text: `Próximo: ${relativeDay(r.nextRunDate)}` }),
    ]),
    el('div', { class: `row__amount tabular ${isIncome ? 'text-positive' : r.type === 'transfer' ? '' : 'text-negative'}`, text: `${sign}${formatMoney(r.amount, r.currency || cur)}` }),
    el('div', { class: 'row__actions' }, actions.map((a) =>
      el('button', {
        class: `icon-btn${a.danger ? ' icon-btn--danger' : ''}`,
        'aria-label': a.label, title: a.label,
        on: { click: a.onClick }, html: icon(a.iconName),
      }))),
  ]);
}

// Agrupación temporal (R2): Vencidos · Esta semana · Próxima semana · Más adelante · Pausados.
function timelineBuckets(items) {
  const todayKey = today();
  const in7  = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const in14 = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  const buckets = [
    { label: 'Vencidos', items: [] },
    { label: 'Esta semana', items: [] },
    { label: 'Próxima semana', items: [] },
    { label: 'Más adelante', items: [] },
    { label: 'Pausados', items: [] },
  ];
  for (const r of items) {
    if (r.isActive === false) { buckets[4].items.push(r); continue; }
    const d = String(r.nextRunDate || '').slice(0, 10);
    if (d < todayKey) buckets[0].items.push(r);
    else if (d <= in7) buckets[1].items.push(r);
    else if (d <= in14) buckets[2].items.push(r);
    else buckets[3].items.push(r);
  }
  return buckets.filter((b) => b.items.length);
}

export function renderRecurring() {
  const root = el('div');

  function repaint() {
    const s = store.get();
    const cur = s.baseCurrency;
    const cat = {}; (s.categories || []).forEach((c) => { cat[c.id] = c; });
    const items = [...(s.recurring || [])].sort((a, b) => (a.nextRunDate < b.nextRunDate ? -1 : 1));

    // Héroe (R2): carga mensual normalizada de recurrentes activos.
    const load = selectors.recurringMonthlyLoad(s);
    const activeCount = items.filter((r) => r.isActive !== false).length;
    const hero = HeroCard({
      label: 'Compromiso mensual',
      iconName: 'recurring',
      value: formatMoney(load.expense, cur),
      trendRow: [
        el('span', { class: 't-caption', text: `${activeCount} recurrente${activeCount !== 1 ? 's' : ''} activo${activeCount !== 1 ? 's' : ''} · normalizado a mes` }),
        load.unconvertedCount ? Badge(`${load.unconvertedCount} sin tasa FX`, 'warning') : null,
      ].filter(Boolean),
      split: [
        { label: 'Ingresos fijos', value: formatMoney(load.income, cur, { compact: true }), cls: load.income > 0 ? 'text-positive' : '' },
        { label: 'Neto', value: formatMoney(load.net, cur, { compact: true, signed: true }), cls: load.net < 0 ? 'text-negative' : 'text-positive' },
      ],
    });

    const buckets = timelineBuckets(items);
    const content = items.length
      ? el('div', { class: 'stack stack--lg' }, buckets.map((b) => el('div', { class: 'acct-group' }, [
          el('div', { class: 'acct-group__header' }, [
            el('span', { class: 'acct-group__label', text: `${b.label} · ${b.items.length}` }),
          ]),
          el('div', { class: 'card card--pad-sm' }, [
            el('div', { class: 'row-list' }, b.items.map((r) => recurringRow(r, cat, cur))),
          ]),
        ])))
      : el('div', { class: 'card' }, [EmptyState({ title: 'Sin recurrentes', message: 'Programa tus pagos fijos.', iconName: 'calendar',
          action: Button('Nuevo recurrente', { variant: 'primary', iconName: 'plus', onClick: () => openRecurringModal({ mode: 'create' }) }) })]);

    mount(root,
      el('div', {}, [
        el('div', { class: 'page-header' }, [
          el('div', { class: 'row-flex between' }, [
            el('div', {}, [
              el('h2', { class: 't-h1', text: 'Recurrentes' }),
              el('p', { class: 'page-header__sub', text: 'Pagos e ingresos automáticos programados.' }),
            ]),
            el('div', { class: 'u-hide-mobile' }, [
              Button('Nuevo recurrente', { variant: 'primary', iconName: 'plus', onClick: () => openRecurringModal({ mode: 'create' }) }),
            ]),
          ]),
        ]),
        items.length ? hero : null,
        el('div', { class: items.length ? 'section' : '' }, [content]),
        Fab('Nuevo recurrente', { onClick: () => openRecurringModal({ mode: 'create' }) }),
      ].filter(Boolean))
    );
  }

  store.subscribe(() => { if (root.isConnected) repaint(); });
  repaint();
  return root;
}
