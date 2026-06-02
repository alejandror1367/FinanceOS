// components/shell.js — sidebar, topbar y barra inferior móvil.
import { el } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { routes, navSections, bottomNavOrder } from '../core/routes.js';

function navItem(routeId, route, activeId, onNavigate) {
  return el('a', {
    class: 'nav__item',
    href: `#/${routeId}`,
    'aria-current': routeId === activeId ? 'page' : null,
    on: { click: () => onNavigate(routeId) },
  }, [
    el('span', { class: 'nav__icon', html: icon(route.icon) }),
    el('span', { class: 'nav__label', text: route.title }),
  ]);
}

export function Sidebar({ activeId, onNavigate }) {
  const nav = el('nav', { class: 'nav', 'aria-label': 'Navegación principal' });

  for (const section of navSections) {
    const items = Object.entries(routes).filter(([, r]) => r.nav === section.id);
    if (!items.length) continue;
    nav.append(el('div', { class: 'nav__section t-micro', text: section.label }));
    for (const [id, route] of items) nav.append(navItem(id, route, activeId, onNavigate));
  }

  return el('aside', { class: 'sidebar' }, [
    el('div', { class: 'brand' }, [
      el('img', { class: 'brand__mark', src: 'assets/icon.svg', alt: '', width: 34, height: 34 }),
      el('span', { class: 'brand__name', html: 'Finance<b>OS</b>' }),
    ]),
    nav,
  ]);
}

export function SyncPill(sync) {
  const online   = sync ? sync.online : (typeof navigator !== 'undefined' ? navigator.onLine : true);
  const pending  = sync ? (sync.pending || 0) : 0;
  const syncing  = sync && sync.state === 'syncing';
  const hasError = sync && sync.state === 'error';
  const state    = !online ? 'offline' : hasError ? 'error' : syncing ? 'syncing' : pending > 0 ? 'pending' : 'synced';
  const label    = !online ? 'Sin conexión' : hasError ? 'Error de sync' : syncing ? `Sincronizando ${pending}` : pending > 0 ? `Pendiente (${pending})` : 'Sincronizado';
  return el('div', { class: 'sync-pill sync-pill--' + state, id: 'sync-pill', title: 'Estado de sincronización' }, [
    el('span', { class: 'sync-pill__dot' }),
    el('span', { class: 'sync-pill__label', text: label }),
  ]);
}

export function Topbar({ title, theme, sync, onToggleTheme, onToggleNav, onRefresh }) {
  return el('header', { class: 'topbar' }, [
    el('button', {
      class: 'btn btn--ghost btn--icon menu-btn', type: 'button',
      'aria-label': 'Abrir menú', on: { click: onToggleNav },
      html: icon('menu'),
    }),
    el('h1', { class: 'topbar__title', text: title }),
    el('div', { class: 'topbar__spacer' }),
    el('div', { class: 'topbar__actions' }, [
      SyncPill(sync),
      el('button', {
        class: 'btn btn--ghost btn--icon', type: 'button', 'aria-label': 'Actualizar',
        on: onRefresh ? { click: onRefresh } : {}, html: icon('refresh'),
      }),
      el('button', { class: 'btn btn--ghost btn--icon', type: 'button', 'aria-label': 'Buscar', html: icon('search') }),
      el('button', {
        class: 'btn btn--ghost btn--icon theme-toggle', type: 'button',
        'aria-label': 'Cambiar tema', on: { click: onToggleTheme },
        html: icon(theme === 'dark' ? 'sun' : 'moon'),
      }),
    ]),
  ]);
}

export function BottomNav({ activeId, onNavigate }) {
  return el('nav', { class: 'bottom-nav', 'aria-label': 'Navegación rápida' },
    bottomNavOrder.map((id) => {
      const route = routes[id];
      return el('a', {
        class: 'bottom-nav__item',
        href: `#/${id}`,
        'aria-current': id === activeId ? 'page' : null,
        on: { click: () => onNavigate(id) },
      }, [
        el('span', { html: icon(route.icon) }),
        el('span', { text: route.title }),
      ]);
    }));
}
