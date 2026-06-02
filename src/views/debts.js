// views/debts.js — Deudas: KPIs unificados (Liabilities + tarjetas de crédito),
// plan de pago Snowball/Avalanche y "abono" como transferencia (debt settlement).

import { el } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { store } from '../store/store.js';
import { selectors } from '../store/selectors.js';
import { dataService } from '../services/dataService.js';
import { formatMoney, formatDate } from '../utils/format.js';
import { KpiCard, Badge, EmptyState, Button } from '../components/ui.js';
import { openModal, confirmDialog } from '../components/modal.js';
import { field, textInput, numberInput, select } from '../components/forms.js';
import { openLiabilityModal, LIABILITY_TYPE_LIST } from './networth.js';
import { openTxModal } from './transactions.js';
import { openAccountModal } from './accounts.js';
import { toast } from '../services/toast.js';
import { guardedOp, guardedSave } from '../components/crud.js';

const pct = (n) => `${(Number(n) || 0).toFixed(1).replace(/\.0$/, '')}%`;

const STATE = { strategy: 'avalanche' };
const typeLabel = (v) => (LIABILITY_TYPE_LIST.find((t) => t.value === v) || {}).label || v;

// ── Amortización ─────────────────────────────────────────────────────────────
// Itera mes a mes para calcular con precisión meses y total de intereses.
function amortize(balance, eaRate, payment) {
  if (!balance || balance <= 0) return { months: 0, totalInterest: 0 };
  if (!payment || payment <= 0) return { months: null, totalInterest: null };
  const r = eaRate > 0 ? Math.pow(1 + eaRate / 100, 1 / 12) - 1 : 0;
  let bal = balance; let totalInterest = 0; let months = 0;
  while (bal > 0.01 && months < 600) {
    const interest = bal * r;
    const capital = payment - interest;
    if (capital <= 0) return { months: Infinity, totalInterest: Infinity };
    totalInterest += interest;
    bal = Math.max(0, bal - capital);
    months++;
  }
  return { months, totalInterest: Math.round(totalInterest) };
}

function payoffDateLabel(months) {
  if (!months || months === Infinity || months > 600) return null;
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return new Intl.DateTimeFormat('es-CO', { month: 'short', year: 'numeric' }).format(d);
}

