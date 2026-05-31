// services/toast.js — notificaciones efímeras (componente Toast).
import { el } from '../utils/dom.js';

export function toast(message, { type = 'default', timeout = 3200 } = {}) {
  const region = document.getElementById('toast-region');
  if (!region) return;
  const node = el('div', { class: `toast toast--${type}`, role: 'status' }, [
    el('span', { class: 'toast__dot' }),
    el('span', { text: message }),
  ]);
  region.append(node);
  setTimeout(() => {
    node.style.transition = 'opacity .2s, transform .2s';
    node.style.opacity = '0';
    node.style.transform = 'translateY(6px)';
    setTimeout(() => node.remove(), 220);
  }, timeout);
}
