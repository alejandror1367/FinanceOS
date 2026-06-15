// views/goals.js — módulo de Metas.
// Avance, tiempo estimado y aporte recomendado (derivados, no persistidos).

import { el, mount } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { store } from '../store/store.js';
import { selectors } from '../store/selectors.js';
import { dataService } from '../services/dataService.js';
import { formatMoney, formatDate } from '../utils/format.js';
import { Badge, ProgressBar, EmptyState, Button, HeroCard, ScoreRing, Fab } from '../components/ui.js';
import { openModal, confirmDialog, openActionSheet } from '../components/modal.js';
import { field, textInput, numberInput, select, setFieldError, focusFieldError } from '../components/forms.js';
import { toast } from '../services/toast.js';
import { guardedOp, guardedSave } from '../components/crud.js';

const GOAL_TYPES = [
  { value: 'emergency_fund', label: 'Fondo de emergencia', icon: 'budgets' },
  { value: 'housing', label: 'Vivienda', icon: 'home' },
  { value: 'travel', label: 'Viaje', icon: 'car' },
  { value: 'retirement', label: 'Retiro', icon: 'networth' },
  { value: 'vehicle', label: 'Vehículo', icon: 'car' },
  { value: 'education', label: 'Educación', icon: 'journal' },
  { value: 'other', label: 'Otro', icon: 'goals' },
];
const STATUSES = [
  { value: 'active', label: 'Activa' },
  { value: 'paused', label: 'Pausada' },
  { value: 'completed', label: 'Completada' },
];
const typeMeta = (v) => GOAL_TYPES.find((t) => t.value === v) || { label: v, icon: 'goals' };

function monthsUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr); const now = new Date();
  let m = (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth());
  if (d.getDate() < now.getDate()) m -= 1;
  return Math.max(0, m);
}

function goalStats(g) {
  const target = g.targetAmount || 0;
  const current = g.currentAmount || 0;
  const pct = target ? Math.min(100, (current / target) * 100) : 0;
  const remaining = Math.max(0, target - current);
  const months = monthsUntil(g.targetDate);
  const recommended = (months && months > 0) ? remaining / months : null;
  return { target, current, pct, remaining, months, recommended };
}

// Forecasting basado en el ritmo de ahorro mensual actual.
function goalForecast(remaining, monthlySavings) {
  if (!remaining || remaining <= 0 || !monthlySavings || monthlySavings <= 0) return null;
  const months = Math.ceil(remaining / monthlySavings);
  if (months > 240) return null; // más de 20 años — no informativo
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  const dateStr = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(d);
  return { months, dateStr };
}

// ---------- Formularios ----------
function openGoalModal({ goal = {}, mode = 'create' }) {
  const s = store.get();
  const accountOpts = [{ value: '', label: '— Sin vincular —' }]
    .concat((s.accounts || []).filter((a) => !a.isArchived).map((a) => ({ value: a.id, label: a.name })));

  const body = el('div', {}, [
    field('Nombre', textInput({ name: 'name', value: goal.name || '', placeholder: 'Fondo de emergencia' })),
    el('div', { class: 'field-row' }, [
      field('Tipo', select({ name: 'type', value: goal.type || 'other', options: GOAL_TYPES.map((t) => ({ value: t.value, label: t.label })) })),
      field('Estado', select({ name: 'status', value: goal.status || 'active', options: STATUSES })),
    ]),
    el('div', { class: 'field-row' }, [
      field('Meta', numberInput({ name: 'targetAmount', value: goal.targetAmount ?? '' })),
      field('Acumulado', numberInput({ name: 'currentAmount', value: goal.currentAmount ?? '' })),
    ]),
    el('div', { class: 'field-row' }, [
      field('Fecha objetivo', textInput({ name: 'targetDate', value: (goal.targetDate || '').slice(0, 10), type: 'date' })),
      field('Cuenta vinculada', select({ name: 'linkedAccountId', value: goal.linkedAccountId || '', options: accountOpts })),
    ]),
  ]);

  openModal({
    title: mode === 'edit' ? 'Editar meta' : 'Nueva meta',
    body,
    submitLabel: mode === 'edit' ? 'Guardar' : 'Crear',
    onSubmit: async () => {
      const g = (n) => body.querySelector(`[name="${n}"]`).value;
      const data = {
        name: g('name').trim(),
        type: g('type'),
        status: g('status'),
        targetAmount: Number(g('targetAmount')) || 0,
        currentAmount: Number(g('currentAmount')) || 0,
        targetDate: g('targetDate'),
        linkedAccountId: g('linkedAccountId'),
      };
      const mark = (n, msg) => {
        const c = body.querySelector(`[name="${n}"]`);
        if (c) { focusFieldError(c); return setFieldError(c, msg); }
        toast(msg, { type: 'negative' }); return false;
      };
      if (!data.name) return mark('name', 'El nombre es obligatorio');
      if (data.targetAmount <= 0) return mark('targetAmount', 'La meta debe ser mayor a cero');
      return guardedSave(
        () => mode === 'edit' ? dataService.update('goals', goal.id, data) : dataService.create('goals', data),
        mode === 'edit' ? 'Meta actualizada' : 'Meta creada',
      );
    },
  });
}

