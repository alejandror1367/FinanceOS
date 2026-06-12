// views/accounts.js — módulo de Cuentas (CRUD + ecosistema financiero).
// Grupos por tipo, KPIs de liquidez/crédito/deuda, presets colombianos, archivar, reactivo.

import { el, mount } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { store } from '../store/store.js';
import { selectors } from '../store/selectors.js';
import { dataService } from '../services/dataService.js';
import { formatMoney, formatDate } from '../utils/format.js';
import { Button, Badge, EmptyState, KpiCard } from '../components/ui.js';
import { openModal, confirmDialog } from '../components/modal.js';
import { field, textInput, numberInput, select, setFieldError, focusFieldError } from '../components/forms.js';
import { toast } from '../services/toast.js';
import { guardedOp, guardedSave } from '../components/crud.js';

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

// Tipos de cuenta que pueden ser remuneradas (rinden interés EA): ahorro, banco,
// billetera digital (Nequi/RappiCuenta) y cuenta de inversión (cash del broker).
// credit_card NO entra: su interestRate es el costo del crédito, no un rendimiento.
const YIELD_TYPES = ['savings', 'bank', 'digital_wallet', 'investment'];
const isYieldType = (t) => YIELD_TYPES.includes(t);

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
  { label: 'RappiCuenta',       type: 'savings',        institution: 'Rappi',       currency: 'COP', interestRate: 9 },
  { label: 'Porvenir Cesantías', type: 'savings',       institution: 'Porvenir',    currency: 'COP', subtype: 'cesantias' },
  { label: 'ARQ Invest',        type: 'digital_wallet', institution: 'ARQ Invest',  currency: 'USD' },
  { label: 'Caja menor',        type: 'cash',           institution: '',            currency: 'COP' },
  { label: 'Visa Bancolombia',  type: 'credit_card',    institution: 'Bancolombia', currency: 'COP' },
  { label: 'MC NuBank',         type: 'credit_card',    institution: 'NuBank',      currency: 'COP' },
  { label: 'RappiCard',         type: 'credit_card',    institution: 'Rappi',       currency: 'COP' },
  { label: 'XTB',               type: 'investment',     institution: 'XTB',         currency: 'USD' },
  { label: 'Tyba',              type: 'investment',     institution: 'Tyba',        currency: 'COP' },
  { label: 'Trii',              type: 'investment',     institution: 'Trii',        currency: 'COP' },
  { label: 'Interactive Brokers', type: 'investment',   institution: 'IBKR',        currency: 'USD' },
  { label: 'Trading212',        type: 'investment',     institution: 'Trading212',  currency: 'USD' },
  { label: 'Bcolombia Valores', type: 'investment',     institution: 'Bancolombia', currency: 'COP' },
  { label: 'Finandina',         type: 'bank',           institution: 'Finandina',   currency: 'COP' },
  { label: 'RappiPay',          type: 'digital_wallet', institution: 'Rappi',       currency: 'COP' },
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
  // CC almacena el saldo como negativo (−200k = debes 200k). En el form mostramos el valor
  // absoluto para que el usuario ingrese "200000" (lo que debe), no "-200000".
  const balEl   = numberInput({ name: 'balance',   value: existing?.type === 'credit_card' ? Math.abs(existing?.balance ?? 0) : (existing?.balance ?? 0) });
  const instEl  = textInput({ name: 'institution', value: existing?.institution || '', placeholder: 'Opcional' });
  const extra = el('div');

  // Campos extra según el tipo: tarjeta de crédito (cupo, corte, pago) o
  // cuenta remunerada savings/bank (tasa EA para estimar el rendimiento — Sprint D).
  function paintExtra() {
    extra.innerHTML = '';
    const t = typeEl.value;
    if (t === 'credit_card') {
      extra.appendChild(el('div', { class: 'field-row' }, [
        field('Cupo total', numberInput({ name: 'creditLimit',  value: existing?.creditLimit  ?? '' })),
        field('Tasa E.A. %', numberInput({ name: 'interestRate', value: existing?.interestRate ?? '' })),
      ]));
      extra.appendChild(el('div', { class: 'field-row' }, [
        field('Día de corte', numberInput({ name: 'cutoffDay',   value: existing?.cutoffDay   ?? '', placeholder: '5' })),
        field('Día de pago',  numberInput({ name: 'paymentDay',  value: existing?.paymentDay  ?? '', placeholder: '25' })),
      ]));
      extra.appendChild(el('div', { class: 'field-row' }, [
        field('Pago mínimo ($)',  numberInput({ name: 'minPayment', value: existing?.minPayment ?? '', placeholder: '0' })),
        field('Total a pagar ($)', numberInput({ name: 'totalDue',  value: existing?.totalDue  ?? '', placeholder: '0' })),
      ]));
    } else if (isYieldType(t)) {
      extra.appendChild(el('div', { class: 'field-row' }, [
        field('Tasa E.A. % (rendimiento)', numberInput({ name: 'interestRate', value: existing?.interestRate ?? '', placeholder: '0' })),
      ]));
      // Subtipo (solo ahorro): "Cesantías" marca fondos NO retirables libremente
      // (p. ej. Porvenir) — se excluyen de los activos líquidos, pero el saldo
      // sigue contando en el patrimonio.
      if (t === 'savings') {
        extra.appendChild(field('Subtipo', select({
          name: 'subtype',
          value: existing?.subtype || '',
          options: [
            { value: '', label: 'Cuenta de ahorro normal' },
            { value: 'cesantias', label: 'Cesantías — bloqueada de los activos líquidos' },
          ],
        })));
      }
    }
  }

  typeEl.addEventListener('change', paintExtra);
  paintExtra();

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
            // Los campos extra los crea paintExtra tras el change; setearlos después.
            if (p.interestRate != null) {
              const ir = extra.querySelector('[name="interestRate"]');
              if (ir) ir.value = p.interestRate;
            }
            if (p.subtype) {
              const st = extra.querySelector('[name="subtype"]');
              if (st) st.value = p.subtype;
            }
          }},
        })
      ))
    : null;

  return el('div', {}, [
    presetsRow,
    field('Nombre', nameEl),
    el('div', { class: 'field-row' }, [field('Tipo', typeEl), field('Moneda', curEl)]),
    el('div', { class: 'field-row' }, [field('Saldo actual', balEl), field('Institución', instEl)]),
    extra,
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
      const rawBalance = Number(get('balance').value) || 0;
      const accType    = get('type').value;
      const data = {
        name:        get('name').value.trim(),
        type:        accType,
        currency:    (get('currency').value || 'COP').trim().toUpperCase().slice(0, 3),
        // CC: el usuario ingresa el monto que debe (positivo); se guarda como negativo.
        // Convención: balance < 0 en CC → más deuda al gastar → _adjustAccountBalances correcto.
        balance:     accType === 'credit_card' ? -Math.abs(rawBalance) : rawBalance,
        institution: get('institution').value.trim(),
      };
      if (data.type === 'credit_card') {
        data.creditLimit  = Number(get('creditLimit')?.value)  || 0;
        data.interestRate = Number(get('interestRate')?.value) || 0;
        data.cutoffDay    = Number(get('cutoffDay')?.value)    || 0;
        data.paymentDay   = Number(get('paymentDay')?.value)   || 0;
        data.minPayment   = Number(get('minPayment')?.value)   || 0;
        data.totalDue     = Number(get('totalDue')?.value)     || 0;
      } else if (isYieldType(data.type)) {
        // Cuenta remunerada: tasa EA para el rendimiento estimado (Sprint D).
        data.interestRate = Number(get('interestRate')?.value) || 0;
        // Subtipo solo aplica a savings; al cambiar de tipo se limpia explícitamente.
        data.subtype = data.type === 'savings' ? (get('subtype')?.value || '') : '';
      }
      if (!data.name) { focusFieldError(get('name')); return setFieldError(get('name'), 'El nombre es obligatorio'); }
      return guardedSave(
        () => existing ? dataService.update('accounts', existing.id, data) : dataService.create('accounts', data),
        existing ? 'Cuenta actualizada' : 'Cuenta creada',
      );
    },
  });
}

