// views/goals.js — módulo de Metas.
// Avance, tiempo estimado y aporte recomendado (derivados, no persistidos).

import { el, mount } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { store } from '../store/store.js';
import { selectors } from '../store/selectors.js';
import { dataService } from '../services/dataService.js';
import { formatMoney, formatDate } from '../utils/format.js';
import { Card, Badge, ProgressBar, EmptyState, Button } from '../components/ui.js';
import { openModal, confirmDialog } from '../components/modal.js';
import { field, textInput, numberInput, select } from '../components/forms.js';
import { toast } from '../services/toast.js';

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
      if (!data.name) { toast('El nombre es obligatorio', { type: 'negative' }); return false; }
      if (data.targetAmount <= 0) { toast('La meta debe ser mayor a cero', { type: 'negative' }); return false; }
      try {
        if (mode === 'edit') { await dataService.update('goals', goal.id, data); toast('Meta actualizada'); }
        else { await dataService.create('goals', data); toast('Meta creada'); }
      } catch (e) { toast('Error al guardar', { type: 'negative' }); return false; }
    },
  });
}

// Aporte rápido a una meta.
function openContributeModal(goal) {
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
      const amount = Number(body.querySelector('[name="amount"]').value) || 0;
      if (amount <= 0) { toast('Ingresa un monto válido', { type: 'negative' }); return false; }
      const next = (goal.currentAmount || 0) + amount;
      const status = next >= (goal.targetAmount || 0) ? 'completed' : goal.status;
      try { await dataService.update('goals', goal.id, { currentAmount: next, status }); toast('Aporte registrado'); }
      catch (e) { toast('Error al aportar', { type: 'negative' }); return false; }
    },
  });
}

function goalCard(g, cur, monthlySavings) {
  const st = goalStats(g);
  const done = g.status === 'completed' || st.pct >= 100;
  const statusBadge = done ? Badge('Completada', 'positive') : g.status === 'paused' ? Badge('Pausada', 'warning') : Badge('Activa', 'info');
  const forecast = !done ? goalForecast(st.remaining, monthlySavings) : null;

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

  return el('div', { class: 'card card--pad-sm' }, [
    el('div', { class: 'row-flex between' }, [
      el('div', { class: 'row-flex' }, [
        el('span', { class: 'row__avatar', html: icon(typeMeta(g.type).icon) }),
        el('div', {}, [
          el('div', { class: 'row__title' }, [g.name, ' ', statusBadge]),
          el('div', { class: 'row__sub', text: typeMeta(g.type).label + (g.targetDate ? ` · ${formatDate(g.targetDate, 'medium')}` : '') }),
        ]),
      ]),
      el('div', { class: 'row__actions' }, [
        el('button', { class: 'icon-btn', 'aria-label': 'Aportar', title: 'Aportar', on: { click: () => openContributeModal(g) }, html: icon('plus') }),
        el('button', { class: 'icon-btn', 'aria-label': 'Editar', title: 'Editar', on: { click: () => openGoalModal({ goal: g, mode: 'edit' }) }, html: icon('edit') }),
        el('button', { class: 'icon-btn icon-btn--danger', 'aria-label': 'Eliminar', title: 'Eliminar', on: { click: () => confirmDialog({ title: 'Eliminar meta', message: `¿Eliminar "${g.name}"?`, onConfirm: async () => { try { await dataService.remove('goals', g.id); toast('Meta eliminada'); } catch (e) { toast('Error', { type: 'negative' }); } } }) }, html: icon('trash') }),
      ]),
    ]),
    el('div', { class: 'mt-4' }, [ProgressBar(st.pct, done ? '' : 'gold')]),
    el('div', { class: 'row-flex between mt-2' }, [
      el('span', { class: 't-caption', html: `<b class="tabular">${formatMoney(st.current, cur)}</b> de <span class="tabular">${formatMoney(st.target, cur)}</span> · ${st.pct.toFixed(0)}%` }),
      el('span', { class: 't-caption text-secondary', text: done ? '¡Meta cumplida!' : `Faltan ${formatMoney(st.remaining, cur)}` }),
    ]),
    forecastEl,
  ].filter(Boolean));
}

export function renderGoals() {
  const root = el('div');

  function repaint() {
    const s = store.get();
    const cur = s.baseCurrency;
    const goals = [...(s.goals || [])].sort((a, b) => goalStats(b).pct - goalStats(a).pct);
    const totalTarget = goals.reduce((sum, g) => sum + (g.targetAmount || 0), 0);
    const totalCurrent = goals.reduce((sum, g) => sum + (g.currentAmount || 0), 0);
    const monthlySavings = selectors.monthlySavings(s);

    mount(root,
      el('div', {}, [
        el('div', { class: 'page-header' }, [
          el('div', { class: 'row-flex between' }, [
            el('div', {}, [
              el('h2', { class: 't-h1', text: 'Metas' }),
              el('p', { class: 'page-header__sub', text: goals.length ? `${formatMoney(totalCurrent, cur)} de ${formatMoney(totalTarget, cur)} ahorrado` : 'Define tus objetivos financieros.' }),
            ]),
            Button('Nueva meta', { variant: 'primary', iconName: 'plus', onClick: () => openGoalModal({ mode: 'create' }) }),
          ]),
        ]),
        goals.length
          ? el('div', { class: goals.length === 1 ? 'stack' : 'grid grid--2' }, goals.map((g) => goalCard(g, cur, monthlySavings)))
          : el('div', { class: 'card' }, [EmptyState({ title: 'Sin metas', message: 'Crea tu primera meta financiera.', iconName: 'goals',
              action: Button('Nueva meta', { variant: 'primary', iconName: 'plus', onClick: () => openGoalModal({ mode: 'create' }) }) })]),
      ])
    );
  }

  store.subscribe(() => { if (root.isConnected) repaint(); });
  repaint();
  return root;
}
