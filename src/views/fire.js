// views/fire.js — Simulador FIRE (Financial Independence, Retire Early).
// Cálculo 100% local: FV con aportaciones mensuales + tabla de sensibilidad 3×3.
// No hay llamadas a red ni a IndexedDB. Los inputs se prelllenan desde los selectores
// y se actualizan en tiempo real (evento "input") sin botón de envío.

import { el, mount } from '../utils/dom.js';
import { store } from '../store/store.js'; // solo store.get() en el montaje inicial
import { selectors } from '../store/selectors.js';
import { formatMoney, formatNumber } from '../utils/format.js';
import { Card, KpiCard, EmptyState, ProgressBar } from '../components/ui.js';

// ---------- Matemáticas FIRE ----------

/**
 * Años hasta FIRE usando FV con aportaciones mensuales y crecimiento compuesto.
 * @param {number} patrimonioActual  Patrimonio neto actual (puede ser negativo)
 * @param {number} objetivo          Patrimonio objetivo FIRE (gastos / SWR)
 * @param {number} ahorroMensual     Aportación mensual (COP/mes)
 * @param {number} rendimientoAnual  Rendimiento real anual en tanto por uno (p.ej. 0.07)
 * @returns {number} Años (puede ser Infinity si no converge)
 */
function yearsToFire(patrimonioActual, objetivo, ahorroMensual, rendimientoAnual) {
  const falta = objetivo - patrimonioActual;
  if (falta <= 0) return 0; // ya alcanzado

  const monthlyRate = Math.pow(1 + rendimientoAnual, 1 / 12) - 1;

  let n; // número de meses
  if (ahorroMensual > 0 && monthlyRate > 0) {
    // n = log(1 + falta * r / PMT) / log(1 + r)
    const arg = 1 + (falta * monthlyRate) / ahorroMensual;
    if (arg <= 0) return Infinity; // el crecimiento nunca alcanza el objetivo
    n = Math.log(arg) / Math.log(1 + monthlyRate);
  } else if (ahorroMensual > 0) {
    // Sin rendimiento: contribuciones lineales
    n = falta / ahorroMensual;
  } else {
    return Infinity; // sin ahorros, nunca llega
  }

  return n / 12;
}

/**
 * Tasa de ahorro implícita basada en ahorro mensual y gastos anuales.
 * Ingresos estimados = ahorroMensual * 12 + gastosAnuales
 */
function savingsRateFromInputs(ahorroMensual, gastosAnuales) {
  const ingresoAnual = ahorroMensual * 12 + gastosAnuales;
  if (ingresoAnual <= 0) return 0;
  return (ahorroMensual * 12) / ingresoAnual * 100;
}

// ---------- Helpers de formato ----------

function fmtYears(years) {
  if (!isFinite(years)) return '∞';
  if (years <= 0) return '0';
  const y = Math.floor(years);
  const m = Math.round((years - y) * 12);
  if (y === 0) return `${m} mes${m !== 1 ? 'es' : ''}`;
  if (m === 0) return `${y} año${y !== 1 ? 's' : ''}`;
  return `${y} año${y !== 1 ? 's' : ''} ${m} mes${m !== 1 ? 'es' : ''}`;
}

function fmtYearsShort(years) {
  if (!isFinite(years)) return '∞';
  if (years <= 0) return '0a';
  const y = Math.ceil(years * 10) / 10;
  return `${formatNumber(y, { maximumFractionDigits: 1 })}a`;
}

// ---------- Componente de input numérico ----------

/**
 * Crea un campo de input numérico con etiqueta y nota opcional.
 * Devuelve { wrapper, input } para poder leer/escribir el valor.
 */
