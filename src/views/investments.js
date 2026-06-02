// views/investments.js — Inversiones con DCA, compras individuales editables,
// agrupación por ticker, rendimiento por sección y resumen global multimoneda.

import { el, mount } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { store } from '../store/store.js';
import { dataService } from '../services/dataService.js';
import { apiClient } from '../services/apiClient.js';
import { formatMoney, formatDate } from '../utils/format.js';
import { KpiCard, Badge, Trend, ProgressBar, EmptyState, Button } from '../components/ui.js';
import { openModal, confirmDialog } from '../components/modal.js';
import { field, textInput, numberInput, select, segmented } from '../components/forms.js';
import { toast } from '../services/toast.js';

const ASSET_TYPES = [
  { value: 'etf',    label: 'ETF',             section: 'mkt'    },
  { value: 'stock',  label: 'Acción',           section: 'mkt'    },
  { value: 'crypto', label: 'Cripto',           section: 'crypto' },
  { value: 'fund',   label: 'Fondo FIC',        section: 'fic'    },
  { value: 'cdt',    label: 'CDT / Renta fija', section: 'cdt'    },
];
const SECTIONS = [
  { id: 'mkt',    label: 'Acciones y ETFs',  types: ['stock', 'etf']  },
  { id: 'crypto', label: 'Criptomonedas',    types: ['crypto']         },
  { id: 'fic',    label: 'Fondos FIC',       types: ['fund']           },
  { id: 'cdt',    label: 'CDT / Renta fija', types: ['cdt']            },
];
const CURRENCIES = ['USD', 'COP', 'EUR', 'GBP', 'BRL'].map((c) => ({ value: c, label: c }));

const typeLabel  = (v) => (ASSET_TYPES.find((t) => t.value === v) || {}).label || v;
const pctFmt     = (n) => `${n >= 0 ? '+' : ''}${Number(n).toFixed(2)}%`;
const today      = () => new Date().toISOString().slice(0, 10);
const isTrivial  = (t) => ['cdt', 'fund'].includes(t);

// ─── DCA: agrupar compras individuales por ticker ──────────────────────────
function groupByTicker(investments) {
  const map = {};
  (investments || []).filter((inv) => !inv.isDeleted).forEach((inv) => {
    const key = ((inv.symbol || inv.name) || inv.id).toUpperCase();
    if (!map[key]) map[key] = { key, symbol: inv.symbol, name: inv.name, assetType: inv.assetType, currency: inv.currency || 'USD', purchases: [] };
    map[key].purchases.push(inv);
    if (inv.name)     map[key].name     = inv.name;
    if (inv.assetType) map[key].assetType = inv.assetType;
    if (inv.currency)  map[key].currency  = inv.currency;
  });
  return Object.values(map).map((g) => {
    const sorted    = [...g.purchases].sort((a, b) => (b.purchaseDate || '').localeCompare(a.purchaseDate || ''));
    const totalQty  = g.purchases.reduce((s, p) => s + (Number(p.quantity) || 0), 0);
    const totalCost = g.purchases.reduce((s, p) => s + (Number(p.quantity) || 0) * (Number(p.purchasePrice || p.avgCost) || 0), 0);
    return { ...g, sorted, totalQty, totalCost, weightedAvg: totalQty ? totalCost / totalQty : 0, storedPrice: Number(sorted[0]?.currentPrice) || 0 };
  });
}

function cdtCurrentValue(group) {
  const inv = group.purchases[0];
  if (!inv?.interestRate || !inv?.purchaseDate) return group.totalCost;
  const days = (Date.now() - new Date(inv.purchaseDate).getTime()) / 86400000;
  return group.totalCost * Math.pow(1 + inv.interestRate / 100, days / 365);
}

function groupValue(group, livePrices) {
  const { assetType, totalQty, totalCost, symbol } = group;
  if (assetType === 'cdt') return { value: cdtCurrentValue(group), cost: totalCost };
  if (assetType === 'fund') {
    const latest = group.sorted[0];
    return { value: latest?.currentValue || totalCost, cost: totalCost };
  }
  const lp = livePrices[(symbol || '').toUpperCase()];
  return { value: totalQty * (lp?.price || group.storedPrice || 0), cost: totalCost };
}

