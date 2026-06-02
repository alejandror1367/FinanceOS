// views/accounts.js — módulo de Cuentas (CRUD).
// Tarjetas de crédito tienen campos extra: cupo, tasa, día de corte, día de pago, % mínimo.

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
  { value: 'cash',           label: 'Efectivo',           icon: 'wallet' },
  { value: 'bank',           label: 'Banco',               icon: 'accounts' },
  { value: 'savings',        label: 'Ahorro',              icon: 'budgets' },
  { value: 'credit_card',    label: 'Tarjeta de crédito',  icon: 'debts' },
  { value: 'investment',     label: 'Inversión',           icon: 'investments' },
  { value: 'digital_wallet', label: 'Billetera digital',   icon: 'wallet' },
];
const typeLabel = (v) => (TYPES.find((t) => t.value === v) || {}).label || v;
const typeIcon  = (v) => (TYPES.find((t) => t.value === v) || {}).icon  || 'accounts';

// Utilización de cupo para tarjetas (balance es negativo = deuda)
function utilization(a) {
  if (a.type !== 'credit_card' || !a.creditLimit) return null;
  const used = Math.abs(a.balance || 0);
  return Math.min(100, Math.round(used / a.creditLimit * 100));
}

function accountForm(existing) {
  const isCc = existing?.type === 'credit_card';
  const typeEl = select({ name: 'type', value: existing?.type || 'bank', options: TYPES.map((t) => ({ value: t.value, label: t.label })) });
  const ccExtra = el('div');

  function paintCcExtra() {
    ccExtra.innerHTML = '';
    if (typeEl.value !== 'credit_card') return;
    ccExtra.appendChild(el('div', { class: 'field-row' }, [
      field('Cupo total', numberInput({ name: 'creditLimit', value: existing?.creditLimit ?? '' })),
      field('Tasa interés (E.A. %)', numberInput({ name: 'interestRate', value: existing?.interestRate ?? '' })),
    ]));
    ccExtra.appendChild(el('div', { class: 'field-row' }, [
      field('Día de corte', numberInput({ name: 'cutoffDay', value: existing?.cutoffDay ?? '', placeholder: '5' })),
      field('Día de pago', numberInput({ name: 'paymentDay', value: existing?.paymentDay ?? '', placeholder: '25' })),
    ]));
    ccExtra.appendChild(el('div', { class: 'field-row' }, [
      field('Pago mínimo ($)', numberInput({ name: 'minPayment', value: existing?.minPayment ?? '', placeholder: '0' })),
      field('Total a pagar ($)', numberInput({ name: 'totalDue', value: existing?.totalDue ?? '', placeholder: '0' })),
    ]));
  }

  typeEl.addEventListener('change', paintCcExtra);
  if (isCc) paintCcExtra();

  return el('div', {}, [
    field('Nombre', textInput({ name: 'name', value: existing?.name || '', placeholder: 'Visa Bancolombia', required: true })),
    el('div', { class: 'field-row' }, [
      field('Tipo', typeEl),
      field('Moneda', textInput({ name: 'currency', value: existing?.currency || 'COP' })),
    ]),
    el('div', { class: 'field-row' }, [
      field('Saldo actual', numberInput({ name: 'balance', value: existing?.balance ?? 0 })),
      field('Institución', textInput({ name: 'institution', value: existing?.institution || '', placeholder: 'Opcional' })),
    ]),
    ccExtra,
  ]);
}

export function openAccountModal(existing) {
  const body = accountForm(existing);
  openModal({
    title: existing ? 'Editar cuenta' : 'Nueva cuenta',
    body,
    submitLabel: existing ? 'Guardar' : 'Crear',
    onSubmit: async () => {
      const get = (n) => body.querySelector(`[name="${n}"]`);
      const data = {
        name:        get('name').value.trim(),
        type:        get('type').value,
        currency:    (get('currency').value || 'COP').trim().toUpperCase().slice(0, 3),
        balance:     Number(get('balance').value) || 0,
        institution: get('institution').value.trim(),
      };
      if (data.type === 'credit_card') {
        data.creditLimit  = Number(get('creditLimit')?.value)  || 0;
        data.interestRate = Number(get('interestRate')?.value) || 0;
        data.cutoffDay    = Number(get('cutoffDay')?.value)    || 0;
        data.paymentDay   = Number(get('paymentDay')?.value)   || 0;
        data.minPayment   = Number(get('minPayment')?.value)   || 0;
        data.totalDue     = Number(get('totalDue')?.value)     || 0;
      }
      if (!data.name) { toast('El nombre es obligatorio', { type: 'negative' }); return false; }
      try {
        if (existing) { await dataService.update('accounts', existing.id, data); toast('Cuenta actualizada'); }
        else          { await dataService.create('accounts', data); toast('Cuenta creada'); }
      } catch (e) { toast('Error al guardar', { type: 'negative' }); return false; }
    },
  });
}

function accountRow(a) {
  const util = utilization(a);
  const subParts = [a.institution || '—'];
  if (util !== null) subParts.push(`${util}% utilizado`);

  return el('div', { class: 'row' }, [
    el('div', { class: 'row__avatar', html: icon(typeIcon(a.type)) }),
    el('div', { class: 'row__main' }, [
      el('div', { class: 'row__title' }, [a.name, ' ', Badge(typeLabel(a.type), a.type === 'credit_card' ? 'negative' : 'info')]),
      el('div', { class: 'row__sub', text: subParts.join(' · ') }),
      util !== null ? el('div', { class: 'util-bar' }, [
        el('div', { class: `util-bar__fill${util > 80 ? ' util-bar__fill--danger' : util > 50 ? ' util-bar__fill--warn' : ''}`, style: `width:${util}%` }),
      ]) : null,
    ].filter(Boolean)),
    el('div', { class: 'row__amount tabular', text: formatMoney(a.balance, a.currency) }),
    el('div', { class: 'row__actions' }, [
      el('button', { class: 'icon-btn', 'aria-label': 'Editar', on: { click: () => openAccountModal(a) }, html: icon('edit') }),
      el('button', {
        class: 'icon-btn icon-btn--danger', 'aria-label': 'Eliminar',
        on: { click: () => confirmDialog({
          title: 'Eliminar cuenta', message: `¿Eliminar "${a.name}"?`,
          onConfirm: async () => { try { await dataService.remove('accounts', a.id); toast('Cuenta eliminada'); } catch (e) { toast('Error', { type: 'negative' }); } },
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
