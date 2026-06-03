// views/analytics.js — Analítica: tendencias históricas e insights.
// Identidad: "más allá del mes actual". El Dashboard cubre el presente;
// Analítica cubre la historia y las tendencias multi-mes.

import { el, mount } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { store } from '../store/store.js';
import { selectors, normPeriodKey } from '../store/selectors.js';
import { formatMoney, formatPercent, formatNumber } from '../utils/format.js';
import { Card, EmptyState } from '../components/ui.js';
import { LineChart, Legend, CHART_PALETTE } from '../components/charts.js';

const compact = (v) => formatNumber(v, { notation: 'compact', maximumFractionDigits: 1 });

const VARIANT_STYLE = {
  accent: ['--accent-bg', '--accent'], positive: ['--positive-bg', '--positive'],
  warning: ['--warning-bg', '--warning'], negative: ['--negative-bg', '--negative'],
  info: ['--info-bg', '--info'], gold: ['--gold-bg', '--gold'],
};

function insightRow(iconName, variant, html) {
  const [bg, fg] = VARIANT_STYLE[variant] || VARIANT_STYLE.accent;
  return el('div', { class: 'insight' }, [
    el('div', { class: 'insight__icon', style: { background: `var(${bg})`, color: `var(${fg})` }, html: icon(iconName) }),
    el('div', { class: 'insight__text', html }),
  ]);
}

function buildInsights(s, cur) {
  const now = new Date();
  const curMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const out = [];
  const income = selectors.monthlyIncome(s);
  const expense = selectors.monthlyExpense(s);
  const savings = income - expense;
  const rate = income ? (savings / income) * 100 : 0;

  // Proyección al cierre del mes (único en esta vista — Dashboard no lo tiene).
  const day = now.getDate();
  const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  if (income || expense) {
    const projSavings = day > 0 ? (savings / day) * dim : savings;
    out.push(insightRow(
      projSavings >= 0 ? 'arrowUp' : 'arrowDown',
      projSavings >= 0 ? 'positive' : 'negative',
      `Si mantienes este ritmo, este mes ${projSavings >= 0 ? 'ahorrarás' : 'tendrás un déficit de'} <b>${formatMoney(Math.abs(projSavings), cur)}</b>.`,
    ));
  }

  // Tasa de ahorro actual vs. promedio histórico 3 meses.
  if (income) {
    const avg3 = selectors.monthlySavingsAvg(s, 3);
    const avgIncome = selectors.cashflow(s, 4).slice(0, 3).reduce((a, m) => a + m.income, 0) / 3;
    const avgRate = avgIncome ? (avg3 / avgIncome) * 100 : null;
    const rateLabel = `Tasa de ahorro: <b>${formatPercent(rate)}</b> este mes`;
    const comparison = avgRate !== null
      ? ` · promedio 3m: <b>${formatPercent(avgRate)}</b>`
      : '';
    out.push(insightRow('wallet', rate >= 20 ? 'positive' : rate >= 0 ? 'info' : 'negative', rateLabel + comparison));
  }

  // Estado del presupuesto mensual.
  const monthlyBudgets = (s.budgets || []).filter(
    (b) => b.period === 'monthly' && normPeriodKey(b.periodKey, 7) === curMonthKey,
  );
  if (monthlyBudgets.length) {
    const budgeted = monthlyBudgets.reduce((a, b) => a + (b.amount || 0), 0);
    const consumed = monthlyBudgets.reduce((a, b) => a + selectors.budgetConsumed(s, b), 0);
    const pct = budgeted ? (consumed / budgeted) * 100 : 0;
    const over = pct > 100;
    out.push(insightRow(
      'budgets', over ? 'negative' : pct >= 80 ? 'warning' : 'accent',
      `Llevas <b>${pct.toFixed(0)}%</b> del presupuesto del mes (${formatMoney(consumed, cur)} de ${formatMoney(budgeted, cur)})${over ? ' — <b>excedido</b>' : ''}.`,
    ));
  }

  // Mayor variación de categoría vs. mes anterior (solo si el cambio es relevante en monto).
  const change = selectors.topCategoryChange(s);
  const MIN_AMOUNT = 10000;
  if (change && change.category && Math.abs(change.pct) >= 5 && change.curAmt >= MIN_AMOUNT) {
    const up = change.pct >= 0;
    out.push(insightRow(
      up ? 'arrowUp' : 'arrowDown', up ? 'warning' : 'positive',
      `Tus gastos en <b>${change.category.name}</b> ${up ? 'aumentaron' : 'bajaron'} <b>${Math.abs(change.pct).toFixed(0)}%</b> vs. el mes anterior (${formatMoney(change.curAmt, cur)}).`,
    ));
  }

  // Mayor gasto del mes por categoría.
  const byCat = selectors.categorySpend(s, curMonthKey);
  if (byCat.length && byCat[0].category) {
    out.push(insightRow(
      'shopping', 'info',
      `Tu mayor gasto del mes es <b>${byCat[0].category.name}</b> con <b>${formatMoney(byCat[0].amount, cur)}</b>.`,
    ));
  }

  return out;
}

