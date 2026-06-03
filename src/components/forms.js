// components/forms.js — helpers de formulario (campos controlados simples).
import { el } from '../utils/dom.js';

// Campo con etiqueta + control + zona de error.
// Asocia <label for> con el control via id generado (WCAG 1.3.1 / 4.1.2 — TD-08).
export function field(label, control, { error } = {}) {
  if (!control.id && control.name) {
    control.id = 'f-' + control.name + '-' + Math.random().toString(36).slice(2, 7);
  }
  return el('div', { class: 'field' }, [
    el('label', { class: 'field__label', for: control.id || undefined, text: label }),
    control,
    el('div', { class: 'field__error', text: error || '' }),
  ]);
}

// ariaLabel solo se pasa cuando el campo NO tiene un <label> visible asociado
// (p. ej. un buscador inline). Si hay <label for=...>, omitir para no duplicar el anuncio.
export function textInput({ name, value = '', placeholder = '', type = 'text', required = false, ariaLabel } = {}) {
  return el('input', {
    class: 'input', name, type, value, placeholder,
    'aria-label': ariaLabel || null, required: required ? true : null,
  });
}

export function numberInput({ name, value = '', placeholder = '0', min = '0', step = 'any' } = {}) {
  return el('input', {
    class: 'input', name, type: 'number', value: value === 0 ? '0' : (value || ''),
    placeholder, min, step, inputmode: 'decimal',
  });
}

export function textarea({ name, value = '', placeholder = '' } = {}) {
  return el('textarea', { class: 'input', name, placeholder }, value || '');
}

// options: [{ value, label }]
// ariaLabel solo se pasa cuando el <select> no tiene un <label> visible asociado.
export function select({ name, value = '', options = [], ariaLabel } = {}) {
  const node = el('select', { class: 'input', name, 'aria-label': ariaLabel || null },
    options.map((o) => el('option', { value: o.value, selected: String(o.value) === String(value) ? true : null, text: o.label })));
  return node;
}

// Control segmentado. options: [{ value, label }]. onChange(value).
export function segmented({ value, options, onChange }) {
  const wrap = el('div', { class: 'seg', role: 'group' });
  function paint(current) {
    wrap.replaceChildren(...options.map((o) => el('button', {
      class: 'seg__btn', type: 'button', 'aria-pressed': String(o.value === current),
      text: o.label, on: { click: () => { paint(o.value); onChange(o.value); } },
    })));
  }
  paint(value);
  return wrap;
}

// Validación inline: marca/limpia el error de un campo concreto (junto al control),
// en lugar de solo lanzar un toast. Usa la zona `.field__error` que ya pinta field().
// Devuelve false para encadenar: `if (!cond) return setFieldError(ctrl, 'msg');`
export function setFieldError(control, message) {
  const wrap = control?.closest?.('.field');
  if (wrap) {
    const errEl = wrap.querySelector('.field__error');
    if (errEl) errEl.textContent = message || '';
  }
  control.classList.toggle('input--error', !!message);
  if (message) {
    control.setAttribute('aria-invalid', 'true');
    // Auto-limpia en cuanto el usuario corrige (una sola vez).
    control.addEventListener('input', () => clearFieldError(control), { once: true });
  } else {
    control.removeAttribute('aria-invalid');
  }
  return false;
}

export function clearFieldError(control) {
  const wrap = control?.closest?.('.field');
  if (wrap) {
    const errEl = wrap.querySelector('.field__error');
    if (errEl) errEl.textContent = '';
  }
  control.classList.remove('input--error');
  control.removeAttribute('aria-invalid');
}

// Enfoca el control con error y desplaza si hace falta (mejor feedback en modales largos).
export function focusFieldError(control) {
  try { control.focus({ preventScroll: false }); } catch (e) { control.focus(); }
}

// Lee los valores de un formulario por name.
export function readForm(formEl) {
  const data = {};
  formEl.querySelectorAll('input, select, textarea').forEach((node) => {
    if (!node.name) return;
    data[node.name] = node.type === 'number' ? (node.value === '' ? '' : Number(node.value)) : node.value;
  });
  return data;
}
