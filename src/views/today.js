// views/today.js — vista "Hoy": copiloto financiero diario.
// Composición de solo lectura sobre selectores + acceso rápido a nuevo movimiento.

import { el } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { store } from '../store/store.js';
import { selectors } from '../store/selectors.js';
import { formatMoney, formatDate, relativeDay } from '../utils/format.js';
import { Card, KpiCard, Badge, ProgressBar, EmptyState, Button } from '../components/ui.js';
import { openTxModal } from './transactions.js';

function rowItem(iconName, title, sub, amount, cls) {
  return el('div', { class: 'row' }, [
    el('div', { class: 'row__avatar', html: icon(iconName) }),
    el('div', { class: 'row__main' }, [
      el('div', { class: 'row__title', text: title }),
      sub ? el('div', { class: 'row__sub', text: sub }) : null,
    ].filter(Boolean)),
    amount ? el('div', { class: `row__amount tabular ${cls || ''}`, text: amount }) : null,
  ].filter(Boolean));
}

export function renderToday() {
  const s = store.get();
  const cur = s.baseCurrency;
  const m = {};
  (s.accounts || []).forEach((a) => { m[a.id] = a; });
  const cat = {};
  (s.categories || []).forEach((c) => { cat[c.id] = c; });

  const liquidity = selectors.totalLiquidity(s);
  const savings = selectors.monthlySavings(s);

  // Movimientos de hoy
  const todayKey = new Date().toISOString().slice(0, 10);
  const todays = (s.transactions || []).filter((t) => String(t.date).slice(0, 10) === todayKey);
  const todayIncome = todays.filter((t) => t.type === 'income').reduce((a, t) => a + t.amount, 0);
  const todayExpense = todays.filter((t) => t.type === 'expense').reduce((a, t) => a + t.amount, 0);

  const recent = selectors.recentTransactions(s, 5);
  const upcoming = selectors.upcomingPayments(s, 5);
  const goals = selectors.activeGoals(s)
    .slice()
    .sort((a, b) => new Date(a.targetDate || '2999') - new Date(b.targetDate || '2999'))
    .slice(0, 3);

  const dateStr = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

  // KPIs
  const kpis = el('div', { class: 'grid grid--kpi' }, [
    KpiCard({ label: 'Saldo disponible', value: formatMoney(liquidity, cur), iconName: 'wallet', variant: 'accent', hero: true,
      foot: [el('span', { class: 't-caption', text: `${selectors.liquidAccounts(s).length} cuentas` })] }),
    KpiCard({ label: 'Hoy', value: formatMoney(todayIncome - todayExpense, cur, { signed: true }), iconName: 'today', variant: 'neutral',
      foot: [el('span', { class: 't-caption', text: `${todays.length} movimientos` })] }),
    KpiCard({ label: 'Ahorro del mes', value: formatMoney(savings, cur), iconName: 'networth', variant: savings >= 0 ? 'emerald' : 'negative' }),
  ]);

  // Próximos pagos
  const upcomingCard = Card({
    title: 'Próximos pagos',
    action: el('span', { class: 'row-flex', html: icon('calendar') }),
    body: upcoming.length
      ? el('div', { class: 'row-list' }, upcoming.map((r) => rowItem(cat[r.categoryId] ? cat[r.categoryId].icon : 'calendar', r.description, relativeDay(r.nextRunDate), formatMoney(r.amount, cur))))
      : EmptyState({ title: 'Nada próximo', iconName: 'calendar' }),
  });

  // Movimientos recientes
  const recentCard = Card({
    title: 'Movimientos recientes',
    action: Button('Ver todos', { variant: 'ghost', onClick: () => { location.hash = '#/transactions'; } }),
    body: recent.length
      ? el('div', { class: 'row-list' }, recent.map((t) => {
          const isIncome = t.type === 'income';
          const isTransfer = t.type === 'transfer';
          const c = cat[t.categoryId];
          const sign = isIncome ? '+' : isTransfer ? '' : '−';
          const cls = isIncome ? 'text-positive' : isTransfer ? '' : 'text-negative';
          return rowItem(isTransfer ? 'transactions' : (c ? c.icon : 'wallet'), t.description || (isTransfer ? 'Transferencia' : (c ? c.name : '')), `${m[t.accountId] ? m[t.accountId].name : ''} · ${relativeDay(t.date)}`, `${sign}${formatMoney(t.amount, cur)}`, cls);
        }))
      : EmptyState({ title: 'Sin movimientos', iconName: 'transactions' }),
  });

  // Metas prioritarias
  const goalsCard = Card({
    title: 'Metas prioritarias',
    body: goals.length
      ? el('div', {}, goals.map((g) => {
          const pct = g.targetAmount ? Math.min(100, (g.currentAmount / g.targetAmount) * 100) : 0;
          return el('div', { class: 'goal' }, [
            el('div', { class: 'goal__top' }, [
              el('span', { class: 'goal__name', text: g.name }),
              el('span', { class: 'goal__meta', text: `${pct.toFixed(0)}%` }),
            ]),
            ProgressBar(pct, 'gold'),
          ]);
        }))
      : EmptyState({ title: 'Sin metas activas', iconName: 'goals' }),
  });

  return el('div', {}, [
    el('div', { class: 'page-header' }, [
      el('div', { class: 'row-flex between' }, [
        el('div', {}, [
          el('h2', { class: 't-h1', text: `Hola, ${s.user}` }),
          el('p', { class: 'page-header__sub', text: dateStr.charAt(0).toUpperCase() + dateStr.slice(1) }),
        ]),
        Button('Nuevo movimiento', { variant: 'primary', iconName: 'plus', onClick: () => openTxModal({ mode: 'create' }) }),
      ]),
    ]),
    kpis,
    el('div', { class: 'grid grid--2 section' }, [recentCard, el('div', { class: 'stack' }, [upcomingCard, goalsCard])]),
  ]);
}