function buildCashflowCard(s, cur) {
  let activePeriod = 6;
  const chartArea = el('div');

  function renderChart() {
    const cf = selectors.cashflow(s, activePeriod);
    const labels = cf.map((m) => m.label);
    mount(chartArea, LineChart({
      labels, valueFormat: compact, series: [
        { name: 'Ingresos', color: 'var(--positive)', points: cf.map((m) => m.income) },
        { name: 'Gastos',   color: 'var(--negative)', points: cf.map((m) => m.expense) },
        { name: 'Ahorro',   color: 'var(--accent)',   points: cf.map((m) => m.savings) },
      ],
    }));
  }
  renderChart();

  const periodBtns = [3, 6, 12].map((n) => {
    const btn = el('button', {
      class: `btn btn--ghost btn--sm${n === activePeriod ? ' btn--primary' : ''}`,
      text: `${n}m`,
      on: {
        click: () => {
          activePeriod = n;
          periodBtns.forEach((b) => { b.className = 'btn btn--ghost btn--sm'; });
          btn.className = 'btn btn--primary btn--sm';
          renderChart();
        },
      },
    });
    return btn;
  });
  // Mark initial active
  periodBtns[1].className = 'btn btn--primary btn--sm';

  return Card({
    title: 'Flujo de caja',
    action: el('div', { class: 'row-flex', style: { gap: '4px' } }, periodBtns),
    body: el('div', {}, [
      chartArea,
      Legend([
        { label: 'Ingresos', color: 'var(--positive)' },
        { label: 'Gastos',   color: 'var(--negative)' },
        { label: 'Ahorro',   color: 'var(--accent)' },
      ]),
    ]),
  });
}

function buildTrendsCard(s, cur) {
  const trends = selectors.categoryTrends(s, 6, 5);
  if (!trends.length) {
    return Card({
      title: 'Tendencias por categoría',
      body: EmptyState({ title: 'Sin datos suficientes', message: 'Registra gastos en al menos 2 meses para ver tendencias.', iconName: 'analytics' }),
    });
  }

  const months = trends[0].months;
  const maxPerRow = trends.map((t) => Math.max(1, ...t.months.map((m) => m.amount)));

  const headerCells = [
    el('th', { text: 'Categoría' }),
    ...months.map((m) => el('th', { class: 'num', text: m.label })),
    el('th', { class: 'num', text: 'Total' }),
  ];

  const rows = trends.map((t, ri) => {
    const rowMax = maxPerRow[ri];
    const cells = t.months.map((m) => {
      if (!m.amount) return el('td', { class: 'num text-tertiary', text: '—' });
      const ratio = m.amount / rowMax;
      const bg = ratio >= 0.9 ? 'var(--negative-bg)' : ratio >= 0.5 ? 'var(--warning-bg)' : 'transparent';
      return el('td', { class: 'num', style: { background: bg } }, [
        el('span', { text: compact(m.amount) }),
      ]);
    });

    return el('tr', {}, [
      el('td', { class: 'row-flex', style: { gap: '6px', alignItems: 'center' } }, [
        el('span', { html: icon(t.category?.icon || 'shopping'), style: { opacity: '0.6', fontSize: '14px' } }),
        el('span', { text: t.category?.name || 'Sin categoría' }),
      ]),
      ...cells,
      el('td', { class: 'num', style: { fontWeight: '600' } }, [
        el('span', { text: compact(t.total) }),
      ]),
    ]);
  });

  const table = el('table', { class: 'analytics-trends', style: { width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-caption)' } }, [
    el('thead', {}, [el('tr', {}, headerCells)]),
    el('tbody', {}, rows),
  ]);

  return Card({
    title: 'Tendencias por categoría',
    action: el('span', { class: 't-caption text-secondary', text: 'Últimos 6 meses' }),
    body: table,
  });
}

export function renderAnalytics() {
  const s = store.get();
  const cur = s.baseCurrency;

  const insights = buildInsights(s, cur);
  const insightsCard = Card({
    title: 'Insights',
    body: insights.length
      ? el('div', {}, insights)
      : EmptyState({ title: 'Sin datos suficientes', message: 'Registra movimientos para generar insights.', iconName: 'bolt' }),
  });

  const cashflowCard = buildCashflowCard(s, cur);
  const trendsCard   = buildTrendsCard(s, cur);

  return el('div', {}, [
    el('div', { class: 'page-header' }, [
      el('h2', { class: 't-h1', text: 'Analítica' }),
      el('p', { class: 'page-header__sub', text: 'Tendencias históricas e insights de tus finanzas.' }),
    ]),
    insightsCard,
    el('div', { class: 'section' }, [cashflowCard]),
    el('div', { class: 'section' }, [trendsCard]),
  ]);
}
