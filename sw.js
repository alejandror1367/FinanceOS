/* FinanceOS — Service Worker (PWA offline-first)
   Estrategia:
   - App shell (HTML/CSS/JS/iconos): precache + cache-first.
   - Navegaciones: network-first con fallback a index.html cacheado.
   Rutas relativas para funcionar en GitHub Pages bajo subdirectorio.
*/

const VERSION = 'financeos-v0.1.6';
const SHELL_CACHE = `${VERSION}-shell`;

// Resuelto contra el scope del SW (directorio de registro).
const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/icon.svg',
  './assets/icon-maskable.svg',
  './src/styles/tokens.css',
  './src/styles/themes.css',
  './src/styles/base.css',
  './src/styles/layout.css',
  './src/styles/components.css',
  './src/core/app.js',
  './src/core/config.js',
  './src/core/router.js',
  './src/core/routes.js',
  './src/store/store.js',
  './src/store/selectors.js',
  './src/services/db.js',
  './src/services/theme.js',
  './src/services/dataService.js',
  './src/services/toast.js',
  './src/services/apiClient.js',
  './src/services/syncQueue.js',
  './src/services/syncEngine.js',
  './src/services/entities.js',
  './src/data/mock.js',
  './src/utils/id.js',
  './src/utils/format.js',
  './src/utils/dom.js',
  './src/utils/icons.js',
  './src/components/ui.js',
  './src/components/shell.js',
  './src/components/modal.js',
  './src/components/forms.js',
  './src/views/dashboard.js',
  './src/views/accounts.js',
  './src/views/transactions.js',
  './src/views/budgets.js',
  './src/views/networth.js',
  './src/views/stub.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => console.warn('[sw] precache parcial:', err)),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Solo gestionamos el mismo origen (el shell). Datos externos: pasar de largo.
  if (url.origin !== self.location.origin) return;

  // Navegaciones (documento): network-first con fallback al shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html', { ignoreSearch: true })),
    );
    return;
  }

  // Recursos del shell: cache-first con relleno perezoso.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((res) => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(request, copy));
        }
        return res;
      }).catch(() => cached);
    }),
  );
});
