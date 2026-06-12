// views/today.js — vista "Hoy": copiloto financiero diario.
// Rediseño fintech R1: héroe con semáforo integrado, quick-add móvil y
// "Para hoy" accionable (registrar pago / aportar a meta sin salir de la vista).

import { el, mount } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { store } from '../store/store.js';
import { selectors } from '../store/selectors.js';
import { formatMoney, relativeDay } from '../utils/format.js';
import { Card, Badge, ProgressBar, EmptyState, Button, HeroCard, Fab } from '../components/ui.js';
import { openTxModal } from './transactions.js';
import { openContributeModal } from './goals.js';
import { dismiss, isDismissed, clearStale } from '../services/dismissService.js';

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
const ACTION_ICON    = { payment: 'calendar', budget: 'budgets', goal: 'goals' };

export function renderToday() {
  const root = el('div');

  function repaint() {
    clearStale();
    const s = store.get();
    const cur = s.baseCurrency;
    const accMap = {}; (s.accounts || []).forEach((a) => { accMap[a.id] = a; });
    const catMap = {}; (s.categories || []).forEach((c) => { catMap[c.id] = c; });

    // ── Datos del día ─────────────────────────────────────────────────────────
    const liquidity  = selectors.totalLiquidity(s);
    const savings    = selectors.monthlySavings(s);
    const todayKey   = new Date().toISOString().slice(0, 10);
    const todays     = (s.transactions || []).filter((t) => String(t.date).slice(0, 10) === todayKey);
    const todayNet   = todays.reduce((sum, t) => sum + (t.type === 'income' ? t.amount : t.type === 'expense' ? -t.amount : 0), 0);
    const health     = selectors.dailyHealth(s);

    // ── Héroe: saldo disponible + semáforo integrado ─────────────────────────
    const heroCard = HeroCard({
      label: 'Saldo disponible',
      iconName: 'wallet',
      value: formatMoney(liquidity, cur),
      trendRow: [
        Badge(HEALTH_LABEL[health.status], HEALTH_VARIANT[health.status]),
        health.reasons.length
          ? el('span', { class: 't-caption', text: health.reasons.join(' · ') })
          : el('span', { class: 't-caption', text: `${selectors.liquidAccounts(s).length} cuentas líquidas` }),
      ],
      split: [
        { label: 'Hoy', value: formatMoney(todayNet, cur, { signed: true }), cls: todayNet < 0 ? 'text-negative' : todayNet > 0 ? 'text-positive' : '' },
        { label: 'Ahorro del mes', value: formatMoney(savings, cur, { compact: true }), cls: savings < 0 ? 'text-negative' : 'text-positive' },
        { label: 'Movimientos hoy', value: String(todays.length) },
      ],
    });

    // ── Quick-add móvil: gasto / ingreso a un toque ──────────────────────────
    const quickAdd = el('div', { class: 'today-quick' }, [
      el('button', { class: 'today-quick__btn today-quick__btn--expense', type: 'button',
        on: { click: () => openTxModal({ tx: { type: 'expense' }, mode: 'create' }) } }, [
        el('span', { html: icon('arrowDown') }), el('span', { text: 'Gasto' }),
      ]),
      el('button', { class: 'today-quick__btn today-quick__btn--income', type: 'button',
        on: { click: () => openTxModal({ tx: { type: 'income' }, mode: 'create' }) } }, [
        el('span', { html: icon('arrowUp') }), el('span', { text: 'Ingreso' }),
      ]),
    ]);

    // ── Insight + progreso del mes ───────────────────────────────────────────
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

    const pulseCard = Card({
      body: el('div', { class: 'today-health-body' }, [
        insight ? el('p', { class: 'today-insight', text: insight }) : null,
        el('div', { class: 'today-progress' }, [
          ProgressBar(progressPct, progressVariant),
          el('span', { class: 't-caption today-progress-label', text: progressText }),
        ]),
      ].filter(Boolean)),
    });

    // ── Para hoy — accionable (R1): registrar pago / ver presupuesto / aportar ─
    const items = selectors.actionItems(s);

    function actionCta(item) {
      if (item.type === 'payment' && item.raw) {
        const r = item.raw;
        return Button('Registrar', { variant: 'ghost', size: 'sm', onClick: () => openTxModal({
          tx: { type: r.type || 'expense', amount: r.amount, accountId: r.accountId,
                categoryId: r.categoryId, description: r.description },
          mode: 'create',
        }) });
      }
      if (item.type === 'goal' && item.raw) {
        return Button('Aportar', { variant: 'ghost', size: 'sm', onClick: () => openContributeModal(item.raw) });
      }
      return el('a', { class: 'btn btn--ghost btn--sm', href: '#/budgets', text: 'Ver →' });
    }

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
              el('div', { class: 'row__actions row__actions--visible' }, [actionCta(item)]),
            ].filter(Boolean));
          }))
        : EmptyState({ title: 'Todo al día', message: 'Sin pagos urgentes ni presupuestos al límite.', iconName: 'check' }),
    });

    // ── Movimientos: timeline de hoy, o recientes si el día está vacío ───────
    const recent     = selectors.recentTransactions(s, 5);
    const showTodays = todays.length > 0;
    const txList     = showTodays
      ? [...todays].sort((a, b) => (a.date < b.date ? 1 : -1))
      : recent;

    const recentCard = Card({
      title: showTodays ? 'Movimientos de hoy' : 'Movimientos recientes',
      action: Button('Ver todos', { variant: 'ghost', onClick: () => { location.hash = '#/transactions'; } }),
      body: txList.length
        ? el('div', { class: 'row-list' }, txList.map((t) => {
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

    // ── Próximos pagos (dismissables) ────────────────────────────────────────
    const upcoming = selectors.upcomingPayments(s, 4);
    const upcomingArea = el('div');

    function renderUpcoming() {
      const visible = upcoming.filter((r) => !isDismissed(r.id));
      mount(upcomingArea, Card({
        title: 'Próximos pagos',
        action: el('span', { class: 'row-flex', html: icon('calendar') }),
        body: visible.length
          ? el('div', { class: 'row-list' }, visible.map((r) => {
              const cat = catMap[r.categoryId];
              return el('div', { class: 'row' }, [
                el('div', { class: 'row__avatar', html: icon(cat?.icon || 'calendar') }),
                el('div', { class: 'row__main' }, [
                  el('div', { class: 'row__title', text: r.description }),
                  el('div', { class: 'row__sub', text: relativeDay(r.nextRunDate) }),
                ]),
                el('div', { class: 'row__amount tabular', text: formatMoney(r.amount, cur) }),
                el('button', {
                  class: 'btn btn--ghost btn--sm',
                  text: 'Visto ✓',
                  'aria-label': `Marcar como visto: ${r.description}`,
                  on: { click: () => {
                    const tod = new Date().toISOString().slice(0, 10);
                    const tom = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
                    dismiss(r.id, r.nextRunDate > tod ? r.nextRunDate : tom);
                    renderUpcoming();
                  } },
                }),
              ]);
            }))
          : EmptyState({ title: 'Nada próximo', iconName: 'calendar' }),
      }));
    }

    renderUpcoming();

    // ── Metas prioritarias ───────────────────────────────────────────────────
    const goals = selectors.activeGoals(s)
      .slice().sort((a, b) => new Date(a.targetDate || '2999') - new Date(b.targetDate || '2999'))
      .slice(0, 3);

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
              ProgressBar(pct, 'gold', { ariaLabel: `Avance de ${g.name}` }),
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
            el('div', { class: 'u-hide-mobile' }, [
              Button('Nuevo movimiento', { variant: 'primary', iconName: 'plus', onClick: () => openTxModal({ mode: 'create' }) }),
            ]),
          ]),
        ]),
        heroCard,
        quickAdd,
        el('div', { class: 'section' }, [pulseCard]),
        el('div', { class: 'section' }, [paraHoyCard]),
        el('div', { class: 'grid grid--2 section' }, [
          recentCard,
          el('div', { class: 'stack' }, [upcomingArea, goalsCard]),
        ]),
        Fab('Nuevo movimiento', { onClick: () => openTxModal({ mode: 'create' }) }),
      ])
    );
  }

  store.subscribe(() => { if (root.isConnected) repaint(); });
  repaint();
  return root;
}