// Aporte rápido a una meta. Exportado: la vista Hoy lo usa en "Para hoy" (R1).
export function openContributeModal(goal) {
  const s = store.get();
  const cur = goal.currency || s.baseCurrency;
  const linkedAcc = goal.linkedAccountId ? (s.accounts || []).find((a) => a.id === goal.linkedAccountId) : null;
  const body = el('div', {}, [
    el('p', { class: 't-caption text-secondary', text: `Acumulado actual: ${formatMoney(goal.currentAmount || 0, cur)}` }),
    field('Monto a aportar', numberInput({ name: 'amount', value: '' })),
    linkedAcc
      ? el('p', { class: 't-caption text-tertiary mt-2', text: `Cuenta vinculada: ${linkedAcc.name} · El aporte actualiza el progreso; el saldo de la cuenta se ajusta manualmente.` })
      : el('p', { class: 't-caption text-tertiary mt-2', text: 'Vincula una cuenta en la meta para saber de dónde sale el dinero.' }),
  ]);
  openModal({
    title: `Aportar a ${goal.name}`,
    body,
    submitLabel: 'Registrar aporte',
    onSubmit: async () => {
      const amountEl = body.querySelector('[name="amount"]');
      const amount = Number(amountEl.value) || 0;
      if (amount <= 0) { focusFieldError(amountEl); return setFieldError(amountEl, 'Ingresa un monto válido'); }
      const next = (goal.currentAmount || 0) + amount;
      const status = next >= (goal.targetAmount || 0) ? 'completed' : goal.status;
      return guardedSave(() => dataService.update('goals', goal.id, { currentAmount: next, status }), 'Aporte registrado', 'Error al aportar');
    },
  });
}

