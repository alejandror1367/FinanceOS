// views/investments.js — Inversiones con DCA, agrupación por ticker y precios reales.
// Tipos: stock | etf | fund (FIC) | cdt | crypto
// DCA: múltiples compras del mismo ticker → costo promedio ponderado automático.

import { el, mount } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { store } from '../store/store.js';
import { dataService } from '../services/dataService.js';
import { apiClient } from '../services/apiClient.js';
import { formatMoney } from '../utils/format.js';
import { KpiCard, Badge, Trend, EmptyState, Button } from '../components/ui.js';
import { openModal, confirmDialog } from '../components/modal.js';
import { field, textInput, numberInput, select } from '../components/forms.js';
import { toast } from '../services/toast.js';

const ASSET_TYPES = [
  { value: 'etf',    label: 'ETF' },
  { value: 'stock',  label: 'Acción' },
  { value: 'crypto', label: 'Cripto' },
  { value: 'fund',   label: 'Fondo FIC' },
  { value: 'cdt',    label: 'CDT / Renta fija' },
];
const typeLabel = (v) => (ASSET_TYPES.find((t) => t.value === v) || {}).label || v;
const pct = (n) => `${(Number(n) || 0).toFixed(2)}%`;
const today = () => new Date().toISOString().slice(0, 10);

// ---------- DCA grouping ----------
function groupByTicker(investments) {
  const map = {};
  (investments || []).filter((inv) => !inv.isDeleted).forEach((inv) => {
    const key = ((inv.symbol || inv.name) || inv.id).toUpperCase();
    if (!map[key]) map[key] = { key, symbol: inv.symbol, name: inv.name, assetType: inv.assetType, currency: inv.currency, purchases: [] };
    map[key].purchases.push(inv);
    // Mantiene el nombre y tipo más reciente
    if (inv.name) map[key].name = inv.name;
    if (inv.assetType) map[key].assetType = inv.assetType;
    if (inv.currency) map[key].currency = inv.currency;
  });

  return Object.values(map).map((g) => {
    const totalQty  = g.purchases.reduce((s, p) => s + (Number(p.quantity) || 0), 0);
    const totalCost = g.purchases.reduce((s, p) => s + (Number(p.quantity) || 0) * (Number(p.purchasePrice || p.avgCost) || 0), 0);
    const weightedAvg = totalQty ? totalCost / totalQty : 0;
    // Precio actual: primero de state (live), luego del registro más reciente
    const sorted = [...g.purchases].sort((a, b) => (b.purchaseDate || '').localeCompare(a.purchaseDate || ''));
    const storedPrice = Number(sorted[0]?.currentPrice) || 0;
    return { ...g, totalQty, totalCost, weightedAvg, storedPrice };
  });
}

// CDT: valor actual por capitalización compuesta
function cdtValue(group) {
  const inv = group.purchases[0];
  if (!inv || !inv.interestRate || !inv.purchaseDate) return group.totalCost;
  const days = (Date.now() - new Date(inv.purchaseDate).getTime()) / 86400000;
  return group.totalCost * Math.pow(1 + inv.interestRate / 100, days / 365);
}

