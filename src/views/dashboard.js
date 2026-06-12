// views/dashboard.js — Dashboard: centro de comando financiero.
// Rediseño fintech (docs/DOSSIER_UI_UX_FINTECH): 8 bloques — Patrimonio,
// Salud, Flujo del Mes, Inversiones, Deudas, Metas, Pagos Próximos, Insights.
// Patrón root + repaint() + store.subscribe (reactivo sin fugas).

import { el, mount } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { store } from '../store/store.js';
import { selectors, isExpenseLike, sameMonth, transactionAmountBase } from '../store/selectors.js';
import { formatMoney, formatPercent, relativeDay, formatDate } from '../utils/format.js';
import {
  Card, Trend, Badge, BarChart, ProgressBar, EmptyState, Button,
} from '../components/ui.js';
import { openTxModal } from './transactions.js';
import { dismiss, isDismissed, clearStale } from '../services/dismissService.js';

const SCORE_META = [
  { min: 80, label: 'Excelente', variant: 'positive' },
  { min: 60, label: 'Bueno',     variant: 'info' },
  { min: 40, label: 'Regular',   variant: 'warning' },
  { min:  0, label: 'Mejorable', variant: 'negative' },
];
function scoreMeta(score) {
  return SCORE_META.find((m) => score >= m.min) || SCORE_META[SCORE_META.length - 1];
}

const ASSET_TYPE_LABEL = {
  stock: 'Acciones', etf: 'ETFs', crypto: 'Cripto', cdt: 'Renta fija',
  fund: 'Fondos', bond: 'Bonos', other: 'Otros',
};

// Sparkline SVG inline (sin librerías) — serie de patrimonio en el héroe.
function sparklineSvg(values, w = 170, h = 52) {
  if (!values || values.length < 2) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * w,
    h - 5 - ((v - min) / range) * (h - 12),
  ]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  return `
    <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="dash-spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop stop-color="currentColor" stop-opacity="0.30"/>
          <stop offset="1" stop-color="currentColor" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="${d}" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
      <path d="${d} L ${w} ${h} L 0 ${h} Z" fill="url(#dash-spark-fill)"/>
    </svg>`;
}

// Anillo de score (0–100) — gauge circular SVG.
function scoreRing(score, variant) {
  const r = 34; const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(100, score)) / 100);
  return el('div', { class: `dash-gauge dash-gauge--${variant}`, role: 'img', 'aria-label': `Score financiero: ${score} de 100` }, [
    el('div', { html: `
      <svg width="80" height="80" viewBox="0 0 80 80" aria-hidden="true">
        <circle cx="40" cy="40" r="${r}" stroke="var(--border)" stroke-width="7" fill="none"/>
        <circle cx="40" cy="40" r="${r}" stroke="currentColor" stroke-width="7" fill="none"
          stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"
          stroke-linecap="round" transform="rotate(-90 40 40)"/>
      </svg>` }),
    el('div', { class: 'dash-gauge__num tabular', text: String(score) }),
  ]);
}

// Fila compacta reutilizable (posiciones, deudas, insights).
function miniRow({ avatar, avatarClass = '', title, sub, right, rightSub }) {
  return el('div', { class: 'dash-mini' }, [
    avatar ? el('div', { class: `dash-mini__avatar ${avatarClass}`, html: avatar }) : null,
    el('div', { class: 'dash-mini__main' }, [
      el('div', { class: 'dash-mini__title', text: title }),
      sub ? el('div', { class: 'dash-mini__sub' }, Array.isArray(sub) ? sub : [sub]) : null,
    ]),
    (right || rightSub) ? el('div', { class: 'dash-mini__right' }, [
      right ? el('div', { class: 'dash-mini__val tabular' }, Array.isArray(right) ? right : [right]) : null,
      rightSub ? el('div', { class: 'dash-mini__valsub' }, Array.isArray(rightSub) ? rightSub : [rightSub]) : null,
    ].filter(Boolean)) : null,
  ].filter(Boolean));
}

