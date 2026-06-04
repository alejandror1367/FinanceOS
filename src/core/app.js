// core/app.js — bootstrap de la aplicación.
// Orquesta: tema, datos (mock o backend vía dataService), shell, router,
// motor de sincronización y render reactivo.
// No contiene lógica financiera (eso vive en store/selectors y services).

import { CONFIG } from './config.js';
import { auth } from './auth.js';
import { store } from '../store/store.js';
import { theme } from '../services/theme.js';
import { dataService } from '../services/dataService.js';
import { createRouter } from './router.js';
import { routes } from './routes.js';
import { Sidebar, Topbar, BottomNav, SyncPill } from '../components/shell.js';
import { initShortcuts } from '../components/commandPalette.js';
import { SkeletonKpis } from '../components/ui.js';
import { el, mount } from '../utils/dom.js';
import { toast } from '../services/toast.js';
import { priceService } from '../services/priceService.js';
import { apiClient } from '../services/apiClient.js';

const appRoot = document.getElementById('app');
let router;
let shellRefs = null;
let currentRoute = null;
let currentTheme = theme.init();

// --- Construcción del shell (una sola vez) ---
function buildShell() {
  const shell = el('div', { class: 'app-shell', id: 'shell' });
  const scrim = el('div', { class: 'scrim', on: { click: () => setNavOpen(false) } });
  const main = el('main', { class: 'main' });
  const topbarMount = el('div');
  const content = el('div', { class: 'content', id: 'view', role: 'main', tabindex: '-1' });

  main.append(topbarMount, content);
  shell.append(buildSidebar(), main, scrim, buildBottomNav());
  mount(appRoot, shell);
  appRoot.setAttribute('aria-busy', 'false');

  return { shell, topbarMount, content };
}

function buildSidebar() {
  return Sidebar({
    activeId: store.get().ui.route,
    onNavigate: (id) => { router.navigate(id); setNavOpen(false); },
  });
}

function buildBottomNav() {
  return BottomNav({
    activeId: store.get().ui.route,
    onNavigate: (id) => router.navigate(id),
  });
}

function setNavOpen(open) {
  store.set({ ui: { navOpen: open } });
  document.getElementById('shell')?.classList.toggle('is-nav-open', open);
}

function refreshSidebar() {
  shellRefs.shell.querySelector('.sidebar').replaceWith(buildSidebar());
  shellRefs.shell.querySelector('.bottom-nav').replaceWith(buildBottomNav());
}

function renderTopbar(title) {
  const topbar = Topbar({
    title,
    theme: currentTheme,
    sync: store.get().sync,
    onToggleTheme: () => {
      currentTheme = theme.toggle();
      renderTopbar(title);
      toast(`Tema ${currentTheme === 'dark' ? 'oscuro' : 'claro'} activado`, { type: 'info' });
    },
    onToggleNav: () => setNavOpen(!store.get().ui.navOpen),
    onRefresh: doRefresh,
  });
  mount(shellRefs.topbarMount, topbar);
}

async function doRefresh() {
  if (!CONFIG.api.baseUrl) {
    toast('Modo local: sin backend configurado', { type: 'info' });
    return;
  }
  toast('Actualizando…', { type: 'info' });
  try {
    await dataService.refresh();
    toast('Datos actualizados');
  } catch (e) {
    toast('No se pudo actualizar', { type: 'negative' });
  }
}

function renderView(route, opts = {}) {
  const state = store.get();
  mount(shellRefs.content, route.render(state));
  if (opts.animate) {
    shellRefs.content.scrollTop = 0;
    shellRefs.content.firstElementChild?.animate?.(
      [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }],
      { duration: 220, easing: 'cubic-bezier(0.16,1,0.3,1)' },
    );
  }
}