// ── Tarjeta de proyección ─────────────────────────────────────────────────────
function projectionCard(debtList, cur) {
  const rows = debtList
    .filter((d) => d.balance > 0 && d.minPayment > 0)
    .map((d) => {
      const { months, totalInterest } = amortize(d.balance, d.interestRate || 0, d.minPayment);
      return { ...d, months, totalInterest };
    });

  if (!rows.length) return null;

  const totalInterestSum = rows.reduce((s, r) => s + (r.totalInterest || 0), 0);
  const maxMonths = Math.max(...rows.map((r) => r.months || 0));
  const freeDate = payoffDateLabel(maxMonths);
  const hasInfinity = rows.some((r) => r.months === Infinity);

  const card = el('div', { class: 'card card--pad-sm mt-4' });
  card.appendChild(el('p', { class: 't-caption text-secondary', style: 'margin:0 0 var(--space-3)' },
    ['PROYECCIÓN (pagando solo los mínimos declarados)']));

  const tbl = el('table', { class: 'inv-summary-table' });
  tbl.appendChild(el('thead', {}, [el('tr', {}, [
    el('th', {}, ['Deuda']),
    el('th', { class: 'text-right' }, ['Saldo']),
    el('th', { class: 'text-right' }, ['Cuota/mes']),
    el('th', { class: 'text-right' }, ['Meses']),
    el('th', { class: 'text-right' }, ['Intereses totales']),
    el('th', { class: 'text-right' }, ['Libre en']),
  ])]));

  const tbody = el('tbody');
  rows.forEach((r) => {
    const tr = el('tr', {});
    tr.appendChild(el('td', {}, [r.name]));
    tr.appendChild(el('td', { class: 'text-right tabular' }, [formatMoney(r.balance, r.currency || cur)]));
    tr.appendChild(el('td', { class: 'text-right tabular' }, [formatMoney(r.minPayment, r.currency || cur)]));
    tr.appendChild(el('td', { class: 'text-right tabular' }, [r.months === Infinity ? '∞' : r.months === null ? '—' : String(r.months)]));
    tr.appendChild(el('td', { class: 'text-right tabular text-negative' }, [
      r.totalInterest === null ? '—' : r.totalInterest === Infinity ? '∞' : `+${formatMoney(r.totalInterest, r.currency || cur)}`,
    ]));
    tr.appendChild(el('td', { class: 'text-right tabular text-secondary' }, [
      r.months === Infinity ? 'nunca' : r.months === null ? '—' : (payoffDateLabel(r.months) || '—'),
    ]));
    tbody.appendChild(tr);
  });
  tbl.appendChild(tbody);
  card.appendChild(tbl);

  const footer = el('div', { class: 'row-flex between', style: 'margin-top:var(--space-3);flex-wrap:wrap;gap:var(--space-2)' });
  if (!hasInfinity && freeDate) {
    footer.appendChild(el('span', { class: 't-caption' }, [
      el('span', { class: 'text-secondary', text: 'Libre de deudas: ' }),
      el('b', { class: 'text-positive', text: freeDate }),
    ]));
  }
  if (totalInterestSum > 0) {
    footer.appendChild(el('span', { class: 't-caption' }, [
      el('span', { class: 'text-secondary', text: 'Intereses totales: ' }),
      el('b', { class: 'text-negative', text: `+${formatMoney(totalInterestSum, cur)}` }),
    ]));
  }
  if (hasInfinity) {
    footer.appendChild(el('span', { class: 't-caption' }, [
      Badge('Atención', 'negative'),
      ' La cuota mínima no cubre los intereses en alguna deuda.',
    ]));
  }
  card.appendChild(footer);
  return card;
}

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

// ── Abono (debt settlement) ───────────────────────────────────────────────────
// Tarjeta (cuenta): se registra como TRANSFERENCIA banco→tarjeta. El modelo híbrido de
// saldos sube el saldo de la tarjeta (que es negativo) → reduce la deuda. Crédito/pasivo:
// reduce el saldo del pasivo y, opcionalmente, registra el egreso de efectivo.
function openAbono(d) {
  if (d.source === 'account') {
    const accounts = (store.get().accounts || [])
      .filter((a) => !a.isArchived && a.type !== 'credit_card' && a.type !== 'investment');
    if (!accounts.length) { toast('Crea una cuenta de origen primero', { type: 'warning' }); return; }
    openTxModal({ mode: 'create', tx: {
      type: 'transfer',
      toAccountId: d.id,
      accountId: accounts[0].id,
      amount: d.minPayment || '',
      description: `Abono ${d.name}`,
    } });
    return;
  }
  openLiabilityAbono(d);
}

// Categoría de gasto para registrar el egreso de un abono a un crédito/pasivo.
function resolveDebtCategory(s) {
  const cats = (s.categories || []).filter((c) => c.kind === 'expense');
  return cats.find((c) => /deuda|prest|prést|pago|cr[eé]dito|financ/i.test(c.name || '')) || cats[0] || null;
}

