// components/commandPalette.js — paleta de comandos (Ctrl/⌘+K) estilo Raycast/Linear.
// Navegación rápida entre módulos + acciones. Sin dependencias; teclado completo.
// Accesible: role=dialog, listbox/option, foco gestionado, restaura el foco previo.

import { el } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { routes, navSections } from '../core/routes.js';

let overlay = null;
let lastFocused = null;
let items = [];        // [{ cmd, node }] visibles tras el filtro
let activeIndex = 0;
let ALL = [];

const sectionLabel = (navId) => (navSections.find((s) => s.id === navId) || {}).label || '';

function buildCommands() {
  const cmds = Object.entries(routes).map(([id, r]) => ({
    title: r.title,
    hint: sectionLabel(r.nav),
    iconName: r.icon,
    keywords: `${r.title} ${sectionLabel(r.nav)} ${id}`.toLowerCase(),
    run: () => { location.hash = `#/${id}`; },
  }));
  // Acción: cambiar tema (dispara el botón real para que el ícono del topbar también cambie).
  cmds.push({
    title: 'Cambiar tema (claro / oscuro)',
    hint: 'Acción',
    iconName: 'settings',
    keywords: 'tema theme claro oscuro dark light apariencia accion',
    run: () => document.querySelector('.theme-toggle')?.click(),
  });
  return cmds;
}

export function isPaletteOpen() { return !!overlay; }

export function closePalette() {
  if (!overlay) return;
  const o = overlay;
  overlay = null;
  document.removeEventListener('keydown', onKey, true);
  o.style.animation = 'fade-in var(--dur-fast) reverse';
  setTimeout(() => o.remove(), 110);
  if (lastFocused && lastFocused.focus) lastFocused.focus();
}

export function openPalette() {
  if (overlay) return;
  if (document.body.classList.contains('modal-open')) return; // no abrir sobre un modal
  lastFocused = document.activeElement;
  ALL = buildCommands();

  const input = el('input', {
    class: 'cmdk__input', type: 'text', placeholder: 'Buscar módulo o acción…',
    'aria-label': 'Buscar comando', autocomplete: 'off', spellcheck: 'false',
  });
  const list = el('div', { class: 'cmdk__list', role: 'listbox', 'aria-label': 'Comandos' });
  const foot = el('div', { class: 'cmdk__foot' }, [
    el('span', {}, ['↑↓ navegar']),
    el('span', {}, ['↵ abrir']),
    el('span', {}, ['esc cerrar']),
    el('span', { class: 'cmdk__foot-spacer' }),
    el('span', {}, ['⌘K · Ctrl K']),
  ]);
  const panel = el('div', { class: 'cmdk', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Paleta de comandos' }, [
    el('div', { class: 'cmdk__search' }, [el('span', { class: 'cmdk__search-icon', html: icon('search') }), input]),
    list, foot,
  ]);
  overlay = el('div', { class: 'cmdk-overlay', on: { mousedown: (e) => { if (e.target === overlay) closePalette(); } } }, [panel]);
  document.body.append(overlay);

  input.addEventListener('input', () => render(input.value));
  document.addEventListener('keydown', onKey, true);
  render('');
  setTimeout(() => input.focus(), 20);
}

function render(query) {
  const q = query.trim().toLowerCase();
  const filtered = q ? ALL.filter((c) => c.keywords.includes(q)) : ALL;
  activeIndex = 0;
  const listEl = overlay.querySelector('.cmdk__list');
  listEl.replaceChildren();
  items = filtered.map((cmd, i) => {
    const node = el('div', {
      class: 'cmdk__item', role: 'option', 'aria-selected': 'false',
      on: { click: () => { cmd.run(); closePalette(); }, mousemove: () => setActive(i) },
    }, [
      el('span', { class: 'cmdk__item-icon', html: icon(cmd.iconName) }),
      el('span', { class: 'cmdk__item-title', text: cmd.title }),
      cmd.hint ? el('span', { class: 'cmdk__item-hint', text: cmd.hint }) : null,
    ].filter(Boolean));
    listEl.appendChild(node);
    return { cmd, node };
  });
  if (!items.length) listEl.appendChild(el('div', { class: 'cmdk__empty', text: 'Sin resultados' }));
  paintActive();
}

function setActive(i) { activeIndex = i; paintActive(); }

function paintActive() {
  items.forEach((it, i) => {
    const on = i === activeIndex;
    it.node.classList.toggle('cmdk__item--active', on);
    it.node.setAttribute('aria-selected', String(on));
    if (on) it.node.scrollIntoView({ block: 'nearest' });
  });
}

function onKey(e) {
  if (!overlay) return;
  switch (e.key) {
    case 'Escape': e.preventDefault(); closePalette(); break;
    case 'ArrowDown': e.preventDefault(); if (items.length) setActive((activeIndex + 1) % items.length); break;
    case 'ArrowUp': e.preventDefault(); if (items.length) setActive((activeIndex - 1 + items.length) % items.length); break;
    case 'Enter': {
      e.preventDefault();
      const it = items[activeIndex];
      if (it) { it.cmd.run(); closePalette(); }
      break;
    }
  }
}

export function togglePalette() { overlay ? closePalette() : openPalette(); }

// Listener global de atajos. Llamar una vez en el bootstrap.
export function initShortcuts() {
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); togglePalette(); return; }
    if (overlay) return; // con el palette abierto, sus teclas las gestiona onKey
    const ae = document.activeElement;
    const inField = ae && (/^(input|textarea|select)$/i.test(ae.tagName) || ae.isContentEditable);
    if (inField || e.ctrlKey || e.metaKey || e.altKey) return;
    // '/' o '?' abren la paleta cuando no se está escribiendo.
    if (e.key === '/' || e.key === '?') { e.preventDefault(); openPalette(); }
  });
}