// ---------- Form ----------
function openInvestmentModal({ inv = null, defaultSymbol = '', mode = 'create' }) {
  const s = store.get();
  const accOpts = [{ value: '', label: '— Sin cuenta —' }]
    .concat((s.accounts || []).filter((a) => !a.isArchived).map((a) => ({ value: a.id, label: a.name })));

  const typeEl = select({ name: 'assetType', value: inv?.assetType || 'etf', options: ASSET_TYPES });
  const extraEl = el('div');

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
      extraEl.appendChild(
        field('Valor actual ($)', numberInput({ name: 'currentValue', value: inv?.currentValue ?? '', placeholder: 'Actualizar manualmente' }))
      );
    }
  }
  typeEl.addEventListener('change', paintExtra);
  paintExtra();

  const isCdtOrFund = () => ['cdt', 'fund'].includes(typeEl.value);

  const body = el('div', {}, [
    el('div', { class: 'field-row' }, [
      field('Ticker / Símbolo', textInput({ name: 'symbol', value: inv?.symbol || defaultSymbol, placeholder: 'VUG, AAPL, BTC-USD' })),
      field('Tipo', typeEl),
    ]),
    field('Nombre', textInput({ name: 'name', value: inv?.name || '', placeholder: 'Vanguard Growth ETF' })),
    field('Cuenta / Broker', select({ name: 'accountId', value: inv?.accountId || '', options: accOpts })),
    el('div', { class: 'field-row' }, [
      field('Cantidad / Unidades', numberInput({ name: 'quantity', value: inv?.quantity ?? '' })),
      field('Precio de compra', numberInput({ name: 'purchasePrice', value: inv?.purchasePrice || inv?.avgCost || '' })),
    ]),
    el('div', { class: 'field-row' }, [
      field('Fecha de compra', textInput({ name: 'purchaseDate', value: inv?.purchaseDate || today(), type: 'date' })),
      field('Moneda', textInput({ name: 'currency', value: inv?.currency || 'USD', placeholder: 'USD' })),
    ]),
    extraEl,
  ]);

  openModal({
    title: mode === 'edit' ? 'Editar compra' : defaultSymbol ? `Nueva compra — ${defaultSymbol}` : 'Nueva inversión',
    body,
    submitLabel: mode === 'edit' ? 'Guardar' : 'Registrar compra',
    onSubmit: async () => {
      const g = (n) => body.querySelector(`[name="${n}"]`)?.value || '';
      const data = {
        symbol:        g('symbol').trim().toUpperCase(),
        name:          g('name').trim(),
        assetType:     g('assetType'),
        accountId:     g('accountId'),
        quantity:      Number(g('quantity')) || 0,
        purchasePrice: Number(g('purchasePrice')) || 0,
        purchaseDate:  g('purchaseDate'),
        currency:      (g('currency') || 'USD').toUpperCase().slice(0, 3),
      };
      if (typeEl.value === 'cdt') {
        data.interestRate = Number(g('interestRate')) || 0;
        data.maturityDate = g('maturityDate');
      }
      if (typeEl.value === 'fund') {
        data.currentValue = Number(g('currentValue')) || 0;
      }
      if (!data.name && !data.symbol) { toast('Ingresa un nombre o ticker', { type: 'negative' }); return false; }
      if (data.quantity <= 0 && !isCdtOrFund()) { toast('Cantidad debe ser mayor a 0', { type: 'negative' }); return false; }
      try {
        if (mode === 'edit' && inv) { await dataService.update('investments', inv.id, data); toast('Inversión actualizada'); }
        else { await dataService.create('investments', data); toast('Compra registrada'); }
      } catch (e) { toast('Error al guardar', { type: 'negative' }); return false; }
    },
  });
}

