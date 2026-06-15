// views/investments.js — Inversiones con DCA, compras individuales editables,
// agrupación por ticker, rendimiento por sección y resumen global multimoneda.

import { el, mount } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { store } from '../store/store.js';
import { dataService } from '../services/dataService.js';
import { apiClient } from '../services/apiClient.js';
import { formatMoney, formatDate, roundMoney } from '../utils/format.js';
import { Badge, Trend, EmptyState, Button, HeroCard, Fab } from '../components/ui.js';
import { openModal, confirmDialog } from '../components/modal.js';
import { field, textInput, numberInput, select, segmented, setFieldError, focusFieldError } from '../components/forms.js';
import { toast } from '../services/toast.js';
import { guardedOp, guardedSave } from '../components/crud.js';
import { priceService } from '../services/priceService.js';
import { selectors } from '../store/selectors.js';

// Brokers predefinidos que aparecen como quick-create si no existen como cuenta
const DEFAULT_BROKERS = [
  { name: 'XTB',                  type: 'investment', currency: 'USD' },
  { name: 'ARQ Invest',           type: 'investment', currency: 'COP' },
  { name: 'Trii',                 type: 'investment', currency: 'COP' },
  { name: 'Tyba',                 type: 'investment', currency: 'COP' },
  { name: 'Interactive Brokers',  type: 'investment', currency: 'USD' },
  { name: 'Trading212',           type: 'investment', currency: 'USD' },
  { name: 'Bancolombia Valores',  type: 'investment', currency: 'COP' },
];

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

// Estado de colapso de secciones — nivel de módulo para sobrevivir re-renders reactivos.
// Default: 'closed' colapsado (sección secundaria); las activas abiertas.
// Por defecto NADA colapsado: "Operaciones cerradas" debe verse sin tener que
// buscarla (antes salía colapsada y el P&L realizado quedaba escondido).
const _collapsed = new Set(
  (() => { try { return JSON.parse(localStorage.getItem('financeOS:inv:collapsed') || '[]'); } catch (_) { return []; } })()
);
function _saveCollapsed() {
  try { localStorage.setItem('financeOS:inv:collapsed', JSON.stringify([..._collapsed])); } catch (_) {}
}

// Posiciones expandidas en móvil (key de grupo). En móvil cada card se muestra
// como fila compacta; el detalle (métricas + acciones) se despliega al tocarla.
// Estado en memoria: se reinicia al recargar (no es preferencia persistente).
const _expandedPos = new Set();

const typeLabel  = (v) => (ASSET_TYPES.find((t) => t.value === v) || {}).label || v;
const pctFmt     = (n) => `${n >= 0 ? '+' : ''}${Number(n).toFixed(2)}%`;
const today      = () => new Date().toISOString().slice(0, 10);
const isTrivial  = (t) => ['cdt', 'fund'].includes(t);
// Formatea montos con 2 decimales para divisas extranjeras (USD, EUR…) y 0 para COP.
const fmtI       = (amount, currency) => formatMoney(amount, currency, currency && currency !== 'COP' ? { decimals: 2 } : {});

function priceAgeLabel() {
  const t = priceService.fetchedAt;
  if (!t) return null;
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return 'precios: ahora';
  if (mins < 60) return `precios: hace ${mins} min`;
  return `precios: hace ${Math.round(mins / 60)}h`;
}

// ─── DCA: agrupar compras individuales por ticker ──────────────────────────
// Separa compras activas (sin soldDate) de vendidas (con soldDate).
function groupByTicker(investments) {
  const map = {};
  (investments || []).filter((inv) => !inv.isDeleted).forEach((inv) => {
    const key = isTrivial(inv.assetType) && !inv.symbol ? inv.id : ((inv.symbol || inv.name) || inv.id).toUpperCase();
    if (!map[key]) map[key] = { key, symbol: inv.symbol, name: inv.name, assetType: inv.assetType, currency: inv.currency || 'USD', purchases: [], sold: [] };
    if (inv.soldDate) map[key].sold.push(inv);
    else              map[key].purchases.push(inv);
    if (inv.name)      map[key].name     = inv.name;
    if (inv.assetType) map[key].assetType = inv.assetType;
    if (inv.currency)  map[key].currency  = inv.currency;
  });
  return Object.values(map).map((g) => {
    const sorted    = [...g.purchases].sort((a, b) => (b.purchaseDate || '').localeCompare(a.purchaseDate || ''));
    const totalQty  = g.purchases.reduce((s, p) => s + (Number(p.quantity) || 0), 0);
    // Cost basis incluye la comisión de compra de cada lote (Sprint 5).
    const totalCommission = g.purchases.reduce((s, p) => s + (Number(p.commission) || 0), 0);
    const totalCost = g.purchases.reduce((s, p) => s + (Number(p.quantity) || 0) * (Number(p.purchasePrice || p.avgCost) || 0), 0) + totalCommission;
    // P&L realizado neto: delega al selector puro selectors.lotRealizedPnL (FIN-002/003/004).
    // Incluye: comisión de compra prorateada, comisión de venta completa y retención.
    const fallbackWithholdingRate = sorted.find((p) => Number(p.withholdingRate) > 0)?.withholdingRate || 0;
    const realizedPnL = g.sold.reduce((s, p) => s + selectors.lotRealizedPnL(p, fallbackWithholdingRate), 0);
    // Retención en fuente de la posición: la del lote más reciente que la tenga definida.
    const withholdingRate = fallbackWithholdingRate;
    return { ...g, sorted, totalQty, totalCost, totalCommission, withholdingRate,
      weightedAvg: totalQty ? totalCost / totalQty : 0,
      storedPrice: Number(sorted[0]?.currentPrice) || 0, realizedPnL };
  });
}

