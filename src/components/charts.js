// components/charts.js — gráficos SVG ligeros (sin dependencias).
// LineChart (multi-serie), Donut y Legend. Usan tokens semánticos de color.

import { el, esc } from '../utils/dom.js';

export const CHART_PALETTE = [
  'var(--accent)', 'var(--positive)', 'var(--accent-2)', 'var(--gold)',
  'var(--warning)', 'var(--negative)', 'var(--neutral)',
];

// FE-011/TD-07: tabla accesible (sr-only) para lectores de pantalla — LineChart
function buildLineSrTable(labels, series, fmt) {
  const table = el('table', { class: 'sr-only' });
  const thead = el('thead');
  const hRow  = el('tr');
  hRow.appendChild(el('th', { scope: 'col' }, ['Período']));
  series.forEach((s) => hRow.appendChild(el('th', { scope: 'col' }, [s.name])));
  thead.appendChild(hRow);
  table.appendChild(thead);
  const tbody = el('tbody');
  labels.forEach((label, i) => {
    const row = el('tr');
    row.appendChild(el('th', { scope: 'row' }, [label]));
    series.forEach((s) => row.appendChild(el('td', {}, [fmt(s.points[i] ?? 0)])));
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  return table;
}

// FE-011/TD-07: tabla accesible (sr-only) para lectores de pantalla — Donut
function buildDonutSrTable(segments, total, fmt) {
  const table = el('table', { class: 'sr-only' });
  const thead = el('thead');
  const hRow  = el('tr');
  ['Categoría', 'Valor', 'Porcentaje'].forEach((h) => hRow.appendChild(el('th', { scope: 'col' }, [h])));
  thead.appendChild(hRow);
  table.appendChild(thead);
  const tbody = el('tbody');
  segments.forEach((s) => {
    const row = el('tr');
    row.appendChild(el('th', { scope: 'row' }, [s.label]));
    row.appendChild(el('td', {}, [fmt(s.value || 0)]));
    row.appendChild(el('td', {}, [((s.value || 0) / total * 100).toFixed(1) + '%']));
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  return table;
}

// series: [{ name, color, points: number[] }]. labels: string[].
// opts: showValues (etiqueta el valor en cada punto), valueFormat(v)->string, ariaLabel (texto alternativo WCAG 1.1.1).
export function LineChart({ labels = [], series = [], height = 210, showValues = true, valueFormat, ariaLabel } = {}) {
  const W = 640, H = height;
  const n = labels.length;
  const fmt = valueFormat || ((v) => String(Math.round(v)));

  // FE-005/TD-40: decimación y rotación adaptativa de labels del eje X.
  // Con n > 6 se rotan para evitar solapamiento; con n > 8 además se deciman.
  const MAX_X_LABELS = 8;
  const step = Math.max(1, Math.ceil(n / MAX_X_LABELS));
  const rotateLabels = n > 6;
  const padL = 12, padR = 12, padT = 26;
  const padB = rotateLabels ? 44 : 26; // espacio extra para labels rotadas

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
    const dots = s.points.map((v, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="4" fill="${s.color}" style="cursor:default"><title>${esc(labels[i])}: ${fmt(v)}</title></circle>`).join('');
    let valueLabels = '';
    if (showValues) {
      // Serie 0 etiqueta encima del punto; series siguientes, debajo (evita choque).
      const dy = si === 0 ? -9 : 16;
      valueLabels = s.points.map((v, i) =>
        `<text x="${x(i).toFixed(1)}" y="${(y(v) + dy).toFixed(1)}" text-anchor="${anchor(i)}" font-size="11" font-weight="600" fill="${s.color}">${fmt(v)}</text>`).join('');
    }
    return `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>${dots}${valueLabels}`;
  }).join('');

  // Labels del eje X: decimar cuando step > 1, rotar cuando n > 6
  const xlabels = labels.map((l, i) => {
    if (step > 1 && i % step !== 0 && i !== n - 1) return ''; // decimar (siempre pintar el último)
    const xp = x(i).toFixed(1);
    if (rotateLabels) {
      const yp = (H - 10).toFixed(1);
      return `<text x="${xp}" y="${yp}" text-anchor="end" font-size="11" fill="var(--text-tertiary)" transform="rotate(-35 ${xp} ${yp})">${esc(l)}</text>`;
    }
    return `<text x="${xp}" y="${(H - 7).toFixed(1)}" text-anchor="${anchor(i)}" font-size="11" fill="var(--text-tertiary)">${esc(l)}</text>`;
  }).join('');

  const a11yLabel = ariaLabel || (series[0] ? series[0].name : 'Gráfico de líneas');
  const svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(a11yLabel)}" style="height:auto;display:block"><title>${esc(a11yLabel)}</title>${grid}${zeroLine}${paths}${xlabels}</svg>`;
  const wrapper = el('div', { class: 'chart', html: svg });
  wrapper.appendChild(buildLineSrTable(labels, series, fmt));
  return wrapper;
}

// segments: [{ label, value, color }]
export function Donut(segments = [], { size = 168, centerTop = '', centerSub = '', ariaLabel, valueFormat } = {}) {
  const total = segments.reduce((a, s) => a + (s.value || 0), 0) || 1;
  const fmt = valueFormat || ((v) => String(Math.round(v)));
  const r = 56, cx = 84, cy = 84;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  // Cada segmento es un <circle> completo cuyo dash deja visible solo su arco. Como el
  // pointer-events por defecto solo cuenta el trazo pintado, el <title> se muestra al
  // pasar sobre el arco visible de ese segmento (tooltip nativo por porción).
  const arcs = segments.map((s) => {
    const frac = (s.value || 0) / total;
    const len = frac * circ;
    const pct = (frac * 100).toFixed(1);
    const seg = `<circle r="${r}" cx="${cx}" cy="${cy}" fill="none" stroke="${s.color}" stroke-width="20" stroke-dasharray="${len.toFixed(2)} ${(circ - len).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})" style="cursor:default"><title>${esc(s.label)}: ${fmt(s.value || 0)} · ${pct}%</title></circle>`;
    offset += len;
    return seg;
  }).join('');
  const center = `<text x="${cx}" y="${cy - 2}" text-anchor="middle" font-size="16" font-weight="700" fill="var(--text-primary)">${centerTop}</text>` +
    (centerSub ? `<text x="${cx}" y="${cy + 16}" text-anchor="middle" font-size="11" fill="var(--text-secondary)">${centerSub}</text>` : '');
  const a11yLabel = ariaLabel || (segments.length ? 'Distribución: ' + segments.map((s) => s.label).join(', ') : 'Gráfico donut');
  const svg = `<svg viewBox="0 0 168 168" width="${size}" height="${size}" role="img" aria-label="${esc(a11yLabel)}"><title>${esc(a11yLabel)}</title>${arcs}${center}</svg>`;
  const wrapper = el('div', { class: 'donut', html: svg });
  wrapper.appendChild(buildDonutSrTable(segments, total, fmt));
  return wrapper;
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
