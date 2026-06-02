// utils/format.js — formato de moneda, números y fechas (ISO 8601 in).

const DEFAULT_CURRENCY = 'COP';
const DEFAULT_LOCALE = 'es-CO';

// TD-21: decimales canónicos por divisa (0 para monedas sin centavos, 2 para la mayoría).
const CURRENCY_DECIMALS = {
  COP: 0, CLP: 0, JPY: 0, KRW: 0, VND: 0, IDR: 0,
  USD: 2, EUR: 2, GBP: 2, ARS: 2, MXN: 2, BRL: 2, CAD: 2, CHF: 2, AUD: 2,
  BTC: 8, ETH: 6, USDT: 2, USDC: 2,
};

// TD-21: decimales por defecto según la divisa (admite override explícito).
function defaultDecimals(currency) {
  return CURRENCY_DECIMALS[currency?.toUpperCase()] ?? 2;
}

export function formatMoney(amount, currency = DEFAULT_CURRENCY, opts = {}) {
  const value = Number(amount) || 0;
  const { compact = false, signed = false, decimals } = opts;
  const frac = decimals !== undefined ? decimals : compact ? 1 : defaultDecimals(currency);
  const nf = new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: 'currency',
    currency,
    minimumFractionDigits: frac,
    maximumFractionDigits: frac,
    notation: compact ? 'compact' : 'standard',
  });
  const formatted = nf.format(Math.abs(value));
  if (signed && value !== 0) return (value > 0 ? '+' : '−') + formatted;
  return value < 0 ? '−' + formatted : formatted;
}

// TD-22: redondeo controlado al número de decimales canónicos de la divisa.
// Úsalo al final de una cadena de cálculos para evitar acumulación de error float.
export function roundMoney(amount, currency = DEFAULT_CURRENCY) {
  const decimals = defaultDecimals(currency);
  const factor = Math.pow(10, decimals);
  return Math.round((Number(amount) || 0) * factor) / factor;
}

export function formatNumber(n, opts = {}) {
  return new Intl.NumberFormat(DEFAULT_LOCALE, opts).format(Number(n) || 0);
}

export function formatPercent(n, digits = 1) {
  const v = Number(n) || 0;
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: 'percent',
    maximumFractionDigits: digits,
    signDisplay: 'exceptZero',
  }).format(v / 100);
}

export function formatDate(iso, style = 'medium') {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const opts = style === 'short'
    ? { day: '2-digit', month: 'short' }
    : style === 'long'
      ? { day: 'numeric', month: 'long', year: 'numeric' }
      : { day: '2-digit', month: 'short', year: 'numeric' };
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, opts).format(d);
}

export function relativeDay(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  const diff = Math.round((d.setHours(0,0,0,0) - today.setHours(0,0,0,0)) / 86400000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Mañana';
  if (diff === -1) return 'Ayer';
  if (diff > 1 && diff <= 7) return `En ${diff} días`;
  if (diff < -1 && diff >= -7) return `Hace ${Math.abs(diff)} días`;
  return formatDate(iso, 'short');
}

export const DEFAULTS = { currency: DEFAULT_CURRENCY, locale: DEFAULT_LOCALE };