// ─── Modal de venta ───────────────────────────────────────────────────────────
// FIN-003 (TD-43): permite ventas parciales. El usuario indica la cantidad a vender
// (≤ cantidad total del lote). Si vende todo, el lote se cierra (soldDate); si vende
// una fracción, se reduce quantity y se registra un lote de venta separado.
function openSellModal(group, livePrice) {
  const { symbol, name, totalQty, totalCost, currency, purchases } = group;
  const currentPrice = livePrice?.price || group.storedPrice || 0;
  const qtyFmt = totalQty.toFixed(6).replace(/\.?0+$/, '');
  const qtyEl   = numberInput({ name: 'soldQuantity', value: qtyFmt, placeholder: `Máx. ${qtyFmt}` });
  const priceEl = numberInput({ name: 'soldPrice', value: currentPrice ? currentPrice.toFixed(currency !== 'COP' ? 2 : 0) : '', placeholder: 'Precio por unidad' });
  const dateEl  = textInput({ name: 'soldDate', value: today(), type: 'date' });
  const commEl  = numberInput({ name: 'soldCommission', value: '', placeholder: 'Opcional' });

  const body = el('div', {}, [
    el('p', { class: 't-caption text-secondary', text: `${qtyFmt} unidades disponibles · costo total ${fmtI(totalCost, currency)}` }),
    el('div', { class: 'field-row' }, [field('Cantidad a vender', qtyEl), field('Precio de venta', priceEl)]),
    el('div', { class: 'field-row' }, [field('Fecha de venta', dateEl), field(`Comisión de venta (${currency})`, commEl)]),
  ]);

  openModal({
    title: `Vender ${symbol || name}`,
    body,
    submitLabel: 'Registrar venta',
    onSubmit: async () => {
      const qtySolicitada = Number(qtyEl.value) || 0;
      const soldPrice     = Number(priceEl.value) || 0;
      const soldDate      = dateEl.value;
      const totalComm     = Number(commEl.value) || 0;

      if (qtySolicitada <= 0 || qtySolicitada > totalQty + 1e-9) {
        focusFieldError(qtyEl); return setFieldError(qtyEl, `Debe ser entre 0 y ${qtyFmt}`);
      }
      if (soldPrice <= 0) { focusFieldError(priceEl); return setFieldError(priceEl, 'Ingresa el precio de venta'); }
      if (!soldDate)      { focusFieldError(dateEl);  return setFieldError(dateEl, 'Selecciona una fecha'); }

      const isTotal = Math.abs(qtySolicitada - totalQty) < 1e-9;

      return guardedSave(async () => {
        if (isTotal) {
          // Venta total: cierra todos los lotes con soldDate.
          // Prorratea la comisión de venta entre lotes por participación de cantidad.
          const qtyLoteTotal = purchases.reduce((s, p) => s + (Number(p.quantity) || 0), 0) || 1;
          for (const p of purchases) {
            const qty = Number(p.quantity) || 0;
            const soldCommission = totalComm * (qty / qtyLoteTotal);
            // FIN-004: soldQuantity = qty del lote (venta total de ese lote).
            await dataService.update('investments', p.id, { ...p, soldPrice, soldDate, soldQuantity: qty, soldCommission });
          }
        } else {
          // Venta parcial: distribuir qtySolicitada entre los lotes FIFO (más recientes primero).
          // Para cada lote, calculamos cuánto vendemos de él y actualizamos su quantity.
          // Si un lote queda en 0, lo marcamos vendido (soldDate); los demás solo reducen quantity.
          let qtyRestante = qtySolicitada;
          // Ordenar FIFO: compras más antiguas primero para la distribución
          const lotesOrdenados = [...purchases].sort((a, b) => (a.purchaseDate || '').localeCompare(b.purchaseDate || ''));
          for (const p of lotesOrdenados) {
            if (qtyRestante <= 0) break;
            const qtyLote = Number(p.quantity) || 0;
            const qtyVendida = Math.min(qtyRestante, qtyLote);
            qtyRestante -= qtyVendida;
            const soldCommission = totalComm * (qtyVendida / qtySolicitada);
            const loteAgotado = Math.abs(qtyVendida - qtyLote) < 1e-9;
            if (loteAgotado) {
              // Lote completamente vendido: cerrarlo
              await dataService.update('investments', p.id, { ...p, soldPrice, soldDate, soldQuantity: qtyVendida, soldCommission });
            } else {
              // Lote parcialmente vendido: crear lote vendido + reducir lote activo
              // 1. Registrar la porción vendida como nuevo lote cerrado
              await dataService.create('investments', {
                ...p, id: undefined,
                quantity: qtyVendida,
                soldPrice, soldDate, soldQuantity: qtyVendida, soldCommission,
              });
              // 2. Reducir la cantidad del lote activo
              await dataService.update('investments', p.id, { ...p, quantity: qtyLote - qtyVendida });
            }
          }
        }
      }, `Venta de ${symbol || name} registrada`, 'Error al registrar');
    },
  });
}

// FIN-008 (TD-44): delega al selector puro (selectors.cdtCurrentValue) para evitar
// duplicar la lógica y mantener la función testeable sin DOM.
function cdtCurrentValue(group) {
  const inv = group.purchases[0];
  if (!inv) return group.totalCost;
  return selectors.cdtCurrentValue(inv);
}

function groupValue(group, livePrices) {
  const { assetType, totalQty, totalCost, symbol } = group;
  if (assetType === 'cdt') return { value: cdtCurrentValue(group), cost: totalCost, hasPrice: true };
  if (assetType === 'fund') {
    const latest = group.sorted[0];
    const v = latest?.currentValue || 0;
    return { value: v || null, cost: totalCost, hasPrice: !!v };
  }
  const lp = livePrices[(symbol || '').toUpperCase()];
  const price = lp?.price || group.storedPrice || 0;
  return { value: price ? totalQty * price : null, cost: totalCost, hasPrice: !!price };
}

function toCOP(amount, currency, fxRates) {
  if (amount === null || amount === undefined) return null;
  if (!currency || currency === 'COP') return amount;
  const r = fxRates[currency];
  return r ? amount * r : null;
}

