// services/theme.js — gestión de tema (claro/oscuro).
// localStorage SOLO para preferencias/UI (docs/Architecture.md §5).

import { CONFIG } from '../core/config.js';

const KEY = CONFIG.storageKeys.theme;
const THEME_COLORS = { dark: '#13171E', light: '#F1F3F7' };

export const theme = {
  get() {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') return saved;
    // Preferencia del sistema como valor inicial.
    return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  },

  apply(value) {
    const t = value === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', t);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_COLORS[t]);
    return t;
  },

  set(value) {
    const t = this.apply(value);
    localStorage.setItem(KEY, t);
    return t;
  },

  toggle() {
    return this.set(this.get() === 'dark' ? 'light' : 'dark');
  },

  init() {
    return this.apply(this.get());
  },
};
