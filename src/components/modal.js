// components/modal.js — modal accesible reutilizable + confirmación.
// role=dialog, cierre con ESC / backdrop / botón, restaura el foco previo.

import { el } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { Button } from './ui.js';

let activeOverlay = null;
let lastFocused = null;

export function closeModal() {
  if (!activeOverlay) return;
  const overlay = activeOverlay;
  activeOverlay = null;
  document.body.classList.remove('modal-open');
  document.removeEventListener('keydown', onKeydown);
  overlay.style.animation = 'fade-in var(--dur-fast) reverse';
  setTimeout(() => overlay.remove(), 120);
  if (lastFocused && lastFocused.focus) lastFocused.focus();
}

function onKeydown(e) {
  if (e.key === 'Escape') closeModal();
  if (e.key === 'Tab' && activeOverlay) trapFocus(e);
}

function trapFocus(e) {
  const focusables = activeOverlay.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  );
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

// Abre un modal. opts: { title, body(HTMLElement), submitLabel, onSubmit(), danger, hideFooter }
// onSubmit puede devolver false (o lanzar) para evitar el cierre.
export function openModal({ title, body, submitLabel = 'Guardar', onSubmit, danger = false, hideFooter = false }) {
  if (activeOverlay) closeModal();
  lastFocused = document.activeElement;

  const form = el('form', { class: 'modal__form', on: { submit: handleSubmit } }, [
    el('div', { class: 'modal__body' }, body),
    hideFooter ? null : el('div', { class: 'modal__foot' }, [
      Button('Cancelar', { variant: 'ghost', onClick: closeModal }),
      el('button', { class: `btn btn--primary${danger ? ' btn--danger' : ''}`, type: 'submit', text: submitLabel }),
    ]),
  ].filter(Boolean));

  const modal = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, [
    el('div', { class: 'modal__head' }, [
      el('h2', { class: 'modal__title', text: title }),
      el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Cerrar', on: { click: closeModal }, html: icon('close') }),
    ]),
    form,
  ]);

  const overlay = el('div', { class: 'modal-overlay', on: { mousedown: onBackdrop } }, [modal]);

  function onBackdrop(e) { if (e.target === overlay) closeModal(); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!onSubmit) { closeModal(); return; }
    try {
      const result = await onSubmit();
      if (result !== false) closeModal();
    } catch (err) {
      console.error('[modal] submit error', err);
    }
  }

  document.body.append(overlay);
  document.body.classList.add('modal-open');
  document.addEventListener('keydown', onKeydown);
  activeOverlay = overlay;

  // Foco al primer campo.
  const firstInput = modal.querySelector('input, select, textarea');
  if (firstInput) setTimeout(() => firstInput.focus(), 30);

  return { close: closeModal };
}

// Diálogo de confirmación (p. ej. eliminar).
export function confirmDialog({ title = '¿Confirmar?', message, confirmLabel = 'Eliminar', onConfirm }) {
  openModal({
    title,
    danger: true,
    submitLabel: confirmLabel,
    body: el('p', { class: 't-body text-secondary', text: message }),
    onSubmit: () => onConfirm(),
  });
}
