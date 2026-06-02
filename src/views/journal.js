// views/journal.js — Diario financiero.
// Reflexiones, decisiones, aprendizajes y objetivos.

import { el } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { store } from '../store/store.js';
import { dataService } from '../services/dataService.js';
import { formatDate } from '../utils/format.js';
import { Card, Badge, EmptyState, Button } from '../components/ui.js';
import { openModal, confirmDialog } from '../components/modal.js';
import { field, textInput, textarea, select } from '../components/forms.js';
import { toast } from '../services/toast.js';
import { guardedOp, guardedSave } from '../components/crud.js';

const CATEGORIES = [
  { value: 'reflection', label: 'Reflexión', icon: 'journal', variant: 'info' },
  { value: 'decision', label: 'Decisión', icon: 'bolt', variant: 'accent' },
  { value: 'learning', label: 'Aprendizaje', icon: 'goals', variant: 'positive' },
  { value: 'objective', label: 'Objetivo', icon: 'networth', variant: 'gold' },
];
const catMeta = (v) => CATEGORIES.find((c) => c.value === v) || CATEGORIES[0];
const today = () => new Date().toISOString().slice(0, 10);

function openEntryModal({ entry = {}, mode = 'create' }) {
  const body = el('div', {}, [
    el('div', { class: 'field-row' }, [
      field('Categoría', select({ name: 'category', value: entry.category || 'reflection', options: CATEGORIES.map((c) => ({ value: c.value, label: c.label })) })),
      field('Fecha', textInput({ name: 'date', value: (entry.date || today()).slice(0, 10), type: 'date' })),
    ]),
    field('Título', textInput({ name: 'title', value: entry.title || '', placeholder: 'Decidí reducir gastos en restaurantes' })),
    field('Contenido', textarea({ name: 'content', value: entry.content || '', placeholder: 'Escribe tu reflexión, decisión o aprendizaje…' })),
  ]);
  openModal({
    title: mode === 'edit' ? 'Editar entrada' : 'Nueva entrada',
    body,
    submitLabel: mode === 'edit' ? 'Guardar' : 'Crear',
    onSubmit: async () => {
      const g = (n) => body.querySelector(`[name="${n}"]`).value;
      const data = { category: g('category'), date: g('date'), title: g('title').trim(), content: g('content').trim() };
      if (!data.title) { toast('El título es obligatorio', { type: 'negative' }); return false; }
      return guardedSave(
        () => mode === 'edit' ? dataService.update('journal', entry.id, data) : dataService.create('journal', data),
        mode === 'edit' ? 'Entrada actualizada' : 'Entrada creada',
      );
    },
  });
}

function entryCard(e) {
  const meta = catMeta(e.category);
  return el('div', { class: 'card card--pad-sm' }, [
    el('div', { class: 'row-flex between' }, [
      el('div', { class: 'row-flex' }, [
        el('span', { class: 'row__avatar', html: icon(meta.icon) }),
        el('div', {}, [
          el('div', { class: 'row__title' }, [e.title, ' ', Badge(meta.label, meta.variant)]),
          el('div', { class: 'row__sub', text: formatDate(e.date, 'long') }),
        ]),
      ]),
      el('div', { class: 'row__actions' }, [
        el('button', { class: 'icon-btn', 'aria-label': 'Editar', title: 'Editar', on: { click: () => openEntryModal({ entry: e, mode: 'edit' }) }, html: icon('edit') }),
        el('button', { class: 'icon-btn icon-btn--danger', 'aria-label': 'Eliminar', title: 'Eliminar', on: { click: () => confirmDialog({ title: 'Eliminar entrada', message: `¿Eliminar "${e.title}"?`, onConfirm: () => guardedOp(() => dataService.remove('journal', e.id), 'Entrada eliminada') }) }, html: icon('trash') }),
      ]),
    ]),
    e.content ? el('p', { class: 't-body text-secondary mt-4', style: { whiteSpace: 'pre-wrap' }, text: e.content }) : null,
  ].filter(Boolean));
}

export function renderJournal() {
  const s = store.get();
  const entries = [...(s.journal || [])].sort((a, b) => (a.date < b.date ? 1 : -1));

  return el('div', {}, [
    el('div', { class: 'page-header' }, [
      el('div', { class: 'row-flex between' }, [
        el('div', {}, [
          el('h2', { class: 't-h1', text: 'Diario financiero' }),
          el('p', { class: 'page-header__sub', text: 'Reflexiones, decisiones, aprendizajes y objetivos.' }),
        ]),
        Button('Nueva entrada', { variant: 'primary', iconName: 'plus', onClick: () => openEntryModal({ mode: 'create' }) }),
      ]),
    ]),
    entries.length
      ? el('div', { class: 'stack' }, entries.map(entryCard))
      : el('div', { class: 'card' }, [EmptyState({ title: 'Diario vacío', message: 'Registra tu primera reflexión o decisión financiera.', iconName: 'journal',
          action: Button('Nueva entrada', { variant: 'primary', iconName: 'plus', onClick: () => openEntryModal({ mode: 'create' }) }) })]),
  ]);
}
