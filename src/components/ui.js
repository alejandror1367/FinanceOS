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

export function KpiCard({ label, value, iconName, variant = '', foot, hero = false } = {}) {
  const classes = ['kpi'];
  if (hero) classes.push('kpi--hero');
  if (variant) classes.push('kpi--' + variant);
  return el('article', { class: classes.join(' ') }, [
    el('div', { class: 'kpi__top' }, [
      el('span', { class: 'kpi__label', text: label }),
      iconName ? el('span', { class: 'kpi__icon', html: icon(iconName) }) : null,
    ]),
    el('div', { class: `kpi__value tabular${hero ? ' kpi__value--hero' : ''}`, text: value }),
    foot ? el('div', { class: 'kpi__foot' }, foot) : null,
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

export function Button(label, { variant = 'ghost', iconName, onClick, iconOnly = false, ariaLabel } = {}) {
  return el('button', {
    class: `btn btn--${variant}${iconOnly ? ' btn--icon' : ''}`,
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

export function ProgressBar(pct, variant = '', { title } = {}) {
  const clamped = Math.max(0, Math.min(100, pct));
  return el('div', { class: 'progress', role: 'progressbar', 'aria-valuenow': Math.round(clamped), title: title || `${Math.round(clamped)}%` }, [
    el('div', { class: `progress__bar${variant ? ' progress__bar--' + variant : ''}`, style: { width: `${clamped}%` } }),
  ]);
}
