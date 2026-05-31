// views/budgets.js — módulo de Presupuestos (CRUD + consumido/disponible/proyectado).
// Mensual o anual. Valores derivados calculados en selectors (no persistidos).

import { el, mount } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { store } from '../store/store.js';
import { selectors } from '../store/selectors.js';
import { dataService } from '../services/dataService.js';
import { formatMoney } from '../utils/format.js';
import { Button, Badge, ProgressBar, EmptyState } from '../components/ui.js';
import { openModal, confirmDialog } from '../components/modal.js';
import { field, numberInput, select, segmented, textInput } from '../components/forms.js';
import { toast } from '../services/toast.js';

const now = new Date();
const curMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
const curYearKey = String(now.getFullYear());

function expenseCategories(s) {
  return (s.categories || []).filter((c) => c.kind === 'expense');
}

function periodLabel(b) {
  if (b.period === 'annual') return `Anual ${b.periodKey}`;
  const [y, m] = b.periodKey.split('-');
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${months[Number(m) - 1] || ''} ${y}`;
}

// ---------- Formulario ----------
function buildBudgetForm(prefill) {
  const s = store.get();
  const state = { period: prefill.period || 'monthly' };
  const catOpts = expenseCategories(s).map((c) => ({ value: c.id, label: c.name }));

  const catEl = select({ name: 'categoryId', value: prefill.categoryId || (catOpts[0] && catOpts[0].value) || '', options: catOpts });
  const amountEl = numberInput({ name: 'amount', value: prefill.amount ?? '' });
  const periodWrap = el('div');

  function paintPeriod() {
    if (state.period === 'annual') {
      periodWrap.replaceChildren(field('Año', textInput({ name: 'periodKey', value: prefill.periodKey && prefill.periodKey.length === 4 ? prefill.periodKey : curYearKey, type: 'number' })));
    } else {
      periodWrap.replaceChildren(field('Mes', textInput({ name: 'periodKey', value: prefill.periodKey && prefill.periodKey.length === 7 ? prefill.periodKey : curMonthKey, type: 'month' })));
    }
  }
  paintPeriod();

  const seg = segmented({
    value: state.period,
    options: [{ value: 'monthly', label: 'Mensual' }, { value: 'annual', label: 'Anual' }],
    onChange: (v) => { state.period = v; paintPeriod(); },
  });

  const body = el('div', {}, [
    field('Categoría', catEl),
    field('Periodicidad', seg),
    periodWrap,
    field('Monto presupuestado', amountEl),
  ]);

  function getData() {
    return {
      categoryId: catEl.value,
      period: state.period,
      periodKey: body.querySelector('[name="periodKey"]').value,
      amount: Number(amountEl.value) || 0,
    };
  }
  return { body, getData };
}

function openBudgetModal({ budget = {}, mode = 'create' }) {
  const s = store.get();
  if (!expenseCategories(s).length) { toast('Crea categorías de gasto primero', { type: 'warning' }); return; }

  const ctl = buildBudgetForm(budget);
  openModal({
    title: mode === 'edit' ? 'Editar presupuesto' : 'Nuevo presupuesto',
    body: ctl.body,
    submitLabel: mode === 'edit' ? 'Guardar' : 'Crear',
    onSubmit: async () => {
      const data = ctl.getData();
      if (!data.categoryId) { toast('Selecciona una categoría', { type: 'negative' }); return false; }
      if (!data.amount || data.amount <= 0) { toast('El monto debe ser mayor a cero', { type: 'negative' }); return false; }
      if (!data.periodKey) { toast('Indica el periodo', { type: 'negative' }); return false; }
      try {
        if (mode === 'edit') { await dataService.update('budgets', budget.id, data); toast('Presupuesto actualizado'); }
        else { await dataService.create('budgets', data); toast('Presupuesto creado'); }
      } catch (e) { toast('Error al guardar', { type: 'negative' }); return false; }
    },
  });
}

function budgetCard(s, b, catMap, cur) {
  const cat = catMap[b.categoryId];
  const st = selectors.budgetStats(s, b);
  const over = st.pct >= 100;
  const near = st.pct >= 80 && !over;
  const variant = over ? 'negative' : near ? 'warning' : '';
  const availClass = st.available < 0 ? 'text-negative' : 'text-positive';

  return el('div', { class: 'card card--pad-sm' }, [
    el('div', { class: 'row-flex between' }, [
      el('div', { class: 'row-flex' }, [
        el('span', { class: 'row__avatar', html: icon(cat ? cat.icon : 'budgets') }),
        el('div', {}, [
          el('div', { class: 'row__title', text: cat ? cat.name : 'Sin categoría' }),
          el('div', { class: 'row__sub' }, [Badge(periodLabel(b), 'info')]),
        ]),
      ]),
      el('div', { class: 'row__actions' }, [
        el('button', { class: 'icon-btn', 'aria-label': 'Editar', title: 'Editar', on: { click: () => openBudgetModal({ budget: b, mode: 'edit' }) }, html: icon('edit') }),
        el('button', {
          class: 'icon-btn icon-btn--danger', 'aria-label': 'Eliminar', title: 'Eliminar',
          on: { click: () => confirmDialog({ title: 'Eliminar presupuesto', message: '¿Eliminar este presupuesto?', onConfirm: async () => { try { await dataService.remove('budgets', b.id); toast('Presupuesto eliminado'); } catch (e) { toast('Error al eliminar', { type: 'negative' }); } } }) },
          html: icon('trash'),
        }),
      ]),
    ]),
    el('div', { class: 'mt-4' }, [ProgressBar(st.pct, variant)]),
    el('div', { class: 'row-flex between mt-2' }, [
      el('span', { class: 't-caption', html: `Consumido <b class="tabular">${formatMoney(st.consumed, cur)}</b> de <span class="tabular">${formatMoney(st.amount, cur)}</span>` }),
      el('span', { class: `t-caption ${availClass}`, text: `${st.available < 0 ? 'Excedido ' : 'Disponible '}${formatMoney(Math.abs(st.available), cur)}` }),
    ]),
    st.projected !== st.consumed
      ? el('div', { class: 't-caption text-secondary mt-2', text: `Proyección al cierre: ${formatMoney(st.projected, cur)}` })
      : null,
  ].filter(Boolean));
}

export function renderBudgets() {
  const s = store.get();
  const cur = s.baseCurrency;
  const catMap = {}; (s.categories || []).forEach((c) => { catMap[c.id] = c; });
  const budgets = [...(s.budgets || [])];
  // Orden: mensual del mes actual primero, luego por consumo descendente.
  budgets.sort((a, b) => selectors.budgetStats(s, b).pct - selectors.budgetStats(s, a).pct);

  const totalBudget = budgets.reduce((sum, b) => sum + (b.amount || 0), 0);
  const totalConsumed = budgets.reduce((sum, b) => sum + selectors.budgetConsumed(s, b), 0);

  return el('div', {}, [
    el('div', { class: 'page-header' }, [
      el('div', { class: 'row-flex between' }, [
        el('div', {}, [
          el('h2', { class: 't-h1', text: 'Presupuestos' }),
          el('p', { class: 'page-header__sub', text: budgets.length ? `${formatMoney(totalConsumed, cur)} de ${formatMoney(totalBudget, cur)} consumido` : 'Define límites por categoría.' }),
        ]),
        Button('Nuevo presupuesto', { variant: 'primary', iconName: 'plus', onClick: () => openBudgetModal({ mode: 'create' }) }),
      ]),
    ]),
    budgets.length
      ? el('div', { class: 'grid grid--2' }, budgets.map((b) => budgetCard(s, b, catMap, cur)))
      : el('div', { class: 'card' }, [EmptyState({
          title: 'Sin presupuestos', message: 'Crea tu primer presupuesto mensual o anual.', iconName: 'budgets',
          action: Button('Nuevo presupuesto', { variant: 'primary', iconName: 'plus', onClick: () => openBudgetModal({ mode: 'create' }) }),
        })]),
  ]);
}
