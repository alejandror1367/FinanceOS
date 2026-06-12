// components/ui.js — componentes base reutilizables del design system.
// Sin estado de dominio: reciben datos y devuelven nodos.

import { el } from '../utils/dom.js';
import { icon } from '../utils/icons.js';

export function Card({ title, action, body, padSm = false } = {}) {
  const head = (title || action)
    ? el('div', { class: 'card__head' }, [
        title ? el('h3', { class: 'card__title', text: title }) : null,
        action || null,
      ])
    : null;
  return el('section', { class: `card${padSm ? ' card--pad-sm' : ''}` }, [head, body].filter(Boolean));
}

export function KpiCard({ label, value, iconName, variant = '', foot, hero = false, details } = {}) {
  const classes = ['kpi'];
  if (hero) classes.push('kpi--hero');
  if (variant) classes.push('kpi--' + variant);
  const detailsEl = details?.length
    ? el('details', { class: 'kpi__details' }, [
        el('summary', { class: 'kpi__dtrig' }, [
          el('span', { text: 'Detalle' }),
          el('span', { class: 'kpi__dchev', html: icon('chevronDown') }),
        ]),
        el('ul', { class: 'kpi__dlist' },
          details.map((r) => el('li', { class: 'kpi__drow' }, [
            el('span', { class: 'kpi__dlabel', text: r.label }),
            el('span', { class: 'kpi__dvalue tabular', text: r.value }),
          ]))
        ),
      ])
    : null;
  return el('article', { class: classes.join(' ') }, [
    el('div', { class: 'kpi__top' }, [
      el('span', { class: 'kpi__label', text: label }),
      iconName ? el('span', { class: 'kpi__icon', html: icon(iconName) }) : null,
    ]),
    el('div', { class: `kpi__value tabular${hero ? ' kpi__value--hero' : ''}`, text: value }),
    foot ? el('div', { class: 'kpi__foot' }, foot) : null,
    detailsEl,
  ]);
}

export function Badge(text, variant = '') {
  return el('span', { class: `badge ${variant ? 'badge--' + variant : ''}`, text });
}

export function Trend(pct, { invert = false } = {}) {
  const up = pct >= 0;
  const good = invert ? !up : up;
  const cls = good ? 'trend--up' : 'trend--down';
  const sign = up ? '+' : '−';
  return el('span', { class: `trend ${cls}` }, [
    el('span', { class: 'tabular', html: icon(up ? 'arrowUp' : 'arrowDown') }),
    el('span', { class: 'tabular', text: `${sign}${Math.abs(pct).toFixed(1)}%` }),
  ]);
}

export function Button(label, { variant = 'ghost', size, iconName, onClick, iconOnly = false, ariaLabel } = {}) {
  return el('button', {
    class: `btn btn--${variant}${size ? ' btn--' + size : ''}${iconOnly ? ' btn--icon' : ''}`,
    type: 'button',
    'aria-label': ariaLabel || (iconOnly ? label : null),
    on: onClick ? { click: onClick } : {},
  }, [
    iconName ? el('span', { html: icon(iconName) }) : null,
    iconOnly ? null : el('span', { text: label }),
  ].filter(Boolean));
}

export function EmptyState({ title, message, iconName = 'bolt', action } = {}) {
  return el('div', { class: 'empty' }, [
    el('div', { class: 'empty__icon', html: icon(iconName) }),
    el('div', { class: 'empty__title', text: title }),
    message ? el('p', { class: 't-caption', text: message }) : null,
    action || null,
  ].filter(Boolean));
}

export function SkeletonKpis(n = 4) {
  return el('div', { class: 'grid grid--kpi' },
    Array.from({ length: n }, () => el('div', { class: 'skeleton skeleton--kpi' })));
}

// Mini gráfico de barras (sin librerías). data: [{label, value, muted?}].
// valueFormat(v)->string formatea el valor visible sobre cada barra y en el tooltip nativo.
export function BarChart(data = [], { ariaLabel, valueFormat } = {}) {
  const fmt = valueFormat || ((v) => String(Math.round(v)));
  const max = Math.max(1, ...data.map((d) => d.value));
  const a11yLabel = ariaLabel || (data.length ? 'Evolución: ' + data.map((d) => `${d.label} ${fmt(d.value)}`).join(', ') : 'Gráfico de barras');
  return el('div', { class: 'bars', role: 'img', 'aria-label': a11yLabel },
    data.map((d) => el('div', { class: 'bars__col' }, [
      el('span', { class: 'bars__val', text: fmt(d.value) }),
      el('div', {
        class: `bars__bar${d.muted ? ' bars__bar--muted' : ''}`,
        style: { height: `${Math.max(4, (d.value / max) * 100)}%` },
        title: `${d.label}: ${fmt(d.value)}`,
      }),
      el('span', { class: 'bars__label', text: d.label }),
    ])));
}

// ============================================================
// Componentes fintech compartidos (rediseño DOSSIER_UI_UX_FINTECH)
// Extraídos del Dashboard (R0.1) para reuso en todas las vistas.
// Estilos en components.css, sección "Dashboard rediseño fintech"
// (las clases .dash-* son del design system compartido, no
// exclusivas del Dashboard).
// ============================================================

// Sparkline SVG inline (sin librerías). values: number[].
export function sparklineSvg(values, w = 170, h = 52, gradId = 'spark-fill') {
  if (!values || values.length < 2) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * w,
    h - 5 - ((v - min) / range) * (h - 12),
  ]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  return `
    <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
          <stop stop-color="currentColor" stop-opacity="0.30"/>
          <stop offset="1" stop-color="currentColor" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="${d}" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
      <path d="${d} L ${w} ${h} L 0 ${h} Z" fill="url(#${gradId})"/>
    </svg>`;
}

