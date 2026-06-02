// views/analytics.js — Analítica e Insights.
// Gráficos: flujo de caja, ahorro, patrimonio, gastos por categoría.
// Insights automáticos derivados de los datos.

import { el } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { store } from '../store/store.js';
import { selectors, normPeriodKey } from '../store/selectors.js';
import { formatMoney, formatDate, formatPercent, formatNumber } from '../utils/format.js';
import { Card, EmptyState } from '../components/ui.js';
import { LineChart, Donut, Legend, CHART_PALETTE } from '../components/charts.js';

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

  // Proyección de ahorro al cierre del mes.
  const day = now.getDate();
  const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  if (income || expense) {
    const projSavings = day > 0 ? (savings / day) * dim : savings;
    out.push(insightRow(projSavings >= 0 ? 'arrowUp' : 'arrowDown', projSavings >= 0 ? 'positive' : 'negative',
      `Si mantienes este ritmo, este mes ${projSavings >= 0 ? 'ahorrarás' : 'tendrás un déficit de'} <b>${formatMoney(Math.abs(projSavings), cur)}</b>.`));
  }

  // Tasa de ahorro.
  if (income) {
    out.push(insightRow('wallet', rate >= 20 ? 'positive' : rate >= 0 ? 'info' : 'negative',
      `Tu tasa de ahorro del mes es <b>${formatPercent(rate)}</b>.`));
  }

  // Presupuesto del mes.
  const monthlyBudgets = (s.budgets || []).filter((b) => b.period === 'monthly' && normPeriodKey(b.periodKey, 7) === curMonthKey);
  if (monthlyBudgets.length) {
    const budgeted = monthlyBudgets.reduce((a, b) => a + (b.amount || 0), 0);
    const consumed = monthlyBudgets.reduce((a, b) => a + selectors.budgetConsumed(s, b), 0);
    const pct = budgeted ? (consumed / budgeted) * 100 : 0;
    const over = pct > 100;
    out.push(insightRow('budgets', over ? 'negative' : pct >= 80 ? 'warning' : 'accent',
      `Llevas <b>${pct.toFixed(0)}%</b> de tu presupuesto del mes (${formatMoney(consumed, cur)} de ${formatMoney(budgeted, cur)})${over ? ' — <b>excedido</b>' : ''}.`));
  }

  // Mayor variación por categoría.
  const change = selectors.topCategoryChange(s);
  if (change && change.category && Math.abs(change.pct) >= 5) {
    const up = change.pct >= 0;
    out.push(insightRow(up ? 'arrowUp' : 'arrowDown', up ? 'warning' : 'positive',
      `Tus gastos en <b>${change.category.name}</b> ${up ? 'aumentaron' : 'bajaron'} <b>${Math.abs(change.pct).toFixed(0)}%</b> vs. el mes anterior.`));
  }

  // Mayor gasto del mes.
  const byCat = selectors.categorySpend(s, curMonthKey);
  if (byCat.length && byCat[0].category) {
    out.push(insightRow('shopping', 'info',
      `Tu mayor gasto del mes es <b>${byCat[0].category.name}</b> con <b>${formatMoney(byCat[0].amount, cur)}</b>.`));
  }

  return out;
}

export function renderAnalytics() {
  const s = store.get();
  const cur = s.baseCurrency;
  const now = new Date();
  const curMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;


  // Flujo de caja (6 meses)
  const cf = selectors.cashflow(s, 6);
  const labels = cf.map((m) => m.label);
  const cashflowCard = Card({
    title: 'Flujo de caja',
    body: el('div', {}, [
      LineChart({ labels, valueFormat: compact, series: [
        { name: 'Ingresos', color: 'var(--positive)', points: cf.map((m) => m.income) },
        { name: 'Gastos', color: 'var(--negative)', points: cf.map((m) => m.expense) },
      ] }),
      Legend([
        { label: 'Ingresos', color: 'var(--positive)' },
        { label: 'Gastos', color: 'var(--negative)' },
      ]),
    ]),
  });

  // Ahorro mensual
  const savingsCard = Card({
    title: 'Ahorro mensual',
    body: LineChart({ labels, valueFormat: compact, series: [{ name: 'Ahorro', color: 'var(--accent)', points: cf.map((m) => m.savings) }] }),
  });

  // Patrimonio (snapshots)
  const snaps = [...(s.netWorthSnapshots || [])].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-8);
  const netWorthCard = Card({
    title: 'Patrimonio neto',
    body: snaps.length >= 2
      ? LineChart({ labels: snaps.map((sn) => formatDate(sn.date, 'short')), valueFormat: compact, series: [{ name: 'Patrimonio', color: 'var(--accent)', points: snaps.map((sn) => sn.netWorth) }] })
      : EmptyState({ title: 'Histórico insuficiente', message: 'Guarda al menos 2 snapshots en Patrimonio para ver la tendencia.', iconName: 'networth' }),
  });

  // Gastos por categoría (mes actual)
  const spend = selectors.categorySpend(s, curMonthKey);
  const top = spend.slice(0, 6);
  const othersTotal = spend.slice(6).reduce((a, c) => a + c.amount, 0);
  const segments = top.map((c, i) => ({ label: c.category ? c.category.name : 'Sin categoría', value: c.amount, color: CHART_PALETTE[i % CHART_PALETTE.length] }));
  if (othersTotal > 0) segments.push({ label: 'Otros', value: othersTotal, color: 'var(--neutral)' });
  const totalSpend = spend.reduce((a, c) => a + c.amount, 0);

  const expensesCard = Card({
    title: 'Gastos por categoría',
    body: spend.length
      ? el('div', { class: 'donut-wrap' }, [
          Donut(segments, { centerTop: formatMoney(totalSpend, cur, { compact: true }), centerSub: 'este mes' }),
          Legend(segments.map((seg) => ({ label: seg.label, color: seg.color, value: formatMoney(seg.value, cur, { compact: true }) }))),
        ])
      : EmptyState({ title: 'Sin gastos este mes', iconName: 'shopping' }),
  });

  // Insights
  const insights = buildInsights(s, cur);
  const insightsCard = Card({
    title: 'Insights',
    body: insights.length ? el('div', {}, insights) : EmptyState({ title: 'Sin datos suficientes', message: 'Registra movimientos para generar insights.', iconName: 'bolt' }),
  });

  return el('div', {}, [
    el('div', { class: 'page-header' }, [
      el('h2', { class: 't-h1', text: 'Analítica' }),
      el('p', { class: 'page-header__sub', text: 'Tendencias e insights de tus finanzas.' }),
    ]),
    insightsCard,
    el('div', { class: 'grid grid--2 section' }, [cashflowCard, savingsCard]),
    el('div', { class: 'grid grid--2 section' }, [netWorthCard, expensesCard]),
  ]);
}