function openLiabilityAbono(d) {
  const s = store.get();
  const accounts = (s.accounts || [])
    .filter((a) => !a.isArchived && a.type !== 'investment' && a.type !== 'credit_card');
  const acctOpts = [{ value: '', label: '(No registrar movimiento de efectivo)' }, ...accounts.map((a) => ({ value: a.id, label: a.name }))];

  const amountEl = numberInput({ name: 'amount', value: d.minPayment || '' });
  const dateEl   = textInput({ name: 'date', value: new Date().toISOString().slice(0, 10), type: 'date' });
  const acctEl   = select({ name: 'acct', value: accounts[0]?.id || '', options: acctOpts });

  const body = el('div', {}, [
    el('p', { class: 't-caption text-secondary', text: `Reduce el saldo de "${d.name}". Si eliges una cuenta de origen, se registra también el egreso del efectivo.` }),
    el('div', { class: 'field-row' }, [field('Monto', amountEl), field('Fecha', dateEl)]),
    field('Cuenta de origen', acctEl),
  ]);

  openModal({
    title: `Abonar a ${d.name}`,
    body,
    submitLabel: 'Registrar abono',
    onSubmit: async () => {
      const amount = Number(amountEl.value) || 0;
      if (amount <= 0) { toast('El monto debe ser mayor a cero', { type: 'negative' }); return false; }
      return guardedSave(async () => {
        const acctId = acctEl.value;
        if (acctId) {
          const cat = resolveDebtCategory(s);
          if (cat) {
            await dataService.create('transactions', {
              type: 'expense', amount, date: dateEl.value, accountId: acctId,
              categoryId: cat.id, description: `Abono ${d.name}`,
            });
          }
        }
        const newBalance = Math.max(0, (d.raw.balance || 0) - amount);
        await dataService.update('liabilities', d.id, { balance: newBalance });
      }, 'Abono registrado', 'Error al registrar el abono');
    },
  });
}

// ── Tarjeta de crédito (panel rico) ─────────────────────────────────────────────
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

  const head = el('div', { class: 'cc-panel__head' });
  head.appendChild(el('div', { class: 'cc-panel__name' }, [
    el('span', { class: 'cc-panel__title', text: a.name }),
    el('span', { class: 'cc-panel__inst', text: a.institution || '' }),
  ]));
  head.appendChild(el('div', { class: 'cc-panel__debt tabular text-negative', text: formatMoney(debt, a.currency || cur) }));
  card.appendChild(head);

  const barWrap = el('div', { class: 'cc-util-bar' });
  barWrap.appendChild(el('div', { class: 'cc-util-fill', style: `width:${util}%;background:${utilColor}` }));
  card.appendChild(barWrap);

  const grid = el('div', { class: 'cc-panel__grid' });
  // sub puede ser string o elemento DOM (para badges accesibles).
  const metric = (label, value, sub) => {
    const m = el('div', { class: 'cc-metric' });
    m.appendChild(el('span', { class: 'cc-metric__label', text: label }));
    m.appendChild(el('span', { class: 'cc-metric__value tabular', text: value }));
    if (sub) {
      const subEl = el('span', { class: 'cc-metric__sub' });
      subEl.append(sub.nodeType ? sub : document.createTextNode(String(sub)));
      m.appendChild(subEl);
    }
    return m;
  };

  grid.appendChild(metric('Cupo disponible', formatMoney(avail, a.currency || cur), `${100 - util}% libre`));
  if (totalDue)  grid.appendChild(metric('Total a pagar', formatMoney(totalDue, a.currency || cur), 'este corte'));
  if (minPay)    grid.appendChild(metric('Pago mínimo', formatMoney(minPay, a.currency || cur), 'según extracto'));
  grid.appendChild(metric('Próximo corte', corteFecha ? formatDate(corteFecha, 'short') : '—', diasCorte !== null ? `en ${diasCorte} días` : ''));
  // WCAG 1.3.3: urgencia comunicada con Badge semántico, no solo el símbolo ⚠.
  const pagoSub = diasPago !== null
    ? (diasPago <= 0 ? Badge('Vence hoy', 'negative')
      : diasPago <= 5 ? Badge(`${diasPago} días`, 'warning')
      : `en ${diasPago} días`)
    : '';
  grid.appendChild(metric('Fecha de pago', pagoFecha ? formatDate(pagoFecha, 'short') : '—', pagoSub));
  if (a.interestRate) grid.appendChild(metric('Tasa E.A.', pct(a.interestRate), 'interés anual'));
  if (limit) grid.appendChild(metric('Cupo total', formatMoney(limit, a.currency || cur), `${util}% utilizado`));
  card.appendChild(grid);

  card.appendChild(el('div', { class: 'cc-panel__actions', style: { marginTop: '12px', display: 'flex', gap: '8px' } }, [
    Button('Abonar', { variant: 'primary', iconName: 'plus', onClick: () => openAbono({ source: 'account', id: a.id, name: a.name, minPayment: a.minPayment || 0, raw: a }) }),
    Button('Editar', { variant: 'ghost', iconName: 'edit', onClick: () => openAccountModal(a) }),
  ]));

  return card;
}

