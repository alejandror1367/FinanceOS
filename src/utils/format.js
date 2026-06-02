// utils/format.js — formato de moneda, números y fechas (ISO 8601 in).

const DEFAULT_CURRENCY = 'COP';
const DEFAULT_LOCALE = 'es-CO';

export function formatMoney(amount, currency = DEFAULT_CURRENCY, opts = {}) {
  const value = Number(amount) || 0;
  const { compact = false, signed = false, decimals } = opts;
  const maxFrac = decimals !== undefined ? decimals : compact ? 1 : 0;
  const nf = new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals !== undefined ? decimals : 0,
    maximumFractionDigits: maxFrac,
    notation: compact ? 'compact' : 'standard',
  });
  const formatted = nf.format(Math.abs(value));
  if (signed && value !== 0) return (value > 0 ? '+' : '−') + formatted;
  return value < 0 ? '−' + formatted : formatted;
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
