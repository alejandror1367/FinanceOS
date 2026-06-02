// views/today.js — vista "Hoy": copiloto financiero diario.
// Composición reactiva sobre selectores + acceso rápido a nuevo movimiento.

import { el, mount } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { store } from '../store/store.js';
import { selectors } from '../store/selectors.js';
import { formatMoney, relativeDay } from '../utils/format.js';
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

// Genera un insight a partir del estado: variación de categoría o pace de ahorro.
function buildInsight(s) {
  const change = selectors.topCategoryChange(s);
  if (change && change.category && Math.abs(change.pct) >= 10) {
    const dir = change.pct > 0 ? 'aumentaron' : 'bajaron';
    return `Tus gastos en ${change.category.name} ${dir} ${Math.abs(change.pct).toFixed(0)}% vs el mes pasado`;
  }
  const savings = selectors.monthlySavings(s);
  if (savings > 0) {
    const goals = selectors.activeGoals(s).filter((g) => (g.targetAmount || 0) > (g.currentAmount || 0));
    if (goals.length) {
      const needed = (goals[0].targetAmount || 0) - (goals[0].currentAmount || 0);
      const months = Math.ceil(needed / savings);
      if (months >= 1 && months <= 24) {
        return `A este ritmo de ahorro llegas a "${goals[0].name}" en ${months} ${months === 1 ? 'mes' : 'meses'}`;
      }
    }
  }
  return null;
}

const HEALTH_LABEL   = { green: 'Todo en orden', yellow: 'Atención', red: 'Acción requerida' };
const HEALTH_VARIANT = { green: 'positive',       yellow: 'warning',  red: 'negative' };
const HEALTH_ICON    = { green: 'check',           yellow: 'bell',     red: 'bell' };
const ACTION_ICON    = { payment: 'calendar', budget: 'budgets', goal: 'goals' };
const ACTION_CTA     = { payment: 'Abonar',   budget: 'Ver',     goal: 'Aportar' };
const ACTION_HREF    = { payment: '#/debts',  budget: '#/budgets', goal: '#/goals' };

