// views/debts.js — Deudas (Snowball/Avalanche) + panel de Tarjetas de crédito.

import { el, mount } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { store } from '../store/store.js';
import { dataService } from '../services/dataService.js';
import { formatMoney, formatDate } from '../utils/format.js';

const pct = (n) => `${(Number(n) || 0).toFixed(1).replace(/\.0$/, '')}%`;
import { Card, KpiCard, Badge, EmptyState, Button } from '../components/ui.js';
import { confirmDialog } from '../components/modal.js';
import { openLiabilityModal, LIABILITY_TYPE_LIST } from './networth.js';
import { toast } from '../services/toast.js';

const STATE = { strategy: 'avalanche' };
const typeLabel = (v) => (LIABILITY_TYPE_LIST.find((t) => t.value === v) || {}).label || v;

// Calcula la próxima fecha a partir de un día del mes
function nextDateForDay(day) {
  if (!day) return null;
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), day);
  if (d <= now) d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

function daysUntil(isoDate) {
  if (!isoDate) return null;
  const diff = new Date(isoDate) - new Date(new Date().toISOString().slice(0, 10));
  return Math.round(diff / 86400000);
}

// ---------- Tarjeta de crédito card ----------
function creditCardPanel(a, cur) {
  const debt     = Math.abs(a.balance || 0);
  const limit    = a.creditLimit || 0;
  const avail    = Math.max(0, limit - debt);
  const util     = limit ? Math.min(100, Math.round(debt / limit * 100)) : 0;
  const minPay   = a.minPayment || 0;
  const totalDue = a.totalDue  || 0;
  const corteFecha  = nextDateForDay(a.cutoffDay);
  const pagoFecha   = nextDateForDay(a.paymentDay);
  const diasCorte   = daysUntil(corteFecha);
  const diasPago    = daysUntil(pagoFecha);

  const utilColor = util > 80 ? 'var(--negative)' : util > 50 ? 'var(--warning, var(--accent))' : 'var(--positive)';

  const card = el('div', { class: 'cc-panel' });

  // Header
  const head = el('div', { class: 'cc-panel__head' });
  head.appendChild(el('div', { class: 'cc-panel__name' }, [
    el('span', { class: 'cc-panel__title', text: a.name }),
    el('span', { class: 'cc-panel__inst', text: a.institution || '' }),
  ]));
  head.appendChild(el('div', { class: 'cc-panel__debt tabular text-negative', text: formatMoney(debt, a.currency || cur) }));
  card.appendChild(head);

  // Barra de utilización
  const barWrap = el('div', { class: 'cc-util-bar' });
  barWrap.appendChild(el('div', { class: 'cc-util-fill', style: `width:${util}%;background:${utilColor}` }));
  card.appendChild(barWrap);

  // Métricas en grid
  const grid = el('div', { class: 'cc-panel__grid' });
  const metric = (label, value, sub) => {
    const m = el('div', { class: 'cc-metric' });
    m.appendChild(el('span', { class: 'cc-metric__label', text: label }));
    m.appendChild(el('span', { class: 'cc-metric__value tabular', text: value }));
    if (sub) m.appendChild(el('span', { class: 'cc-metric__sub', text: sub }));
    return m;
  };

  grid.appendChild(metric('Cupo disponible', formatMoney(avail, a.currency || cur), `${100 - util}% libre`));
  if (totalDue)  grid.appendChild(metric('Total a pagar', formatMoney(totalDue, a.currency || cur), 'este corte'));
  if (minPay)    grid.appendChild(metric('Pago mínimo', formatMoney(minPay, a.currency || cur), 'según extracto'));
  grid.appendChild(metric('Próximo corte', corteFecha ? formatDate(corteFecha, 'short') : '—', diasCorte !== null ? `en ${diasCorte} días` : ''));
  grid.appendChild(metric('Fecha de pago', pagoFecha ? formatDate(pagoFecha, 'short') : '—', diasPago !== null ? (diasPago <= 5 ? `⚠ ${diasPago} días` : `en ${diasPago} días`) : ''));
  if (a.interestRate) grid.appendChild(metric('Tasa E.A.', pct(a.interestRate), 'interés anual'));
  if (limit) grid.appendChild(metric('Cupo total', formatMoney(limit, a.currency || cur), `${util}% utilizado`));
  card.appendChild(grid);

  return card;
}

// ---------- Deuda row ----------
function debtRow(l, rank, cur) {
  return el('div', { class: 'row' }, [
    el('div', { class: 'row__avatar', html: rank === 1 ? icon('bolt') : icon('debts'), style: rank === 1 ? { background: 'var(--negative-bg)', color: 'var(--negative)' } : {} }),
    el('div', { class: 'row__main' }, [
      el('div', { class: 'row__title' }, [l.name, ' ', rank === 1 ? Badge('Atacar primero', 'negative') : null].filter(Boolean)),
      el('div', { class: 'row__sub', text: `${typeLabel(l.type)} · ${pct(l.interestRate)} · cuota ${formatMoney(l.minimumPayment || 0, l.currency || cur)}${l.dueDate ? ' · vence ' + formatDate(l.dueDate, 'short') : ''}` }),
    ]),
    el('div', { class: 'row__amount tabular text-negative', text: formatMoney(l.balance, l.currency || cur) }),
    el('div', { class: 'row__actions' }, [
      el('button', { class: 'icon-btn', 'aria-label': 'Editar', on: { click: () => openLiabilityModal({ liability: l, mode: 'edit' }) }, html: icon('edit') }),
      el('button', { class: 'icon-btn icon-btn--danger', 'aria-label': 'Eliminar', on: { click: () => confirmDialog({ title: 'Eliminar deuda', message: `¿Eliminar "${l.name}"?`, onConfirm: async () => { try { await dataService.remove('liabilities', l.id); toast('Deuda eliminada'); } catch (e) { toast('Error', { type: 'negative' }); } } }) }, html: icon('trash') }),
    ]),
  ]);
}

