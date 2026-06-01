// views/investments.js — Dashboard de inversiones con DCA, secciones por tipo,
// rendimiento por sección, resumen global ponderado y soporte multimoneda.

import { el, mount } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { store } from '../store/store.js';
import { dataService } from '../services/dataService.js';
import { apiClient } from '../services/apiClient.js';
import { formatMoney } from '../utils/format.js';
import { KpiCard, Badge, Trend, ProgressBar, EmptyState, Button } from '../components/ui.js';
import { openModal, confirmDialog } from '../components/modal.js';
import { field, textInput, numberInput, select, segmented } from '../components/forms.js';
import { toast } from '../services/toast.js';

// Tipos y secciones
const ASSET_TYPES = [
  { value: 'etf',    label: 'ETF',             section: 'mkt' },
  { value: 'stock',  label: 'Acción',           section: 'mkt' },
  { value: 'crypto', label: 'Cripto',           section: 'crypto' },
  { value: 'fund',   label: 'Fondo FIC',        section: 'fic' },
  { value: 'cdt',    label: 'CDT / Renta fija', section: 'cdt' },
];
const SECTIONS = [
  { id: 'mkt',    label: 'Acciones y ETFs',    icon: 'investments', types: ['stock', 'etf']   },
  { id: 'crypto', label: 'Criptomonedas',       icon: 'bolt',        types: ['crypto']          },
  { id: 'fic',    label: 'Fondos FIC',          icon: 'goals',       types: ['fund']            },
  { id: 'cdt',    label: 'CDT / Renta fija',    icon: 'accounts',    types: ['cdt']             },
];

// Divisas soportadas para el selector
const CURRENCIES = ['USD', 'COP', 'EUR', 'GBP', 'BRL'].map((c) => ({ value: c, label: c }));

const typeLabel = (v) => (ASSET_TYPES.find((t) => t.value === v) || {}).label || v;
const pctFmt = (n) => `${n >= 0 ? '+' : ''}${(Number(n) || 0).toFixed(2)}%`;
const today = () => new Date().toISOString().slice(0, 10);

// ---------- DCA: agrupar compras por ticker ----------
function groupByTicker(investments) {
  const map = {};
  (investments || []).filter((inv) => !inv.isDeleted).forEach((inv) => {
    const key = ((inv.symbol || inv.name) || inv.id).toUpperCase();
    if (!map[key]) {
      map[key] = { key, symbol: inv.symbol, name: inv.name, assetType: inv.assetType, currency: inv.currency || 'USD', purchases: [] };
    }
    map[key].purchases.push(inv);
    if (inv.name) map[key].name = inv.name;
    if (inv.assetType) map[key].assetType = inv.assetType;
    if (inv.currency) map[key].currency = inv.currency;
  });

  return Object.values(map).map((g) => {
    const totalQty  = g.purchases.reduce((s, p) => s + (Number(p.quantity) || 0), 0);
    const totalCost = g.purchases.reduce((s, p) => s + (Number(p.quantity) || 0) * (Number(p.purchasePrice || p.avgCost) || 0), 0);
    const weightedAvg = totalQty ? totalCost / totalQty : 0;
    const sorted = [...g.purchases].sort((a, b) => (b.purchaseDate || '').localeCompare(a.purchaseDate || ''));
    return { ...g, totalQty, totalCost, weightedAvg, storedPrice: Number(sorted[0]?.currentPrice) || 0 };
  });
}

// CDT: capitalización compuesta diaria
function cdtCurrentValue(group) {
  const inv = group.purchases[0];
  if (!inv?.interestRate || !inv?.purchaseDate) return group.totalCost;
  const days = (Date.now() - new Date(inv.purchaseDate).getTime()) / 86400000;
  return group.totalCost * Math.pow(1 + inv.interestRate / 100, days / 365);
}

// Conversión a moneda base (COP)
function toCOP(amount, currency, fxRates) {
  if (!currency || currency === 'COP') return amount;
  const rate = fxRates[currency] || 0;
  return rate ? amount * rate : null; // null = sin tasa disponible
}