// --- Precios en vivo: refresh silencioso al arrancar ---
// Evita que el Dashboard muestre $0 en Inversiones en cold-start.
async function backgroundRefreshPrices() {
  if (!CONFIG.api.baseUrl) return;
  const invs = store.get().investments || [];
  const syms = [...new Set(
    invs.filter((i) => !i.isDeleted && i.symbol && !['cdt', 'fund'].includes(i.assetType))
      .map((i) => i.symbol.toUpperCase()),
  )];
  if (!syms.length) return;
  try {
    const tickers = [...syms, 'USDCOP=X', 'EURCOP=X'].join(',');
    const resp = await apiClient.get('getQuotes', { tickers });
    const quotesMap  = (resp && typeof resp.quotes  === 'object') ? resp.quotes  : (resp || {});
    const fxFromBack = (resp && typeof resp.fxRates === 'object') ? resp.fxRates : {};
    const prices = {};
    Object.entries(quotesMap).forEach(([k, q]) => { if (q && !q.error) prices[k] = q; });
    const fx = {};
    Object.entries(fxFromBack).forEach(([cur, rate]) => { if (rate) fx[cur] = rate; });
    if (!Object.keys(fxFromBack).length) {
      ['USD', 'EUR', 'GBP', 'BRL'].forEach((c) => { if (prices[`${c}COP=X`]?.price) fx[c] = prices[`${c}COP=X`].price; });
    }
    priceService.update(prices, fx);
    store.set({ _priceRevision: Date.now() });
  } catch (_) {}
}

// --- Service Worker (PWA offline-first) ---
async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('sw.js', { scope: './' });

    // Cuando el SW nuevo activa, recarga la página automáticamente.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });

    reg.addEventListener('updatefound', () => {
      const sw = reg.installing;
      if (!sw) return;
      sw.addEventListener('statechange', () => {
        // SW nuevo instalado y listo: hay un controlador previo (no es la primera carga).
        if (sw.state === 'installed' && navigator.serviceWorker.controller) {
          toast('Actualizando a la nueva versión…', { type: 'info', timeout: 3000 });
          // Decirle al SW nuevo que tome el control ya (dispara controllerchange arriba).
          sw.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    });
  } catch (e) {
    console.warn('[app] No se pudo registrar el Service Worker:', e);
  }
}

// --- Re-render reactivo ante cambios del store ---
function onStoreChange() {
  const s = store.get();
  // Actualiza la píldora de sincronización sin reconstruir la topbar.
  const pill = document.getElementById('sync-pill');
  if (pill) pill.replaceWith(SyncPill(s.sync));
  // No re-renderizar si hay un modal abierto o el usuario está escribiendo
  // (evita perder foco/estado durante una sincronización en segundo plano).
  const ae = document.activeElement;
  const typing = ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT');
  const modalOpen = document.body.classList.contains('modal-open');

  // Re-renderiza la vista activa cuando hay datos (sin animación ni reset de scroll).
  if (s.ready && shellRefs && currentRoute && !typing && !modalOpen) {
    renderView(routes[s.ui.route], { animate: false });
  }
}

// --- Arranque ---
async function bootstrap() {
  // Verificar autenticación antes de montar la app (TD-09).
  // Si hay un clientId configurado, requerimos sesión de Google.
  if (CONFIG.auth.clientId && !auth.isAuthenticated()) {
    await auth.prompt();
  }

  // Renovar el token silenciosamente cada 45 min (los tokens de Google duran 1 h).
  if (CONFIG.auth.clientId) {
    setInterval(() => auth.refreshSilent(), 45 * 60 * 1000);
  }

  document.title = CONFIG.appName;

  shellRefs = buildShell();
  renderTopbar('Dashboard');
  mount(shellRefs.content, el('div', {}, [
    el('div', { class: 'page-header' }, [el('div', { class: 'skeleton skeleton--line', style: { width: '200px', height: '28px' } })]),
    SkeletonKpis(6),
  ]));

  // Suscripción reactiva (antes de cargar datos para reflejar el primer hydrate).
  store.subscribe(onStoreChange);

  // Atajos de teclado globales (Command Palette: ⌘K / Ctrl K · / · ?). Se
  // registran ANTES de cargar datos: no dependen de la red y deben estar
  // disponibles de inmediato (si esperaran a dataService.init(), offline o con
  // backend lento quedarían inactivos hasta que el pull termine/falle).
  initShortcuts();

  // Cargar datos (mock local o backend) e iniciar el motor de sync.
  const { source } = await dataService.init();
  backgroundRefreshPrices(); // no-await: background, no bloquea el arranque

  // Router.
  router = createRouter({
    routes,
    fallback: 'dashboard',
    onChange: (routeId, route) => {
      store.set({ ui: { route: routeId } });
      currentRoute = routeId;
      renderTopbar(route.title);
      renderView(route, { animate: true });
      refreshSidebar();
    },
  });
  router.start();

  registerSW();
  console.info(`[FinanceOS] v${CONFIG.version} · datos: ${source}`);
}

bootstrap();
