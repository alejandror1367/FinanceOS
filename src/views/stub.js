// views/stub.js — placeholder navegable para módulos de fases posteriores.
// Mantiene la navegación completa funcionando en Fase 1.

import { el } from '../utils/dom.js';
import { EmptyState, Badge } from '../components/ui.js';

export function makeStub(title, description, iconName) {
  return function render() {
    return el('div', {}, [
      el('div', { class: 'page-header' }, [
        el('div', { class: 'row-flex' }, [
          el('h2', { class: 't-h1', text: title }),
          Badge('Próxima fase', 'info'),
        ]),
        el('p', { class: 'page-header__sub', text: description }),
      ]),
      el('div', { class: 'card' }, [
        EmptyState({
          title: 'Módulo planificado',
          message: 'Esta sección se construirá en una fase posterior del roadmap. La navegación, el shell y el design system ya están listos.',
          iconName,
        }),
      ]),
    ]);
  };
}
