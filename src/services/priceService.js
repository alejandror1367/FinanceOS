// services/priceService.js — Registro global de precios en vivo.
// Compartido entre investments.js (escritura) y selectors.js (lectura)
// sin pasar por el store, evitando ciclos de re-render.

const PRICE_TTL   = 15 * 60_000;
const LS_PRICES   = 'financeOS:inv:prices';
const LS_FX       = 'financeOS:inv:fx';
const LS_FETCH_AT = 'financeOS:inv:fetchAt';

let _prices    = {};
let _fxRates   = {};
let _fetchedAt = 0;

try {
  const ts = Number(localStorage.getItem(LS_FETCH_AT) || 0);
  if (ts) {
    _prices    = JSON.parse(localStorage.getItem(LS_PRICES) || '{}');
    _fxRates   = JSON.parse(localStorage.getItem(LS_FX)     || '{}');
    _fetchedAt = ts; // isStale derivado de ts; backgroundRefreshPrices corre si stale
  }
} catch (_) {}

export const priceService = {
  get prices()    { return _prices; },
  get fxRates()   { return _fxRates; },
  get fetchedAt() { return _fetchedAt; },
  get isStale()   { return !_fetchedAt || Date.now() - _fetchedAt > PRICE_TTL; },

  priceFor(symbol) {
    return _prices[(symbol || '').toUpperCase()] || null;
  },

  update(newPrices, newFxRates) {
    Object.assign(_prices, newPrices);
    _fxRates   = { ...newFxRates };
    _fetchedAt = Date.now();
    try {
      localStorage.setItem(LS_FETCH_AT, String(_fetchedAt));
      localStorage.setItem(LS_PRICES,   JSON.stringify(_prices));
      localStorage.setItem(LS_FX,       JSON.stringify(_fxRates));
    } catch (_) {}
  },
};
