// views/accounts.js — módulo de Cuentas (CRUD + ecosistema financiero).
// Grupos por tipo, KPIs de liquidez/crédito/deuda, presets colombianos, archivar, reactivo.

import { el, mount } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { store } from '../store/store.js';
import { selectors } from '../store/selectors.js';
import { dataService } from '../services/dataService.js';
import { formatMoney } from '../utils/format.js';
import { Button, Badge, EmptyState, KpiCard } from '../components/ui.js';
import { openModal, confirmDialog } from '../components/modal.js';
import { field, textInput, numberInput, select } from '../components/forms.js';
import { toast } from '../services/toast.js';

const TYPES = [
  { value: 'cash',           label: 'Efectivo',          icon: 'wallet' },
  { value: 'bank',           label: 'Banco',              icon: 'accounts' },
  { value: 'savings',        label: 'Ahorro',             icon: 'budgets' },
  { value: 'credit_card',    label: 'Tarjeta de crédito', icon: 'debts' },
  { value: 'investment',     label: 'Inversión',          icon: 'investments' },
  { value: 'digital_wallet', label: 'Billetera digital',  icon: 'wallet' },
];
const typeLabel = (v) => (TYPES.find((t) => t.value === v) || {}).label || v;
const typeIcon  = (v) => (TYPES.find((t) => t.value === v) || {}).icon  || 'accounts';

// Grupos de visualización — orden y tipos incluidos en cada sección.
const GROUPS = [
  { key: 'bank',    label: 'Bancos y Ahorro',       types: ['bank', 'savings'] },
  { key: 'cash',    label: 'Efectivo',               types: ['cash'] },
  { key: 'credit',  label: 'Tarjetas de crédito',    types: ['credit_card'] },
  { key: 'digital', label: 'Billeteras digitales',   types: ['digital_wallet'] },
  { key: 'invest',  label: 'Inversiones',            types: ['investment'] },
];

// Quick presets para nueva cuenta (bancos y servicios colombianos habituales).
const PRESETS = [
  { label: 'Bancolombia',       type: 'bank',           institution: 'Bancolombia', currency: 'COP' },
  { label: 'NuBank',            type: 'bank',           institution: 'NuBank',      currency: 'COP' },
  { label: 'Nequi',             type: 'digital_wallet', institution: 'Nequi',       currency: 'COP' },
  { label: 'Daviplata',         type: 'digital_wallet', institution: 'Daviplata',   currency: 'COP' },
  { label: 'Global66',          type: 'bank',           institution: 'Global66',    currency: 'USD' },
  { label: 'Caja menor',        type: 'cash',           institution: '',            currency: 'COP' },
  { label: 'Visa Bancolombia',  type: 'credit_card',    institution: 'Bancolombia', currency: 'COP' },
  { label: 'MC NuBank',         type: 'credit_card',    institution: 'NuBank',      currency: 'COP' },
  { label: 'RappiCard',         type: 'credit_card',    institution: 'Rappi',       currency: 'COP' },
  { label: 'XTB',               type: 'investment',     institution: 'XTB',         currency: 'USD' },
  { label: 'Tyba',              type: 'investment',     institution: 'Tyba',        currency: 'COP' },
];

// Utilización de cupo para tarjetas (balance negativo = deuda).
function utilization(a) {
  if (a.type !== 'credit_card' || !a.creditLimit) return null;
  return Math.min(100, Math.round(Math.abs(a.balance || 0) / a.creditLimit * 100));
}