function toCOP(amount, currency, fxRates) {
  if (!currency || currency === 'COP') return amount;
  const r = fxRates[currency];
  return r ? amount * r : null;
}

// ─── Formulario de compra ──────────────────────────────────────────────────
function openPurchaseModal({ inv = null, defaultSymbol = '', defaultType = 'etf' }) {
  const s = store.get();
  const mode = inv ? 'edit' : 'create';
  const accOpts = [{ value: '', label: '— Sin cuenta —' }]
    .concat((s.accounts || []).filter((a) => !a.isArchived).map((a) => ({ value: a.id, label: a.name })));

  let inputMode = 'qty';
  const typeEl   = select({ name: 'assetType', value: inv?.assetType || defaultType, options: ASSET_TYPES });
  const qtyEl    = numberInput({ name: 'quantity',     value: inv?.quantity ?? '',                  placeholder: 'Ej: 2' });
  const priceEl  = numberInput({ name: 'purchasePrice', value: inv?.purchasePrice || inv?.avgCost || '', placeholder: 'Precio por unidad' });
  const amountEl = numberInput({ name: 'purchaseAmount', value: '',                                  placeholder: 'Monto total a invertir' });
  const calcEl   = el('p', { style: 'font-size:var(--fs-caption);color:var(--text-secondary);min-height:16px;margin:0' });
  const extraEl  = el('div');

  const qtyRow = el('div', { class: 'field-row' }, [field('Cantidad / Unidades', qtyEl), field('Precio por unidad', priceEl)]);
  const amtRow = el('div', { class: 'field-row' }, [field('Monto total invertido', amountEl), field('Precio por unidad', priceEl)]);

  function recalc() {
    const qty = Number(qtyEl.value) || 0;
    const price = Number(priceEl.value) || 0;
    const amount = Number(amountEl.value) || 0;
    if (inputMode === 'qty') {
      calcEl.textContent = qty && price ? `Total ≈ ${formatMoney(qty * price)}` : '';
    } else {
      const derived = price && amount ? amount / price : 0;
      if (derived) { qtyEl.value = derived.toFixed(8).replace(/\.?0+$/, ''); calcEl.textContent = `Cantidad calculada: ${derived.toFixed(6)}`; }
      else { qtyEl.value = ''; calcEl.textContent = ''; }
    }
  }
  [qtyEl, priceEl, amountEl].forEach((e) => e.addEventListener('input', recalc));

  const modeSeg = segmented({ value: 'qty', options: [{ value: 'qty', label: 'Por cantidad' }, { value: 'amount', label: 'Por monto ($)' }],
    onChange: (v) => { inputMode = v; qtyRow.style.display = v === 'qty' ? '' : 'none'; amtRow.style.display = v === 'qty' ? 'none' : ''; recalc(); }
  });
  amtRow.style.display = 'none';

  function paintExtra() {
    extraEl.replaceChildren();
    const t = typeEl.value;
    if (t === 'cdt') {
      extraEl.appendChild(el('div', { class: 'field-row' }, [
        field('Tasa E.A. (%)', numberInput({ name: 'interestRate', value: inv?.interestRate ?? '', placeholder: '12.5' })),
        field('Fecha vencimiento', textInput({ name: 'maturityDate', value: inv?.maturityDate || '', type: 'date' })),
      ]));
    }
    if (t === 'fund') {
      extraEl.appendChild(field('Valor actual ($)', numberInput({ name: 'currentValue', value: inv?.currentValue ?? '', placeholder: 'Actualizar manualmente' })));
    }
  }
  typeEl.addEventListener('change', paintExtra);
  paintExtra();

  const body = el('div', {}, [
    el('div', { class: 'field-row' }, [
      field('Ticker / Símbolo', textInput({ name: 'symbol', value: inv?.symbol || defaultSymbol, placeholder: 'VUG, AAPL, BTC-USD' })),
      field('Tipo', typeEl),
    ]),
    field('Nombre', textInput({ name: 'name', value: inv?.name || '', placeholder: 'Vanguard Growth ETF' })),
    el('div', { class: 'field-row' }, [
      field('Cuenta / Broker', select({ name: 'accountId', value: inv?.accountId || '', options: accOpts })),
      field('Moneda', select({ name: 'currency', value: inv?.currency || 'USD', options: CURRENCIES })),
    ]),
    field('Fecha de compra', textInput({ name: 'purchaseDate', value: inv?.purchaseDate || today(), type: 'date' })),
    el('div', { style: 'margin:var(--space-2) 0' }, [modeSeg]),
    qtyRow, amtRow, calcEl, extraEl,
  ]);

  openModal({
    title: mode === 'edit' ? 'Editar compra' : defaultSymbol ? `Nueva compra — ${defaultSymbol}` : 'Registrar inversión',
    body, submitLabel: mode === 'edit' ? 'Guardar' : 'Registrar',
    onSubmit: async () => {
      const g = (n) => body.querySelector(`[name="${n}"]`)?.value || '';
      const data = {
        symbol: g('symbol').trim().toUpperCase() || null,
        name:   g('name').trim(),
        assetType: g('assetType'), accountId: g('accountId'),
        quantity:  Number(qtyEl.value) || 0,
        purchasePrice: Number(priceEl.value) || 0,
        purchaseDate: g('purchaseDate'),
        currency: (g('currency') || 'USD').toUpperCase().slice(0, 3),
      };
      if (isTrivial(typeEl.value)) {
        data.quantity = 1;
        data.purchasePrice = Number(amountEl.value) || Number(priceEl.value) || data.purchasePrice;
        if (typeEl.value === 'cdt') { data.interestRate = Number(g('interestRate')) || 0; data.maturityDate = g('maturityDate'); }
        if (typeEl.value === 'fund') data.currentValue = Number(g('currentValue')) || 0;
      }
      if (!data.name && !data.symbol) { toast('Ingresa nombre o ticker', { type: 'negative' }); return false; }
      if (data.quantity <= 0) { toast('Cantidad o monto mayor a 0', { type: 'negative' }); return false; }
      try {
        if (mode === 'edit' && inv) { await dataService.update('investments', inv.id, data); toast('Actualizado'); }
        else { await dataService.create('investments', data); toast('Compra registrada'); }
      } catch (e) { toast('Error: ' + e.message, { type: 'negative' }); return false; }
    },
  });
}

