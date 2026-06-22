// views/budgets.js — módulo de Presupuestos (CRUD + consumido/disponible/proyectado).
// Mensual o anual. Valores derivados calculados en selectors (no persistidos).

import { el, mount } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { store } from '../store/store.js';
import { selectors } from '../store/selectors.js';
import { dataService } from '../services/dataService.js';
import { formatMoney } from '../utils/format.js';
import { Button, Badge, ProgressBar, EmptyState, HeroCard, ScoreRing, Fab } from '../components/ui.js';
import { openModal, confirmDialog } from '../components/modal.js';
import { field, numberInput, select, segmented, textInput, setFieldError, focusFieldError } from '../components/forms.js';
import { toast } from '../services/toast.js';
import { guardedOp, guardedSave } from '../components/crud.js';

const now = new Date();
const curMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
const curYearKey = String(now.getFullYear());

function expenseCategories(s) {
  return (s.categories || []).filter((c) => c.kind === 'expense');
}

function parsePeriodKey(raw, isMonthly) {
  const s = String(raw);
  if (/^\d{4}/.test(s)) return s;
  const d = new Date(s);
  if (isNaN(d)) return s;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return isMonthly ? `${y}-${m}` : String(y);
}

function periodLabel(b) {
  const isMonthly = b.period !== 'annual';
  const key = parsePeriodKey(b.periodKey, isMonthly);
  if (!isMonthly) return `Anual ${key.slice(0, 4)}`;
  const [y, m] = key.split('-');
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
      const mark = (name, msg) => {
        const c = ctl.body.querySelector(`[name="${name}"]`);
        if (c) { focusFieldError(c); return setFieldError(c, msg); }
        toast(msg, { type: 'negative' }); return false;
      };
      if (!data.categoryId) return mark('categoryId', 'Selecciona una categoría');
      if (!data.amount || data.amount <= 0) return mark('amount', 'El monto debe ser mayor a cero');
      if (!data.periodKey) return mark('periodKey', 'Indica el periodo');
      // TD-37: impedir solapamiento (misma categoría + periodo + periodKey).
      const isMonthly = data.period !== 'annual';
      const normalizedKey = parsePeriodKey(data.periodKey, isMonthly);
      const clash = (store.get().budgets || []).find((b) =>
        b.id !== budget.id &&
        b.categoryId === data.categoryId &&
        b.period === data.period &&
        parsePeriodKey(b.periodKey, isMonthly) === normalizedKey
      );
      if (clash) return mark('categoryId', 'Ya existe un presupuesto para esta categoría y periodo');
      return guardedSave(
        () => mode === 'edit' ? dataService.update('budgets', budget.id, data) : dataService.create('budgets', data),
        mode === 'edit' ? 'Presupuesto actualizado' : 'Presupuesto creado',
      );
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
  // R2: la proyección al cierre se calcula desde antes (budgetStats.projected)
  // pero solo se mostraba como texto plano — ahora alerta cuando supera el límite.
  const projOver = st.projected > st.amount && !over;

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
          on: { click: () => confirmDialog({ title: 'Eliminar presupuesto', message: '¿Eliminar este presupuesto?', onConfirm: () => guardedOp(() => dataService.remove('budgets', b.id), 'Presupuesto eliminado', 'Error al eliminar') }) },
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
      ? el('div', { class: 'row-flex mt-2', style: 'gap: var(--space-2); flex-wrap: wrap' }, [
          el('span', { class: 't-caption text-secondary', text: `Proyección al cierre: ${formatMoney(st.projected, cur)}` }),
          projOver ? Badge(`supera el límite en ${formatMoney(st.projected - st.amount, cur, { compact: true })}`, 'warning') : null,
        ].filter(Boolean))
      : null,
  ].filter(Boolean));
}

// R2: período visible — navegable mes a mes (los datos históricos siempre
// estuvieron en la BD vía periodKey; antes solo se listaba todo junto).
const VIEW = { monthKey: curMonthKey };