function goalCard(g, cur, monthlySavings) {
  const st = goalStats(g);
  const done = g.status === 'completed' || st.pct >= 100;
  const statusBadge = done ? Badge('Completada', 'positive') : g.status === 'paused' ? Badge('Pausada', 'warning') : Badge('Activa', 'info');
  const forecast = !done ? goalForecast(st.remaining, monthlySavings) : null;

  // CAMBIO 7 (rediseño): probabilidad determinista de cumplimiento — misma
  // heurística del Dashboard (selectors.goalOutlook), aporte = reparto mensual.
  const outlook = !done ? selectors.goalOutlook(store.get(), g, monthlySavings) : null;
  const probBadge = outlook?.probability != null
    ? Badge(`${outlook.probability}% prob.`,
        outlook.probability >= 70 ? 'positive' : outlook.probability >= 40 ? 'warning' : 'negative')
    : null;

  // Línea de proyección inteligente — combina aporte recomendado + ritmo real.
  let forecastEl = null;
  if (!done) {
    const lines = [];
    if (st.recommended) {
      lines.push(el('span', { class: 'text-secondary' },
        [`Necesitas ${formatMoney(st.recommended, cur)}/mes para llegar en ${st.months} ${st.months === 1 ? 'mes' : 'meses'}.`]));
    } else if (st.months === 0) {
      lines.push(el('span', { class: 'text-secondary' }, ['La fecha objetivo ya pasó.']));
    } else {
      lines.push(el('span', { class: 'text-secondary' }, ['Define una fecha objetivo para calcular el aporte recomendado.']));
    }
    if (forecast) {
      const ahead = st.months != null && forecast.months <= st.months;
      const cls = ahead ? 'text-positive' : monthlySavings > 0 ? 'text-warning' : 'text-secondary';
      const icon_ = ahead ? '✓' : '→';
      lines.push(el('span', { class: cls },
        [`${icon_} A este ritmo (${formatMoney(monthlySavings, cur)}/mes): ${forecast.dateStr} (${forecast.months} ${forecast.months === 1 ? 'mes' : 'meses'})`]));
    } else if (monthlySavings <= 0) {
      lines.push(el('span', { class: 'text-negative' }, ['Sin ahorro neto este mes.']));
    }
    if (lines.length) {
      forecastEl = el('div', { class: 't-caption mt-2', style: 'display:flex;flex-direction:column;gap:2px' }, lines);
    }
  }

  // R4: acciones declarativas (iconos desktop + bottom sheet móvil).
  const actions = [
    { label: 'Aportar', iconName: 'plus', onClick: () => openContributeModal(g) },
    { label: 'Editar', iconName: 'edit', onClick: () => openGoalModal({ goal: g, mode: 'edit' }) },
    { label: 'Eliminar', iconName: 'trash', danger: true, onClick: () => confirmDialog({
      title: 'Eliminar meta', message: `¿Eliminar "${g.name}"?`,
      onConfirm: () => guardedOp(() => dataService.remove('goals', g.id), 'Meta eliminada'),
    }) },
  ];

  return el('div', { class: 'card card--pad-sm goal-card', on: { click: (e) => {
    if (!window.matchMedia('(max-width: 920px)').matches) return;
    if (e.target.closest('button, a')) return;
    openActionSheet({ title: g.name, actions });
  } } }, [
    el('div', { class: 'row-flex between' }, [
      el('div', { class: 'row-flex' }, [
        el('span', { class: 'row__avatar', html: icon(typeMeta(g.type).icon) }),
        el('div', {}, [
          el('div', { class: 'row__title' }, [g.name, ' ', statusBadge, probBadge ? ' ' : null, probBadge].filter(Boolean)),
          el('div', { class: 'row__sub', text: typeMeta(g.type).label + (g.targetDate ? ` · ${formatDate(g.targetDate, 'medium')}` : '') }),
        ]),
      ]),
      el('div', { class: 'row__actions' }, actions.map((a) =>
        el('button', {
          class: `icon-btn${a.danger ? ' icon-btn--danger' : ''}`,
          'aria-label': a.label, title: a.label,
          on: { click: a.onClick }, html: icon(a.iconName),
        }))),
    ]),
    el('div', { class: 'mt-4' }, [ProgressBar(st.pct, done ? '' : 'gold')]),
    el('div', { class: 'row-flex between mt-2' }, [
      el('span', { class: 't-caption', html: `<b class="tabular">${formatMoney(st.current, cur)}</b> de <span class="tabular">${formatMoney(st.target, cur)}</span> · ${st.pct.toFixed(0)}%` }),
      el('span', { class: 't-caption text-secondary', text: done ? '¡Meta cumplida!' : `Faltan ${formatMoney(st.remaining, cur)}` }),
    ]),
    forecastEl,
  ].filter(Boolean));
}

// R4: orden de metas — por avance (default) o por riesgo (probabilidad ascendente,
// las que peligran primero). Las completadas van al final en ambos modos.
const GOALS_STATE = { sort: 'progress' };
function sortGoals(goals, mode, s, savingsPerGoal) {
  const done = (g) => g.status === 'completed' || goalStats(g).pct >= 100;
  return [...goals].sort((a, b) => {
    if (done(a) !== done(b)) return done(a) ? 1 : -1;
    if (mode === 'risk') {
      const pa = selectors.goalOutlook(s, a, savingsPerGoal).probability ?? 999;
      const pb = selectors.goalOutlook(s, b, savingsPerGoal).probability ?? 999;
      return pa - pb;
    }
    return goalStats(b).pct - goalStats(a).pct;
  });
}