// <details> desplegable estilo KPI (desgloses).
function detailsBlock(rows, label = 'Detalle') {
  if (!rows?.length) return null;
  return el('details', { class: 'kpi__details' }, [
    el('summary', { class: 'kpi__dtrig' }, [
      el('span', { text: label }),
      el('span', { class: 'kpi__dchev', html: icon('chevronDown') }),
    ]),
    el('ul', { class: 'kpi__dlist' },
      rows.map((r) => el('li', { class: 'kpi__drow' }, [
        el('span', { class: 'kpi__dlabel', text: r.label }),
        el('span', { class: 'kpi__dvalue tabular', text: r.value }),
      ]))
    ),
  ]);
}

function cardLink(label, hash) {
  return Button(label, { variant: 'ghost', size: 'sm', onClick: () => { location.hash = hash; } });
}

export function renderDashboard() {
  const root = el('div');

  function repaint() {
    clearStale();
    const s   = store.get();
    const cur = s.baseCurrency;

    // ── Datos derivados ───────────────────────────────────────────────────────
    const netWorth    = selectors.netWorth(s);
    const totalAssets = selectors.totalAssets(s);
    const totalLiab   = selectors.totalLiabilities(s);
    const income      = selectors.monthlyIncome(s);
    const expense     = selectors.monthlyExpense(s);
    const savings     = selectors.monthlySavings(s);
    const savingsRate = selectors.savingsRate(s);
    const liquidity   = selectors.totalLiquidity(s);
    const score       = selectors.financialScore(s);
    const sm          = scoreMeta(score);
    const gaps        = selectors.fxGaps(s);
    const portfolio   = selectors.portfolioOverview(s);
    const debtStats   = selectors.debtStats(s);
    const goals       = selectors.activeGoals(s);
    const monthlySavingsAvg = selectors.monthlySavingsAvg(s);
    const goalContribution  = selectors.goalSavingsSplit(s);

    const todayActions   = selectors.actionItems(s);
    const urgentPayments = todayActions.filter((i) => i.type === 'payment');
    const budgetAlerts   = todayActions.filter((i) => i.type === 'budget');
    const maxBudgetPct   = budgetAlerts.length ? Math.max(...budgetAlerts.map((i) => i.pct || 0)) : 0;

    const currentMonthLabel = (() => {
      const str = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(new Date());
      return str.charAt(0).toUpperCase() + str.slice(1);
    })();

    // ── BLOQUE 1: Patrimonio Neto (héroe — CAMBIO 3) ─────────────────────────
    const snaps = [...(s.netWorthSnapshots || [])].sort((a, b) => (a.date < b.date ? -1 : 1));
    const prevSnap      = snaps.at(-1);
    const netWorthTrend = prevSnap?.netWorth
      ? ((netWorth - prevSnap.netWorth) / Math.abs(prevSnap.netWorth)) * 100
      : null;

    // Variación mensual: contra el snapshot más reciente del mes ANTERIOR (o el último previo).
    const curMonthKey = new Date().toISOString().slice(0, 7);
    const prevMonthSnap = [...snaps].reverse().find((sn) => String(sn.date).slice(0, 7) < curMonthKey);
    const monthlyTrend = prevMonthSnap?.netWorth
      ? ((netWorth - prevMonthSnap.netWorth) / Math.abs(prevMonthSnap.netWorth)) * 100
      : null;

    const sparkValues = [...snaps.slice(-6).map((sn) => sn.netWorth), netWorth];

    const detailsNetWorth = (() => {
      const bd = selectors.netWorthBreakdown(s);
      const invValue = selectors.investmentsValue(s);
      return [
        { label: '+ Cuentas', value: formatMoney(bd.accountsValue, cur) },
        { label: '+ Inversiones', value: formatMoney(invValue, cur) },
        ...(bd.otherAssets > 0 ? [{ label: '+ Otros activos', value: formatMoney(bd.otherAssets, cur) }] : []),
        { label: '− Tarjetas de crédito', value: formatMoney(bd.ccDebt, cur) },
        ...(bd.liabilitiesDebt > 0 ? [{ label: '− Créditos / deudas', value: formatMoney(bd.liabilitiesDebt, cur) }] : []),
      ];
    })();

    const heroCard = el('article', { class: 'card dash-hero' }, [
      el('div', { class: 'dash-hero__top' }, [
        el('span', { class: 'kpi__label', text: 'Patrimonio neto' }),
        el('span', { class: 'kpi__icon', html: icon('networth') }),
      ]),
      el('div', { class: 'dash-hero__value tabular', text: formatMoney(netWorth, cur) }),
      el('div', { class: 'dash-hero__trend' }, [
        monthlyTrend !== null ? Trend(monthlyTrend) : null,
        el('span', { class: 't-caption', text:
          monthlyTrend !== null ? 'este mes'
            : netWorthTrend !== null ? 'sin snapshot del mes anterior' : 'sin comparativa aún' }),
        netWorthTrend !== null && monthlyTrend !== netWorthTrend
          ? el('span', { class: 't-caption dash-hero__vs', text:
              `· ${netWorthTrend >= 0 ? '+' : '−'}${Math.abs(netWorthTrend).toFixed(1)}% vs snapshot` })
          : null,
      ].filter(Boolean)),
      el('div', { class: 'dash-hero__split' }, [
        el('div', {}, [
          el('div', { class: 'dash-hero__k', text: 'Activos' }),
          el('div', { class: 'dash-hero__v tabular', text: formatMoney(totalAssets, cur, { compact: true }) }),
        ]),
        el('div', {}, [
          el('div', { class: 'dash-hero__k', text: 'Pasivos' }),
          el('div', { class: 'dash-hero__v tabular text-negative', text: totalLiab > 0 ? `−${formatMoney(totalLiab, cur, { compact: true })}` : formatMoney(0, cur) }),
        ]),
        el('div', {}, [
          el('div', { class: 'dash-hero__k', text: 'Liquidez' }),
          el('div', { class: 'dash-hero__v tabular', text: formatMoney(liquidity, cur, { compact: true }) }),
        ]),
      ]),
      sparkValues.length >= 3 ? el('div', { class: 'dash-hero__spark', html: sparklineSvg(sparkValues) }) : null,
      detailsBlock(detailsNetWorth),
    ].filter(Boolean));

    // ── BLOQUE 2: Salud Financiera ───────────────────────────────────────────
    const breakdown = selectors.financialScoreBreakdown(s);
    const healthCard = Card({
      title: 'Salud financiera',
      action: Badge(sm.label, sm.variant),
      body: el('div', { class: 'dash-health' }, [
        scoreRing(score, sm.variant),
        el('div', { class: 'dash-health__rows' }, breakdown.map((f) => {
          const ratio = f.max ? f.pts / f.max : 0;
          const cls = ratio >= 0.66 ? 'text-positive' : ratio >= 0.33 ? 'dash-warn' : 'text-negative';
          return el('div', { class: 'dash-health__row' }, [
            el('span', { class: 't-caption', text: f.factor }),
            el('span', { class: `tabular ${cls}`, text: `${f.pts}/${f.max}` }),
          ]);
        })),
      ]),
    });

    // ── BLOQUE 3: Flujo del Mes ──────────────────────────────────────────────
    const debtAccIds = new Set(s.accounts.filter((a) => a.type === 'credit_card').map((a) => a.id));
    const txBase = (t) => transactionAmountBase(t, cur) ?? 0;
    const detailsExpense = (() => {
      const txs = s.transactions
        .filter((t) => isExpenseLike(t, debtAccIds) && sameMonth(t.date))
        .sort((a, b) => txBase(b) - txBase(a));
      const rows = txs.slice(0, 7).map((t) => {
        const cat = selectors.categoryById(s, t.categoryId);
        return { label: t.description || cat?.name || 'Sin descripción', value: formatMoney(txBase(t), cur) };
      });
      if (txs.length > 7) rows.push({ label: `+${txs.length - 7} más`, value: '' });
      return rows;
    })();

    const flowMax = Math.max(income, expense, 1);
    const flowBar = (label, value, pct, variant) => el('div', { class: 'dash-flow__item' }, [
      el('div', { class: 'dash-flow__top' }, [
        el('span', { class: 't-caption', text: label }),
        el('span', { class: 'tabular dash-flow__amt', text: value }),
      ]),
      ProgressBar(pct, variant, { ariaLabel: label }),
    ]);

    const flowCard = Card({
      title: 'Flujo del mes',
      action: Badge(currentMonthLabel.split(' ')[0], 'info'),
      body: el('div', { class: 'dash-flow' }, [
        flowBar('Ingresos', formatMoney(income, cur), (income / flowMax) * 100, 'positive'),
        flowBar('Gastos', formatMoney(expense, cur), (expense / flowMax) * 100, 'negative'),
        maxBudgetPct > 0
          ? flowBar('Presupuesto más usado', `${Math.round(maxBudgetPct)}%`, maxBudgetPct, maxBudgetPct >= 100 ? 'negative' : 'warning')
          : null,
        el('div', { class: 'dash-flow__net' }, [
          el('span', { class: 't-caption', text: 'Ahorro neto' }),
          el('span', { class: 'row-flex' }, [
            el('span', { class: `tabular dash-flow__netval ${savings >= 0 ? 'text-positive' : 'text-negative'}`,
              text: `${savings >= 0 ? '+' : '−'}${formatMoney(Math.abs(savings), cur)}` }),
            Badge(formatPercent(savingsRate), savings >= 0 ? 'positive' : 'negative'),
          ]),
        ]),
        detailsBlock(detailsExpense, 'Gastos del mes'),
      ].filter(Boolean)),
    });

    // ── BLOQUE 4: Inversiones (vista compacta — CAMBIO 5) ───────────────────
    const invSummary = selectors.investmentsSummary(s);
    const invCard = Card({
      title: 'Inversiones',
      action: el('div', { class: 'row-flex' }, [
        invSummary.value > 0 ? Trend(invSummary.returnPct) : null,
        cardLink('Ver todas', '#/investments'),
      ].filter(Boolean)),
      body: portfolio.positions.length
        ? el('div', {}, [
            el('div', { class: 'dash-blocktotal tabular', text: formatMoney(portfolio.total, cur) }),
            el('div', { class: 'dash-minilist' }, portfolio.positions.slice(0, 5).map((p) => miniRow({
              avatar: `<span>${(p.symbol || p.name).slice(0, 2).toUpperCase()}</span>`,
              avatarClass: 'dash-mini__avatar--accent',
              title: p.symbol || p.name,
              sub: el('span', { class: 't-caption', text: ASSET_TYPE_LABEL[p.assetType] || p.assetType }),
              right: formatMoney(p.value, cur, { compact: true }),
              rightSub: el('span', { class: `tabular ${p.returnPct >= 0 ? 'text-positive' : 'text-negative'}`,
                text: `${p.returnPct >= 0 ? '+' : '−'}${Math.abs(p.returnPct).toFixed(1)}%` }),
            }))),
          ])
        : EmptyState({ title: 'Sin posiciones activas', iconName: 'investments',
            action: Button('Ir a Inversiones', { variant: 'ghost', onClick: () => { location.hash = '#/investments'; } }) }),
    });

    // ── BLOQUE 5: Deudas (CAMBIO 6) ──────────────────────────────────────────
    const debtCard = (() => {
      const list = [...debtStats.list].sort((a, b) => b.balance - a.balance);
      if (!list.length) {
        return Card({ title: 'Deudas', body: EmptyState({ title: 'Libre de deudas', message: 'No tienes saldos pendientes.', iconName: 'check' }) });
      }
      const palette = ['var(--negative)', 'var(--warning)', 'var(--accent)', 'var(--accent-2)', 'var(--neutral)'];
      const totalForDist = list.reduce((a, d) => a + d.balance, 0) || 1;
      const dist = el('div', { class: 'dash-dist', role: 'img', 'aria-label': 'Distribución de deudas' },
        list.slice(0, 5).map((d, i) => el('span', {
          style: { width: `${(d.balance / totalForDist) * 100}%`, background: palette[i % palette.length] },
          title: d.name,
        })));
      const rows = list.slice(0, 4).map((d, i) => miniRow({
        avatar: `<span class="dash-dot" style="background:${palette[i % palette.length]}"></span>`,
        title: d.name,
        sub: d.interestRate ? el('span', { class: 't-caption', text: `${d.interestRate}% E.A.` }) : null,
        right: formatMoney(d.balance, d.currency || cur, { compact: true }),
      }));

      // Estrategia Avalanche encadenada (mayor tasa primero) — fecha libre + intereses.
      const avalanche = selectors.chainedPayoff([...list].sort((a, b) => (b.interestRate || 0) - (a.interestRate || 0)));
      let strategy = null;
      if (avalanche.months > 0 && avalanche.months !== Infinity) {
        const d = new Date(); d.setMonth(d.getMonth() + avalanche.months);
        const dateStr = new Intl.DateTimeFormat('es-CO', { month: 'short', year: 'numeric' }).format(d);
        strategy = el('div', { class: 'dash-strategy' }, [
          el('span', { html: icon('bolt') }),
          el('span', {}, [
            'Avalanche: libre de deuda en ',
            el('b', { text: dateStr }),
            ` · ${formatMoney(avalanche.totalInterest, cur, { compact: true })} en intereses`,
          ]),
        ]);
      } else if (avalanche.months === Infinity) {
        strategy = el('div', { class: 'dash-strategy dash-strategy--warn' }, [
          el('span', { html: icon('bell') }),
          el('span', { text: 'Las cuotas mínimas no cubren los intereses — revisa el plan en Deudas.' }),
        ]);
      }

      return Card({
        title: 'Deudas',
        action: cardLink('Ver plan', '#/debts'),
        body: el('div', {}, [
          el('div', { class: 'dash-blocktotal tabular', text: formatMoney(debtStats.total, cur) }),
          dist,
          el('div', { class: 'dash-minilist' }, rows),
          strategy,
        ].filter(Boolean)),
      });
    })();

    // ── BLOQUE 6: Metas (CAMBIO 7 — probabilidad + fecha proyectada) ─────────
    const goalsCard = Card({
      title: 'Metas',
      action: el('div', { class: 'row-flex' }, [
        goals.length ? Badge(String(goals.length), 'gold') : null,
        cardLink('Ver todas', '#/goals'),
      ].filter(Boolean)),
      body: goals.length
        ? el('div', {}, goals.slice(0, 4).map((g) => {
            const pct = g.targetAmount ? Math.min(100, ((g.currentAmount || 0) / g.targetAmount) * 100) : 0;
            const outlook = selectors.goalOutlook(s, g, goalContribution);
            const probBadge = outlook.probability !== null
              ? Badge(`${outlook.probability}% prob.`, outlook.probability >= 70 ? 'positive' : outlook.probability >= 40 ? 'warning' : 'negative')
              : null;
            const projected = outlook.projectedDate
              ? new Intl.DateTimeFormat('es-CO', { month: 'short', year: 'numeric' }).format(new Date(outlook.projectedDate))
              : null;
            return el('div', { class: 'goal' }, [
              el('div', { class: 'goal__top' }, [
                el('span', { class: 'goal__name', text: g.name }),
                el('span', { class: 'goal__meta tabular', text: `${formatMoney(g.currentAmount || 0, cur, { compact: true })} / ${formatMoney(g.targetAmount, cur, { compact: true })}` }),
              ]),
              ProgressBar(pct, pct >= 90 ? 'positive' : 'gold', { ariaLabel: `Avance de ${g.name}` }),
              el('div', { class: 'goal__outlook' }, [
                el('span', { class: 't-caption', text: projected ? `Proyección: ${projected}` : (outlook.months === null ? 'Sin ritmo de ahorro' : '') }),
                probBadge,
              ].filter(Boolean)),
            ]);
          }))
        : EmptyState({ title: 'Sin metas activas', iconName: 'goals' }),
    });

    // ── BLOQUE 7: Pagos próximos ─────────────────────────────────────────────
    const upcoming = selectors.upcomingPayments(s, 5);
    const upcomingArea = el('div');

    function renderUpcomingCard() {
      const visible = upcoming.filter((r) => !isDismissed(r.id));
      mount(upcomingArea, Card({
        title: 'Pagos próximos',
        action: urgentPayments.length
          ? Badge(`${urgentPayments.length} urgente${urgentPayments.length > 1 ? 's' : ''}`, 'warning')
          : el('span', { class: 'row-flex', html: icon('calendar') }),
        body: visible.length
          ? el('div', { class: 'row-list' }, visible.map((r) => {
              const cat      = selectors.categoryById(s, r.categoryId);
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
                el('button', {
                  class: 'btn btn--ghost btn--sm',
                  text: 'Visto ✓',
                  'aria-label': `Marcar como visto: ${r.description}`,
                  on: { click: () => {
                    const tod = new Date().toISOString().slice(0, 10);
                    const tom = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
                    dismiss(r.id, r.nextRunDate > tod ? r.nextRunDate : tom);
                    renderUpcomingCard();
                  } },
                }),
              ]);
            }))
          : EmptyState({ title: 'Sin pagos próximos', iconName: 'calendar' }),
      }));
    }
    renderUpcomingCard();

    // ── BLOQUE 8: Insights (CAMBIO 4 + 9 — deterministas, accionables) ───────
    const insights = (() => {
      const out = [];
      const pushI = (kind, html) => out.push({ kind, html });

      // Presupuestos al límite
      budgetAlerts.slice(0, 2).forEach((b) => {
        const over = (b.pct || 0) >= 100;
        pushI(over ? 'negative' : 'warning',
          `<b>${b.title}</b>: ${over ? 'presupuesto superado' : `${Math.round(b.pct)}% del presupuesto consumido`}.`);
      });

      // Cambio de categoría más fuerte vs mes anterior
      const change = selectors.topCategoryChange(s);
      if (change && Math.abs(change.pct) >= 10 && change.category) {
        const dir = change.pct > 0 ? 'aumentó' : 'bajó';
        pushI(change.pct > 0 ? 'warning' : 'positive',
          `<b>${change.category.name}</b> ${dir} ${Math.abs(change.pct).toFixed(0)}% vs el mes pasado (${formatMoney(change.curAmt, cur, { compact: true })}).`);
      }

      // Ritmo de ahorro proyectado al cierre del mes
      const day = new Date().getDate();
      const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
      if (day > 3 && income > 0) {
        const projected = (savings / day) * daysInMonth;
        pushI(projected >= 0 ? 'positive' : 'negative',
          projected >= 0
            ? `A este ritmo ahorrarás <b>${formatMoney(projected, cur, { compact: true })}</b> este mes.`
            : `A este ritmo cerrarás el mes con <b>${formatMoney(Math.abs(projected), cur, { compact: true })}</b> en negativo.`);
      }

      // Portafolio: mayor ganador / concentración (sin duplicar alertas)
      if (portfolio.topGainer && portfolio.topGainer.returnPct > 0) {
        pushI('positive',
          `<b>${portfolio.topGainer.symbol || portfolio.topGainer.name}</b> lidera tu portafolio: ${portfolio.topGainer.returnPct >= 0 ? '+' : ''}${portfolio.topGainer.returnPct.toFixed(1)}% (${formatMoney(portfolio.topGainer.gain, cur, { compact: true })}).`);
      }
      selectors.portfolioAlerts(s).slice(0, 2).forEach((a) => {
        pushI(a.severity === 'error' ? 'negative' : a.severity === 'warning' ? 'warning' : 'info', a.message);
      });

      // Liquidez vs gasto mensual
      if (expense > 0 && monthlySavingsAvg > 0 && liquidity / expense < 1) {
        pushI('warning', `Tu liquidez cubre menos de 1 mes de gastos (${(liquidity / expense).toFixed(1)} meses).`);
      }

      return out.slice(0, 5);
    })();

    const INSIGHT_ICON = { positive: 'arrowUp', warning: 'bell', negative: 'arrowDown', info: 'analytics' };
    const insightsCard = Card({
      title: 'Insights',
      action: insights.length ? Badge(String(insights.length), 'info') : null,
      body: insights.length
        ? el('div', { class: 'dash-insights' }, insights.map((i) => el('div', { class: 'dash-insight' }, [
            el('span', { class: `dash-insight__ico dash-insight__ico--${i.kind}`, html: icon(INSIGHT_ICON[i.kind] || 'analytics') }),
            el('span', { class: 'dash-insight__text', html: i.html }),
          ])))
        : EmptyState({ title: 'Sin novedades', message: 'Todo en orden este mes.', iconName: 'check' }),
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

    // ── Evolución del patrimonio (histórico por snapshots) ───────────────────
    const snapsChart = snaps.slice(-6);
    const series = snapsChart.map((sn) => ({ label: formatDate(sn.date, 'short'), value: sn.netWorth }));
    const netWorthCard = snapsChart.length >= 2
      ? Card({
          title: 'Evolución del patrimonio',
          action: Badge(`${snapsChart.length} snapshot${snapsChart.length > 1 ? 's' : ''}`, 'info'),
          body: el('div', {}, [BarChart(series)]),
        })
      : Card({
          title: 'Evolución del patrimonio',
          body: EmptyState({
            title: snapsChart.length === 0 ? 'Sin historial aún' : 'Solo 1 snapshot',
            message: 'Toma un snapshot mensual en Patrimonio para ver cómo evoluciona tu riqueza neta.',
            iconName: 'networth',
            action: Button('Ir a Patrimonio', { variant: 'primary', iconName: 'networth', onClick: () => { location.hash = '#/networth'; } }),
          }),
        });

    // ── Banner FX: entidades excluidas de totales por falta de tasa ─────────
    const fxBanner = (() => {
      if (!gaps.count) return null;
      const n   = gaps.count;
      const curList = gaps.currencies.join(', ');
      const w   = el('div', { class: 'import-warning', style: { marginBottom: 'var(--space-4)' } });
      w.appendChild(el('span', { html: icon('bell') }));
      w.appendChild(el('span', {}, [
        `${n} entidad${n > 1 ? 'es' : ''} en ${curList} excluida${n > 1 ? 's' : ''} de los totales por falta de tasa de cambio. `,
        el('a', { href: '#/investments', style: 'color:inherit;text-decoration:underline', text: 'Actualizar precios en Inversiones.' }),
      ]));
      return w;
    })();

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
        fxBanner,
        el('div', { class: 'grid dash-row dash-row--hero' }, [heroCard, healthCard, flowCard]),
        el('div', { class: 'grid dash-row section' }, [invCard, debtCard, goalsCard]),
        el('div', { class: 'grid dash-row section' }, [upcomingArea, insightsCard, categoryCard]),
        el('div', { class: 'grid grid--2 section' }, [recentCard, netWorthCard]),
      ])
    );
  }

  store.subscribe(() => { if (root.isConnected) repaint(); });
  repaint();
  return root;
}