// ---------- Registrar rendimiento (cuentas remuneradas, Sprint D) ----------
function previewRow(label, value) {
  return el('div', { class: 'row' }, [
    el('div', { class: 'row__main' }, [el('div', { class: 'row__title', text: label })]),
    el('div', { class: 'row__amount tabular', text: value }),
  ]);
}

// D.5: el rendimiento se registra como UNA transacción de ingreso sobre la cuenta —
// sube el saldo una sola vez (fuente única, sin doble conteo con la liquidez).
// D.4: preview → confirmar → tx ingreso + lastYieldDate. Idempotencia por período:
// tras registrar, lastYieldDate = hoy, así un segundo intento el mismo período
// estima $0 y se bloquea antes de abrir el modal.
export function openYieldModal(a) {
  const s   = store.get();
  const now = new Date();
  const toISO   = now.toISOString().slice(0, 10);
  const fromISO = String(a.lastYieldDate || a.createdAt || toISO).slice(0, 10);
  const amount  = Math.round(selectors.accountYield(s, a.id, now));

  if (amount <= 0) {
    toast('No hay rendimiento para registrar en este período', { type: 'info' });
    return;
  }

  // Categoría de ingreso para rendimientos si existe; si no, sin categoría.
  const yieldCat = (s.categories || []).find(
    (c) => c.type === 'income' && /rendi|inter[eé]s|inver/i.test(c.name || '')
  );

  const body = el('div', { class: 'stack' }, [
    el('p', { class: 't-body text-secondary', text:
      `Se registrará el rendimiento estimado de "${a.name}" como un ingreso en la cuenta.` }),
    el('div', { class: 'card card--pad-sm' }, [
      el('div', { class: 'row-list' }, [
        previewRow('Período', `${formatDate(fromISO, 'short')} → ${formatDate(toISO, 'short')}`),
        previewRow('Tasa', `${a.interestRate}% E.A.`),
        previewRow('Rendimiento estimado', formatMoney(amount, a.currency)),
      ]),
    ]),
    el('p', { class: 't-caption text-tertiary', text:
      'Calculado sobre el saldo promedio del período (no el saldo actual). Es una estimación.' }),
    // Caveat: el saldo de cuentas de inversión se excluye del patrimonio (se cuentan las
    // posiciones, no el cash del broker), así que este rendimiento sube el saldo y el
    // flujo de caja, pero no el patrimonio neto a menos que registres ese cash aparte.
    a.type === 'investment'
      ? el('p', { class: 't-caption text-negative', text:
          'Nota: el saldo de cuentas de inversión no se cuenta en el patrimonio (solo las posiciones). El rendimiento se verá en flujo de caja y en el saldo de la cuenta.' })
      : null,
  ].filter(Boolean));

  openModal({
    title: 'Registrar rendimiento',
    body,
    submitLabel: 'Registrar',
    onSubmit: () => guardedSave(async () => {
      await dataService.create('transactions', {
        type: 'income',
        amount,
        date: toISO,
        accountId: a.id,
        categoryId: yieldCat?.id || '',
        currency: a.currency || 'COP',
        description: `Rendimiento ${a.name}`,
      });
      // No tocar balance aquí: la tx de ingreso ya lo ajusta (fuente única).
      await dataService.update('accounts', a.id, { lastYieldDate: toISO });
    }, 'Rendimiento registrado'),
  });
}