export function renderToday() {
  const root = el('div');

  function repaint() {
    const s = store.get();
    const cur = s.baseCurrency;
    const accMap = {}; (s.accounts || []).forEach((a) => { accMap[a.id] = a; });
    const catMap = {}; (s.categories || []).forEach((c) => { catMap[c.id] = c; });

    // ── KPIs ─────────────────────────────────────────────────────────────────
    const liquidity  = selectors.totalLiquidity(s);
    const savings    = selectors.monthlySavings(s);
    const todayKey   = new Date().toISOString().slice(0, 10);
    const todays     = (s.transactions || []).filter((t) => String(t.date).slice(0, 10) === todayKey);
    const todayNet   = todays.reduce((sum, t) => sum + (t.type === 'income' ? t.amount : t.type === 'expense' ? -t.amount : 0), 0);

    const kpis = el('div', { class: 'grid grid--kpi' }, [
      KpiCard({ label: 'Saldo disponible', value: formatMoney(liquidity, cur), iconName: 'wallet', variant: 'accent', hero: true,
        foot: [el('span', { class: 't-caption', text: `${selectors.liquidAccounts(s).length} cuentas` })] }),
      KpiCard({ label: 'Hoy', value: formatMoney(todayNet, cur, { signed: true }), iconName: 'today', variant: 'neutral',
        foot: [el('span', { class: 't-caption', text: `${todays.length} movimiento${todays.length !== 1 ? 's' : ''}` })] }),
      KpiCard({ label: 'Ahorro del mes', value: formatMoney(savings, cur), iconName: 'networth', variant: savings >= 0 ? 'emerald' : 'negative' }),
    ]);

    // ── Semáforo + Insight + Progreso del mes ─────────────────────────────────
    const health   = selectors.dailyHealth(s);
    const progress = selectors.monthProgress(s);
    const insight  = buildInsight(s);

    const monthName  = new Intl.DateTimeFormat('es-CO', { month: 'long' }).format(new Date());
    const monthLabel = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    const progressPct = progress.totalBudget > 0
      ? (progress.monthlyExpense / progress.totalBudget) * 100
      : progress.pct;
    const progressVariant = progress.totalBudget > 0 && progress.monthlyExpense >= progress.totalBudget ? 'negative'
      : progress.totalBudget > 0 && progress.monthlyExpense >= progress.totalBudget * 0.8 ? 'warning' : 'gold';
    const progressText = `${monthLabel} ${progress.day}: ${progress.day}/${progress.daysInMonth} días`
      + (progress.totalBudget > 0
        ? ` · ${formatMoney(progress.monthlyExpense, cur, { compact: true })} de ${formatMoney(progress.totalBudget, cur, { compact: true })}`
        : '');

    const healthCard = Card({
      body: el('div', { class: 'today-health-body' }, [
        el('div', { class: 'row-flex between' }, [
          el('div', { class: 'row-flex' }, [
            el('span', { class: 'today-health-icon', html: icon(HEALTH_ICON[health.status]) }),
            Badge(HEALTH_LABEL[health.status], HEALTH_VARIANT[health.status]),
          ]),
          health.reasons.length
            ? el('span', { class: 't-caption text-secondary', text: health.reasons.join(' · ') })
            : null,
        ].filter(Boolean)),
        insight ? el('p', { class: 'today-insight', text: insight }) : null,
        el('div', { class: 'today-progress' }, [
          ProgressBar(progressPct, progressVariant),
          el('span', { class: 't-caption today-progress-label', text: progressText }),
        ]),
      ].filter(Boolean)),
    });

    // ── Para hoy ─────────────────────────────────────────────────────────────
    const items = selectors.actionItems(s);
    const paraHoyCard = Card({
      title: 'Para hoy',
      action: items.length ? Badge(String(items.length), 'warning') : null,
      body: items.length
        ? el('div', { class: 'row-list' }, items.map((item) => {
            const amtText = item.amount > 0 ? formatMoney(item.amount, item.currency || cur) : null;
            const badgeVariant = item.type === 'budget' && item.pct >= 100 ? 'negative'
              : item.type === 'budget' ? 'warning'
              : item.type === 'payment' ? 'negative' : 'info';
            return el('div', { class: 'row' }, [
              el('div', { class: 'row__avatar', html: icon(ACTION_ICON[item.type]) }),
              el('div', { class: 'row__main' }, [
                el('div', { class: 'row__title', text: item.title }),
                el('div', { class: 'row__sub' }, [Badge(item.meta, badgeVariant)]),
              ]),
              amtText ? el('div', { class: 'row__amount', text: amtText }) : null,
              el('div', { class: 'row__actions' }, [
                el('a', { class: 'btn btn--ghost btn--sm', href: ACTION_HREF[item.type],
                  text: `${ACTION_CTA[item.type]} →` }),
              ]),
            ].filter(Boolean));
          }))
        : EmptyState({ title: 'Todo al día', message: 'Sin pagos urgentes ni presupuestos al límite.', iconName: 'check' }),
    });

    // ── Movimientos recientes ─────────────────────────────────────────────────
    const recent   = selectors.recentTransactions(s, 5);
    const upcoming = selectors.upcomingPayments(s, 4);
    const goals    = selectors.activeGoals(s)
      .slice().sort((a, b) => new Date(a.targetDate || '2999') - new Date(b.targetDate || '2999'))
      .slice(0, 3);

    const recentCard = Card({
      title: 'Movimientos recientes',
      action: Button('Ver todos', { variant: 'ghost', onClick: () => { location.hash = '#/transactions'; } }),
      body: recent.length
        ? el('div', { class: 'row-list' }, recent.map((t) => {
            const isIncome   = t.type === 'income';
            const isTransfer = t.type === 'transfer';
            const c    = catMap[t.categoryId];
            const sign = isIncome ? '+' : isTransfer ? '' : '−';
            const cls  = isIncome ? 'text-positive' : isTransfer ? '' : 'text-negative';
            return rowItem(
              isTransfer ? 'transactions' : (c ? c.icon : 'wallet'),
              t.description || (isTransfer ? 'Transferencia' : (c ? c.name : '')),
              `${accMap[t.accountId] ? accMap[t.accountId].name : ''} · ${relativeDay(t.date)}`,
              `${sign}${formatMoney(t.amount, cur)}`, cls);
          }))
        : EmptyState({ title: 'Sin movimientos', iconName: 'transactions' }),
    });

    const upcomingCard = Card({
      title: 'Próximos pagos',
      action: el('span', { class: 'row-flex', html: icon('calendar') }),
      body: upcoming.length
        ? el('div', { class: 'row-list' }, upcoming.map((r) =>
            rowItem(catMap[r.categoryId] ? catMap[r.categoryId].icon : 'calendar',
              r.description, relativeDay(r.nextRunDate), formatMoney(r.amount, cur))))
        : EmptyState({ title: 'Nada próximo', iconName: 'calendar' }),
    });

    const goalsCard = Card({
      title: 'Metas prioritarias',
      body: goals.length
        ? el('div', {}, goals.map((g) => {
            const pct = g.targetAmount ? Math.min(100, ((g.currentAmount || 0) / g.targetAmount) * 100) : 0;
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

    const dateStr = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

    mount(root,
      el('div', {}, [
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
        healthCard,
        paraHoyCard,
        el('div', { class: 'grid grid--2 section' }, [
          recentCard,
          el('div', { class: 'stack' }, [upcomingCard, goalsCard]),
        ]),
      ])
    );
  }

  store.subscribe(() => { if (root.isConnected) repaint(); });
  repaint();
  return root;
}