// ─── Tabla de compras individuales (expandible por grupo) ──────────────────
function purchasesTable(group, livePrice, cur) {
  const wrap = el('div', { class: 'inv-purchases' });
  const header = el('div', { class: 'inv-purchases__head' }, [
    el('span', { class: 'inv-purchases__col', text: 'Fecha' }),
    el('span', { class: 'inv-purchases__col', text: 'Cantidad' }),
    el('span', { class: 'inv-purchases__col', text: 'Precio compra' }),
    el('span', { class: 'inv-purchases__col', text: 'Costo total' }),
    el('span', { class: 'inv-purchases__col', text: 'Valor actual' }),
    el('span', { class: 'inv-purchases__col text-right', text: 'P&L' }),
    el('span', { class: 'inv-purchases__col' }),
  ]);
  wrap.appendChild(header);

  const currency = group.currency || cur;
  group.sorted.forEach((p) => {
    const qty = Number(p.quantity) || 0;
    const boughtAt = Number(p.purchasePrice || p.avgCost) || 0;
    const costBasis = qty * boughtAt;
    const currentP = livePrice?.price || Number(p.currentPrice) || 0;
    const currentVal = qty * currentP;
    const pnl = currentVal - costBasis;
    const pnlPct = costBasis ? pnl / costBasis * 100 : 0;

    const row = el('div', { class: 'inv-purchases__row' });
    row.appendChild(el('span', { class: 'inv-purchases__col tabular', text: p.purchaseDate || '—' }));
    row.appendChild(el('span', { class: 'inv-purchases__col tabular', text: qty % 1 === 0 ? String(qty) : qty.toFixed(4) }));
    row.appendChild(el('span', { class: 'inv-purchases__col tabular', text: formatMoney(boughtAt, currency) }));
    row.appendChild(el('span', { class: 'inv-purchases__col tabular', text: formatMoney(costBasis, currency) }));
    row.appendChild(el('span', { class: 'inv-purchases__col tabular', text: currentP ? formatMoney(currentVal, currency) : '—' }));
    const pnlEl = el('span', { class: `inv-purchases__col tabular text-right ${pnl >= 0 ? 'text-positive' : 'text-negative'}` });
    pnlEl.textContent = currentP ? `${pnl >= 0 ? '+' : ''}${formatMoney(pnl, currency)}` : '—';
    row.appendChild(pnlEl);

    const actions = el('span', { class: 'inv-purchases__col inv-purchases__actions' });
    actions.appendChild(el('button', { class: 'icon-btn', title: 'Editar',
      on: { click: () => openPurchaseModal({ inv: p }) }, html: icon('edit') }));
    actions.appendChild(el('button', { class: 'icon-btn icon-btn--danger', title: 'Eliminar',
      on: { click: () => confirmDialog({ title: 'Eliminar compra', message: `¿Eliminar compra del ${p.purchaseDate}?`,
        onConfirm: async () => { try { await dataService.remove('investments', p.id); toast('Eliminado'); } catch(e) { toast('Error', { type: 'negative' }); } }
      }) }, html: icon('trash') }));
    row.appendChild(actions);
    wrap.appendChild(row);
  });
  return wrap;
}