// ─── Formulario de compra ──────────────────────────────────────────────────
function openPurchaseModal({ inv = null, defaultSymbol = '', defaultType = 'etf', defaultName = '', defaultCurrency = '' }) {
  const s = store.get();
  const mode = inv ? 'edit' : 'create';
  const existingNames = new Set((s.accounts || []).map((a) => a.name.toLowerCase()));
  const brokerOpts = DEFAULT_BROKERS
    .filter((b) => !existingNames.has(b.name.toLowerCase()))
    .map((b) => ({ value: `__broker__${b.name}`, label: `${b.name}` }));
  const accOpts = [{ value: '', label: '— Sin cuenta —' }]
    .concat(brokerOpts)
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
    field('Nombre', textInput({ name: 'name', value: inv?.name || defaultName, placeholder: 'Vanguard Growth ETF' })),
    el('div', { class: 'field-row' }, [
      field('Cuenta / Broker', select({ name: 'accountId', value: inv?.accountId || '', options: accOpts })),
      field('Moneda', select({ name: 'currency', value: inv?.currency || defaultCurrency || 'USD', options: CURRENCIES })),
    ]),
    field('Fecha de compra', textInput({ name: 'purchaseDate', value: inv?.purchaseDate || today(), type: 'date' })),
    el('div', { class: 'field-row' }, [
      field('Comisión de compra', numberInput({ name: 'commission', value: inv?.commission ?? '', placeholder: 'Opcional' })),
      field('Retención en fuente (%)', numberInput({ name: 'withholdingRate', value: inv?.withholdingRate ?? '', placeholder: 'Ej: 4' })),
    ]),
    el('div', { style: 'margin:var(--space-2) 0' }, [modeSeg]),
    qtyRow, amtRow, calcEl, extraEl,
  ]);

  openModal({
    title: mode === 'edit' ? 'Editar compra' : defaultSymbol ? `Nueva compra — ${defaultSymbol}` : 'Registrar inversión',
    body, submitLabel: mode === 'edit' ? 'Guardar' : 'Registrar',
    onSubmit: async () => {
      const g = (n) => body.querySelector(`[name="${n}"]`)?.value || '';
      let accountId = g('accountId');
      if (accountId.startsWith('__broker__')) {
        const brokerName = accountId.slice('__broker__'.length);
        const brokerDef  = DEFAULT_BROKERS.find((b) => b.name === brokerName);
        try {
          const acc = await dataService.create('accounts', {
            name: brokerName, type: brokerDef?.type || 'investment',
            currency: brokerDef?.currency || 'USD', balance: 0,
          });
          accountId = acc.id;
        } catch (e) { accountId = ''; }
      }
      const symbolVal = g('symbol').trim().toUpperCase();
      const data = {
        symbol: symbolVal || null,
        // El backend exige `name` no vacío. En "+ Compra" el campo nombre suele
        // quedar en blanco (solo se prellena el símbolo): si falta, usa el símbolo
        // como nombre para no romper la sync (Campo requerido: name).
        name:   g('name').trim() || symbolVal,
        assetType: g('assetType'), accountId,
        quantity:  Number(qtyEl.value) || 0,
        purchasePrice: Number(priceEl.value) || 0,
        purchaseDate: g('purchaseDate'),
        currency: (g('currency') || 'USD').toUpperCase().slice(0, 3),
        commission: Number(g('commission')) || 0,
        withholdingRate: Number(g('withholdingRate')) || 0,
      };
      if (isTrivial(typeEl.value)) {
        data.quantity = 1;
        data.purchasePrice = Number(amountEl.value) || Number(priceEl.value) || data.purchasePrice;
        if (typeEl.value === 'cdt') { data.interestRate = Number(g('interestRate')) || 0; data.maturityDate = g('maturityDate'); }
        if (typeEl.value === 'fund') data.currentValue = Number(g('currentValue')) || 0;
      }
      if (!data.name && !data.symbol) {
        const nameEl = body.querySelector('[name="name"]');
        focusFieldError(nameEl); return setFieldError(nameEl, 'Ingresa un nombre o un ticker');
      }
      if (data.quantity <= 0) {
        const target = inputMode === 'qty' ? qtyEl : amountEl;
        focusFieldError(target); return setFieldError(target, 'Debe ser mayor a 0');
      }
      return guardedSave(
        () => mode === 'edit' && inv ? dataService.update('investments', inv.id, data) : dataService.create('investments', data),
        mode === 'edit' ? 'Actualizado' : 'Compra registrada',
      );
    },
  });
}

// ─── Tabla de compras individuales (compacta, scroll horizontal) ───────────
function purchasesTable(group, livePrice) {
  const currency = group.currency || 'USD';
  const tableWrap = el('div', { class: 'inv-purchases-wrap' });
  const tbl = el('table', { class: 'inv-purchases-tbl' });

  tbl.appendChild(el('thead', {}, [el('tr', {}, [
    el('th', {}, ['Fecha']),
    el('th', { class: 'text-right' }, ['Cant.']),
    el('th', { class: 'text-right' }, ['P. compra']),
    el('th', { class: 'text-right' }, ['Invertido']),
    el('th', { class: 'text-right' }, ['P&L']),
    el('th', {}),
  ])]));

  const tbody = el('tbody');
  group.sorted.forEach((p) => {
    const qty      = Number(p.quantity) || 0;
    const buyPrice = Number(p.purchasePrice || p.avgCost) || 0;
    const costBasis = qty * buyPrice;
    const liveP    = livePrice?.price || 0;
    const pnl      = liveP ? qty * liveP - costBasis : null;
    const pnlPct   = pnl !== null && costBasis ? pnl / costBasis * 100 : null;

    const tr = el('tr', {});
    tr.appendChild(el('td', {}, [p.purchaseDate ? String(p.purchaseDate).slice(0, 10) : '—']));
    tr.appendChild(el('td', { class: 'text-right tabular' }, [qty % 1 === 0 ? String(qty) : qty.toFixed(6).replace(/0+$/, '')]));
    tr.appendChild(el('td', { class: 'text-right tabular' }, [fmtI(buyPrice, currency)]));
    tr.appendChild(el('td', { class: 'text-right tabular' }, [fmtI(costBasis, currency)]));

    const pnlTd = el('td', { class: `text-right tabular ${pnl === null ? '' : pnl >= 0 ? 'text-positive' : 'text-negative'}` });
    if (pnl === null) {
      pnlTd.textContent = '—';
    } else {
      const sign = pnl >= 0 ? '+' : '';
      pnlTd.append(
        el('span', { text: pnlPct !== null ? `${sign}${pnlPct.toFixed(1)}%` : '' }),
        el('br'),
        el('span', { class: 't-caption', text: `${sign}${fmtI(Math.abs(pnl), currency)}` }),
      );
    }
    tr.appendChild(pnlTd);

    const actionsTd = el('td', { class: 'inv-purchases-actions' });
    actionsTd.appendChild(el('button', { class: 'icon-btn', title: 'Editar',
      on: { click: () => openPurchaseModal({ inv: p }) }, html: icon('edit') }));
    actionsTd.appendChild(el('button', { class: 'icon-btn icon-btn--danger', title: 'Eliminar',
      on: { click: () => confirmDialog({ title: 'Eliminar compra', message: `¿Eliminar compra del ${p.purchaseDate}?`,
        onConfirm: () => guardedOp(() => dataService.remove('investments', p.id), 'Eliminado')
      }) }, html: icon('trash') }));
    tr.appendChild(actionsTd);
    tbody.appendChild(tr);
  });
  tbl.appendChild(tbody);
  tableWrap.appendChild(tbl);
  return tableWrap;
}