// Valor y costo de un grupo en su moneda nativa
function groupNativeValue(group, livePrices) {
  const { assetType, totalQty, totalCost, symbol } = group;
  if (assetType === 'cdt') {
    return { value: cdtCurrentValue(group), cost: totalCost };
  }
  if (assetType === 'fund') {
    const latest = [...group.purchases].sort((a, b) => (b.purchaseDate || '').localeCompare(a.purchaseDate || ''))[0];
    const value = latest?.currentValue || totalCost;
    return { value, cost: totalCost };
  }
  const lp = livePrices[symbol?.toUpperCase()];
  const price = lp?.price || group.storedPrice || 0;
  return { value: totalQty * price, cost: totalCost };
}

// ---------- Formulario de compra con modo qty/monto ----------
function openInvestmentModal({ inv = null, defaultSymbol = '', mode = 'create' }) {
  const s = store.get();
  const accOpts = [{ value: '', label: '— Sin cuenta —' }]
    .concat((s.accounts || []).filter((a) => !a.isArchived).map((a) => ({ value: a.id, label: a.name })));

  let inputMode = 'qty';

  const typeEl   = select({ name: 'assetType',     value: inv?.assetType || 'etf',                        options: ASSET_TYPES });
  const qtyEl    = numberInput({ name: 'quantity',      value: inv?.quantity ?? '',    placeholder: 'Ej: 0.05' });
  const priceEl  = numberInput({ name: 'purchasePrice', value: inv?.purchasePrice || inv?.avgCost || '', placeholder: 'Precio por unidad' });
  const amountEl = numberInput({ name: 'purchaseAmount', value: '',                     placeholder: 'Monto total invertido' });
  const calcInfo = el('div', { class: 'inv-calc-info t-caption text-secondary', style: 'min-height:18px' });
  const qtyRow   = el('div', { class: 'field-row' }, [field('Cantidad / Unidades', qtyEl), field('Precio por unidad', priceEl)]);
  const amtRow   = el('div', { class: 'field-row' }, [field('Monto total invertido', amountEl), field('Precio por unidad', priceEl)]);
  const extraEl  = el('div');

  function updateCalc() {
    const qty    = Number(qtyEl.value) || 0;
    const price  = Number(priceEl.value) || 0;
    const amount = Number(amountEl.value) || 0;
    if (inputMode === 'qty') {
      const total = qty * price;
      calcInfo.textContent = total ? `Total invertido ≈ ${formatMoney(total)}` : '';
    } else {
      const derived = price && amount ? amount / price : 0;
      if (derived) {
        qtyEl.value = derived.toFixed(8).replace(/\.?0+$/, '');
        calcInfo.textContent = `Cantidad calculada: ${derived.toFixed(6)} unidades`;
      } else {
        qtyEl.value = '';
        calcInfo.textContent = '';
      }
    }
  }

  function paintMode() {
    if (inputMode === 'qty') {
      qtyRow.style.display = '';
      amtRow.style.display = 'none';
    } else {
      qtyRow.style.display = 'none';
      amtRow.style.display = '';
    }
    updateCalc();
  }

  [qtyEl, priceEl, amountEl].forEach((el) => el.addEventListener('input', updateCalc));

  const modeToggle = segmented({
    value: 'qty',
    options: [{ value: 'qty', label: 'Por cantidad' }, { value: 'amount', label: 'Por monto ($)' }],
    onChange: (v) => { inputMode = v; paintMode(); },
  });

  function paintExtra() {
    extraEl.innerHTML = '';
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
  paintMode();

  const body = el('div', {}, [
    el('div', { class: 'field-row' }, [
      field('Ticker / Símbolo', textInput({ name: 'symbol', value: inv?.symbol || defaultSymbol, placeholder: 'VUG, BTC-USD, PFBANCOL.CL' })),
      field('Tipo', typeEl),
    ]),
    field('Nombre / Descripción', textInput({ name: 'name', value: inv?.name || '', placeholder: 'Vanguard Growth ETF' })),
    el('div', { class: 'field-row' }, [
      field('Cuenta / Broker', select({ name: 'accountId', value: inv?.accountId || '', options: accOpts })),
      field('Moneda', select({ name: 'currency', value: inv?.currency || 'USD', options: CURRENCIES })),
    ]),
    field('Fecha de compra', textInput({ name: 'purchaseDate', value: inv?.purchaseDate || today(), type: 'date' })),
    el('div', { style: 'margin: var(--space-2) 0' }, [modeToggle]),
    qtyRow,
    amtRow,
    calcInfo,
    extraEl,
  ]);

  openModal({
    title: mode === 'edit' ? 'Editar compra' : defaultSymbol ? `Nueva compra — ${defaultSymbol}` : 'Registrar inversión',
    body,
    submitLabel: mode === 'edit' ? 'Guardar' : 'Registrar',
    onSubmit: async () => {
      const g  = (n) => body.querySelector(`[name="${n}"]`)?.value || '';
      const data = {
        symbol:        g('symbol').trim().toUpperCase() || null,
        name:          g('name').trim(),
        assetType:     g('assetType'),
        accountId:     g('accountId'),
        quantity:      Number(qtyEl.value) || 0,
        purchasePrice: Number(priceEl.value) || 0,
        purchaseDate:  g('purchaseDate'),
        currency:      (g('currency') || 'USD').toUpperCase().slice(0, 3),
      };
      if (typeEl.value === 'cdt') {
        data.interestRate = Number(g('interestRate')) || 0;
        data.maturityDate = g('maturityDate');
        data.quantity = 1;
        data.purchasePrice = Number(g('purchaseAmount')) || Number(priceEl.value) || data.purchasePrice;
      }
      if (typeEl.value === 'fund') {
        data.currentValue = Number(g('currentValue')) || 0;
        data.quantity = 1;
        data.purchasePrice = Number(g('purchaseAmount')) || Number(priceEl.value) || data.purchasePrice;
      }
      if (!data.name && !data.symbol) { toast('Ingresa nombre o ticker', { type: 'negative' }); return false; }
      if (data.quantity <= 0) { toast('Cantidad o monto debe ser mayor a 0', { type: 'negative' }); return false; }
      try {
        if (mode === 'edit' && inv) { await dataService.update('investments', inv.id, data); toast('Actualizado'); }
        else { await dataService.create('investments', data); toast('Compra registrada'); }
      } catch (e) { toast('Error: ' + e.message, { type: 'negative' }); return false; }
    },
  });
}

// ---------- Card de posición ----------
function positionCard(group, livePrice, fxRates, baseCur) {
  const { symbol, name, assetType, totalQty, totalCost, weightedAvg, currency, purchases } = group;
  const { value: nativeValue, cost: nativeCost } = groupNativeValue(group, { [symbol?.toUpperCase()]: livePrice });
  const gain    = nativeValue - nativeCost;
  const gainPct = nativeCost ? (gain / nativeCost) * 100 : 0;
  const isPos   = gain >= 0;

  const card = el('div', { class: 'inv-card' });

  // Header
  const head = el('div', { class: 'inv-card__head' });
  const titleWrap = el('div', { class: 'inv-card__title-wrap' });
  if (symbol) titleWrap.appendChild(el('span', { class: 'inv-card__ticker' }, [symbol]));
  titleWrap.appendChild(el('span', { class: 'inv-card__name' }, [name || symbol || '—']));
  titleWrap.appendChild(Badge(typeLabel(assetType), 'info'));
  if (currency && currency !== baseCur) titleWrap.appendChild(Badge(currency, ''));
  head.appendChild(titleWrap);

  const valWrap = el('div', { class: 'inv-card__value-wrap' });
  valWrap.appendChild(el('div', { class: 'inv-card__value tabular' }, [formatMoney(nativeValue, currency)]));
  const gainEl = el('span', { class: `inv-card__gain ${isPos ? 'text-positive' : 'text-negative'}` });
  gainEl.textContent = `${isPos ? '+' : ''}${formatMoney(gain, currency)}  ${pctFmt(gainPct)}`;
  valWrap.appendChild(gainEl);
  if (livePrice?.changePct !== undefined) {
    const d = livePrice.changePct;
    valWrap.appendChild(el('div', { class: `t-caption ${d >= 0 ? 'text-positive' : 'text-negative'}` },
      [`Hoy: ${pctFmt(d)}`]));
  }
  head.appendChild(valWrap);
  card.appendChild(head);

  // Métricas
  const metrics = el('div', { class: 'inv-card__metrics' });
  const m = (lbl, val) => {
    const d = el('div', { class: 'inv-metric' });
    d.appendChild(el('span', { class: 'inv-metric__label' }, [lbl]));
    d.appendChild(el('span', { class: 'inv-metric__value tabular' }, [val]));
    return d;
  };

  if (!['cdt', 'fund'].includes(assetType)) {
    metrics.appendChild(m('Cantidad', totalQty % 1 === 0 ? String(totalQty) : totalQty.toFixed(6).replace(/0+$/, '')));
    metrics.appendChild(m('Precio promedio', formatMoney(weightedAvg, currency)));
    if (livePrice?.price) metrics.appendChild(m('Precio actual', formatMoney(livePrice.price, livePrice.currency || currency)));
    if (purchases.length > 1) metrics.appendChild(m('Compras (DCA)', `${purchases.length} operaciones`));
  }
  metrics.appendChild(m('Invertido', formatMoney(nativeCost, currency)));
  if (assetType === 'cdt') {
    const inv0 = purchases[0];
    if (inv0?.interestRate) metrics.appendChild(m('Tasa E.A.', `${inv0.interestRate}%`));
    if (inv0?.maturityDate) metrics.appendChild(m('Vencimiento', inv0.maturityDate));
  }

  // Equivalente en COP si es moneda distinta
  const copValue = toCOP(nativeValue, currency, fxRates);
  if (copValue !== null && currency !== 'COP') {
    metrics.appendChild(m('≈ en COP', formatMoney(copValue, 'COP')));
  }
  card.appendChild(metrics);

  // Acciones
  const actions = el('div', { class: 'inv-card__actions' });
  if (!['cdt', 'fund'].includes(assetType)) {
    actions.appendChild(Button('+ Compra', { variant: 'outline', size: 'sm', onClick: () => openInvestmentModal({ defaultSymbol: symbol || '', mode: 'create' }) }));
  }
  if (assetType === 'fund') {
    actions.appendChild(Button('Actualizar valor', { variant: 'outline', size: 'sm', onClick: () => openInvestmentModal({ inv: purchases[0], mode: 'edit' }) }));
  }
  actions.appendChild(el('button', { class: 'icon-btn', title: 'Editar',
    on: { click: () => openInvestmentModal({ inv: purchases[0], mode: 'edit' }) }, html: icon('edit') }));
  if (purchases.length === 1) {
    actions.appendChild(el('button', { class: 'icon-btn icon-btn--danger', title: 'Eliminar',
      on: { click: () => confirmDialog({ title: `Eliminar ${name || symbol}`, message: '¿Eliminar esta posición?',
        onConfirm: async () => { try { await dataService.remove('investments', purchases[0].id); toast('Eliminado'); } catch(e) { toast('Error', { type: 'negative' }); } }
      }) }, html: icon('trash') }));
  }
  card.appendChild(actions);
  return card;
}

// ---------- Render principal ----------
export function renderInvestments() {
  const root = el('div');
  const bodyMount = el('div');
  let livePrices = {}; // { 'VUG': { price, prevClose, changePct }, 'USDCOP=X': { price } }
  let fxRates = {};    // { 'USD': 4180, 'EUR': 4600 } en COP
  let refreshing = false;

  function buildFxRates() {
    const rates = {};
    ['USD', 'EUR', 'GBP', 'BRL'].forEach((cur) => {
      const key = cur + 'COP=X';
      if (livePrices[key]?.price) rates[cur] = livePrices[key].price;
    });
    return rates;
  }

  async function refreshPrices() {
    if (refreshing) return;
    const s = store.get();
    const groups = groupByTicker(s.investments);
    const stockTickers = groups
      .filter((g) => g.symbol && !['cdt', 'fund'].includes(g.assetType))
      .map((g) => g.symbol.toUpperCase());
    const fxTickers = ['USDCOP=X', 'EURCOP=X', 'GBPCOP=X'];
    const all = [...new Set([...stockTickers, ...fxTickers])];
    if (!all.length) return;

    refreshing = true;
    paint(true);
    try {
      const quotes = await apiClient.get('getQuotes', { tickers: all.join(',') });
      Object.entries(quotes || {}).forEach(([tk, q]) => { if (q && !q.error) livePrices[tk] = q; });
      fxRates = buildFxRates();
      toast('Precios actualizados');
    } catch (e) {
      toast('Error al obtener precios: ' + e.message, { type: 'warning' });
    } finally {
      refreshing = false;
      paint(false);
    }
  }

  function paint(loading = false) {
    const s = store.get();
    const baseCur = s.baseCurrency || 'COP';
    const allGroups = groupByTicker(s.investments);

    if (!allGroups.length) {
      mount(bodyMount, el('div', { class: 'card' }, [EmptyState({
        title: 'Sin inversiones', message: 'Registra tu primera posición con el botón de arriba.', iconName: 'investments',
        action: Button('Nueva inversión', { variant: 'primary', iconName: 'plus', onClick: () => openInvestmentModal({ mode: 'create' }) }),
      })]));
      return;
    }

    // Calcular valores en COP para totales globales
    const sectionStats = SECTIONS.map((sec) => {
      const groups = allGroups.filter((g) => sec.types.includes(g.assetType));
      let totalValue = 0, totalCost = 0, noRate = false;
      groups.forEach((g) => {
        const lp = livePrices[g.symbol?.toUpperCase()];
        const { value, cost } = groupNativeValue(g, { [g.symbol?.toUpperCase()]: lp });
        const valueCOP = toCOP(value, g.currency, fxRates);
        const costCOP  = toCOP(cost, g.currency, fxRates);
        if (valueCOP === null) { noRate = true; totalValue += value; totalCost += cost; }
        else { totalValue += valueCOP; totalCost += costCOP; }
      });
      const gain    = totalValue - totalCost;
      const ret     = totalCost ? (gain / totalCost) * 100 : 0;
      return { ...sec, groups, totalValue, totalCost, gain, ret, noRate };
    }).filter((s) => s.groups.length > 0);

    const portfolioValue = sectionStats.reduce((s, sec) => s + sec.totalValue, 0);
    const portfolioCost  = sectionStats.reduce((s, sec) => s + sec.totalCost, 0);
    const portfolioGain  = portfolioValue - portfolioCost;
    const portfolioRet   = portfolioCost ? (portfolioGain / portfolioCost) * 100 : 0;

    const wrap = el('div', { class: 'stack' });

    // KPIs globales
    wrap.appendChild(el('div', { class: 'grid grid--kpi' }, [
      KpiCard({ label: 'Portafolio total', value: formatMoney(portfolioValue, baseCur), iconName: 'investments', variant: 'accent', hero: true,
        foot: [Trend(portfolioRet), el('span', { class: 't-caption', text: ' retorno total' })] }),
      KpiCard({ label: 'Capital invertido', value: formatMoney(portfolioCost, baseCur), iconName: 'wallet', variant: 'neutral' }),
      KpiCard({ label: 'Ganancia / Pérdida', value: formatMoney(portfolioGain, baseCur), iconName: portfolioGain >= 0 ? 'arrowUp' : 'arrowDown', variant: portfolioGain >= 0 ? 'emerald' : 'negative' }),
    ]));

    // Distribución visual por sección
    if (portfolioValue > 0) {
      const distEl = el('div', { class: 'card card--pad' });
      distEl.appendChild(el('p', { class: 't-caption text-secondary mb-2', text: 'DISTRIBUCIÓN DEL PORTAFOLIO' }));
      sectionStats.forEach((sec) => {
        const pct = (sec.totalValue / portfolioValue) * 100;
        const row = el('div', { class: 'stack mb-2' });
        row.appendChild(el('div', { class: 'row-flex between' }, [
          el('span', { class: 't-caption', text: sec.label }),
          el('span', { class: 'tabular t-caption' }, [
            el('span', { class: sec.ret >= 0 ? 'text-positive' : 'text-negative', text: pctFmt(sec.ret) }),
            el('span', { class: 'text-secondary', text: `  ·  ${formatMoney(sec.totalValue, baseCur)}  ·  ${pct.toFixed(1)}%` }),
          ]),
        ]));
        row.appendChild(ProgressBar(pct));
        distEl.appendChild(row);
      });
      wrap.appendChild(distEl);
    }

    // Sección por tipo
    sectionStats.forEach((sec) => {
      const secEl = el('div', { class: 'section' });
      // Header de sección con P&L
      const secHead = el('div', { class: 'inv-section-head' });
      secHead.appendChild(el('div', { class: 'inv-section-title' }, [
        el('span', { html: icon(sec.icon), class: 'inv-section-icon' }),
        el('span', { class: 't-h2', text: sec.label }),
        el('span', { class: `inv-section-ret ${sec.ret >= 0 ? 'text-positive' : 'text-negative'}`, text: pctFmt(sec.ret) }),
      ]));
      secHead.appendChild(el('div', { class: 't-caption text-secondary tabular' }, [
        `${formatMoney(sec.totalValue, baseCur)}  ·  ${sec.gain >= 0 ? '+' : ''}${formatMoney(sec.gain, baseCur)}`,
      ]));
      secEl.appendChild(secHead);

      const grid = el('div', { class: 'inv-cards-grid' });
      sec.groups.forEach((g) => {
        const lp = livePrices[g.symbol?.toUpperCase()];
        grid.appendChild(positionCard(g, lp || null, fxRates, baseCur));
      });
      secEl.appendChild(grid);
      wrap.appendChild(secEl);
    });

    // Resumen global ponderado
    const summaryEl = el('div', { class: 'card card--pad section' });
    summaryEl.appendChild(el('p', { class: 't-caption text-secondary mb-3', text: 'RESUMEN GLOBAL PONDERADO' }));
    const table = el('table', { class: 'inv-summary-table' });
    const thead = el('thead');
    thead.appendChild(el('tr', {}, [
      el('th', {}, ['Sección']),
      el('th', { class: 'text-right' }, ['Valor']),
      el('th', { class: 'text-right' }, ['Invertido']),
      el('th', { class: 'text-right' }, ['Retorno']),
      el('th', { class: 'text-right' }, ['Peso']),
    ]));
    table.appendChild(thead);
    const tbody = el('tbody');
    sectionStats.forEach((sec) => {
      const weight = portfolioValue ? (sec.totalValue / portfolioValue) * 100 : 0;
      const tr = el('tr', {});
      tr.appendChild(el('td', {}, [
        el('span', { class: 'inv-section-icon-sm', html: icon(sec.icon) }),
        sec.label,
      ]));
      tr.appendChild(el('td', { class: 'text-right tabular' }, [formatMoney(sec.totalValue, baseCur)]));
      tr.appendChild(el('td', { class: 'text-right tabular' }, [formatMoney(sec.totalCost, baseCur)]));
      tr.appendChild(el('td', { class: `text-right tabular ${sec.ret >= 0 ? 'text-positive' : 'text-negative'}` }, [pctFmt(sec.ret)]));
      tr.appendChild(el('td', { class: 'text-right tabular text-secondary' }, [`${weight.toFixed(1)}%`]));
      tbody.appendChild(tr);
    });
    // Fila total
    const totRow = el('tr', { class: 'inv-summary-total' });
    totRow.appendChild(el('td', {}, ['Total portafolio']));
    totRow.appendChild(el('td', { class: 'text-right tabular' }, [formatMoney(portfolioValue, baseCur)]));
    totRow.appendChild(el('td', { class: 'text-right tabular' }, [formatMoney(portfolioCost, baseCur)]));
    totRow.appendChild(el('td', { class: `text-right tabular ${portfolioRet >= 0 ? 'text-positive' : 'text-negative'}` }, [pctFmt(portfolioRet)]));
    totRow.appendChild(el('td', { class: 'text-right tabular text-secondary' }, ['100%']));
    tbody.appendChild(totRow);
    table.appendChild(tbody);
    summaryEl.appendChild(table);

    // Nota tipo de cambio
    if (Object.keys(fxRates).length) {
      const fxNote = Object.entries(fxRates).map(([c, r]) => `1 ${c} = ${formatMoney(r, 'COP')}`).join('  ·  ');
      summaryEl.appendChild(el('p', { class: 't-caption text-tertiary mt-3', text: `Tasas usadas: ${fxNote}` }));
    } else if (loading) {
      summaryEl.appendChild(el('p', { class: 't-caption text-tertiary mt-3', text: 'Actualizando tasas de cambio…' }));
    } else {
      summaryEl.appendChild(el('p', { class: 't-caption text-tertiary mt-3', text: 'Presiona "Actualizar precios" para obtener tasas de cambio y precios reales.' }));
    }
    wrap.appendChild(summaryEl);

    mount(bodyMount, wrap);
  }

  const refreshBtn = Button(refreshing ? 'Actualizando…' : 'Actualizar precios', {
    variant: 'outline', iconName: 'refresh', onClick: () => refreshPrices(),
  });

  root.append(
    el('div', { class: 'page-header' }, [
      el('div', { class: 'row-flex between' }, [
        el('div', {}, [
          el('h2', { class: 't-h1', text: 'Inversiones' }),
          el('p', { class: 'page-header__sub', text: 'DCA · Precio promedio ponderado · Multimoneda' }),
        ]),
        el('div', { class: 'row-flex', style: 'gap:var(--space-2)' }, [
          refreshBtn,
          Button('Nueva inversión', { variant: 'primary', iconName: 'plus', onClick: () => openInvestmentModal({ mode: 'create' }) }),
        ]),
      ]),
    ]),
    bodyMount,
  );

  store.subscribe(() => paint());
  paint();
  return root;
}