// ─── Card de posición agrupada ─────────────────────────────────────────────
function positionCard(group, livePrice, fxRates, baseCur) {
  const { symbol, name, assetType, totalQty, totalCost, weightedAvg, currency, purchases } = group;
  const { value: nativeValue } = groupValue(group, { [(symbol || '').toUpperCase()]: livePrice });
  const gain = nativeValue - totalCost;
  const gainPct = totalCost ? gain / totalCost * 100 : 0;
  const isPos = gain >= 0;
  const currentPrice = livePrice?.price || group.storedPrice || 0;

  let expanded = false;
  const toggleWrap = el('div');

  function renderPurchases() {
    toggleWrap.replaceChildren();
    if (!expanded || isTrivial(assetType)) return;
    toggleWrap.appendChild(purchasesTable(group, livePrice, baseCur));
  }

  const card = el('div', { class: 'inv-card' });

  // Header: ticker + nombre + tipo + moneda
  const head = el('div', { class: 'inv-card__head' });
  const titleWrap = el('div', { class: 'inv-card__title-wrap' });
  if (symbol) titleWrap.appendChild(el('span', { class: 'inv-card__ticker' }, [symbol]));
  titleWrap.appendChild(el('span', { class: 'inv-card__name' }, [name || symbol || '—']));
  titleWrap.appendChild(Badge(typeLabel(assetType), 'info'));
  if (currency && currency !== baseCur) titleWrap.appendChild(Badge(currency, ''));
  head.appendChild(titleWrap);

  const valWrap = el('div', { class: 'inv-card__value-wrap' });
  valWrap.appendChild(el('div', { class: 'inv-card__value tabular' }, [formatMoney(nativeValue, currency)]));
  const gainEl = el('div', { class: `inv-card__gain ${isPos ? 'text-positive' : 'text-negative'}` });
  gainEl.textContent = `${isPos ? '+' : ''}${formatMoney(gain, currency)}  ${pctFmt(gainPct)}`;
  valWrap.appendChild(gainEl);
  if (livePrice?.changePct !== undefined) {
    valWrap.appendChild(el('div', { class: `t-caption ${livePrice.changePct >= 0 ? 'text-positive' : 'text-negative'}` }, [`Hoy: ${pctFmt(livePrice.changePct)}`]));
  }
  head.appendChild(valWrap);
  card.appendChild(head);

  // Métricas principales
  const metrics = el('div', { class: 'inv-card__metrics' });
  const m = (lbl, val) => {
    const d = el('div', { class: 'inv-metric' });
    d.appendChild(el('span', { class: 'inv-metric__label' }, [lbl]));
    d.appendChild(el('span', { class: 'inv-metric__value tabular' }, [val]));
    return d;
  };

  if (!isTrivial(assetType)) {
    metrics.appendChild(m('Shares totales', totalQty % 1 === 0 ? String(totalQty) : totalQty.toFixed(6).replace(/0+$/, '')));
    metrics.appendChild(m('Cost basis (avg)', formatMoney(weightedAvg, currency)));
    if (currentPrice) metrics.appendChild(m('Precio actual', formatMoney(currentPrice, currency)));
    if (purchases.length > 1) metrics.appendChild(m('Compras (DCA)', `${purchases.length} operaciones`));
  }
  metrics.appendChild(m('Total invertido', formatMoney(totalCost, currency)));
  const copVal = toCOP(nativeValue, currency, fxRates);
  if (copVal !== null && currency !== 'COP') metrics.appendChild(m('≈ en COP', formatMoney(copVal, 'COP')));
  if (assetType === 'cdt') {
    const p0 = purchases[0];
    if (p0?.interestRate) metrics.appendChild(m('Tasa E.A.', `${p0.interestRate}%`));
    if (p0?.maturityDate) metrics.appendChild(m('Vencimiento', p0.maturityDate));
  }
  card.appendChild(metrics);

  // Compras individuales (toggle)
  card.appendChild(toggleWrap);

  // Acciones
  const actions = el('div', { class: 'inv-card__actions' });
  if (!isTrivial(assetType)) {
    const toggleBtn = Button(expanded ? 'Ocultar compras' : `Ver ${purchases.length} compra${purchases.length > 1 ? 's' : ''}`, {
      variant: 'ghost', size: 'sm',
      onClick: () => { expanded = !expanded; toggleBtn.textContent = expanded ? 'Ocultar compras' : `Ver ${purchases.length} compra${purchases.length > 1 ? 's' : ''}`; renderPurchases(); },
    });
    actions.appendChild(toggleBtn);
    actions.appendChild(Button('+ Compra', { variant: 'outline', size: 'sm',
      onClick: () => openPurchaseModal({ defaultSymbol: symbol || '', defaultType: assetType }) }));
  }
  if (assetType === 'fund') {
    actions.appendChild(Button('Actualizar valor', { variant: 'outline', size: 'sm',
      onClick: () => openPurchaseModal({ inv: purchases[0] }) }));
  }
  actions.appendChild(el('button', { class: 'icon-btn', title: 'Nueva compra',
    on: { click: () => openPurchaseModal({ defaultSymbol: symbol || '', defaultType: assetType }) }, html: icon('plus') }));
  card.appendChild(actions);

  renderPurchases();
  return card;
}