function orderBy(debts, strategy) {
  const copy = [...debts];
  if (strategy === 'snowball') copy.sort((a, b) => (a.balance || 0) - (b.balance || 0));
  else copy.sort((a, b) => (b.interestRate || 0) - (a.interestRate || 0));
  return copy;
}

export function renderDebts() {
  const root = el('div');
  const listMount = el('div');

  function paint() {
    const s = store.get();
    const cur = s.baseCurrency;
    const debts = (s.liabilities || []).filter((l) => (l.balance || 0) > 0);

    if (!debts.length) {
      mount(listMount, el('div', { class: 'card' }, [EmptyState({
        title: 'Sin deudas', message: 'Registra tus deudas para planear su pago.', iconName: 'debts',
        action: Button('Nueva deuda', { variant: 'primary', iconName: 'plus', onClick: () => openLiabilityModal({ mode: 'create' }) }),
      })]));
      return;
    }

    const ordered = orderBy(debts, STATE.strategy);
    const explain = STATE.strategy === 'snowball'
      ? 'Snowball: liquidas primero la deuda de menor saldo (motivación rápida).'
      : 'Avalanche: liquidas primero la deuda de mayor tasa (ahorras más en intereses).';

    mount(listMount, el('div', {}, [
      el('div', { class: 'card card--pad-sm' }, [
        el('div', { class: 'row-flex between mt-2' }, [
          el('div', { class: 'seg', style: { width: 'auto' } }, [
            el('button', { class: 'seg__btn', 'aria-pressed': String(STATE.strategy === 'avalanche'), text: 'Avalanche', on: { click: () => { STATE.strategy = 'avalanche'; paint(); } } }),
            el('button', { class: 'seg__btn', 'aria-pressed': String(STATE.strategy === 'snowball'), text: 'Snowball', on: { click: () => { STATE.strategy = 'snowball'; paint(); } } }),
          ]),
          el('span', { class: 't-caption text-secondary', text: explain }),
        ]),
      ]),
      el('div', { class: 'card card--pad-sm mt-4' }, [el('div', { class: 'row-list' }, ordered.map((l, i) => debtRow(l, i + 1, cur)))]),
    ]));
  }

  const s = store.get();
  const cur = s.baseCurrency;
  const debts = (s.liabilities || []).filter((l) => (l.balance || 0) > 0);
  const totalDebt = debts.reduce((sum, l) => sum + (l.balance || 0), 0);
  const totalMin  = debts.reduce((sum, l) => sum + (l.minimumPayment || 0), 0);
  const avgRate   = totalDebt ? debts.reduce((sum, l) => sum + (l.interestRate || 0) * (l.balance || 0), 0) / totalDebt : 0;

  // Tarjetas de crédito (desde accounts)
  const ccAccounts = (s.accounts || []).filter((a) => a.type === 'credit_card' && !a.isArchived);
  const totalCcDebt = ccAccounts.reduce((sum, a) => sum + Math.abs(a.balance || 0), 0);

  root.append(
    el('div', { class: 'page-header' }, [
      el('div', { class: 'row-flex between' }, [
        el('div', {}, [
          el('h2', { class: 't-h1', text: 'Deudas' }),
          el('p', { class: 'page-header__sub', text: 'Plan de pago con Snowball y Avalanche.' }),
        ]),
        Button('Nueva deuda', { variant: 'primary', iconName: 'plus', onClick: () => openLiabilityModal({ mode: 'create' }) }),
      ]),
    ]),
    el('div', { class: 'grid grid--kpi' }, [
      KpiCard({ label: 'Deuda total', value: formatMoney(totalDebt, cur), iconName: 'debts', variant: 'negative', hero: true,
        foot: [el('span', { class: 't-caption', text: `${debts.length} deudas` })] }),
      KpiCard({ label: 'Tarjetas de crédito', value: formatMoney(totalCcDebt, cur), iconName: 'accounts', variant: 'negative',
        foot: [el('span', { class: 't-caption', text: `${ccAccounts.length} tarjeta${ccAccounts.length !== 1 ? 's' : ''}` })] }),
      KpiCard({ label: 'Cuota mínima/mes', value: formatMoney(totalMin, cur), iconName: 'calendar', variant: 'neutral' }),
      KpiCard({ label: 'Tasa promedio', value: pct(avgRate), iconName: 'analytics', variant: 'warning' }),
    ]),

    // Panel de tarjetas de crédito
    ccAccounts.length ? el('div', { class: 'section' }, [
      el('h3', { class: 't-h2 mb-4', text: 'Tarjetas de crédito' }),
      el('div', { class: 'cc-panels-grid' }, ccAccounts.map((a) => creditCardPanel(a, cur))),
    ]) : null,

    el('div', { class: 'section' }, [
      debts.length ? el('h3', { class: 't-h2 mb-4', text: 'Otras deudas' }) : null,
      listMount,
    ]),
  );

  paint();
  return root;
}
