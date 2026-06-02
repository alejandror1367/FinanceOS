// views/dashboard.js — Dashboard: centro de comando financiero.
// Patrón root + repaint() + store.subscribe (reactivo sin fugas).

import { el, mount } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { store } from '../store/store.js';
import { selectors } from '../store/selectors.js';
import { formatMoney, formatPercent, relativeDay, formatDate } from '../utils/format.js';
import {
  Card, KpiCard, Trend, Badge, BarChart, ProgressBar, EmptyState, Button,
} from '../components/ui.js';
import { openTxModal } from './transactions.js';

const SCORE_META = [
  { min: 80, label: 'Excelente', variant: 'positive' },
  { min: 60, label: 'Bueno',     variant: 'info' },
  { min: 40, label: 'Regular',   variant: 'warning' },
  { min:  0, label: 'Mejorable', variant: 'negative' },
];
function scoreMeta(score) {
  return SCORE_META.find((m) => score >= m.min) || SCORE_META[SCORE_META.length - 1];
}

export function renderDashboard() {
  const root = el('div');

  function repaint() {
    const s   = store.get();
    const cur = s.baseCurrency;

    // ── Datos derivados ───────────────────────────────────────────────────────
    const netWorth    = selectors.netWorth(s);
    const income      = selectors.monthlyIncome(s);
    const expense     = selectors.monthlyExpense(s);
    const savings     = selectors.monthlySavings(s);
    const savingsRate = selectors.savingsRate(s);
    const liquidity   = selectors.totalLiquidity(s);
    const invValue    = selectors.investmentsValue(s);
    const invReturn   = selectors.investmentsReturnPct(s);
    const score       = selectors.financialScore(s);
    const sm          = scoreMeta(score);

    // Trend patrimonio desde snapshots reales.
    const snapsForTrend = [...(s.netWorthSnapshots || [])].sort((a, b) => (a.date < b.date ? -1 : 1));
    const prevSnap      = snapsForTrend.at(-2);
    const netWorthTrend = prevSnap?.netWorth
      ? ((netWorth - prevSnap.netWorth) / Math.abs(prevSnap.netWorth)) * 100
      : null;

    const currentMonthLabel = (() => {
      const str = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(new Date());
      return str.charAt(0).toUpperCase() + str.slice(1);
    })();

    // ── Alertas para KPIs — reutiliza actionItems que usa normPeriodKey ───────
    const todayActions  = selectors.actionItems(s);
    const urgentPayments = todayActions.filter((i) => i.type === 'payment');
    const budgetAlerts   = todayActions.filter((i) => i.type === 'budget');
    const maxBudgetPct   = budgetAlerts.length ? Math.max(...budgetAlerts.map((i) => i.pct || 0)) : 0;
    const nearGoals      = selectors.activeGoals(s).filter(
      (g) => g.targetAmount && ((g.currentAmount || 0) / g.targetAmount) >= 0.9
    );

    // ── KPIs ─────────────────────────────────────────────────────────────────
    const expenseAlert = maxBudgetPct >= 100
      ? Badge('Superado', 'negative')
      : maxBudgetPct >= 80 ? Badge(`${Math.round(maxBudgetPct)}% presupuesto`, 'warning') : null;

    const liquidityAlert = urgentPayments.length
      ? Badge(`${urgentPayments.length} pago${urgentPayments.length > 1 ? 's' : ''} urgente${urgentPayments.length > 1 ? 's' : ''}`, 'warning')
      : null;

    const kpis = el('div', { class: 'grid grid--kpi' }, [
      KpiCard({
        label: 'Patrimonio neto', value: formatMoney(netWorth, cur), iconName: 'networth', variant: 'accent', hero: true,
        foot: [
          netWorthTrend !== null ? Trend(netWorthTrend) : null,
          el('span', { class: 't-caption', text: netWorthTrend !== null ? 'vs. snapshot anterior' : 'sin comparativa aún' }),
        ].filter(Boolean),
      }),
      KpiCard({
        label: 'Score financiero', value: String(score), iconName: 'analytics', variant: sm.variant,
        foot: [Badge(sm.label, sm.variant), el('span', { class: 't-caption', text: 'de 100 puntos' })],
      }),
      KpiCard({
        label: 'Inversiones', value: formatMoney(invValue, cur), iconName: 'investments', variant: 'emerald',
        foot: invValue > 0
          ? [Trend(invReturn), el('span', { class: 't-caption', text: 'rentabilidad' })]
          : [el('span', { class: 't-caption', text: 'sin posiciones activas' })],
      }),
      KpiCard({
        label: 'Gastos del mes', value: formatMoney(expense, cur), iconName: 'arrowDown', variant: maxBudgetPct >= 100 ? 'negative' : 'neutral',
        foot: [
          expenseAlert,
          expenseAlert ? null : el('span', { class: 't-caption', text: `${((expense / (income || 1)) * 100).toFixed(0)}% de ingresos` }),
        ].filter(Boolean),
      }),
      KpiCard({
        label: 'Ingresos del mes', value: formatMoney(income, cur), iconName: 'arrowUp', variant: 'neutral',
        foot: [el('span', { class: 't-caption', text: currentMonthLabel })],
      }),
      KpiCard({
        label: 'Ahorro del mes', value: formatMoney(savings, cur), iconName: 'wallet', variant: 'neutral',
        foot: [Badge(formatPercent(savingsRate), savings >= 0 ? 'positive' : 'negative'), el('span', { class: 't-caption', text: 'tasa de ahorro' })],
      }),
      KpiCard({
        label: 'Liquidez disponible', value: formatMoney(liquidity, cur), iconName: 'accounts', variant: 'neutral',
        foot: [
          liquidityAlert,
          liquidityAlert ? null : el('span', { class: 't-caption', text:
            `${selectors.liquidAccounts(s).length} cuentas${expense > 0 ? ` · ${(liquidity / expense).toFixed(1)} meses` : ''}` }),
        ].filter(Boolean),
      }),
    ]);

    // ── Evolución patrimonio ──────────────────────────────────────────────────
    const snaps  = [...(s.netWorthSnapshots || [])].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-6);
    const series = snaps.map((sn) => ({ label: formatDate(sn.date, 'short'), value: sn.netWorth }));

    const netWorthCard = snaps.length >= 2
      ? Card({
          title: 'Evolución del patrimonio',
          action: Badge(`${snaps.length} snapshot${snaps.length > 1 ? 's' : ''}`, 'info'),
          body: el('div', {}, [BarChart(series)]),
        })
      : Card({
          title: 'Evolución del patrimonio',
          body: EmptyState({
            title: snaps.length === 0 ? 'Sin historial aún' : 'Solo 1 snapshot',
            message: 'Toma un snapshot mensual en Patrimonio para ver cómo evoluciona tu riqueza neta.',
            iconName: 'networth',
            action: Button('Ir a Patrimonio', { variant: 'primary', iconName: 'networth', onClick: () => { location.hash = '#/networth'; } }),
          }),
        });

    // ── Gasto por categoría ───────────────────────────────────────────────────
    const byCat  = selectors.expenseByCategory(s).slice(0, 5);
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

    // ── Movimientos recientes ─────────────────────────────────────────────────
    const recent     = selectors.recentTransactions(s, 6);
    const recentCard = Card({
      title: 'Movimientos recientes',
      action: Button('Ver todos', { variant: 'ghost', onClick: () => { location.hash = '#/transactions'; } }),
      body: recent.length
        ? el('div', { class: 'row-list' }, recent.map((t) => {
            const cat        = selectors.categoryById(s, t.categoryId);
            const acc        = selectors.accountById(s, t.accountId);
            const isIncome   = t.type === 'income';
            const isTransfer = t.type === 'transfer';
            const sign  = isIncome ? '+' : isTransfer ? '' : '−';
            const cls   = isIncome ? 'text-positive' : isTransfer ? '' : 'text-negative';
            const label = isTransfer ? 'Transferencia' : (cat?.name || 'Sin categoría');
            return el('div', { class: 'row' }, [
              el('div', { class: 'row__avatar', html: icon(isTransfer ? 'transactions' : (cat?.icon || 'wallet')) }),
              el('div', { class: 'row__main' }, [
                el('div', { class: 'row__title', text: t.description || label }),
                el('div', { class: 'row__sub', text: `${label} · ${acc?.name || ''} · ${relativeDay(t.date)}` }),
              ]),
              el('div', { class: `row__amount ${cls}`, text: `${sign}${formatMoney(t.amount, cur)}` }),
            ]);
          }))
        : EmptyState({ title: 'Sin movimientos', iconName: 'transactions' }),
    });

    // ── Metas activas ─────────────────────────────────────────────────────────
    const goals     = selectors.activeGoals(s);
    const goalsCard = Card({
      title: 'Metas activas',
      action: el('div', { class: 'row-flex' }, [
        nearGoals.length ? Badge(`${nearGoals.length} casi lista${nearGoals.length > 1 ? 's' : ''}`, 'positive') : null,
        Badge(`${goals.length}`, 'gold'),
      ].filter(Boolean)),
      body: goals.length
        ? el('div', {}, goals.map((g) => {
            const pct = g.targetAmount ? Math.min(100, ((g.currentAmount || 0) / g.targetAmount) * 100) : 0;
            return el('div', { class: 'goal' }, [
              el('div', { class: 'goal__top' }, [
                el('span', { class: 'goal__name', text: g.name }),
                el('span', { class: 'goal__meta', text: `${formatMoney(g.currentAmount || 0, cur, { compact: true })} / ${formatMoney(g.targetAmount, cur, { compact: true })}` }),
              ]),
              ProgressBar(pct, pct >= 90 ? 'positive' : 'gold'),
            ]);
          }))
        : EmptyState({ title: 'Sin metas activas', iconName: 'goals' }),
    });

    // ── Próximos pagos ────────────────────────────────────────────────────────
    const upcoming     = selectors.upcomingPayments(s, 5);
    const upcomingCard = Card({
      title: 'Próximos pagos',
      action: urgentPayments.length
        ? Badge(`${urgentPayments.length} urgente${urgentPayments.length > 1 ? 's' : ''}`, 'warning')
        : el('span', { class: 'row-flex', html: icon('calendar') }),
      body: upcoming.length
        ? el('div', { class: 'row-list' }, upcoming.map((r) => {
            const cat = selectors.categoryById(s, r.categoryId);
            const isUrgent = urgentPayments.some((i) => i.id === r.id);
            return el('div', { class: 'row' }, [
              el('div', { class: 'row__avatar', html: icon(cat?.icon || 'calendar') }),
              el('div', { class: 'row__main' }, [
                el('div', { class: 'row__title', text: r.description }),
                el('div', { class: 'row__sub' }, [
                  isUrgent ? Badge(relativeDay(r.nextRunDate), 'warning') : relativeDay(r.nextRunDate),
                ]),
              ]),
              el('div', { class: 'row__amount', text: formatMoney(r.amount, cur) }),
            ]);
          }))
        : EmptyState({ title: 'Sin pagos próximos', iconName: 'calendar' }),
    });

    // ── Composición ──────────────────────────────────────────────────────────
    mount(root,
      el('div', {}, [
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
      ])
    );
  }

  store.subscribe(() => { if (root.isConnected) repaint(); });
  repaint();
  return root;
}