// ─── Card de posición agrupada ─────────────────────────────────────────────
function positionCard(group, livePrice, fxRates, baseCur) {
  const { key, symbol, name, assetType, totalQty, totalCost, weightedAvg, currency, purchases, totalCommission, withholdingRate } = group;
  const { value: nativeValue, hasPrice } = groupValue(group, { [(symbol || '').toUpperCase()]: livePrice });
  const gain    = hasPrice && nativeValue !== null ? nativeValue - totalCost : null;
  const gainPct = gain !== null && totalCost ? gain / totalCost * 100 : null;

  let expanded = false;
  const toggleWrap = el('div');

  function renderPurchases() {
    toggleWrap.replaceChildren();
    if (!expanded || isTrivial(assetType)) return;
    toggleWrap.appendChild(purchasesTable(group, livePrice));
  }

  const isOpen = _expandedPos.has(key);
  const card = el('div', { class: `inv-card${isOpen ? ' is-open' : ''}` });

  // ── Header ── (en móvil es el disparador de expansión: muestra/oculta el cuerpo)
  const head = el('div', {
    class: 'inv-card__head',
    role: 'button', tabindex: '0',
    'aria-expanded': String(isOpen),
    on: {
      click: (e) => {
        if (!window.matchMedia('(max-width: 920px)').matches) return; // desktop: siempre abierto
        if (e.target.closest('button, a')) return;
        if (_expandedPos.has(key)) _expandedPos.delete(key); else _expandedPos.add(key);
        card.classList.toggle('is-open');
        head.setAttribute('aria-expanded', String(card.classList.contains('is-open')));
      },
      keydown: (e) => { if ((e.key === 'Enter' || e.key === ' ') && window.matchMedia('(max-width: 920px)').matches) { e.preventDefault(); head.click(); } },
    },
  });
  const titleWrap = el('div', { class: 'inv-card__title-wrap' });
  if (symbol) titleWrap.appendChild(el('span', { class: 'inv-card__ticker' }, [symbol]));
  titleWrap.appendChild(el('span', { class: 'inv-card__name' }, [name || symbol || '—']));
  titleWrap.appendChild(Badge(typeLabel(assetType), 'info'));
  if (currency && currency !== baseCur) titleWrap.appendChild(Badge(currency, ''));
  if (withholdingRate > 0) titleWrap.appendChild(Badge(`Ret. ${withholdingRate}%`, 'warning'));
  head.appendChild(titleWrap);

  const valWrap = el('div', { class: 'inv-card__value-wrap' });
  if (hasPrice && nativeValue !== null) {
    valWrap.appendChild(el('div', { class: 'inv-card__value tabular' }, [fmtI(nativeValue, currency)]));
    if (gain !== null) {
      const isPos = gain >= 0;
      valWrap.appendChild(el('div', { class: `inv-card__gain ${isPos ? 'text-positive' : 'text-negative'}` },
        [`${isPos ? '+' : ''}${fmtI(Math.abs(gain), currency)}  ${pctFmt(gainPct)}`]));
    }
    if (livePrice?.changePct !== undefined) {
      valWrap.appendChild(el('div', { class: `t-caption ${livePrice.changePct >= 0 ? 'text-positive' : 'text-negative'}` },
        [`Hoy: ${pctFmt(livePrice.changePct)}`]));
    }
  } else {
    valWrap.appendChild(el('div', { class: 'inv-card__value tabular text-secondary' }, ['— sin precio —']));
    valWrap.appendChild(el('div', { class: 't-caption text-tertiary' }, ['Pulsa "Actualizar precios"']));
  }
  head.appendChild(valWrap);
  // Chevron indicador de expansión (solo visible en móvil vía CSS).
  head.appendChild(el('span', { class: 'inv-card__chev', html: icon('chevronDown') }));
  card.appendChild(head);

  // ── Cuerpo (métricas + compras + acciones): colapsable en móvil ──
  const body = el('div', { class: 'inv-card__body' });

  // ── Métricas ──
  const metrics = el('div', { class: 'inv-card__metrics' });
  const m = (lbl, val) => {
    const d = el('div', { class: 'inv-metric' });
    d.appendChild(el('span', { class: 'inv-metric__label' }, [lbl]));
    d.appendChild(el('span', { class: 'inv-metric__value tabular' }, [val]));
    return d;
  };

  if (!isTrivial(assetType)) {
    metrics.appendChild(m('Shares totales', totalQty % 1 === 0 ? String(totalQty) : totalQty.toFixed(6).replace(/0+$/, '')));
    metrics.appendChild(m('Cost basis (avg)', fmtI(weightedAvg, currency)));
    if (hasPrice && livePrice?.price) metrics.appendChild(m('Precio actual', fmtI(livePrice.price, currency)));
    if (purchases.length > 1) metrics.appendChild(m('Compras (DCA)', `${purchases.length} ops.`));
  }
  metrics.appendChild(m('Total invertido', fmtI(totalCost, currency)));
  if (totalCommission > 0) metrics.appendChild(m('Comisiones', fmtI(totalCommission, currency)));
  if (withholdingRate > 0) metrics.appendChild(m('Retención fuente', `${withholdingRate}%`));
  if (hasPrice && nativeValue !== null) {
    const copVal = toCOP(nativeValue, currency, fxRates);
    if (copVal !== null && currency !== 'COP') metrics.appendChild(m('≈ en COP', formatMoney(copVal, 'COP')));
  }
  if (assetType === 'cdt') {
    const p0 = purchases[0];
    if (p0?.interestRate) metrics.appendChild(m('Tasa E.A.', `${p0.interestRate}%`));
    if (p0?.maturityDate) metrics.appendChild(m('Vencimiento', p0.maturityDate));
  }
  body.appendChild(metrics);
  body.appendChild(toggleWrap);

  // ── Acciones ──
  const actions = el('div', { class: 'inv-card__actions' });
  if (!isTrivial(assetType)) {
    const n = purchases.length;
    const toggleBtn = Button(`Ver ${n} compra${n > 1 ? 's' : ''}`, { variant: 'ghost', size: 'sm',
      onClick: () => {
        expanded = !expanded;
        toggleBtn.textContent = expanded ? 'Ocultar compras' : `Ver ${n} compra${n > 1 ? 's' : ''}`;
        renderPurchases();
      },
    });
    actions.appendChild(toggleBtn);
    actions.appendChild(Button('+ Compra', { variant: 'outline', size: 'sm',
      onClick: () => openPurchaseModal({ defaultSymbol: symbol || '', defaultType: assetType, defaultName: name || '', defaultCurrency: currency || '' }) }));
    if (totalQty > 0) {
      actions.appendChild(Button('Vender', { variant: 'outline', size: 'sm',
        onClick: () => openSellModal(group, livePrice) }));
    }
    actions.appendChild(Button('Dividendo', { variant: 'ghost', size: 'sm',
      onClick: () => openDividendModal(group) }));
  }
  if (assetType === 'fund') {
    actions.appendChild(Button('Actualizar valor', { variant: 'outline', size: 'sm',
      onClick: () => openPurchaseModal({ inv: purchases[0] }) }));
  }
  // CDT/fondos se liquidan (no se venden por precio×cantidad): Redimir / Rescatar.
  if (isTrivial(assetType) && totalQty > 0) {
    actions.appendChild(Button(assetType === 'cdt' ? 'Redimir' : 'Rescatar', { variant: 'outline', size: 'sm',
      onClick: () => openRedeemModal(group, livePrice) }));
  }
  body.appendChild(actions);
  card.appendChild(body);
  renderPurchases();
  return card;
}