// Anillo de progreso/score 0–100 — gauge circular SVG con cifra al centro.
// variant: positive | info | warning | negative (color del trazo).
export function ScoreRing(score, variant = 'info', { ariaLabel } = {}) {
  const r = 34; const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, score));
  const off = c * (1 - clamped / 100);
  return el('div', { class: `dash-gauge dash-gauge--${variant}`, role: 'img',
    'aria-label': ariaLabel || `${Math.round(clamped)} de 100` }, [
    el('div', { html: `
      <svg width="80" height="80" viewBox="0 0 80 80" aria-hidden="true">
        <circle cx="40" cy="40" r="${r}" stroke="var(--border)" stroke-width="7" fill="none"/>
        <circle cx="40" cy="40" r="${r}" stroke="currentColor" stroke-width="7" fill="none"
          stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"
          stroke-linecap="round" transform="rotate(-90 40 40)"/>
      </svg>` }),
    el('div', { class: 'dash-gauge__num tabular', text: String(Math.round(score)) }),
  ]);
}

// Fila compacta de alta densidad (posiciones, deudas, cuentas, insights…).
// avatar: html string · sub/right/rightSub: nodo, string o array de nodos.
export function MiniRow({ avatar, avatarClass = '', title, sub, right, rightSub }) {
  return el('div', { class: 'dash-mini' }, [
    avatar ? el('div', { class: `dash-mini__avatar ${avatarClass}`, html: avatar }) : null,
    el('div', { class: 'dash-mini__main' }, [
      el('div', { class: 'dash-mini__title', text: title }),
      sub ? el('div', { class: 'dash-mini__sub' }, Array.isArray(sub) ? sub : [sub]) : null,
    ]),
    (right || rightSub) ? el('div', { class: 'dash-mini__right' }, [
      right ? el('div', { class: 'dash-mini__val tabular' }, Array.isArray(right) ? right : [right]) : null,
      rightSub ? el('div', { class: 'dash-mini__valsub' }, Array.isArray(rightSub) ? rightSub : [rightSub]) : null,
    ].filter(Boolean)) : null,
  ].filter(Boolean));
}

// <details> desplegable de desglose (mismo estilo que los KPI).
// rows: [{ label, value }].
export function DetailsBlock(rows, label = 'Detalle') {
  if (!rows?.length) return null;
  return el('details', { class: 'kpi__details' }, [
    el('summary', { class: 'kpi__dtrig' }, [
      el('span', { text: label }),
      el('span', { class: 'kpi__dchev', html: icon('chevronDown') }),
    ]),
    el('ul', { class: 'kpi__dlist' },
      rows.map((r) => el('li', { class: 'kpi__drow' }, [
        el('span', { class: 'kpi__dlabel', text: r.label }),
        el('span', { class: 'kpi__dvalue tabular', text: r.value }),
      ]))
    ),
  ]);
}

// Tarjeta héroe — cifra dominante de la vista (patrón del Dashboard).
// trendRow: nodos bajo el valor (Trend + captions) · split: [{ label, value, cls }]
// sparkValues: serie para el sparkline decorativo · details: filas de desglose.
export function HeroCard({ label, iconName, value, trendRow, split, sparkValues, details, detailsLabel } = {}) {
  return el('article', { class: 'card dash-hero' }, [
    el('div', { class: 'dash-hero__top' }, [
      el('span', { class: 'kpi__label', text: label }),
      iconName ? el('span', { class: 'kpi__icon', html: icon(iconName) }) : null,
    ].filter(Boolean)),
    el('div', { class: 'dash-hero__value tabular', text: value }),
    trendRow?.length ? el('div', { class: 'dash-hero__trend' }, trendRow) : null,
    split?.length ? el('div', { class: 'dash-hero__split' }, split.map((it) => el('div', {}, [
      el('div', { class: 'dash-hero__k', text: it.label }),
      el('div', { class: `dash-hero__v tabular${it.cls ? ' ' + it.cls : ''}`, text: it.value }),
    ]))) : null,
    sparkValues?.length >= 3 ? el('div', { class: 'dash-hero__spark', html: sparklineSvg(sparkValues) }) : null,
    DetailsBlock(details, detailsLabel),
  ].filter(Boolean));
}

// FAB móvil (R0.3) — acción primaria de creación al alcance del pulgar.
// Solo visible ≤920px (CSS); en desktop el CTA del header sigue siendo el camino.
export function Fab(label, { iconName = 'plus', onClick } = {}) {
  return el('button', {
    class: 'fab', type: 'button',
    'aria-label': label, title: label,
    on: onClick ? { click: onClick } : {},
  }, [el('span', { html: icon(iconName) })]);
}

// Barra de filtros sticky (R0.5) — búsqueda + chips fijos al hacer scroll.
export function FilterBar(children) {
  return el('div', { class: 'filterbar' }, children);
}

// ariaLabel: descripción del progreso (default "Progreso"). Completa WCAG 4.1.2.
export function ProgressBar(pct, variant = '', { title, ariaLabel } = {}) {
  const clamped = Math.max(0, Math.min(100, pct));
  return el('div', {
    class: 'progress',
    role: 'progressbar',
    'aria-valuemin': '0',
    'aria-valuemax': '100',
    'aria-valuenow': Math.round(clamped),
    'aria-label': ariaLabel || 'Progreso',
    title: title || `${Math.round(clamped)}%`,
  }, [
    el('div', { class: `progress__bar${variant ? ' progress__bar--' + variant : ''}`, style: { width: `${clamped}%` } }),
  ]);
}