// ---------- Formulario ----------
function accountForm(existing) {
  const nameEl  = textInput({ name: 'name',        value: existing?.name        || '', placeholder: 'Ej. Bancolombia', required: true });
  const typeEl  = select({ name: 'type',           value: existing?.type        || 'bank', options: TYPES.map((t) => ({ value: t.value, label: t.label })) });
  const curEl   = textInput({ name: 'currency',    value: existing?.currency    || 'COP' });
  const balEl   = numberInput({ name: 'balance',   value: existing?.balance     ?? 0 });
  const instEl  = textInput({ name: 'institution', value: existing?.institution || '', placeholder: 'Opcional' });
  const ccExtra = el('div');

  function paintCcExtra() {
    ccExtra.innerHTML = '';
    if (typeEl.value !== 'credit_card') return;
    ccExtra.appendChild(el('div', { class: 'field-row' }, [
      field('Cupo total', numberInput({ name: 'creditLimit',  value: existing?.creditLimit  ?? '' })),
      field('Tasa E.A. %', numberInput({ name: 'interestRate', value: existing?.interestRate ?? '' })),
    ]));
    ccExtra.appendChild(el('div', { class: 'field-row' }, [
      field('Día de corte', numberInput({ name: 'cutoffDay',   value: existing?.cutoffDay   ?? '', placeholder: '5' })),
      field('Día de pago',  numberInput({ name: 'paymentDay',  value: existing?.paymentDay  ?? '', placeholder: '25' })),
    ]));
    ccExtra.appendChild(el('div', { class: 'field-row' }, [
      field('Pago mínimo ($)',  numberInput({ name: 'minPayment', value: existing?.minPayment ?? '', placeholder: '0' })),
      field('Total a pagar ($)', numberInput({ name: 'totalDue',  value: existing?.totalDue  ?? '', placeholder: '0' })),
    ]));
  }

  typeEl.addEventListener('change', paintCcExtra);
  if (existing?.type === 'credit_card') paintCcExtra();

  // Chips de preset (solo en modal "Nueva cuenta")
  const presetsRow = !existing
    ? el('div', { class: 'preset-chips' }, PRESETS.map((p) =>
        el('button', { type: 'button', class: 'preset-chip', text: p.label,
          on: { click: () => {
            nameEl.value  = p.label;
            typeEl.value  = p.type;
            curEl.value   = p.currency;
            instEl.value  = p.institution;
            typeEl.dispatchEvent(new Event('change'));
          }},
        })
      ))
    : null;

  return el('div', {}, [
    presetsRow,
    field('Nombre', nameEl),
    el('div', { class: 'field-row' }, [field('Tipo', typeEl), field('Moneda', curEl)]),
    el('div', { class: 'field-row' }, [field('Saldo actual', balEl), field('Institución', instEl)]),
    ccExtra,
  ].filter(Boolean));
}