// ─── Modal de liquidación: Redimir CDT / Rescatar fondo ──────────────────────
// CDT/fondos no se "venden" por precio×cantidad (modelo isTrivial: quantity=1,
// el monto vive en purchasePrice). Se liquidan a un monto recibido: marca cada
// lote como cerrado (soldDate) con soldPrice = monto/quantity (precio unitario,
// para que selectors.lotRealizedPnL — que hace soldQuantity×soldPrice — calcule
// el P&L correcto independientemente de la convención de quantity).
function openRedeemModal(group, livePrice) {
  const { assetType, symbol, name, currency, purchases, totalCost } = group;
  const esCdt = assetType === 'cdt';
  // Valor sugerido: CDT capitalizado a hoy; fondo a su valor actual registrado.
  const { value: sugerido } = groupValue(group, { [(symbol || '').toUpperCase()]: livePrice });
  const valorSugerido = sugerido !== null ? Math.round(sugerido) : totalCost;

  const amountEl = numberInput({ name: 'amount', value: valorSugerido || '', placeholder: 'Monto recibido' });
  const dateEl   = textInput({ name: 'date', value: today(), type: 'date' });
  const commEl   = numberInput({ name: 'commission', value: '', placeholder: 'Opcional' });

  const body = el('div', {}, [
    el('p', { class: 't-caption text-secondary', text:
      `${esCdt ? 'Redención del CDT' : 'Rescate del fondo'} "${name || symbol}". Costo invertido: ${fmtI(totalCost, currency)}.` }),
    field(`Monto recibido (${currency})`, amountEl),
    el('div', { class: 'field-row' }, [field('Fecha', dateEl), field(`Comisión / retención (${currency})`, commEl)]),
    el('p', { class: 't-caption text-tertiary', text:
      esCdt ? 'Sugerido = capital capitalizado a hoy. Ajústalo al valor real recibido.'
            : 'Sugerido = valor actual registrado. Ajústalo al valor real rescatado.' }),
  ]);

  openModal({
    title: esCdt ? `Redimir ${name || symbol}` : `Rescatar ${name || symbol}`,
    body,
    submitLabel: esCdt ? 'Registrar redención' : 'Registrar rescate',
    onSubmit: async () => {
      const monto    = Number(amountEl.value) || 0;
      const soldDate = dateEl.value;
      const totalComm = Number(commEl.value) || 0;
      if (monto <= 0)  { focusFieldError(amountEl); return setFieldError(amountEl, 'Ingresa el monto recibido'); }
      if (!soldDate)   { focusFieldError(dateEl);   return setFieldError(dateEl, 'Selecciona una fecha'); }

      // Distribuir el monto y la comisión entre lotes proporcional a su costo
      // (normalmente 1 solo lote en CDT/fondos).
      const costTotal = purchases.reduce((sp, p) =>
        sp + (Number(p.quantity) || 0) * (Number(p.purchasePrice || p.avgCost) || 0), 0) || 1;

      return guardedSave(async () => {
        for (const p of purchases) {
          const qty = Number(p.quantity) || 0;
          const loteCost = qty * (Number(p.purchasePrice || p.avgCost) || 0);
          const share = costTotal ? loteCost / costTotal : (1 / purchases.length);
          const montoLote = monto * share;
          const soldCommission = totalComm * share;
          // soldPrice unitario: lotRealizedPnL multiplica por soldQuantity (=qty).
          const soldPrice = qty > 0 ? montoLote / qty : montoLote;
          await dataService.update('investments', p.id, {
            ...p, soldPrice, soldDate, soldQuantity: qty, soldCommission,
          });
        }
      }, `${esCdt ? 'Redención' : 'Rescate'} de ${name || symbol} registrado`, 'Error al registrar');
    },
  });
}

// ─── Modal de dividendo ───────────────────────────────────────────────────────
// Registra un dividendo como transacción de ingreso en la cuenta del broker.
function openDividendModal(group) {
  const { symbol, name, currency, purchases } = group;
  const s = store.get();
  const accountId = purchases[0]?.accountId || '';
  const accts = (s.accounts || []).filter((a) => !a.isArchived);
  const acctOpts = accts.map((a) => ({ value: a.id, label: a.name }));
  // Buscar o crear categoría "Dividendos"
  const divCat = (s.categories || []).find((c) => /dividend|divid/i.test(c.name || '') && c.kind === 'income');
  const incomeCats = (s.categories || []).filter((c) => c.kind === 'income');
  const catOpts = incomeCats.map((c) => ({ value: c.id, label: c.name }));

  const amountEl = numberInput({ name: 'amount', value: '', placeholder: 'Monto recibido' });
  const dateEl   = textInput({ name: 'date', value: today(), type: 'date' });
  const acctEl   = el('select', { class: 'input', name: 'acct' });
  acctOpts.forEach((o) => acctEl.appendChild(el('option', { value: o.value, text: o.label, selected: o.value === accountId ? true : null })));
  const catEl = el('select', { class: 'input', name: 'cat' });
  catOpts.forEach((o) => catEl.appendChild(el('option', { value: o.value, text: o.label, selected: o.value === divCat?.id ? true : null })));

  const body = el('div', {}, [
    field('Monto del dividendo', amountEl),
    el('div', { class: 'field-row' }, [field('Fecha', dateEl), field('Cuenta de acreditación', acctEl)]),
    catOpts.length ? field('Categoría de ingreso', catEl) : el('p', { class: 't-caption text-secondary', text: 'Crea categorías de tipo "ingreso" para clasificar el dividendo.' }),
  ]);

  openModal({
    title: `Dividendo — ${symbol || name}`,
    body,
    submitLabel: 'Registrar dividendo',
    onSubmit: async () => {
      const amount = Number(amountEl.value) || 0;
      if (amount <= 0) { focusFieldError(amountEl); return setFieldError(amountEl, 'Ingresa el monto del dividendo'); }
      const acctId = acctEl.value;
      if (!acctId) { focusFieldError(acctEl); return setFieldError(acctEl, 'Selecciona una cuenta'); }
      return guardedSave(() => dataService.create('transactions', {
        type: 'income', amount, date: dateEl.value, accountId: acctId,
        categoryId: catEl.value || (incomeCats[0]?.id || ''),
        description: `Dividendo ${symbol || name}`, currency,
      }), 'Dividendo registrado como ingreso');
    },
  });
}