// ---------- Fila de cuenta ----------
function accountRow(a) {
  const util    = utilization(a);
  const isCC    = a.type === 'credit_card';
  const isYield = isYieldType(a.type) && Number(a.interestRate) > 0;
  const subParts = [a.institution || '—'];
  if (util !== null) subParts.push(`${util}% utilizado`);
  // CC puede almacenar el saldo como positivo (monto adeudado) o negativo: normalizamos a negativo para display.
  const rawBal      = a.balance || 0;
  const displayBal  = isCC ? -Math.abs(rawBal) : rawBal;
  const amtCls      = isCC && rawBal !== 0 ? 'row__amount tabular text-negative' : 'row__amount tabular';

  return el('div', { class: 'row' }, [
    el('div', { class: 'row__avatar', html: icon(typeIcon(a.type)) }),
    el('div', { class: 'row__main' }, [
      el('div', { class: 'row__title' }, [
        a.name, ' ', Badge(typeLabel(a.type), isCC ? 'negative' : 'info'),
        isYield ? ' ' : null,
        isYield ? Badge(`${a.interestRate}% EA`, 'positive') : null,
        a.subtype === 'cesantias' ? ' ' : null,
        a.subtype === 'cesantias' ? Badge('Cesantías · no líquida', 'gold') : null,
      ].filter(Boolean)),
      el('div', { class: 'row__sub', text: subParts.join(' · ') }),
      util !== null ? el('div', { class: 'util-bar' }, [
        el('div', { class: `util-bar__fill${util > 80 ? ' util-bar__fill--danger' : util > 50 ? ' util-bar__fill--warn' : ''}`, style: `width:${util}%` }),
      ]) : null,
    ].filter(Boolean)),
    el('div', { class: amtCls, text: formatMoney(displayBal, a.currency) }),
    el('div', { class: 'row__actions' }, [
      isYield ? el('button', { class: 'icon-btn', 'aria-label': 'Registrar rendimiento', title: 'Registrar rendimiento',
        on: { click: () => openYieldModal(a) }, html: icon('budgets') }) : null,
      el('button', { class: 'icon-btn', 'aria-label': 'Editar', title: 'Editar',
        on: { click: () => openAccountModal(a) }, html: icon('edit') }),
      el('button', { class: 'icon-btn', 'aria-label': 'Archivar', title: 'Archivar',
        on: { click: () => confirmDialog({
          title: 'Archivar cuenta',
          message: `¿Archivar "${a.name}"? Sus transacciones se conservan.`,
          onConfirm: () => guardedOp(() => dataService.update('accounts', a.id, { isArchived: true }), 'Cuenta archivada', 'Error al archivar'),
        }) }, html: icon('archive') }),
      el('button', { class: 'icon-btn icon-btn--danger', 'aria-label': 'Eliminar', title: 'Eliminar',
        on: { click: () => confirmDialog({
          title: 'Eliminar cuenta', message: `¿Eliminar "${a.name}"? Esta acción es permanente.`,
          onConfirm: () => guardedOp(() => dataService.remove('accounts', a.id), 'Cuenta eliminada'),
        }) }, html: icon('trash') }),
    ]),
  ]);
}

