// views/accounts.js — módulo de Cuentas (CRUD).
// Usa dataService (Optimistic UI + sync). Sin lógica de negocio aquí.

import { el } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { store } from '../store/store.js';
import { dataService } from '../services/dataService.js';
import { formatMoney } from '../utils/format.js';
import { Button, Badge, EmptyState } from '../components/ui.js';
import { openModal, confirmDialog } from '../components/modal.js';
import { field, textInput, numberInput, select } from '../components/forms.js';
import { toast } from '../services/toast.js';

const TYPES = [
  { value: 'cash', label: 'Efectivo', icon: 'wallet' },
  { value: 'bank', label: 'Banco', icon: 'accounts' },
  { value: 'savings', label: 'Ahorro', icon: 'budgets' },
  { value: 'investment', label: 'Inversión', icon: 'investments' },
  { value: 'digital_wallet', label: 'Billetera digital', icon: 'wallet' },
];
const typeLabel = (v) => (TYPES.find((t) => t.value === v) || {}).label || v;
const typeIcon = (v) => (TYPES.find((t) => t.value === v) || {}).icon || 'accounts';

function accountForm(existing) {
  return el('div', {}, [
    field('Nombre', textInput({ name: 'name', value: existing?.name || '', placeholder: 'Bancolombia', required: true })),
    el('div', { class: 'field-row' }, [
      field('Tipo', select({ name: 'type', value: existing?.type || 'bank', options: TYPES.map((t) => ({ value: t.value, label: t.label })) })),
      field('Moneda', textInput({ name: 'currency', value: existing?.currency || 'COP' })),
    ]),
    el('div', { class: 'field-row' }, [
      field('Saldo', numberInput({ name: 'balance', value: existing?.balance ?? 0 })),
      field('Institución', textInput({ name: 'institution', value: existing?.institution || '', placeholder: 'Opcional' })),
    ]),
  ]);
}

function openAccountModal(existing) {
  const body = accountForm(existing);
  openModal({
    title: existing ? 'Editar cuenta' : 'Nueva cuenta',
    body,
    submitLabel: existing ? 'Guardar' : 'Crear',
    onSubmit: async () => {
      const get = (n) => body.querySelector(`[name="${n}"]`);
      const data = {
        name: get('name').value.trim(),
        type: get('type').value,
        currency: (get('currency').value || 'COP').trim().toUpperCase().slice(0, 3),
        balance: Number(get('balance').value) || 0,
        institution: get('institution').value.trim(),
      };
      if (!data.name) { toast('El nombre es obligatorio', { type: 'negative' }); return false; }
      try {
        if (existing) { await dataService.update('accounts', existing.id, data); toast('Cuenta actualizada'); }
        else { await dataService.create('accounts', data); toast('Cuenta creada'); }
      } catch (e) { toast('Error al guardar', { type: 'negative' }); return false; }
    },
  });
}

function accountRow(a) {
  return el('div', { class: 'row' }, [
    el('div', { class: 'row__avatar', html: icon(typeIcon(a.type)) }),
    el('div', { class: 'row__main' }, [
      el('div', { class: 'row__title' }, [a.name, ' ', Badge(typeLabel(a.type), 'info')]),
      el('div', { class: 'row__sub', text: a.institution || '—' }),
    ]),
    el('div', { class: 'row__amount tabular', text: formatMoney(a.balance, a.currency) }),
    el('div', { class: 'row__actions' }, [
      el('button', { class: 'icon-btn', 'aria-label': 'Editar', title: 'Editar', on: { click: () => openAccountModal(a) }, html: icon('edit') }),
      el('button', {
        class: 'icon-btn icon-btn--danger', 'aria-label': 'Eliminar', title: 'Eliminar',
        on: { click: () => confirmDialog({
          title: 'Eliminar cuenta', message: `¿Eliminar "${a.name}"? Esta acción se puede revertir desde la base de datos.`,
          onConfirm: async () => { try { await dataService.remove('accounts', a.id); toast('Cuenta eliminada'); } catch (e) { toast('Error al eliminar', { type: 'negative' }); } },
        }) },
        html: icon('trash'),
      }),
    ]),
  ]);
}

export function renderAccounts() {
  const s = store.get();
  const accounts = (s.accounts || []).filter((a) => !a.isArchived);
  const total = accounts.reduce((sum, a) => sum + (a.balance || 0), 0);
  const cur = s.baseCurrency;

  return el('div', {}, [
    el('div', { class: 'page-header' }, [
      el('div', { class: 'row-flex between' }, [
        el('div', {}, [
          el('h2', { class: 't-h1', text: 'Cuentas' }),
          el('p', { class: 'page-header__sub', text: `${accounts.length} cuentas · ${formatMoney(total, cur)} en total` }),
        ]),
        Button('Nueva cuenta', { variant: 'primary', iconName: 'plus', onClick: () => openAccountModal(null) }),
      ]),
    ]),
    accounts.length
      ? el('div', { class: 'card card--pad-sm' }, [el('div', { class: 'row-list' }, accounts.map(accountRow))])
      : el('div', { class: 'card' }, [EmptyState({
          title: 'Sin cuentas', message: 'Crea tu primera cuenta para empezar.', iconName: 'accounts',
          action: Button('Nueva cuenta', { variant: 'primary', iconName: 'plus', onClick: () => openAccountModal(null) }),
        })]),
  ]);
}