// ─── Render principal ──────────────────────────────────────────────────────
export function renderInvestments() {
  const root = el('div');
  const bodyMount = el('div');
  let refreshing = false;

  // livePrices y fxRates son vistas locales sobre priceService — se actualizan tras el fetch.
  let livePrices = { ...priceService.prices };
  let fxRates    = { ...priceService.fxRates };

  async function refreshPrices() {
    if (refreshing) return;
    const groups = groupByTicker(store.get().investments);
    const tickers = groups.filter((g) => g.symbol && !isTrivial(g.assetType)).map((g) => g.symbol.toUpperCase());
    // BE-003 (TD-02): el backend ya inyecta USDCOP=X/EURCOP=X internamente; seguimos
    // pidiéndolos por si el backend no está actualizado (degradación gradual).
    const all = [...new Set(tickers)];
    refreshing = true; paint(true);
    try {
      const resp = await apiClient.get('getQuotes', { tickers: all.join(',') });

      // BE-003: el backend ahora devuelve { quotes: {...}, fxRates: { USD: rate, EUR: rate } }.
      // Si resp tiene la clave 'quotes' usamos la nueva forma; si no (backend viejo) tratamos
      // todo el objeto como mapa plano de quotes para compatibilidad hacia atrás.
      const quotesMap  = (resp && typeof resp.quotes === 'object') ? resp.quotes  : (resp || {});
      const fxFromBack = (resp && typeof resp.fxRates === 'object') ? resp.fxRates : {};

      Object.entries(quotesMap).forEach(([tk, q]) => {
        if (q && !q.error) livePrices[tk] = q;
      });

      // Construir fxRates: preferir las tasas del backend (campo fxRates) que se
      // basan en el ticker USDCOP=X real; degradar a las que ya teníamos si falta.
      const newFxRates = { ...fxRates }; // conservar tasas previas (offline-first)
      Object.entries(fxFromBack).forEach(([cur, rate]) => { if (rate) newFxRates[cur] = rate; });
      // Fallback legacy: leer de livePrices si el backend no devolvió fxRates
      if (!Object.keys(fxFromBack).length) {
        ['USD', 'EUR', 'GBP', 'BRL'].forEach((c) => { const k = c + 'COP=X'; if (livePrices[k]?.price) newFxRates[c] = livePrices[k].price; });
      }
      fxRates = newFxRates;

      // Persiste en priceService (localStorage + memoria compartida con selectors)
      priceService.update(livePrices, fxRates);
      store.set({ _priceRevision: Date.now() }); // notifica a Dashboard y Patrimonio
      toast('Precios actualizados');
    } catch (e) { toast('Error al actualizar precios: ' + e.message, { type: 'warning' }); }
    finally { refreshing = false; paint(false); }
  }

  function paint(loading = false) {
    const s = store.get();
    const baseCur = s.baseCurrency || 'COP';
    const allGroups = groupByTicker(s.investments);
    // Grupos con posiciones activas (lotes sin vender).
    const activeGroups = allGroups.filter((g) => g.purchases.length > 0);
    // Operaciones de venta: cualquier grupo con lotes vendidos, INCLUYE ventas
    // PARCIALES. Antes exigía purchases.length===0 (ticker 100% liquidado), así
    // que una venta parcial nunca aparecía en "Operaciones cerradas" y su P&L
    // realizado se perdía de la vista y del total.
    const closedGroups = allGroups.filter((g) => g.sold.length > 0);

    if (!allGroups.length) {
      mount(bodyMount, el('div', { class: 'card' }, [EmptyState({
        title: 'Sin inversiones', message: 'Registra tu primera posición.', iconName: 'investments',
        action: Button('Nueva inversión', { variant: 'primary', iconName: 'plus', onClick: () => openPurchaseModal({ defaultType: 'etf' }) }),
      })]));
      return;
    }

    // A.3 (FIN-005/TD-02): grupos en divisa sin tasa FX se EXCLUYEN de los totales
    // (antes caían a suma 1:1 silenciosa → cifras infladas ×~4000 con USD).
    // fxExcludedCount alimenta el aviso de cifras incompletas bajo el resumen.
    let fxExcludedCount = 0;
    const secStats = SECTIONS.map((sec) => {
      const groups = activeGroups.filter((g) => sec.types.includes(g.assetType));
      let totalValue = 0, totalCost = 0;
      groups.forEach((g) => {
        const lp = livePrices[(g.symbol || '').toUpperCase()];
        const { value, cost, hasPrice } = groupValue(g, { [(g.symbol || '').toUpperCase()]: lp });
        // Si no hay precio, usamos el costo como valor (P&L = 0 para esa posición)
        const rawVal = hasPrice && value !== null ? value : cost;
        const v = toCOP(rawVal, g.currency, fxRates);
        const c = toCOP(cost,   g.currency, fxRates);
        if (v === null || c === null) { fxExcludedCount++; return; }
        totalValue += v; totalCost += c;
      });
      // FIN-009 (TD-21): redondear el acumulado de cada sección al cerrarlo, antes de
      // mostrarlo (distribución, head, tabla) y de sumarlo al total. Garantiza que
      // "suma de secciones == total" sin penny drift. Los valores por lote no se tocan.
      totalValue = roundMoney(totalValue, baseCur);
      totalCost  = roundMoney(totalCost,  baseCur);
      const gain = roundMoney(totalValue - totalCost, baseCur);
      return { ...sec, groups, totalValue, totalCost, gain, ret: totalCost ? gain / totalCost * 100 : 0 };
    }).filter((s) => s.groups.length);

    // FIN-009 (TD-21): el total es la suma de las secciones ya redondeadas → reconciliación
    // exacta entre las filas de sección y la fila "Total portafolio" de la tabla resumen.
    const pTotal = roundMoney(secStats.reduce((s, x) => s + x.totalValue, 0), baseCur);
    const cTotal = roundMoney(secStats.reduce((s, x) => s + x.totalCost, 0), baseCur);
    const gTotal = roundMoney(pTotal - cTotal, baseCur);
    const rTotal = cTotal ? gTotal / cTotal * 100 : 0;
    // P&L realizado acumulado de todas las posiciones cerradas (en moneda base).
    // A.3: cerradas en divisa sin tasa FX se excluyen del acumulado (no 1:1).
    const realizedTotal = roundMoney(closedGroups.reduce((sum, g) => {
      const v = toCOP(g.realizedPnL, g.currency, fxRates);
      if (v === null) { fxExcludedCount++; return sum; }
      return sum + v;
    }, 0), baseCur);

    const wrap = el('div', { class: 'stack' });

    // Héroe (R3): valor total + P&L + XIRR — mismas cifras que el resumen
    // (pTotal/cTotal/gTotal calculados arriba; solo cambia la presentación).
    const xirrRate = selectors.portfolioXIRR(s);
    const heroSplit = [
      { label: 'Invertido', value: formatMoney(cTotal, baseCur, { compact: true }) },
      { label: 'P&L', value: `${gTotal >= 0 ? '+' : '−'}${formatMoney(Math.abs(gTotal), baseCur, { compact: true })}`, cls: gTotal >= 0 ? 'text-positive' : 'text-negative' },
      ...(xirrRate !== null ? [{ label: 'XIRR anual', value: pctFmt(xirrRate * 100), cls: xirrRate >= 0 ? 'text-positive' : 'text-negative' }] : []),
      ...(closedGroups.length > 0 ? [{ label: 'P&L realizado', value: `${realizedTotal >= 0 ? '+' : '−'}${formatMoney(Math.abs(realizedTotal), baseCur, { compact: true })}`, cls: realizedTotal >= 0 ? 'text-positive' : 'text-negative' }] : []),
    ];
    wrap.appendChild(HeroCard({
      label: 'Portafolio total',
      iconName: 'investments',
      value: formatMoney(pTotal, baseCur),
      trendRow: [Trend(rTotal), el('span', { class: 't-caption', text: 'retorno total' })],
      split: heroSplit,
    }));

    // Distribución (R3): barra apilada única + filas de detalle (sin barras
    // individuales repetidas — la apilada ya comunica el peso).
    if (pTotal > 0) {
      const DIST_COLORS = { mkt: 'var(--accent)', crypto: 'var(--warning)', fic: 'var(--accent-2)', cdt: 'var(--positive)' };
      const distCard = el('div', { class: 'card card--pad' });
      distCard.appendChild(el('p', { class: 't-caption text-secondary', style: 'margin:0 0 var(--space-3)' }, ['DISTRIBUCIÓN DEL PORTAFOLIO']));
      distCard.appendChild(el('div', { class: 'dash-dist', role: 'img',
        'aria-label': 'Distribución: ' + secStats.map((sec) => `${sec.label} ${(pTotal ? sec.totalValue / pTotal * 100 : 0).toFixed(1)}%`).join(', ') },
        secStats.map((sec) => el('span', {
          style: { width: `${pTotal ? sec.totalValue / pTotal * 100 : 0}%`, background: DIST_COLORS[sec.id] || 'var(--neutral)' },
          title: sec.label,
        }))));
      secStats.forEach((sec) => {
        const w = pTotal ? sec.totalValue / pTotal * 100 : 0;
        distCard.appendChild(el('div', { class: 'row-flex between', style: 'margin-top:var(--space-2)' }, [
          el('span', { class: 't-caption' }, [
            el('span', { class: 'dash-dot', style: `background:${DIST_COLORS[sec.id] || 'var(--neutral)'};display:inline-block;margin-right:8px;vertical-align:middle` }),
            sec.label,
          ]),
          el('span', { class: 'tabular t-caption' }, [
            el('span', { class: sec.ret >= 0 ? 'text-positive' : 'text-negative', text: pctFmt(sec.ret) }),
            el('span', { class: 'text-secondary', text: `  ·  ${formatMoney(sec.totalValue, baseCur)}  ·  ${w.toFixed(1)}%` }),
          ]),
        ]));
      });
      wrap.appendChild(distCard);
    }

    // Secciones con cards (desplegables)
    secStats.forEach((sec) => {
      const isCollapsed = _collapsed.has(sec.id);
      const secEl = el('div', { class: 'section' });

      const head = el('button', {
        class: 'inv-section-head inv-section-head--toggle',
        'aria-expanded': String(!isCollapsed),
        on: { click: () => {
          _collapsed.has(sec.id) ? _collapsed.delete(sec.id) : _collapsed.add(sec.id);
          _saveCollapsed();
          paint(false);
        }},
      });
      head.appendChild(el('div', { class: 'inv-section-title' }, [
        el('span', { class: 't-h2', text: sec.label }),
        el('span', { class: `inv-section-ret ${sec.ret >= 0 ? 'text-positive' : 'text-negative'}`, text: pctFmt(sec.ret) }),
      ]));
      head.appendChild(el('div', { class: 'inv-section-head__right' }, [
        el('span', { class: 't-caption text-secondary tabular' },
          [`${formatMoney(sec.totalValue, baseCur)}  ·  ${sec.gain >= 0 ? '+' : ''}${formatMoney(sec.gain, baseCur)}`]),
        el('span', { class: `inv-section-chevron${isCollapsed ? ' is-collapsed' : ''}`, html: icon('chevronDown') }),
      ]));
      secEl.appendChild(head);

      if (!isCollapsed) {
        const grid = el('div', { class: 'inv-cards-grid' });
        sec.groups.forEach((g) => {
          const lp = livePrices[(g.symbol || '').toUpperCase()];
          grid.appendChild(positionCard(g, lp || null, fxRates, baseCur));
        });
        secEl.appendChild(grid);
      }
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
    const tblWrap = el('div', { class: 'inv-summary-wrap' });
    tblWrap.appendChild(tbl);
    summaryCard.appendChild(tblWrap);

    if (Object.keys(fxRates).length) {
      const note = Object.entries(fxRates).map(([c, r]) => `1 ${c} = ${formatMoney(r, 'COP')}`).join('  ·  ');
      summaryCard.appendChild(el('p', { class: 't-caption text-tertiary', style: 'margin:var(--space-3) 0 0' }, [`Tasas: ${note}`]));
    } else {
      summaryCard.appendChild(el('p', { class: 't-caption text-tertiary', style: 'margin:var(--space-3) 0 0' }, [loading ? 'Obteniendo tasas de cambio…' : 'Pulsa "Actualizar precios" para obtener precios y tasas de cambio reales.']));
    }
    // A.3 (FIN-005/TD-02): aviso de cifras incompletas cuando hubo exclusiones por falta de tasa FX.
    if (fxExcludedCount > 0) {
      summaryCard.appendChild(el('p', { class: 't-caption text-negative', style: 'margin:var(--space-2) 0 0' }, [
        `⚠ ${fxExcludedCount} posición${fxExcludedCount > 1 ? 'es' : ''} en divisa extranjera excluida${fxExcludedCount > 1 ? 's' : ''} de los totales por falta de tasa de cambio. Pulsa "Actualizar precios".`,
      ]));
    }
    wrap.appendChild(summaryCard);

    // ── Sección Análisis — alertas determinísticas de portafolio (R4 / I7a) ──
    const alerts = selectors.portfolioAlerts(s);
    const isAnalysisCollapsed = _collapsed.has('analysis');
    const analysisEl = el('div', { class: 'section' });

    const analysisHead = el('button', {
      class: 'inv-section-head inv-section-head--toggle',
      'aria-expanded': String(!isAnalysisCollapsed),
      on: { click: () => {
        _collapsed.has('analysis') ? _collapsed.delete('analysis') : _collapsed.add('analysis');
        _saveCollapsed();
        paint(false);
      }},
    });
    analysisHead.appendChild(el('div', { class: 'inv-section-title' }, [
      el('span', { class: 't-h2', text: 'Análisis del portafolio' }),
      alerts.length > 0
        ? Badge(String(alerts.length), 'warning')
        : Badge('Sin alertas', 'positive'),
    ]));
    analysisHead.appendChild(
      el('span', { class: `inv-section-chevron${isAnalysisCollapsed ? ' is-collapsed' : ''}`, html: icon('chevronDown') })
    );
    analysisEl.appendChild(analysisHead);

    if (!isAnalysisCollapsed) {
      const analysisCard = el('div', { class: 'card card--pad-sm' });
      if (!alerts.length) {
        analysisCard.appendChild(el('p', { class: 't-caption text-secondary', style: 'padding:var(--space-3) 0' },
          ['Portafolio sin alertas activas.']));
      } else {
        const SEVERITY_BADGE = { warning: 'warning', error: 'negative', info: 'info' };
        const alertsList = el('div', { class: 'row-list' });
        alerts.forEach((alert) => {
          const row = el('div', { class: 'row' }, [
            el('div', { class: 'row__main' }, [
              el('div', { class: 'row__title' }, [
                Badge(
                  alert.type === 'concentration' ? 'Concentración'
                  : alert.type === 'maturity'    ? 'Vencimiento'
                  : alert.type === 'loss'        ? 'Pérdida'
                  : 'Diversificación',
                  SEVERITY_BADGE[alert.severity] || 'info'
                ),
                el('span', { style: 'margin-left:var(--space-2)', text: alert.message }),
              ]),
              alert.isApproximate
                ? el('div', { class: 'row__sub t-caption text-tertiary' }, ['Estimado — sin precio en vivo'])
                : null,
            ].filter(Boolean)),
          ]);
          alertsList.appendChild(row);
        });
        analysisCard.appendChild(alertsList);
      }
      if (priceService.fetchedAt) {
        analysisCard.appendChild(el('p', { class: 't-caption text-tertiary', style: 'margin:var(--space-3) 0 0' },
          [priceAgeLabel()]));
      }
      analysisEl.appendChild(analysisCard);
    }
    wrap.appendChild(analysisEl);

    // ── Operaciones cerradas — una fila POR VENTA (no agrupadas por ticker) ────
    // Lista plana de cada lote vendido con su fecha, cantidad y P&L individual.
    const soldLots = closedGroups
      .flatMap((g) => g.sold.map((p) => ({ p, g })))
      .sort((a, b) => String(b.p.soldDate || '').localeCompare(String(a.p.soldDate || '')));

    if (soldLots.length > 0) {
      const isClosedCollapsed = _collapsed.has('closed');
      const closedEl = el('div', { class: 'section' });

      const closedHead = el('button', {
        class: 'inv-section-head inv-section-head--toggle',
        'aria-expanded': String(!isClosedCollapsed),
        on: { click: () => {
          _collapsed.has('closed') ? _collapsed.delete('closed') : _collapsed.add('closed');
          _saveCollapsed();
          paint(false);
        }},
      });
      closedHead.appendChild(el('div', { class: 'inv-section-title' }, [
        el('span', { class: 't-h2', text: 'Operaciones cerradas' }),
        Badge(String(soldLots.length), 'info'),
      ]));
      closedHead.appendChild(
        el('span', { class: `inv-section-chevron${isClosedCollapsed ? ' is-collapsed' : ''}`, html: icon('chevronDown') })
      );
      closedEl.appendChild(closedHead);

      if (!isClosedCollapsed) {
        const closedList = el('div', { class: 'card card--pad-sm' });
        closedList.appendChild(el('div', { class: 'row-list' }, soldLots.map(({ p, g }) => {
          const trivial  = isTrivial(g.assetType);
          // P&L individual del lote (selectors.lotRealizedPnL: comisiones + retención).
          const pnlNative = selectors.lotRealizedPnL(p, g.withholdingRate);
          const pnlBase   = toCOP(pnlNative, g.currency, fxRates);
          const pnl       = pnlBase !== null ? pnlBase : pnlNative;
          const pnlCur    = pnlBase !== null ? baseCur : (g.currency || baseCur);
          // Cost basis del lote vendido para el % (cantidad vendida × precio compra + comisión prorrateada).
          const qtyVend   = Number(p.soldQuantity || p.quantity) || 0;
          const qtyLote   = Number(p.quantity) || qtyVend || 1;
          const buyPrice  = Number(p.purchasePrice || p.avgCost) || 0;
          const costBasis = qtyVend * buyPrice + (Number(p.commission) || 0) * (qtyVend / qtyLote);
          const pctVal    = costBasis ? (pnlNative / costBasis) * 100 : 0;
          const isPos     = pnlNative >= 0;
          const fecha     = p.soldDate ? String(p.soldDate).slice(0, 10) : '';
          const sub = trivial
            ? `${g.assetType === 'cdt' ? 'Redimido' : 'Rescatado'} ${fecha} · recibido ${fmtI(qtyVend * (Number(p.soldPrice) || 0), g.currency)}`
            : `Vendido ${fecha} · ${qtyVend % 1 === 0 ? qtyVend : qtyVend.toFixed(4)} @ ${fmtI(Number(p.soldPrice) || 0, g.currency)}`;
          return el('div', { class: 'row' }, [
            el('div', { class: 'row__avatar', html: icon('investments') }),
            el('div', { class: 'row__main' }, [
              el('div', { class: 'row__title' }, [g.symbol || g.name, ' ', Badge(typeLabel(g.assetType), 'info')]),
              el('div', { class: 'row__sub', text: sub }),
            ]),
            el('div', { class: `row__amount tabular ${isPos ? 'text-positive' : 'text-negative'}` }, [
              `${isPos ? '+' : ''}${formatMoney(pnl, pnlCur)}  ${pctFmt(pctVal)}`,
            ]),
            el('div', { class: 'row__actions' }, [
              el('button', { class: 'icon-btn icon-btn--danger', 'aria-label': 'Eliminar venta', title: 'Eliminar este registro de venta',
                on: { click: () => confirmDialog({ title: 'Eliminar venta',
                  message: `¿Eliminar esta venta de ${g.symbol || g.name} del ${fecha}?`,
                  onConfirm: () => guardedOp(() => dataService.remove('investments', p.id), 'Venta eliminada'),
                }) }, html: icon('trash') }),
            ]),
          ]);
        })));
        closedEl.appendChild(closedList);
      }
      wrap.appendChild(closedEl);
    }

    mount(bodyMount, wrap);
  }

  const headerEl = el('div', { class: 'page-header' });
  function paintHeader() {
    const ageLabel = priceAgeLabel();
    mount(headerEl,
      el('div', { class: 'row-flex between' }, [
        el('div', {}, [
          el('h2', { class: 't-h1', text: 'Inversiones' }),
          el('p', { class: 'page-header__sub' }, [
            'DCA · Cost basis · Multimoneda',
            ageLabel ? el('span', { class: 't-caption text-tertiary', style: 'margin-left:var(--space-3)', text: ageLabel }) : null,
          ].filter(Boolean)),
        ]),
        el('div', { class: 'row-flex', style: 'gap:var(--space-2)' }, [
          Button(refreshing ? 'Actualizando…' : 'Actualizar precios', { variant: 'outline', iconName: 'refresh', onClick: async () => { await refreshPrices(); paintHeader(); } }),
          el('div', { class: 'u-hide-mobile' }, [
            Button('Nueva inversión', { variant: 'primary', iconName: 'plus', onClick: () => openPurchaseModal({ defaultType: 'etf' }) }),
          ]),
        ]),
      ])
    );
  }
  paintHeader();

  root.append(headerEl, bodyMount, Fab('Nueva inversión', { onClick: () => openPurchaseModal({ defaultType: 'etf' }) }));

  // Guard: si bodyMount ya no está en el DOM (render anterior), ignorar cambios del store.
  store.subscribe(() => { if (bodyMount.isConnected) paint(); });
  paint();
  // Auto-refresh si el servicio de precios está desactualizado
  if (priceService.isStale) refreshPrices();
  return root;
}