function numField({ id, label, value, min, max, step = 'any', note, suffix }) {
  const input = el('input', {
    id,
    class: 'input',
    type: 'number',
    value: String(value),
    ...(min !== undefined ? { min: String(min) } : {}),
    ...(max !== undefined ? { max: String(max) } : {}),
    step,
    'aria-label': label,
  });

  const labelEl = el('label', { for: id, class: 't-caption text-secondary', text: label });
  const noteEl = note ? el('span', { class: 't-micro text-tertiary', text: note }) : null;

  const wrapper = el('div', { class: 'fire-field' }, [
    el('div', { class: 'fire-field__head' }, [labelEl, noteEl].filter(Boolean)),
    el('div', { class: 'fire-field__control' }, [
      input,
      suffix ? el('span', { class: 'fire-field__suffix t-caption text-tertiary', text: suffix }) : null,
    ].filter(Boolean)),
  ]);

  return { wrapper, input };
}

// ---------- Tabla de sensibilidad ----------

function buildSensTable(baseAhorro, baseRendimiento, patrimonioActual, objetivo, cur) {
  const savingsMultipliers = [0.75, 1.0, 1.25];
  const returns = [0.05, 0.07, 0.09];
  const returnLabels = ['5%', '7%', '9%'];
  const savingsLabels = ['−25%', 'Base', '+25%'];

  // Encabezados: rendimiento en columnas
  const headerRow = el('tr', {}, [
    el('th', { class: 'fire-table__corner', text: 'Ahorro / Rend.' }),
    ...returnLabels.map((lbl) => el('th', { class: 'fire-table__th', text: lbl })),
  ]);

  const bodyRows = savingsMultipliers.map((sMult, ri) => {
    const cells = returns.map((ret, ci) => {
      const ahorro = baseAhorro * sMult;
      const years = yearsToFire(patrimonioActual, objetivo, ahorro, ret);
      const isCenter = ri === 1 && ci === 1;
      return el('td', {
        class: `fire-table__td${isCenter ? ' fire-table__td--highlight' : ''}`,
        text: fmtYearsShort(years),
        title: `Ahorro ${formatMoney(ahorro, cur)}/mes · Rendimiento ${(ret * 100).toFixed(0)}% → ${fmtYears(years)}`,
      });
    });
    return el('tr', {}, [
      el('td', { class: 'fire-table__label', text: savingsLabels[ri] }),
      ...cells,
    ]);
  });

  return el('table', { class: 'fire-table', role: 'table', 'aria-label': 'Tabla de sensibilidad: años hasta FIRE' }, [
    el('thead', {}, [headerRow]),
    el('tbody', {}, bodyRows),
  ]);
}

// ---------- Selector de variantes FIRE ----------

/**
 * Crea un grupo de botones para seleccionar la variante FIRE (SWR preset).
 * @param {HTMLInputElement} tasaInput  Input numérico de la tasa SWR.
 * @param {Function}         onSelect   Callback a llamar tras seleccionar.
 * @returns {HTMLElement}
 */
function buildVariantSelector(tasaInput, onSelect) {
  const variants = [
    { label: 'Lean (5%)',      swr: 5   },
    { label: 'Standard (4%)', swr: 4   },
    { label: 'Fat (3.5%)',     swr: 3.5 },
    { label: 'Barista (5.5%)', swr: 5.5 },
  ];

  const buttons = variants.map(({ label, swr }) => {
    const isDefault = swr === 4;
    const btn = el('button', {
      type: 'button',
      class: `btn btn--sm btn--ghost${isDefault ? ' btn--primary' : ''}`,
      text: label,
      title: `Establecer SWR al ${swr}%`,
    });
    btn.addEventListener('click', () => {
      tasaInput.value = String(swr);
      // Marcar activo
      for (const b of buttons) b.classList.remove('btn--primary');
      btn.classList.add('btn--primary');
      onSelect();
    });
    return btn;
  });

  return el('div', { class: 'fire-variants' }, buttons);
}

// ---------- Vista principal ----------