// ---------- Vista ----------
export function renderAccounts() {
  const root = el('div');

  // P2 (UX): filtro por categoría — chips segmentados que muestran un solo grupo
  // (o todos). Reduce el scroll vertical y facilita explorar activos en móvil.
  // Persiste entre repaints de la vista (variable del closure), vuelve a "Todas" al navegar.
  let groupFilter = 'all';

  function repaint() {
    const s        = store.get();
    const cur      = s.baseCurrency;
    const accounts = (s.accounts || []).filter((a) => !a.isArchived);

    // KPIs
    const liquid      = selectors.totalLiquidity(s);
    const ccDebt      = selectors.creditCardDebt(s);
    const creditAvail = selectors.sumAccountsInBase(
      s,
      (s.accounts || []).filter((a) => !a.isArchived && a.type === 'credit_card' && (a.creditLimit || 0) > 0),
      (a) => Math.max(0, (a.creditLimit || 0) - Math.abs(a.balance || 0)),
    );

    const kpis = el('div', { class: 'grid grid--kpi' }, [
      KpiCard({ label: 'Activos líquidos', value: formatMoney(liquid, cur), iconName: 'wallet', variant: 'emerald' }),
      KpiCard({ label: 'Crédito disponible', value: creditAvail > 0 ? formatMoney(creditAvail, cur) : '—', iconName: 'accounts', variant: 'neutral' }),
      KpiCard({ label: 'Deuda CC', value: ccDebt > 0 ? formatMoney(ccDebt, cur) : '—', iconName: 'debts', variant: ccDebt > 0 ? 'negative' : 'neutral' }),
    ]);

    // Chips de navegación por categoría (con conteo). "Todas" restaura la vista completa.
    const chipDefs = [{ key: 'all', label: 'Todas', count: accounts.length }]
      .concat(GROUPS
        .map((g) => ({ key: g.key, label: g.label, count: accounts.filter((a) => g.types.includes(a.type)).length }))
        .filter((g) => g.count > 0));
    if (!chipDefs.some((c) => c.key === groupFilter)) groupFilter = 'all';
    const groupChips = el('div', { class: 'group-chips', role: 'tablist', 'aria-label': 'Categorías de cuentas' },
      chipDefs.map((c) => el('button', {
        class: `group-chip${groupFilter === c.key ? ' group-chip--active' : ''}`,
        role: 'tab', 'aria-selected': String(groupFilter === c.key),
        on: { click: () => { groupFilter = c.key; repaint(); } },
      }, [
        el('span', { text: c.label }),
        el('span', { class: 'group-chip__count', text: String(c.count) }),
      ])));

    // Secciones agrupadas por tipo (filtradas por el chip activo)
    const groupEls = GROUPS
      .filter((g) => groupFilter === 'all' || g.key === groupFilter)
      .map(({ label, types }) => {
        const items = accounts.filter((a) => types.includes(a.type));
        if (!items.length) return null;
        const isCcGrp  = types.includes('credit_card');
        // P1/P2: orden DESCENDENTE por valor equivalente en COP (FX) — nunca por el
        // nominal de la divisa. Tarjetas: por magnitud de la deuda (mayor primero).
        // Reactivo: repaint corre en cada cambio del store, el orden se recalcula solo.
        const valBase = (a) => selectors.sumAccountsInBase(s, [a]);
        items.sort((a, b) => (isCcGrp
          ? Math.abs(valBase(b)) - Math.abs(valBase(a))
          : valBase(b) - valBase(a)));
        // Total del grupo EN MONEDA BASE (FX): antes sumaba saldos crudos y una
        // billetera/cuenta en USD se mezclaba 1:1 con las de COP.
        const rawTotal = selectors.sumAccountsInBase(s, items);
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
      ? el('div', { class: 'stack stack--lg' }, groupEls)
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
        accounts.length ? groupChips : null,
        content,
      ].filter(Boolean))
    );
  }

  store.subscribe(() => { if (root.isConnected) repaint(); });
  repaint();
  return root;
}
