// views/debts.js — módulo de Deudas con estrategias de pago.
// Snowball (menor saldo primero) · Avalanche (mayor tasa primero).
// Reutiliza el CRUD de pasivos del módulo de Patrimonio.

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

// Estrategia seleccionada (persiste entre re-renders).
const STATE = { strategy: 'avalanche' };

const typeLabel = (v) => (LIABILITY_TYPE_LIST.find((t) => t.value === v) || {}).label || v;

function orderBy(debts, strategy) {
  const copy = [...debts];
  if (strategy === 'snowball') copy.sort((a, b) => (a.balance || 0) - (b.balance || 0));
  else copy.sort((a, b) => (b.interestRate || 0) - (a.interestRate || 0));
  return copy;
}

function debtRow(l, rank, cur) {
  return el('div', { class: 'row' }, [
    el('div', { class: 'row__avatar', html: rank === 1 ? icon('bolt') : icon('debts'), style: rank === 1 ? { background: 'var(--negative-bg)', color: 'var(--negative)' } : {} }),
    el('div', { class: 'row__main' }, [
      el('div', { class: 'row__title' }, [l.name, ' ', rank === 1 ? Badge('Atacar primero', 'negative') : null].filter(Boolean)),
      el('div', { class: 'row__sub', text: `${typeLabel(l.type)} · ${pct(l.interestRate)} · cuota ${formatMoney(l.minimumPayment || 0, l.currency || cur)}${l.dueDate ? ' · vence ' + formatDate(l.dueDate, 'short') : ''}` }),
    ]),
    el('div', { class: 'row__amount tabular text-negative', text: formatMoney(l.balance, l.currency || cur) }),
    el('div', { class: 'row__actions' }, [
      el('button', { class: 'icon-btn', 'aria-label': 'Editar', title: 'Editar', on: { click: () => openLiabilityModal({ liability: l, mode: 'edit' }) }, html: icon('edit') }),
      el('button', { class: 'icon-btn icon-btn--danger', 'aria-label': 'Eliminar', title: 'Eliminar', on: { click: () => confirmDialog({ title: 'Eliminar deuda', message: `¿Eliminar "${l.name}"?`, onConfirm: async () => { try { await dataService.remove('liabilities', l.id); toast('Deuda eliminada'); } catch (e) { toast('Error', { type: 'negative' }); } } }) }, html: icon('trash') }),
    ]),
  ]);
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
  const totalMin = debts.reduce((sum, l) => sum + (l.minimumPayment || 0), 0);
  const avgRate = totalDebt ? debts.reduce((sum, l) => sum + (l.interestRate || 0) * (l.balance || 0), 0) / totalDebt : 0;

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
      KpiCard({ label: 'Cuota mínima/mes', value: formatMoney(totalMin, cur), iconName: 'calendar', variant: 'neutral' }),
      KpiCard({ label: 'Tasa promedio', value: pct(avgRate), iconName: 'analytics', variant: 'warning' }),
    ]),
    el('div', { class: 'section' }, [listMount]),
  );

  paint();
  return root;
}
