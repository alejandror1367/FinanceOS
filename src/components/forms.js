// components/forms.js — helpers de formulario (campos controlados simples).
import { el } from '../utils/dom.js';

// Campo con etiqueta + control + zona de error.
export function field(label, control, { error } = {}) {
  return el('div', { class: 'field' }, [
    el('label', { class: 'field__label', text: label }),
    control,
    el('div', { class: 'field__error', text: error || '' }),
  ]);
}

export function textInput({ name, value = '', placeholder = '', type = 'text', required = false } = {}) {
  return el('input', {
    class: 'input', name, type, value, placeholder,
    'aria-label': name, required: required ? true : null,
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
export function select({ name, value = '', options = [] } = {}) {
  const node = el('select', { class: 'input', name, 'aria-label': name },
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

// Lee los valores de un formulario por name.
export function readForm(formEl) {
  const data = {};
  formEl.querySelectorAll('input, select, textarea').forEach((node) => {
    if (!node.name) return;
    data[node.name] = node.type === 'number' ? (node.value === '' ? '' : Number(node.value)) : node.value;
  });
  return data;
}