export function openAccountModal(existing, { defaults = null } = {}) {
  const prefill = existing || defaults;
  const isCC    = prefill?.type === 'credit_card';
  const body    = accountForm(prefill);
  const title   = existing
    ? (isCC ? 'Editar tarjeta' : 'Editar cuenta')
    : (isCC ? 'Nueva tarjeta'  : 'Nueva cuenta');

  openModal({
    title, body,
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

// ---------- Fila de cuenta ----------
function accountRow(a) {
  const util   = utilization(a);
  const isCC   = a.type === 'credit_card';
  const subParts = [a.institution || '—'];
  if (util !== null) subParts.push(`${util}% utilizado`);
  // CC puede almacenar el saldo como positivo (monto adeudado) o negativo: normalizamos a negativo para display.
  const rawBal      = a.balance || 0;
  const displayBal  = isCC ? -Math.abs(rawBal) : rawBal;
  const amtCls      = isCC && rawBal !== 0 ? 'row__amount tabular text-negative' : 'row__amount tabular';

  return el('div', { class: 'row' }, [
    el('div', { class: 'row__avatar', html: icon(typeIcon(a.type)) }),
    el('div', { class: 'row__main' }, [
      el('div', { class: 'row__title' }, [a.name, ' ', Badge(typeLabel(a.type), isCC ? 'negative' : 'info')]),
      el('div', { class: 'row__sub', text: subParts.join(' · ') }),
      util !== null ? el('div', { class: 'util-bar' }, [
        el('div', { class: `util-bar__fill${util > 80 ? ' util-bar__fill--danger' : util > 50 ? ' util-bar__fill--warn' : ''}`, style: `width:${util}%` }),
      ]) : null,
    ].filter(Boolean)),
    el('div', { class: amtCls, text: formatMoney(displayBal, a.currency) }),
    el('div', { class: 'row__actions' }, [
      el('button', { class: 'icon-btn', 'aria-label': 'Editar', title: 'Editar',
        on: { click: () => openAccountModal(a) }, html: icon('edit') }),
      el('button', { class: 'icon-btn', 'aria-label': 'Archivar', title: 'Archivar',
        on: { click: () => confirmDialog({
          title: 'Archivar cuenta',
          message: `¿Archivar "${a.name}"? Sus transacciones se conservan.`,
          onConfirm: async () => {
            try { await dataService.update('accounts', a.id, { isArchived: true }); toast('Cuenta archivada'); }
            catch (e) { toast('Error al archivar', { type: 'negative' }); }
          },
        }) }, html: icon('archive') }),
      el('button', { class: 'icon-btn icon-btn--danger', 'aria-label': 'Eliminar', title: 'Eliminar',
        on: { click: () => confirmDialog({
          title: 'Eliminar cuenta', message: `¿Eliminar "${a.name}"? Esta acción es permanente.`,
          onConfirm: async () => {
            try { await dataService.remove('accounts', a.id); toast('Cuenta eliminada'); }
            catch (e) { toast('Error', { type: 'negative' }); }
          },
        }) }, html: icon('trash') }),
    ]),
  ]);
}

// ---------- Vista ----------
export function renderAccounts() {
  const root = el('div');

  function repaint() {
    const s        = store.get();
    const cur      = s.baseCurrency;
    const accounts = (s.accounts || []).filter((a) => !a.isArchived);

    // KPIs
    const liquid      = selectors.totalLiquidity(s);
    const ccDebt      = selectors.creditCardDebt(s);
    const creditAvail = (s.accounts || [])
      .filter((a) => !a.isArchived && a.type === 'credit_card' && (a.creditLimit || 0) > 0)
      .reduce((sum, a) => sum + Math.max(0, (a.creditLimit || 0) - Math.abs(a.balance || 0)), 0);

    const kpis = el('div', { class: 'grid grid--kpi' }, [
      KpiCard({ label: 'Activos líquidos', value: formatMoney(liquid, cur), iconName: 'wallet', variant: 'emerald' }),
      KpiCard({ label: 'Crédito disponible', value: creditAvail > 0 ? formatMoney(creditAvail, cur) : '—', iconName: 'accounts', variant: 'neutral' }),
      KpiCard({ label: 'Deuda CC', value: ccDebt > 0 ? formatMoney(ccDebt, cur) : '—', iconName: 'debts', variant: ccDebt > 0 ? 'negative' : 'neutral' }),
    ]);

    // Secciones agrupadas por tipo
    const groupEls = GROUPS
      .map(({ label, types }) => {
        const items = accounts.filter((a) => types.includes(a.type));
        if (!items.length) return null;
        const isCcGrp  = types.includes('credit_card');
        const rawTotal = items.reduce((sum, a) => sum + (a.balance || 0), 0);
        const total    = isCcGrp ? -Math.abs(rawTotal) : rawTotal;
        const totalCls = isCcGrp && rawTotal !== 0 ? 'acct-group__total tabular text-negative' : 'acct-group__total tabular';
        return el('div', { class: 'acct-group' }, [
          el('div', { class: 'acct-group__header' }, [
            el('span', { class: 'acct-group__label', text: label }),
            el('span', { class: totalCls, text: formatMoney(total, cur) }),
          ]),
          el('div', { class: 'card card--pad-sm' }, [
            el('div', { class: 'row-list' }, items.map(accountRow)),
          ]),
        ]);
      })
      .filter(Boolean);

    const content = accounts.length
      ? el('div', { class: 'stack' }, groupEls)
      : el('div', { class: 'card' }, [EmptyState({
          title: 'Sin cuentas', message: 'Crea tu primera cuenta para empezar.', iconName: 'accounts',
          action: Button('Nueva cuenta', { variant: 'primary', iconName: 'plus', onClick: () => openAccountModal(null) }),
        })]);

    mount(root,
      el('div', {}, [
        el('div', { class: 'page-header' }, [
          el('div', { class: 'row-flex between' }, [
            el('div', {}, [
              el('h2', { class: 't-h1', text: 'Cuentas' }),
              el('p', { class: 'page-header__sub', text: `${accounts.length} cuenta${accounts.length !== 1 ? 's' : ''}` }),
            ]),
            Button('Nueva cuenta', { variant: 'primary', iconName: 'plus', onClick: () => openAccountModal(null) }),
          ]),
        ]),
        kpis,
        content,
      ])
    );
  }

  store.subscribe(() => { if (root.isConnected) repaint(); });
  repaint();
  return root;
}