// ---------- Posición agrupada (DCA) ----------
function positionCard(group, livePrice, cur) {
  const { symbol, name, assetType, totalQty, totalCost, weightedAvg, purchases, currency } = group;
  const c = currency || cur;

  let currentPrice, currentValue;
  if (assetType === 'cdt') {
    currentValue = cdtValue(group);
    currentPrice = totalQty ? currentValue / totalQty : 0;
  } else if (assetType === 'fund') {
    const latestFund = [...purchases].sort((a, b) => (b.purchaseDate || '').localeCompare(a.purchaseDate || ''))[0];
    currentValue = latestFund?.currentValue || totalCost;
    currentPrice = totalQty ? currentValue / totalQty : 0;
  } else {
    currentPrice = livePrice?.price || group.storedPrice || 0;
    currentValue = totalQty * currentPrice;
  }

  const gain    = currentValue - totalCost;
  const gainPct = totalCost ? (gain / totalCost) * 100 : 0;
  const isPos   = gain >= 0;

  const card = el('div', { class: 'inv-card' });

  // Header: ticker + nombre + badge tipo
  const head = el('div', { class: 'inv-card__head' });
  const titleWrap = el('div', { class: 'inv-card__title-wrap' });
  if (symbol) titleWrap.appendChild(el('span', { class: 'inv-card__ticker', text: symbol }));
  titleWrap.appendChild(el('span', { class: 'inv-card__name', text: name || symbol || '—' }));
  titleWrap.appendChild(Badge(typeLabel(assetType), 'info'));
  head.appendChild(titleWrap);

  const valueWrap = el('div', { class: 'inv-card__value-wrap' });
  valueWrap.appendChild(el('div', { class: 'inv-card__value tabular', text: formatMoney(currentValue, c) }));
  const gainEl = el('div', { class: `inv-card__gain tabular ${isPos ? 'text-positive' : 'text-negative'}` });
  gainEl.textContent = `${isPos ? '+' : ''}${formatMoney(gain, c)} (${isPos ? '+' : ''}${gainPct.toFixed(2)}%)`;
  valueWrap.appendChild(gainEl);

  // Cambio diario si hay precio live
  if (livePrice && livePrice.price && livePrice.prevClose) {
    const dayChg = ((livePrice.price - livePrice.prevClose) / livePrice.prevClose) * 100;
    valueWrap.appendChild(el('div', { class: `t-caption ${dayChg >= 0 ? 'text-positive' : 'text-negative'}` },
      [`Hoy: ${dayChg >= 0 ? '+' : ''}${dayChg.toFixed(2)}%`]));
  }
  head.appendChild(valueWrap);
  card.appendChild(head);

  // Métricas: qty, precio promedio, precio actual, costo total
  const metrics = el('div', { class: 'inv-card__metrics' });
  const m = (label, value) => {
    const d = el('div', { class: 'inv-metric' });
    d.appendChild(el('span', { class: 'inv-metric__label', text: label }));
    d.appendChild(el('span', { class: 'inv-metric__value tabular', text: value }));
    return d;
  };

  if (assetType !== 'cdt' && assetType !== 'fund') {
    metrics.appendChild(m('Cantidad', totalQty % 1 === 0 ? totalQty : totalQty.toFixed(4)));
    metrics.appendChild(m('Precio promedio', formatMoney(weightedAvg, c)));
    if (currentPrice) metrics.appendChild(m('Precio actual', formatMoney(currentPrice, c)));
  }
  metrics.appendChild(m('Costo total', formatMoney(totalCost, c)));
  if (assetType === 'cdt') {
    const inv0 = purchases[0];
    if (inv0?.interestRate) metrics.appendChild(m('Tasa E.A.', pct(inv0.interestRate)));
    if (inv0?.maturityDate) metrics.appendChild(m('Vencimiento', inv0.maturityDate));
  }
  if (purchases.length > 1) metrics.appendChild(m('Compras', `${purchases.length} operaciones (DCA)`));
  card.appendChild(metrics);

  // Acciones
  const actions = el('div', { class: 'inv-card__actions' });

  if (assetType !== 'cdt' && assetType !== 'fund') {
    actions.appendChild(Button('+ Compra', {
      variant: 'outline', size: 'sm',
      onClick: () => openInvestmentModal({ defaultSymbol: symbol || '', mode: 'create' }),
    }));
  }

  if (assetType === 'fund') {
    actions.appendChild(Button('Actualizar valor', {
      variant: 'outline', size: 'sm',
      onClick: () => openInvestmentModal({ inv: purchases[0], mode: 'edit' }),
    }));
  }

  actions.appendChild(el('button', { class: 'icon-btn', 'aria-label': 'Editar', title: 'Editar última compra',
    on: { click: () => openInvestmentModal({ inv: purchases[0], mode: 'edit' }) }, html: icon('edit') }));

  if (purchases.length === 1) {
    actions.appendChild(el('button', { class: 'icon-btn icon-btn--danger', 'aria-label': 'Eliminar',
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
  const livePrices = {}; // { TICKER: { price, prevClose, changePct } }
  let refreshing = false;

  function totalPortfolio(groups) {
    return groups.reduce((sum, g) => {
      if (g.assetType === 'cdt') return sum + cdtValue(g);
      if (g.assetType === 'fund') {
        const latest = [...g.purchases].sort((a, b) => (b.purchaseDate || '').localeCompare(a.purchaseDate || ''))[0];
        return sum + (latest?.currentValue || g.totalCost);
      }
      const lp = livePrices[g.symbol?.toUpperCase()];
      const price = lp?.price || g.storedPrice || 0;
      return sum + g.totalQty * price;
    }, 0);
  }

  async function refreshPrices() {
    if (refreshing) return;
    const s = store.get();
    const groups = groupByTicker(s.investments);
    const tickers = groups
      .filter((g) => g.symbol && g.assetType !== 'cdt' && g.assetType !== 'fund')
      .map((g) => g.symbol.toUpperCase());
    if (!tickers.length) return;
    refreshing = true;
    paint(true);
    try {
      const quotes = await apiClient.get('getQuotes', { tickers: tickers.join(',') });
      Object.entries(quotes || {}).forEach(([tk, q]) => { if (q && !q.error) livePrices[tk] = q; });
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
    const cur = s.baseCurrency;
    const groups = groupByTicker(s.investments);

    if (!groups.length) {
      mount(bodyMount, el('div', { class: 'card' }, [EmptyState({
        title: 'Sin inversiones', message: 'Registra tu primera posición.', iconName: 'investments',
        action: Button('Nueva inversión', { variant: 'primary', iconName: 'plus', onClick: () => openInvestmentModal({ mode: 'create' }) }),
      })]));
      return;
    }

    const totalValue = totalPortfolio(groups);
    const totalCost  = groups.reduce((s, g) => s + g.totalCost, 0);
    const totalGain  = totalValue - totalCost;
    const totalRet   = totalCost ? (totalGain / totalCost) * 100 : 0;

    // Separar por tipo
    const mktGroups  = groups.filter((g) => ['stock', 'etf', 'crypto'].includes(g.assetType));
    const ficGroups  = groups.filter((g) => g.assetType === 'fund');
    const cdtGroups  = groups.filter((g) => g.assetType === 'cdt');

    const kpiRow = el('div', { class: 'grid grid--kpi' }, [
      KpiCard({ label: 'Portafolio total', value: formatMoney(totalValue, cur), iconName: 'investments', variant: 'accent', hero: true,
        foot: [Trend(totalRet), el('span', { class: 't-caption', text: 'retorno total' })] }),
      KpiCard({ label: 'Invertido', value: formatMoney(totalCost, cur), iconName: 'wallet', variant: 'neutral' }),
      KpiCard({ label: 'Ganancia / Pérdida', value: formatMoney(totalGain, cur), iconName: totalGain >= 0 ? 'arrowUp' : 'arrowDown', variant: totalGain >= 0 ? 'emerald' : 'negative' }),
    ]);

    const refreshBtn = Button(loading ? 'Actualizando…' : 'Actualizar precios', {
      variant: 'outline', iconName: 'refresh',
      onClick: refreshPrices,
    });
    refreshBtn.disabled = loading;

    const sections = el('div', { class: 'stack' });

    function section(title, grps) {
      if (!grps.length) return null;
      const wrap = el('div', { class: 'section' });
      wrap.appendChild(el('h3', { class: 't-h2 mb-4', text: title }));
      const grid = el('div', { class: 'inv-cards-grid' });
      grps.forEach((g) => {
        const lp = livePrices[g.symbol?.toUpperCase()];
        grid.appendChild(positionCard(g, lp || null, cur));
      });
      wrap.appendChild(grid);
      return wrap;
    }

    [
      section('Acciones y ETFs', mktGroups),
      section('Fondos de Inversión (FIC)', ficGroups),
      section('Renta fija — CDT', cdtGroups),
    ].filter(Boolean).forEach((s) => sections.appendChild(s));

    mount(bodyMount, el('div', {}, [kpiRow, sections]));
  }

  root.append(
    el('div', { class: 'page-header' }, [
      el('div', { class: 'row-flex between' }, [
        el('div', {}, [
          el('h2', { class: 't-h1', text: 'Inversiones' }),
          el('p', { class: 'page-header__sub', text: 'DCA · Precio promedio ponderado · Precios reales' }),
        ]),
        el('div', { class: 'row-flex gap-2' }, [
          Button('Nueva inversión', { variant: 'primary', iconName: 'plus', onClick: () => openInvestmentModal({ mode: 'create' }) }),
        ]),
      ]),
    ]),
    bodyMount,
  );

  // Agregar botón de actualizar precios encima de las cards
  const unsubscribe = store.subscribe(() => paint());
  root.addEventListener('disconnected', unsubscribe);

  paint();

  // Inyectar botón refresh después del primer render
  setTimeout(() => {
    const header = root.querySelector('.page-header .row-flex');
    if (header) {
      const btn = Button('Actualizar precios', { variant: 'outline', iconName: 'refresh', onClick: refreshPrices });
      header.appendChild(btn);
    }
  }, 0);

  return root;
}
