// views/dashboard.js — Dashboard inicial (centro de comando).
// Compone componentes base con datos derivados del store (selectores).
// docs/PRD.md §8.1. Datos mock en Fase 1.

import { el } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { selectors } from '../store/selectors.js';
import { formatMoney, formatPercent, relativeDay } from '../utils/format.js';
import {
  Card, KpiCard, Trend, Badge, BarChart, ProgressBar, EmptyState, Button,
} from '../components/ui.js';
import { openTxModal } from './transactions.js';

export function renderDashboard(s) {
  const cur = s.baseCurrency;
  const netWorth = selectors.netWorth(s);
  const income = selectors.monthlyIncome(s);
  const expense = selectors.monthlyExpense(s);
  const savings = selectors.monthlySavings(s);
  const savingsRate = selectors.savingsRate(s);
  const liquidity = selectors.totalLiquidity(s);
  const invValue = selectors.investmentsValue(s);
  const invReturn = selectors.investmentsReturnPct(s);

  // --- KPIs ---
  const kpis = el('div', { class: 'grid grid--kpi' }, [
    // Patrimonio Neto: color principal (periwinkle), tratamiento héroe.
    KpiCard({
      label: 'Patrimonio neto', value: formatMoney(netWorth, cur), iconName: 'networth', variant: 'accent', hero: true,
      foot: [Trend(4.2), el('span', { class: 't-caption', text: 'vs. mes anterior' })],
    }),
    // Inversiones: emerald.
    KpiCard({
      label: 'Inversiones', value: formatMoney(invValue, cur), iconName: 'investments', variant: 'emerald',
      foot: [Trend(invReturn), el('span', { class: 't-caption', text: 'rentabilidad' })],
    }),
    // Gastos: neutro (sin alarma; el dato manda).
    KpiCard({
      label: 'Gastos del mes', value: formatMoney(expense, cur), iconName: 'arrowDown', variant: 'neutral',
      foot: [el('span', { class: 't-caption', text: `${((expense / (income || 1)) * 100).toFixed(0)}% de ingresos` })],
    }),
    // Ingresos, ahorro y liquidez: neutros; los deltas portan el color.
    KpiCard({
      label: 'Ingresos del mes', value: formatMoney(income, cur), iconName: 'arrowUp', variant: 'neutral',
      foot: [el('span', { class: 't-caption', text: 'Mayo 2026' })],
    }),
    KpiCard({
      label: 'Ahorro del mes', value: formatMoney(savings, cur), iconName: 'wallet', variant: 'neutral',
      foot: [Badge(formatPercent(savingsRate), savings >= 0 ? 'positive' : 'negative'), el('span', { class: 't-caption', text: 'tasa de ahorro' })],
    }),
    KpiCard({
      label: 'Liquidez disponible', value: formatMoney(liquidity, cur), iconName: 'accounts', variant: 'neutral',
      foot: [el('span', { class: 't-caption', text: `${selectors.liquidAccounts(s).length} cuentas` })],
    }),
  ]);

  // --- Evolución patrimonio (mini chart) ---
  const netWorthCard = Card({
    title: 'Evolución del patrimonio',
    action: Badge('6 meses', 'info'),
    body: el('div', {}, [
      BarChart((s.netWorthSeries || []).map((d, i, arr) => ({
        label: d.label, value: d.value, muted: i < arr.length - 1 ? false : false,
      }))),
    ]),
  });

  // --- Gasto por categoría ---
  const byCat = selectors.expenseByCategory(s).slice(0, 5);
  const maxCat = Math.max(1, ...byCat.map((c) => c.amount));
  const categoryCard = Card({
    title: 'Gastos por categoría',
    action: Badge('Este mes', 'info'),
    body: byCat.length
      ? el('div', { class: 'stack mt-2' }, byCat.map((c) => el('div', { class: 'stack' }, [
          el('div', { class: 'row-flex between' }, [
            el('span', { class: 'row-flex' }, [
              el('span', { class: 'row__avatar', style: { width: '26px', height: '26px' }, html: icon(c.category?.icon || 'shopping') }),
              el('span', { text: c.category?.name || 'Sin categoría' }),
            ]),
            el('span', { class: 'tabular', text: formatMoney(c.amount, cur) }),
          ]),
          ProgressBar((c.amount / maxCat) * 100),
        ])))
      : EmptyState({ title: 'Sin gastos aún', message: 'Registra movimientos para ver el desglose.', iconName: 'shopping' }),
  });

  // --- Movimientos recientes ---
  const recent = selectors.recentTransactions(s, 6);
  const recentCard = Card({
    title: 'Movimientos recientes',
    action: Button('Ver todos', { variant: 'ghost', onClick: () => { location.hash = '#/transactions'; } }),
    body: el('div', { class: 'row-list' }, recent.map((t) => {
      const cat = selectors.categoryById(s, t.categoryId);
      const acc = selectors.accountById(s, t.accountId);
      const isIncome = t.type === 'income';
      const isTransfer = t.type === 'transfer';
      const sign = isIncome ? '+' : isTransfer ? '' : '−';
      const cls = isIncome ? 'text-positive' : isTransfer ? '' : 'text-negative';
      const label = isTransfer ? 'Transferencia' : (cat?.name || 'Sin categoría');
      const iconName = isTransfer ? 'transactions' : (cat?.icon || 'wallet');
      return el('div', { class: 'row' }, [
        el('div', { class: 'row__avatar', html: icon(iconName) }),
        el('div', { class: 'row__main' }, [
          el('div', { class: 'row__title', text: t.description || label }),
          el('div', { class: 'row__sub', text: `${label} · ${acc?.name || ''} · ${relativeDay(t.date)}` }),
        ]),
        el('div', { class: `row__amount ${cls}`, text: `${sign}${formatMoney(t.amount, cur)}` }),
      ]);
    })),
  });

  // --- Metas activas ---
  const goals = selectors.activeGoals(s);
  const goalsCard = Card({
    title: 'Metas activas',
    action: Badge(`${goals.length}`, 'gold'),
    body: el('div', {}, goals.map((g) => {
      const pct = (g.currentAmount / g.targetAmount) * 100;
      return el('div', { class: 'goal' }, [
        el('div', { class: 'goal__top' }, [
          el('span', { class: 'goal__name', text: g.name }),
          el('span', { class: 'goal__meta', text: `${formatMoney(g.currentAmount, cur, { compact: true })} / ${formatMoney(g.targetAmount, cur, { compact: true })}` }),
        ]),
        ProgressBar(pct, 'gold'),
      ]);
    })),
  });

  // --- Próximos pagos ---
  const upcoming = selectors.upcomingPayments(s, 5);
  const upcomingCard = Card({
    title: 'Próximos pagos',
    action: el('span', { class: 'row-flex', html: icon('calendar') }),
    body: el('div', { class: 'row-list' }, upcoming.map((r) => {
      const cat = selectors.categoryById(s, r.categoryId);
      return el('div', { class: 'row' }, [
        el('div', { class: 'row__avatar', html: icon(cat?.icon || 'calendar') }),
        el('div', { class: 'row__main' }, [
          el('div', { class: 'row__title', text: r.description }),
          el('div', { class: 'row__sub', text: relativeDay(r.nextRunDate) }),
        ]),
        el('div', { class: 'row__amount', text: formatMoney(r.amount, cur) }),
      ]);
    })),
  });

  // --- Composición de la página ---
  return el('div', {}, [
    el('div', { class: 'page-header' }, [
      el('div', { class: 'row-flex between' }, [
        el('div', {}, [
          el('h2', { class: 't-h1', text: `Hola, ${s.user}` }),
          el('p', { class: 'page-header__sub', text: 'Tu centro de comando financiero.' }),
        ]),
        Button('Nuevo movimiento', { variant: 'primary', iconName: 'plus', onClick: () => openTxModal({ mode: 'create' }) }),
      ]),
    ]),
    kpis,
    el('div', { class: 'grid grid--2 section' }, [netWorthCard, categoryCard]),
    el('div', { class: 'grid grid--2 section' }, [recentCard, el('div', { class: 'stack' }, [goalsCard, upcomingCard])]),
  ]);
}