export function renderGoals() {
  const root = el('div');

  function repaint() {
    const s = store.get();
    const cur = s.baseCurrency;
    const allGoals = s.goals || [];
    // FIN-011 (TD-52): repartir el ahorro mensual entre las metas activas con saldo
    // pendiente (selector goalSavingsSplit). Sin reparto, cada meta asume el 100%.
    const savingsPerGoal = selectors.goalSavingsSplit(s);
    const goals = sortGoals(allGoals, GOALS_STATE.sort, s, savingsPerGoal);
    const totalTarget = goals.reduce((sum, g) => sum + (g.targetAmount || 0), 0);
    const totalCurrent = goals.reduce((sum, g) => sum + (g.currentAmount || 0), 0);
    const globalPct = totalTarget ? Math.round((totalCurrent / totalTarget) * 100) : 0;

    // Héroe (R4): total ahorrado + gauge de avance global + aporte mensual disponible.
    const heroBlock = goals.length
      ? el('div', { class: 'grid budget-hero' }, [
          HeroCard({
            label: 'Ahorrado en metas',
            iconName: 'goals',
            value: formatMoney(totalCurrent, cur),
            trendRow: [
              Badge(`${globalPct}% del objetivo`, globalPct >= 70 ? 'positive' : globalPct >= 40 ? 'warning' : 'info'),
              el('span', { class: 't-caption', text: `${goals.length} meta${goals.length !== 1 ? 's' : ''}` }),
            ],
            split: [
              { label: 'Objetivo total', value: formatMoney(totalTarget, cur, { compact: true }) },
              { label: 'Falta', value: formatMoney(Math.max(0, totalTarget - totalCurrent), cur, { compact: true }) },
              { label: 'Ahorro/mes disp.', value: formatMoney(savingsPerGoal, cur, { compact: true }), cls: savingsPerGoal > 0 ? 'text-positive' : '' },
            ],
          }),
          el('div', { class: 'card dash-health' }, [
            ScoreRing(globalPct, globalPct >= 70 ? 'positive' : globalPct >= 40 ? 'warning' : 'info', { ariaLabel: `${globalPct}% del objetivo global` }),
            el('div', { class: 'dash-health__rows' }, [
              el('div', { class: 'dash-health__row' }, [
                el('span', { class: 't-caption', text: 'Avance global' }),
                el('span', { class: 'tabular', text: `${globalPct}%` }),
              ]),
              el('div', { class: 'dash-health__row' }, [
                el('span', { class: 't-caption', text: 'Aporte mensual' }),
                el('span', { class: 'tabular', text: formatMoney(savingsPerGoal, cur, { compact: true }) }),
              ]),
            ]),
          ]),
        ])
      : null;

    // Segmented: orden por Avance | Riesgo.
    const sortSeg = goals.length > 1
      ? el('div', { class: 'seg', style: { width: 'auto' } }, [
          el('button', { class: 'seg__btn', 'aria-pressed': String(GOALS_STATE.sort === 'progress'), text: 'Avance', on: { click: () => { GOALS_STATE.sort = 'progress'; repaint(); } } }),
          el('button', { class: 'seg__btn', 'aria-pressed': String(GOALS_STATE.sort === 'risk'), text: 'Riesgo', on: { click: () => { GOALS_STATE.sort = 'risk'; repaint(); } } }),
        ])
      : null;

    mount(root,
      el('div', {}, [
        el('div', { class: 'page-header' }, [
          el('div', { class: 'row-flex between' }, [
            el('div', {}, [
              el('h2', { class: 't-h1', text: 'Metas' }),
              el('p', { class: 'page-header__sub', text: goals.length ? `${formatMoney(totalCurrent, cur)} de ${formatMoney(totalTarget, cur)} ahorrado` : 'Define tus objetivos financieros.' }),
            ]),
            el('div', { class: 'u-hide-mobile' }, [
              Button('Nueva meta', { variant: 'primary', iconName: 'plus', onClick: () => openGoalModal({ mode: 'create' }) }),
            ]),
          ]),
        ]),
        heroBlock,
        sortSeg ? el('div', { class: 'row-flex between section', style: 'align-items:center' }, [
          el('span', { class: 't-caption text-secondary', text: GOALS_STATE.sort === 'risk' ? 'Las metas en riesgo aparecen primero.' : 'Ordenadas por avance.' }),
          sortSeg,
        ]) : null,
        goals.length
          ? el('div', { class: goals.length === 1 ? 'stack' : 'grid grid--2', style: sortSeg ? '' : 'margin-top:var(--space-6)' }, goals.map((g) => goalCard(g, cur, savingsPerGoal)))
          : el('div', { class: 'card' }, [EmptyState({ title: 'Sin metas', message: 'Crea tu primera meta financiera.', iconName: 'goals',
              action: Button('Nueva meta', { variant: 'primary', iconName: 'plus', onClick: () => openGoalModal({ mode: 'create' }) }) })]),
        Fab('Nueva meta', { onClick: () => openGoalModal({ mode: 'create' }) }),
      ].filter(Boolean))
    );
  }

  store.subscribe(() => { if (root.isConnected) repaint(); });
  repaint();
  return root;
}
