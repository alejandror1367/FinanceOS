// components/charts.js — gráficos SVG ligeros (sin dependencias).
// LineChart (multi-serie), Donut y Legend. Usan tokens semánticos de color.

import { el } from '../utils/dom.js';

export const CHART_PALETTE = [
  'var(--accent)', 'var(--positive)', 'var(--gold)', 'var(--info)',
  'var(--warning)', 'var(--negative)', 'var(--periwinkle-300)', 'var(--neutral)',
];

// series: [{ name, color, points: number[] }]. labels: string[].
// opts: showValues (etiqueta el valor en cada punto), valueFormat(v)->string, ariaLabel (texto alternativo WCAG 1.1.1).
export function LineChart({ labels = [], series = [], height = 210, showValues = true, valueFormat, ariaLabel } = {}) {
  const W = 640, H = height;
  const padL = 12, padR = 12, padT = 26, padB = 26;
  const n = labels.length;
  const fmt = valueFormat || ((v) => String(Math.round(v)));
  const all = series.flatMap((s) => s.points);
  const max = Math.max(1, ...all);
  const min = Math.min(0, ...all);
  const range = (max - min) || 1;
  const x = (i) => padL + (n <= 1 ? (W - padL - padR) / 2 : (i / (n - 1)) * (W - padL - padR));
  const y = (v) => padT + (1 - (v - min) / range) * (H - padT - padB);
  const anchor = (i) => (i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle');

  // Línea de referencia en cero si hay valores negativos.
  const grid = [0, 0.5, 1].map((f) => {
    const gy = padT + f * (H - padT - padB);
    return `<line x1="${padL}" y1="${gy.toFixed(1)}" x2="${W - padR}" y2="${gy.toFixed(1)}" stroke="var(--border-subtle)" stroke-width="1"/>`;
  }).join('');
  const zeroLine = (min < 0)
    ? `<line x1="${padL}" y1="${y(0).toFixed(1)}" x2="${W - padR}" y2="${y(0).toFixed(1)}" stroke="var(--border-strong)" stroke-width="1" stroke-dasharray="3 3"/>`
    : '';

  const paths = series.map((s, si) => {
    const pts = s.points.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    const dots = s.points.map((v, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="4" fill="${s.color}" style="cursor:default"><title>${labels[i]}: ${fmt(v)}</title></circle>`).join('');
    let valueLabels = '';
    if (showValues) {
      // Serie 0 etiqueta encima del punto; series siguientes, debajo (evita choque).
      const dy = si === 0 ? -9 : 16;
      valueLabels = s.points.map((v, i) =>
        `<text x="${x(i).toFixed(1)}" y="${(y(v) + dy).toFixed(1)}" text-anchor="${anchor(i)}" font-size="11" font-weight="600" fill="${s.color}">${fmt(v)}</text>`).join('');
    }
    return `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>${dots}${valueLabels}`;
  }).join('');

  const xlabels = labels.map((l, i) =>
    `<text x="${x(i).toFixed(1)}" y="${H - 7}" text-anchor="${anchor(i)}" font-size="11" fill="var(--text-tertiary)">${l}</text>`).join('');

  const a11yLabel = ariaLabel || (series[0] ? series[0].name : 'Gráfico de líneas');
  const svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${a11yLabel}" style="height:auto;display:block"><title>${a11yLabel}</title>${grid}${zeroLine}${paths}${xlabels}</svg>`;
  return el('div', { class: 'chart', html: svg });
}

// segments: [{ label, value, color }]
export function Donut(segments = [], { size = 168, centerTop = '', centerSub = '', ariaLabel } = {}) {
  const total = segments.reduce((a, s) => a + (s.value || 0), 0) || 1;
  const r = 56, cx = 84, cy = 84;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const arcs = segments.map((s) => {
    const frac = (s.value || 0) / total;
    const len = frac * circ;
    const seg = `<circle r="${r}" cx="${cx}" cy="${cy}" fill="none" stroke="${s.color}" stroke-width="20" stroke-dasharray="${len.toFixed(2)} ${(circ - len).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"/>`;
    offset += len;
    return seg;
  }).join('');
  const center = `<text x="${cx}" y="${cy - 2}" text-anchor="middle" font-size="16" font-weight="700" fill="var(--text-primary)">${centerTop}</text>` +
    (centerSub ? `<text x="${cx}" y="${cy + 16}" text-anchor="middle" font-size="11" fill="var(--text-secondary)">${centerSub}</text>` : '');
  const a11yLabel = ariaLabel || (segments.length ? 'Distribución: ' + segments.map((s) => s.label).join(', ') : 'Gráfico donut');
  const svg = `<svg viewBox="0 0 168 168" width="${size}" height="${size}" role="img" aria-label="${a11yLabel}"><title>${a11yLabel}</title>${arcs}${center}</svg>`;
  return el('div', { class: 'donut', html: svg });
}

// items: [{ label, color, value }]
export function Legend(items = []) {
  return el('div', { class: 'legend' }, items.map((it) =>
    el('div', { class: 'legend__item' }, [
      el('span', { class: 'legend__dot', style: { background: it.color } }),
      el('span', { class: 'legend__label', text: it.label }),
      it.value != null ? el('span', { class: 'legend__val tabular', text: it.value }) : null,
    ].filter(Boolean))));
}