function shiftMonth(key, delta) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthTitle(key) {
  const [y, m] = key.split('-').map(Number);
  const str = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1));
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function renderBudgets() {
  const root = el('div');

  function repaint() {
    const s = store.get();
    const cur = s.baseCurrency;
    const catMap = {}; (s.categories || []).forEach((c) => { catMap[c.id] = c; });

    // Presupuestos del período visible: mensuales del mes + anuales del año.
    const monthKey = VIEW.monthKey;
    const yearKey  = monthKey.slice(0, 4);
    const budgets = (s.budgets || []).filter((b) => {
      const isMonthly = b.period !== 'annual';
      const key = parsePeriodKey(b.periodKey, isMonthly);
      return isMonthly ? key === monthKey : key === yearKey;
    });
    budgets.sort((a, b) => selectors.budgetStats(s, b).pct - selectors.budgetStats(s, a).pct);

    const totalBudget = budgets.reduce((sum, b) => sum + (b.amount || 0), 0);
    const totalConsumed = budgets.reduce((sum, b) => sum + selectors.budgetConsumed(s, b), 0);
    const available = Math.max(0, totalBudget - totalConsumed);
    const consumedPct = totalBudget ? Math.round(totalConsumed / totalBudget * 100) : 0;
    const gaugeVariant = consumedPct >= 100 ? 'negative' : consumedPct >= 80 ? 'warning' : 'positive';
    const nearCount = budgets.filter((b) => selectors.budgetStats(s, b).pct >= 80).length;

    // Navegación de período ← Mes →
    const periodNav = el('div', { class: 'period-nav' }, [
      Button('‹', { variant: 'ghost', iconOnly: true, ariaLabel: 'Mes anterior',
        onClick: () => { VIEW.monthKey = shiftMonth(VIEW.monthKey, -1); repaint(); } }),
      el('span', { class: 'period-nav__label', text: monthTitle(monthKey) }),
      Button('›', { variant: 'ghost', iconOnly: true, ariaLabel: 'Mes siguiente',
        onClick: () => { VIEW.monthKey = shiftMonth(VIEW.monthKey, 1); repaint(); } }),
      monthKey !== curMonthKey
        ? Button('Hoy', { variant: 'ghost', size: 'sm', onClick: () => { VIEW.monthKey = curMonthKey; repaint(); } })
        : null,
    ].filter(Boolean));

    const header = el('div', { class: 'page-header' }, [
      el('div', { class: 'row-flex between' }, [
        el('div', {}, [
          el('h2', { class: 't-h1', text: 'Presupuestos' }),
          el('p', { class: 'page-header__sub', text: budgets.length ? `${budgets.length} presupuesto${budgets.length !== 1 ? 's' : ''} en ${monthTitle(monthKey)}` : 'Define límites por categoría.' }),
        ]),
        el('div', { class: 'u-hide-mobile' }, [
          Button('Nuevo presupuesto', { variant: 'primary', iconName: 'plus', onClick: () => openBudgetModal({ mode: 'create' }) }),
        ]),
      ]),
    ]);

    const children = [header, periodNav];

    if (budgets.length) {
      // Héroe (R2): disponible + gauge de consumo global
      children.push(el('div', { class: 'grid budget-hero' }, [
        HeroCard({
          label: 'Disponible',
          iconName: 'budgets',
          value: formatMoney(available, cur),
          trendRow: [
            Badge(`${consumedPct}% consumido`, consumedPct >= 100 ? 'negative' : consumedPct >= 80 ? 'warning' : 'positive'),
            nearCount ? el('span', { class: 't-caption', text: `${nearCount} cerca del límite` }) : null,
          ].filter(Boolean),
          split: [
            { label: 'Presupuestado', value: formatMoney(totalBudget, cur, { compact: true }) },
            { label: 'Consumido', value: formatMoney(totalConsumed, cur, { compact: true }), cls: consumedPct >= 100 ? 'text-negative' : '' },
          ],
        }),
        el('div', { class: 'card dash-health' }, [
          ScoreRing(consumedPct, gaugeVariant, { ariaLabel: `${consumedPct}% del presupuesto consumido` }),
          el('div', { class: 'dash-health__rows' }, [
            el('div', { class: 'dash-health__row' }, [
              el('span', { class: 't-caption', text: 'Consumo global' }),
              el('span', { class: 'tabular', text: `${consumedPct}%` }),
            ]),
            el('div', { class: 'dash-health__row' }, [
              el('span', { class: 't-caption', text: 'Al límite (≥80%)' }),
              el('span', { class: `tabular ${nearCount ? 'dash-warn' : 'text-positive'}`, text: String(nearCount) }),
            ]),
          ]),
        ]),
      ]));
      children.push(el('div', { class: 'grid grid--2 mt-4' }, budgets.map((b) => budgetCard(s, b, catMap, cur))));
    } else {
      // R2: empty state inteligente — sugiere presupuestos desde el gasto real
      // del mes anterior (top 3 categorías).
      const prevSpend = selectors.categorySpend(s, shiftMonth(monthKey, -1))
        .filter((c) => c.category)
        .slice(0, 3);
      const suggestions = prevSpend.length
        ? el('div', { class: 'budget-suggestions' }, [
            el('p', { class: 't-caption text-secondary', text: 'Sugerencias según tu gasto del mes anterior:' }),
            el('div', { class: 'row-flex', style: 'flex-wrap: wrap; gap: var(--space-2)' }, prevSpend.map((c) =>
              Button(`${c.category.name} (~${formatMoney(c.amount, cur, { compact: true })})`, {
                variant: 'ghost', size: 'sm', iconName: 'plus',
                onClick: () => openBudgetModal({ mode: 'create', budget: {
                  categoryId: c.category.id, amount: Math.round(c.amount), period: 'monthly', periodKey: monthKey,
                } }),
              }))),
          ])
        : null;
      children.push(el('div', { class: 'card' }, [EmptyState({
        title: monthKey === curMonthKey ? 'Sin presupuestos' : `Sin presupuestos en ${monthTitle(monthKey)}`,
        message: 'Crea tu primer presupuesto mensual o anual.', iconName: 'budgets',
        action: el('div', { class: 'stack' }, [
          Button('Nuevo presupuesto', { variant: 'primary', iconName: 'plus', onClick: () => openBudgetModal({ mode: 'create' }) }),
          suggestions,
        ].filter(Boolean)),
      })]));
    }

    children.push(Fab('Nuevo presupuesto', { onClick: () => openBudgetModal({ mode: 'create' }) }));
    root.replaceChildren(...children);
  }

  repaint();
  // Reactividad centralizada en core/app.js (render coalescido por rAF).
  return root;
}