// ── Fila de deuda (lista priorizada Snowball/Avalanche) ─────────────────────────
function debtRow(d, rank, cur) {
  const isCard = d.source === 'account';
  const sub = `${typeLabel(d.type)} · ${pct(d.interestRate)} · cuota ${formatMoney(d.minPayment || 0, d.currency || cur)}${d.dueDate ? ' · vence ' + formatDate(d.dueDate, 'short') : ''}`;

  const actions = [
    el('button', { class: 'icon-btn', 'aria-label': 'Abonar', title: 'Registrar abono', on: { click: () => openAbono(d) }, html: icon('plus') }),
    el('button', { class: 'icon-btn', 'aria-label': 'Editar', title: 'Editar', on: { click: () => isCard ? openAccountModal(d.raw) : openLiabilityModal({ liability: d.raw, mode: 'edit' }) }, html: icon('edit') }),
  ];
  if (!isCard) {
    actions.push(el('button', {
      class: 'icon-btn icon-btn--danger', 'aria-label': 'Eliminar', title: 'Eliminar',
      on: { click: () => confirmDialog({ title: 'Eliminar deuda', message: `¿Eliminar "${d.name}"?`, onConfirm: () => guardedOp(() => dataService.remove('liabilities', d.id), 'Deuda eliminada') }) },
      html: icon('trash'),
    }));
  }

  return el('div', { class: 'row' }, [
    el('div', { class: 'row__avatar', html: rank === 1 ? icon('bolt') : icon('debts'), style: rank === 1 ? { background: 'var(--negative-bg)', color: 'var(--negative)' } : {} }),
    el('div', { class: 'row__main' }, [
      el('div', { class: 'row__title' }, [d.name, ' ', rank === 1 ? Badge('Atacar primero', 'negative') : null, isCard ? Badge('Tarjeta', 'info') : null].filter(Boolean)),
      el('div', { class: 'row__sub', text: sub }),
    ]),
    el('div', { class: 'row__amount tabular text-negative', text: formatMoney(d.balance, d.currency || cur) }),
    el('div', { class: 'row__actions' }, actions),
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

  function repaint() {
    const s = store.get();
    const cur = s.baseCurrency;
    const stats = selectors.debtStats(s);          // { total, minPayment, avgRate, count, list }
    const ccDebt = selectors.creditCardDebt(s);
    const ccAccounts = selectors.creditCardAccounts(s);
    const ccLiabCount = (s.liabilities || []).filter((l) => l.type === 'credit_card' && (l.balance || 0) > 0).length;
    const ccCount = ccAccounts.length + ccLiabCount;

    const header = el('div', { class: 'page-header' }, [
      el('div', { class: 'row-flex between' }, [
        el('div', {}, [
          el('h2', { class: 't-h1', text: 'Deudas' }),
          el('p', { class: 'page-header__sub', text: 'Tarjetas, créditos e hipotecas. Plan de pago Snowball y Avalanche.' }),
        ]),
        Button('Nueva deuda', { variant: 'primary', iconName: 'plus', onClick: () => openLiabilityModal({ mode: 'create' }) }),
      ]),
    ]);

    const kpis = el('div', { class: 'grid grid--kpi' }, [
      KpiCard({ label: 'Deuda total', value: formatMoney(stats.total, cur), iconName: 'debts', variant: 'negative', hero: true,
        foot: [el('span', { class: 't-caption', text: `${stats.count} deuda${stats.count !== 1 ? 's' : ''}` })] }),
      KpiCard({ label: 'Tarjetas de crédito', value: formatMoney(ccDebt, cur), iconName: 'accounts', variant: 'negative',
        foot: [el('span', { class: 't-caption', text: `${ccCount} tarjeta${ccCount !== 1 ? 's' : ''}` })] }),
      KpiCard({ label: 'Cuota mínima/mes', value: formatMoney(stats.minPayment, cur), iconName: 'calendar', variant: 'neutral' }),
      KpiCard({ label: 'Tasa promedio', value: pct(stats.avgRate), iconName: 'analytics', variant: 'warning' }),
    ]);

    const children = [header, kpis];

    // Panel de tarjetas (estado detallado).
    if (ccAccounts.length) {
      children.push(el('div', { class: 'section' }, [
        el('div', { class: 'row-flex between mb-4' }, [
          el('h3', { class: 't-h2', text: 'Tarjetas de crédito' }),
          Button('Nueva tarjeta', { variant: 'ghost', iconName: 'plus', onClick: () => openAccountModal(null, { defaults: { type: 'credit_card' } }) }),
        ]),
        el('div', { class: 'cc-panels-grid' }, ccAccounts.map((a) => creditCardPanel(a, cur))),
      ]));
    }

    // Plan de pago priorizado (todas las deudas).
    if (!stats.list.length) {
      children.push(el('div', { class: 'section' }, [
        el('div', { class: 'card' }, [EmptyState({
          title: 'Sin deudas', message: 'Registra tus deudas (tarjetas, créditos, hipotecas) para planear su pago.', iconName: 'debts',
          action: Button('Nueva deuda', { variant: 'primary', iconName: 'plus', onClick: () => openLiabilityModal({ mode: 'create' }) }),
        })]),
      ]));
    } else {
      const ordered = orderBy(stats.list, STATE.strategy);
      const explain = STATE.strategy === 'snowball'
        ? 'Snowball: liquidas primero la deuda de menor saldo (motivación rápida).'
        : 'Avalanche: liquidas primero la deuda de mayor tasa (ahorras más en intereses).';

      children.push(el('div', { class: 'section' }, [
        el('h3', { class: 't-h2 mb-4', text: 'Plan de pago' }),
        el('div', { class: 'card card--pad-sm' }, [
          el('div', { class: 'row-flex between mt-2' }, [
            el('div', { class: 'seg', style: { width: 'auto' } }, [
              el('button', { class: 'seg__btn', 'aria-pressed': String(STATE.strategy === 'avalanche'), text: 'Avalanche', on: { click: () => { STATE.strategy = 'avalanche'; repaint(); } } }),
              el('button', { class: 'seg__btn', 'aria-pressed': String(STATE.strategy === 'snowball'), text: 'Snowball', on: { click: () => { STATE.strategy = 'snowball'; repaint(); } } }),
            ]),
            el('span', { class: 't-caption text-secondary', text: explain }),
          ]),
        ]),
        el('div', { class: 'card card--pad-sm mt-4' }, [el('div', { class: 'row-list' }, ordered.map((d, i) => debtRow(d, i + 1, cur)))]),
        projectionCard(ordered, cur),
      ].filter(Boolean)));
    }

    root.replaceChildren(...children);
  }

  repaint();
  // Repintar al cambiar el store (tras un abono, edición o sync) sin fuga: el guard
  // isConnected evita renders sobre un root ya desmontado (idéntico a investments.js).
  store.subscribe(() => { if (root.isConnected) repaint(); });
  return root;
}