// ─── Render principal ──────────────────────────────────────────────────────
export function renderInvestments() {
  const root = el('div');
  const bodyMount = el('div');
  let livePrices = {};
  let fxRates    = {};
  let refreshing = false;

  function buildFxRates() {
    const r = {};
    ['USD', 'EUR', 'GBP', 'BRL'].forEach((c) => { const k = c + 'COP=X'; if (livePrices[k]?.price) r[c] = livePrices[k].price; });
    return r;
  }

  async function refreshPrices() {
    if (refreshing) return;
    const groups = groupByTicker(store.get().investments);
    const tickers = groups.filter((g) => g.symbol && !isTrivial(g.assetType)).map((g) => g.symbol.toUpperCase());
    const fx = ['USDCOP=X', 'EURCOP=X'];
    const all = [...new Set([...tickers, ...fx])];
    refreshing = true; paint(true);
    try {
      const quotes = await apiClient.get('getQuotes', { tickers: all.join(',') });
      Object.entries(quotes || {}).forEach(([tk, q]) => { if (q && !q.error) livePrices[tk] = q; });
      fxRates = buildFxRates();
      toast('Precios actualizados');
    } catch (e) { toast('Error: ' + e.message, { type: 'warning' }); }
    finally { refreshing = false; paint(false); }
  }

  function paint(loading = false) {
    const s = store.get();
    const baseCur = s.baseCurrency || 'COP';
    const allGroups = groupByTicker(s.investments);

    if (!allGroups.length) {
      mount(bodyMount, el('div', { class: 'card' }, [EmptyState({
        title: 'Sin inversiones', message: 'Registra tu primera posición.', iconName: 'investments',
        action: Button('Nueva inversión', { variant: 'primary', iconName: 'plus', onClick: () => openPurchaseModal({ defaultType: 'etf' }) }),
      })]));
      return;
    }

    const secStats = SECTIONS.map((sec) => {
      const groups = allGroups.filter((g) => sec.types.includes(g.assetType));
      let totalValue = 0, totalCost = 0;
      groups.forEach((g) => {
        const lp = livePrices[(g.symbol || '').toUpperCase()];
        const { value, cost } = groupValue(g, { [(g.symbol || '').toUpperCase()]: lp });
        const v = toCOP(value, g.currency, fxRates) ?? value;
        const c = toCOP(cost,  g.currency, fxRates) ?? cost;
        totalValue += v; totalCost += c;
      });
      return { ...sec, groups, totalValue, totalCost, gain: totalValue - totalCost, ret: totalCost ? (totalValue - totalCost) / totalCost * 100 : 0 };
    }).filter((s) => s.groups.length);

    const pTotal = secStats.reduce((s, x) => s + x.totalValue, 0);
    const cTotal = secStats.reduce((s, x) => s + x.totalCost, 0);
    const gTotal = pTotal - cTotal;
    const rTotal = cTotal ? gTotal / cTotal * 100 : 0;

    const wrap = el('div', { class: 'stack' });

    // KPIs
    wrap.appendChild(el('div', { class: 'grid grid--kpi' }, [
      KpiCard({ label: 'Portafolio total', value: formatMoney(pTotal, baseCur), iconName: 'investments', variant: 'accent', hero: true,
        foot: [Trend(rTotal), el('span', { class: 't-caption', text: ' retorno total' })] }),
      KpiCard({ label: 'Capital invertido', value: formatMoney(cTotal, baseCur), iconName: 'wallet', variant: 'neutral' }),
      KpiCard({ label: 'Ganancia / Pérdida', value: formatMoney(gTotal, baseCur), iconName: gTotal >= 0 ? 'arrowUp' : 'arrowDown', variant: gTotal >= 0 ? 'emerald' : 'negative' }),
    ]));

    // Distribución
    if (pTotal > 0) {
      const distCard = el('div', { class: 'card card--pad' });
      distCard.appendChild(el('p', { class: 't-caption text-secondary', style: 'margin:0 0 var(--space-3)' }, ['DISTRIBUCIÓN DEL PORTAFOLIO']));
      secStats.forEach((sec) => {
        const w = pTotal ? sec.totalValue / pTotal * 100 : 0;
        distCard.appendChild(el('div', { class: 'stack', style: 'margin-bottom:var(--space-2)' }, [
          el('div', { class: 'row-flex between' }, [
            el('span', { class: 't-caption', text: sec.label }),
            el('span', { class: 'tabular t-caption' }, [
              el('span', { class: sec.ret >= 0 ? 'text-positive' : 'text-negative', text: pctFmt(sec.ret) }),
              el('span', { class: 'text-secondary', text: `  ·  ${formatMoney(sec.totalValue, baseCur)}  ·  ${w.toFixed(1)}%` }),
            ]),
          ]),
          ProgressBar(w),
        ]));
      });
      wrap.appendChild(distCard);
    }

    // Secciones con cards
    secStats.forEach((sec) => {
      const secEl = el('div', { class: 'section' });
      const head = el('div', { class: 'inv-section-head' });
      head.appendChild(el('div', { class: 'inv-section-title' }, [
        el('span', { class: 't-h2', text: sec.label }),
        el('span', { class: `inv-section-ret ${sec.ret >= 0 ? 'text-positive' : 'text-negative'}`, text: pctFmt(sec.ret) }),
      ]));
      head.appendChild(el('div', { class: 't-caption text-secondary tabular' }, [
        `${formatMoney(sec.totalValue, baseCur)}  ·  ${sec.gain >= 0 ? '+' : ''}${formatMoney(sec.gain, baseCur)}`,
      ]));
      secEl.appendChild(head);

      const grid = el('div', { class: 'inv-cards-grid' });
      sec.groups.forEach((g) => {
        const lp = livePrices[(g.symbol || '').toUpperCase()];
        grid.appendChild(positionCard(g, lp || null, fxRates, baseCur));
      });
      secEl.appendChild(grid);
      wrap.appendChild(secEl);
    });

    // Resumen global ponderado
    const summaryCard = el('div', { class: 'card card--pad section' });
    summaryCard.appendChild(el('p', { class: 't-caption text-secondary', style: 'margin:0 0 var(--space-3)' }, ['RESUMEN GLOBAL PONDERADO']));
    const tbl = el('table', { class: 'inv-summary-table' });
    tbl.appendChild(el('thead', {}, [el('tr', {}, [
      el('th', {}, ['Sección']),
      el('th', { class: 'text-right' }, ['Valor']),
      el('th', { class: 'text-right' }, ['Invertido']),
      el('th', { class: 'text-right' }, ['P&L']),
      el('th', { class: 'text-right' }, ['Retorno']),
      el('th', { class: 'text-right' }, ['Peso']),
    ])]));
    const tbody = el('tbody');
    secStats.forEach((sec) => {
      const w = pTotal ? sec.totalValue / pTotal * 100 : 0;
      const tr = el('tr', {});
      tr.appendChild(el('td', {}, [sec.label]));
      tr.appendChild(el('td', { class: 'text-right tabular' }, [formatMoney(sec.totalValue, baseCur)]));
      tr.appendChild(el('td', { class: 'text-right tabular' }, [formatMoney(sec.totalCost, baseCur)]));
      tr.appendChild(el('td', { class: `text-right tabular ${sec.gain >= 0 ? 'text-positive' : 'text-negative'}` }, [`${sec.gain >= 0 ? '+' : ''}${formatMoney(sec.gain, baseCur)}`]));
      tr.appendChild(el('td', { class: `text-right tabular ${sec.ret >= 0 ? 'text-positive' : 'text-negative'}` }, [pctFmt(sec.ret)]));
      tr.appendChild(el('td', { class: 'text-right tabular text-secondary' }, [`${w.toFixed(1)}%`]));
      tbody.appendChild(tr);
    });
    const totRow = el('tr', { class: 'inv-summary-total' });
    totRow.appendChild(el('td', {}, ['Total portafolio']));
    totRow.appendChild(el('td', { class: 'text-right tabular' }, [formatMoney(pTotal, baseCur)]));
    totRow.appendChild(el('td', { class: 'text-right tabular' }, [formatMoney(cTotal, baseCur)]));
    totRow.appendChild(el('td', { class: `text-right tabular ${gTotal >= 0 ? 'text-positive' : 'text-negative'}` }, [`${gTotal >= 0 ? '+' : ''}${formatMoney(gTotal, baseCur)}`]));
    totRow.appendChild(el('td', { class: `text-right tabular ${rTotal >= 0 ? 'text-positive' : 'text-negative'}` }, [pctFmt(rTotal)]));
    totRow.appendChild(el('td', { class: 'text-right tabular text-secondary' }, ['100%']));
    tbody.appendChild(totRow);
    tbl.appendChild(tbody);
    summaryCard.appendChild(tbl);

    if (Object.keys(fxRates).length) {
      const note = Object.entries(fxRates).map(([c, r]) => `1 ${c} = ${formatMoney(r, 'COP')}`).join('  ·  ');
      summaryCard.appendChild(el('p', { class: 't-caption text-tertiary', style: 'margin:var(--space-3) 0 0' }, [`Tasas: ${note}`]));
    } else {
      summaryCard.appendChild(el('p', { class: 't-caption text-tertiary', style: 'margin:var(--space-3) 0 0' }, [loading ? 'Obteniendo tasas de cambio…' : 'Pulsa "Actualizar precios" para obtener precios y tasas de cambio reales.']));
    }
    wrap.appendChild(summaryCard);
    mount(bodyMount, wrap);
  }

  root.append(
    el('div', { class: 'page-header' }, [
      el('div', { class: 'row-flex between' }, [
        el('div', {}, [
          el('h2', { class: 't-h1', text: 'Inversiones' }),
          el('p', { class: 'page-header__sub', text: 'DCA · Cost basis · Multimoneda' }),
        ]),
        el('div', { class: 'row-flex', style: 'gap:var(--space-2)' }, [
          Button(refreshing ? 'Actualizando…' : 'Actualizar precios', { variant: 'outline', iconName: 'refresh', onClick: refreshPrices }),
          Button('Nueva inversión', { variant: 'primary', iconName: 'plus', onClick: () => openPurchaseModal({ defaultType: 'etf' }) }),
        ]),
      ]),
    ]),
    bodyMount,
  );

  store.subscribe(() => paint());
  paint();
  return root;
}