export function renderFire() {
  // Lee el estado UNA VEZ al montar. Los inputs no se recrean nunca después.
  // No hay store.subscribe: FIRE es cálculo puro; no necesita reaccionar a cambios del store.
  const s = store.get();
  const cur = s.baseCurrency || 'COP';

  const defaultGastos     = Math.round(selectors.monthlyExpense(s) * 12);
  const defaultAhorro     = Math.round(Math.max(0, selectors.monthlySavingsAvg(s, 3)));
  const defaultPatrimonio = Math.round(selectors.netWorth(s));
  const hasData = defaultGastos > 0 || defaultAhorro > 0;

  // Inputs — creados una sola vez
  const { wrapper: gastosW,      input: gastosI      } = numField({ id: 'fire-gastos',      label: 'Gastos anuales',       value: defaultGastos,     min: 0,    step: 100000, note: 'Base = gasto mensual × 12', suffix: cur });
  const { wrapper: ahorroW,      input: ahorroI      } = numField({ id: 'fire-ahorro',      label: 'Ahorro mensual',       value: defaultAhorro,     min: 0,    step: 100000, note: 'Prom. 3 meses',             suffix: `${cur}/mes` });
  const { wrapper: patrimonioW,  input: patrimonioI  } = numField({ id: 'fire-patrimonio',  label: 'Patrimonio actual',    value: defaultPatrimonio, step: 1000000,             note: 'Activos − Pasivos',         suffix: cur });
  const { wrapper: rendimientoW, input: rendimientoI } = numField({ id: 'fire-rendimiento', label: 'Rendimiento esperado', value: 7,   min: 0, max: 30,  step: 0.5, note: 'Real (post-inflación)',     suffix: '% anual' });
  const { wrapper: tasaW,        input: tasaI        } = numField({ id: 'fire-tasa',        label: 'Tasa de retiro (SWR)', value: 4,   min: 0.1, max: 10, step: 0.1, note: 'Regla del 4%',            suffix: '%' });

  // Tooltips informativos en los campos técnicos
  tasaW.title        = 'Safe Withdrawal Rate (SWR): % del patrimonio retirable anualmente sin agotarlo. 4% = Estudio Trinity. Barista FIRE = retiro parcial + trabajo part-time.';
  rendimientoW.title = 'Rendimiento real anual ajustado por inflación. Histórico acciones diversificadas: ~7%.';

  // Selector de variantes (encima de los inputs)
  const variantSelector = buildVariantSelector(tasaI, () => updateResults());

  // Áreas de salida — se actualizan en cada cambio de input, nunca se reemplaza el input
  const resultsArea = el('div', { class: 'fire-results' });
  const sensArea    = el('div', { class: 'fire-sens' });

  function updateResults() {
    const gastos     = Math.max(0, Number(gastosI.value) || 0);
    const ahorro     = Math.max(0, Number(ahorroI.value) || 0);
    const patrimonio = Number(patrimonioI.value) || 0;
    const rend       = Math.max(0, (Number(rendimientoI.value) || 7)) / 100;
    const swr        = Math.max(0.001, (Number(tasaI.value) || 4)) / 100;

    // EmptyState mejorado: cuando no hay datos de store y los inputs están vacíos
    if (!hasData && gastos === 0 && ahorro === 0) {
      mount(resultsArea, EmptyState({
        iconName: 'fire',
        title: 'Sin datos financieros',
        message: 'Registra transacciones para que el simulador se precargue, o ajusta los valores manualmente.',
      }));
      mount(sensArea);
      return;
    }

    const objetivo = gastos / swr;
    const falta    = Math.max(0, objetivo - patrimonio);
    const years    = yearsToFire(patrimonio, objetivo, ahorro, rend);
    const sr       = savingsRateFromInputs(ahorro, gastos);
    const reached  = patrimonio >= objetivo && objetivo > 0;

    // KPI: año estimado de alcanzar FIRE
    const targetYear = new Date().getFullYear() + Math.ceil(years);

    mount(resultsArea, el('div', { class: 'stack' }, [
      el('div', { class: 'grid grid--kpi' }, [
        KpiCard({ label: 'Patrimonio objetivo FIRE',  value: formatMoney(objetivo, cur, { compact: true }),                                                iconName: 'fire',      variant: 'accent' }),
        KpiCard({ label: reached ? 'Superávit' : 'Falta acumular', value: formatMoney(reached ? patrimonio - objetivo : falta, cur, { compact: true }), iconName: reached ? 'goals' : 'networth', variant: reached ? 'positive' : '' }),
        KpiCard({
          label: reached ? '¡Ya alcanzaste FIRE!' : 'Años hasta FIRE',
          value: reached ? '0' : fmtYearsShort(years),
          iconName: 'today',
          variant: reached ? 'positive' : !isFinite(years) ? 'negative' : '',
          foot: reached ? null : [
            el('span', { class: 't-micro text-secondary', text: fmtYears(years) }),
            isFinite(years) ? el('span', { class: 't-micro text-tertiary', text: `≈ ${targetYear}` }) : null,
          ].filter(Boolean),
        }),
        KpiCard({ label: 'Tasa de ahorro implícita', value: `${sr.toFixed(1)}%`,                                                                        iconName: 'analytics', variant: sr >= 50 ? 'positive' : sr >= 25 ? 'info' : sr > 0 ? 'warning' : 'negative' }),
      ]),
      // ProgressBar de avance hacia el objetivo
      objetivo > 0 ? el('div', { class: 'fire-progress' }, reached
        ? [el('p', { class: 't-caption text-secondary', text: '¡Objetivo FIRE alcanzado!' })]
        : [
          el('p', { class: 't-caption text-secondary', text: `Avance hacia el objetivo: ${Math.min(100, (patrimonio / objetivo * 100)).toFixed(1)}%` }),
          ProgressBar(
            Math.min(100, Math.max(0, (patrimonio / objetivo) * 100)),
            '',
            { ariaLabel: `Avance hacia el objetivo FIRE: ${Math.min(100, (patrimonio / objetivo * 100)).toFixed(1)}%` },
          ),
        ]
      ) : null,
    ].filter(Boolean)));

    if (ahorro > 0 && gastos > 0) {
      mount(sensArea, Card({
        title: 'Tabla de sensibilidad',
        body: el('div', {}, [
          el('p', { class: 't-caption text-secondary', text: 'Años hasta FIRE variando ahorro mensual (filas) y rendimiento real (columnas). La celda central es tu escenario base.' }),
          buildSensTable(ahorro, rend, patrimonio, objetivo, cur),
        ]),
      }));
    } else {
      mount(sensArea);
    }
  }

  for (const inp of [gastosI, ahorroI, patrimonioI, rendimientoI, tasaI]) {
    inp.addEventListener('input', updateResults);
  }

  updateResults();

  return el('div', {}, [
    el('div', { class: 'page-header' }, [
      el('div', {}, [
        el('h2', { class: 't-h1', text: 'Simulador FIRE' }),
        el('p', { class: 'page-header__sub', text: 'Financial Independence, Retire Early — ¿cuándo puedes dejar de trabajar por dinero?' }),
      ]),
    ]),
    el('div', { class: 'stack' }, [
      Card({
        title: 'Parámetros',
        body: el('div', { class: 'fire-inputs' }, [
          variantSelector,
          el('div', { class: 'fire-inputs__grid' }, [gastosW, ahorroW, patrimonioW, rendimientoW, tasaW]),
          !hasData ? el('p', { class: 't-caption text-secondary fire-inputs__hint', text: 'No hay transacciones registradas. Ajusta los valores manualmente para simular tu camino a la independencia financiera.' }) : null,
        ].filter(Boolean)),
      }),
      resultsArea,
      sensArea,
    ]),
  ]);
}
