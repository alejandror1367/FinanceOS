// views/recurring.js — transacciones recurrentes (próximos pagos).
// CRUD sobre la entidad RecurringTransactions.

import { el } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { store } from '../store/store.js';
import { dataService } from '../services/dataService.js';
import { formatMoney, relativeDay } from '../utils/format.js';
import { Card, Badge, EmptyState, Button } from '../components/ui.js';
import { openModal, confirmDialog } from '../components/modal.js';
import { field, numberInput, textarea, select, segmented } from '../components/forms.js';
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
      if (!data.amount || data.amount <= 0) { toast('Monto inválido', { type: 'negative' }); return false; }
      if (!data.nextRunDate) { toast('Indica la próxima ejecución', { type: 'negative' }); return false; }
      if (data.type !== 'transfer' && !data.categoryId) { toast('Selecciona categoría', { type: 'negative' }); return false; }
      if (data.type === 'transfer' && (!data.toAccountId || data.toAccountId === data.accountId)) { toast('Cuentas destino inválida', { type: 'negative' }); return false; }
      return guardedSave(
        () => mode === 'edit' ? dataService.update('recurring', item.id, data) : dataService.create('recurring', data),
        mode === 'edit' ? 'Recurrente actualizado' : 'Recurrente creado',
      );
    },
  });
}

export function renderRecurring() {
  const s = store.get();
  const cur = s.baseCurrency;
  const cat = {}; (s.categories || []).forEach((c) => { cat[c.id] = c; });
  const items = [...(s.recurring || [])].sort((a, b) => (a.nextRunDate < b.nextRunDate ? -1 : 1));

  const rows = items.map((r) => {
    const c = cat[r.categoryId];
    const isIncome = r.type === 'income';
    const sign = isIncome ? '+' : r.type === 'transfer' ? '' : '−';
    return el('div', { class: 'row' }, [
      el('div', { class: 'row__avatar', html: icon(r.type === 'transfer' ? 'transactions' : (c ? c.icon : 'calendar')) }),
      el('div', { class: 'row__main' }, [
        el('div', { class: 'row__title' }, [r.description || (c ? c.name : 'Recurrente'), ' ', Badge(freqLabel(r.frequency), 'info'), ' ', r.isActive === false ? Badge('Pausada', 'warning') : null].filter(Boolean)),
        el('div', { class: 'row__sub', text: `Próximo: ${relativeDay(r.nextRunDate)}` }),
      ]),
      el('div', { class: `row__amount tabular ${isIncome ? 'text-positive' : r.type === 'transfer' ? '' : 'text-negative'}`, text: `${sign}${formatMoney(r.amount, r.currency || cur)}` }),
      el('div', { class: 'row__actions' }, [
        el('button', { class: 'icon-btn', 'aria-label': 'Editar', title: 'Editar', on: { click: () => openRecurringModal({ item: r, mode: 'edit' }) }, html: icon('edit') }),
        el('button', { class: 'icon-btn icon-btn--danger', 'aria-label': 'Eliminar', title: 'Eliminar', on: { click: () => confirmDialog({ title: 'Eliminar recurrente', message: `¿Eliminar "${r.description || 'este recurrente'}"?`, onConfirm: () => guardedOp(() => dataService.remove('recurring', r.id), 'Eliminado') }) }, html: icon('trash') }),
      ]),
    ]);
  });

  return el('div', {}, [
    el('div', { class: 'page-header' }, [
      el('div', { class: 'row-flex between' }, [
        el('div', {}, [
          el('h2', { class: 't-h1', text: 'Recurrentes' }),
          el('p', { class: 'page-header__sub', text: 'Pagos e ingresos automáticos programados.' }),
        ]),
        Button('Nuevo recurrente', { variant: 'primary', iconName: 'plus', onClick: () => openRecurringModal({ mode: 'create' }) }),
      ]),
    ]),
    items.length
      ? el('div', { class: 'card card--pad-sm' }, [el('div', { class: 'row-list' }, rows)])
      : el('div', { class: 'card' }, [EmptyState({ title: 'Sin recurrentes', message: 'Programa tus pagos fijos.', iconName: 'calendar',
          action: Button('Nuevo recurrente', { variant: 'primary', iconName: 'plus', onClick: () => openRecurringModal({ mode: 'create' }) }) })]),
  ]);
}
