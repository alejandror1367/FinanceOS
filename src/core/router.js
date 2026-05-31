// core/router.js — router por hash (#/ruta). Compatible con GitHub Pages
// sin configuración de servidor. No conoce lógica de dominio.

export function createRouter({ routes, fallback, onChange }) {
  function currentPath() {
    const hash = location.hash.replace(/^#/, '');
    return hash.startsWith('/') ? hash.slice(1) : hash || fallback;
  }

  function resolve() {
    const path = currentPath() || fallback;
    const route = routes[path] ? path : fallback;
    onChange(route, routes[route]);
  }

  function navigate(path) {
    if (currentPath() === path) { resolve(); return; }
    location.hash = `#/${path}`;
  }

  function start() {
    addEventListener('hashchange', resolve);
    if (!location.hash) location.replace(`#/${fallback}`);
    else resolve();
  }

  return { start, navigate, current: currentPath };
}
