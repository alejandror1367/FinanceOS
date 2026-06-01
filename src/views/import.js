// views/import.js — Módulo de importación de extractos (CSV, Excel, PDF).
// Soporta: Bancolombia, NuBank, Nequi, Global66, RappiPay (nativo) + XTB, AQR, PDFs (Claude).

import { el, mount } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { store } from '../store/store.js';
import { dataService } from '../services/dataService.js';
import { importService } from '../services/importService.js';
import { formatMoney, formatDate } from '../utils/format.js';
import { Button, Badge } from '../components/ui.js';
import { toast } from '../services/toast.js';

const ACCEPT = '.csv,.xlsx,.xls,.pdf';

const SOURCES = [
  { name: 'Bancolombia', hint: 'Extracto CSV/PDF' },
  { name: 'NuBank',      hint: 'CSV desde app' },
  { name: 'Nequi',       hint: 'CSV/PDF' },
  { name: 'Global66',    hint: 'CSV historial' },
  { name: 'RappiPay',    hint: 'PDF extracto' },
  { name: 'XTB',         hint: 'Excel/CSV historial' },
  { name: 'AQR Invest',  hint: 'Excel/PDF' },
];

const TYPE_LABEL = { income: 'Ingreso', expense: 'Gasto', transfer: 'Transferencia' };
const TYPE_COLOR = { income: 'positive', expense: 'negative', transfer: 'neutral' };

function duplicateKey(item) {
  return `${item.date}|${Math.abs(item.amount || 0).toFixed(0)}`;
}

export function renderImport() {
  const root = el('div');
  const state = {
    phase: 'idle',       // idle | analyzing | preview | importing | done
    progress: 'reading', // reading | pdf | ai
    file: null,
    result: null,        // { bank, type, currency, items[], period }
    accountId: '',
    selected: new Set(),
    duplicateKeys: new Set(),
    imported: 0,
  };

  // ---------- Re-render ----------
  function render() {
    root.innerHTML = '';
    const header = el('div', { class: 'view-header' }, [
      el('h1', { class: 'view-title' }, ['Importar datos']),
    ]);
    mount(root, header);

    if (state.phase === 'idle')      mount(root, buildIdle());
    if (state.phase === 'analyzing') mount(root, buildAnalyzing());
    if (state.phase === 'preview')   mount(root, buildPreview());
    if (state.phase === 'importing') mount(root, buildImporting());
    if (state.phase === 'done')      mount(root, buildDone());
  }

  // ---------- Handlers de archivo ----------
  function onFile(file) {
    if (!file) return;
    state.file = file;
    state.phase = 'analyzing';
    state.progress = 'reading';
    render();

    importService.processFile(file, (step) => {
      state.progress = step;
      render();
    }).then((result) => {
      state.result = result;
      state.phase = 'preview';

      // Pre-seleccionar todos los ítems
      state.selected = new Set(result.items.map((_, i) => i));

      // Detectar posibles duplicados contra transacciones existentes
      const existing = (store.get().transactions || []).map(duplicateKey);
      const existingSet = new Set(existing);
      state.duplicateKeys = new Set();
      result.items.forEach((item, i) => {
        if (existingSet.has(duplicateKey(item))) {
          state.duplicateKeys.add(i);
          state.selected.delete(i);
        }
      });

      // Cuenta por defecto: primera cuenta no archivada
      const accounts = (store.get().accounts || []).filter((a) => !a.isArchived);
      state.accountId = accounts[0]?.id || '';

      render();
    }).catch((err) => {
      state.phase = 'idle';
      render();
      toast(err.message || 'Error al procesar el archivo.', { type: 'error' });
    });
  }

  // ---------- Fase: Idle ----------
  function buildIdle() {
    const wrap = el('div', { class: 'import-wrap' });

    // Drop zone
    const input = el('input', { type: 'file', accept: ACCEPT, id: 'import-file-input' });
    input.addEventListener('change', () => { if (input.files[0]) onFile(input.files[0]); });

    const zone = el('label', { class: 'drop-zone', for: 'import-file-input' }, [
      el('div', { class: 'drop-zone__icon' }, [icon('importFile')]),
      el('p', { class: 'drop-zone__title' }, ['Arrastra tu extracto aquí']),
      el('p', { class: 'drop-zone__sub' }, ['o haz clic para seleccionar']),
      el('p', { class: 'drop-zone__formats' }, ['CSV · Excel (.xlsx) · PDF']),
    ]);

    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('dragover');
      const file = e.dataTransfer?.files?.[0];
      if (file) onFile(file);
    });

    mount(wrap, input);
    mount(wrap, zone);

    // Fuentes soportadas
    const sourcesGrid = el('div', { class: 'import-sources' });
    SOURCES.forEach(({ name, hint }) => {
      mount(sourcesGrid, el('div', { class: 'import-source-chip' }, [
        el('span', { class: 'import-source-name' }, [name]),
        el('span', { class: 'import-source-hint' }, [hint]),
      ]));
    });

    mount(wrap, el('div', { class: 'import-sources-label' }, ['Fuentes soportadas']));
    mount(wrap, sourcesGrid);

    // Instrucciones
    mount(wrap, el('div', { class: 'import-help' }, [
      el('p', {}, ['Para Bancolombia y NuBank descarga el CSV desde la app o portal web. Para XTB usa la exportación de historial de operaciones. Para PDFs escaneados o formatos desconocidos se usará IA automáticamente.']),
    ]));

    return wrap;
  }

  // ---------- Fase: Analizando ----------
  function buildAnalyzing() {
    const STEPS = {
      reading: { label: 'Leyendo archivo…',         sub: 'Procesando localmente' },
      pdf:     { label: 'Extrayendo texto del PDF…', sub: 'Analizando con PDF.js' },
      ai:      { label: 'Interpretando con IA…',     sub: 'Enviando a Claude (Sonnet)' },
    };
    const step = STEPS[state.progress] || STEPS.reading;

    return el('div', { class: 'import-analyzing' }, [
      el('div', { class: 'import-analyzing__icon' }, [icon('importFile')]),
      el('p', { class: 'import-analyzing__file' }, [state.file?.name || '']),
      el('div', { class: 'import-spinner' }),
      el('p', { class: 'import-analyzing__label' }, [step.label]),
      el('p', { class: 'import-analyzing__sub' }, [step.sub]),
    ]);
  }

  // ---------- Fase: Preview ----------
  function buildPreview() {
    const { result, accountId } = state;
    const { bank, items, currency, period } = result;
    const s = store.get();
    const accounts = (s.accounts || []).filter((a) => !a.isArchived);
    const categories = s.categories || [];

    const dupCount = state.duplicateKeys.size;
    const selectedCount = state.selected.size;
    const isInvestment = result.type === 'investment';

    const wrap = el('div', { class: 'import-preview' });

    // Header con info del banco
    const bankBadge = el('span', { class: 'import-bank-badge', style: `background:${bank.color || 'var(--accent)'};color:${bank.textColor || '#fff'}` }, [bank.name]);
    const periodText = period ? `${formatDate(period.from)} – ${formatDate(period.to)}` : '';
    mount(wrap, el('div', { class: 'import-preview-header' }, [
      bankBadge,
      el('span', { class: 'import-preview-meta' }, [`${items.length} transacciones · ${currency}${periodText ? ' · ' + periodText : ''}`]),
    ]));

    // Advertencia duplicados
    if (dupCount > 0) {
      mount(wrap, el('div', { class: 'import-warning' }, [
        icon('bell'),
        el('span', {}, [`${dupCount} posible${dupCount > 1 ? 's' : ''} duplicado${dupCount > 1 ? 's' : ''} detectado${dupCount > 1 ? 's' : ''} y deseleccionado${dupCount > 1 ? 's' : ''} automáticamente.`]),
      ]));
    }

    // Advertencia inversiones
    if (isInvestment) {
      mount(wrap, el('div', { class: 'import-warning import-warning--info' }, [
        icon('investments'),
        el('span', {}, ['Archivo de broker detectado. Las operaciones se importarán como transacciones. Puedes actualizar tus posiciones en Inversiones manualmente.']),
      ]));
    }

    // Selector de cuenta
    if (!isInvestment) {
      const accSel = el('select', { class: 'input import-account-sel' });
      if (!accounts.length) {
        mount(accSel, el('option', { value: '' }, ['Sin cuentas — crea una primero']));
      } else {
        accounts.forEach((a) => {
          const opt = el('option', { value: a.id }, [a.name]);
          if (a.id === accountId) opt.selected = true;
          mount(accSel, opt);
        });
      }
      accSel.addEventListener('change', () => { state.accountId = accSel.value; });
      mount(wrap, el('div', { class: 'import-account-row' }, [
        el('label', { class: 'import-account-label' }, ['Importar a cuenta']),
        accSel,
      ]));
    }

    // Selector de categoría por defecto
    const expCats = categories.filter((c) => c.kind === 'expense');
    const catSel = el('select', { class: 'input import-account-sel' });
    mount(catSel, el('option', { value: '' }, ['Sin categoría']));
    expCats.forEach((c) => {
      mount(catSel, el('option', { value: c.id }, [c.name]));
    });
    let defaultCategoryId = '';
    catSel.addEventListener('change', () => { defaultCategoryId = catSel.value; });
    mount(wrap, el('div', { class: 'import-account-row' }, [
      el('label', { class: 'import-account-label' }, ['Categoría por defecto (gastos)'],),
      catSel,
    ]));

    // Tabla
    const table = el('table', { class: 'import-table' });
    const thead = el('thead');
    const allChecked = el('input', { type: 'checkbox', checked: selectedCount === items.length });
    allChecked.addEventListener('change', () => {
      if (allChecked.checked) items.forEach((_, i) => state.selected.add(i));
      else state.selected.clear();
      render();
    });
    mount(thead, el('tr', {}, [
      el('th', {}, [allChecked]),
      el('th', {}, ['Fecha']),
      el('th', {}, ['Descripción']),
      el('th', { class: 'text-right' }, ['Monto']),
      el('th', {}, ['Tipo']),
    ]));
    mount(table, thead);

    const tbody = el('tbody');
    items.forEach((item, i) => {
      const isDup = state.duplicateKeys.has(i);
      const isSel = state.selected.has(i);
      const tr = el('tr', { class: `import-row${isDup ? ' import-row--dup' : ''}${!isSel ? ' import-row--desel' : ''}` });

      const chk = el('input', { type: 'checkbox' });
      chk.checked = isSel;
      chk.addEventListener('change', () => {
        if (chk.checked) state.selected.add(i);
        else state.selected.delete(i);
        allChecked.checked = state.selected.size === items.length;
        tr.className = `import-row${state.duplicateKeys.has(i) ? ' import-row--dup' : ''}${!state.selected.has(i) ? ' import-row--desel' : ''}`;
      });

      const amountClass = `import-amount import-amount--${item.type === 'income' ? 'pos' : item.type === 'expense' ? 'neg' : 'neu'}`;
      const sign = item.type === 'income' ? '+' : item.type === 'expense' ? '-' : '±';
      const desc = String(item.description || item.symbol || '').slice(0, 55);

      mount(tr, el('td', {}, [chk]));
      mount(tr, el('td', { class: 'import-date' }, [item.date || '—']));
      mount(tr, el('td', { class: 'import-desc', title: item.description || '' }, [desc]));
      mount(tr, el('td', { class: amountClass }, [`${sign} ${formatMoney(item.amount || 0)}`]));
      mount(tr, el('td', {}, [Badge({ label: TYPE_LABEL[item.type] || item.tradeType || item.type, color: TYPE_COLOR[item.type] || 'neutral' })]));

      if (isDup) mount(tr, el('td', {}, [Badge({ label: 'Posible dup.', color: 'warning' })]));

      mount(tbody, tr);
    });
    mount(table, tbody);

    const tableWrap = el('div', { class: 'import-table-wrap' });
    mount(tableWrap, table);
    mount(wrap, tableWrap);

    // Footer con botones
    const footer = el('div', { class: 'import-footer' });

    mount(footer, Button({
      label: 'Cancelar',
      variant: 'ghost',
      onClick: () => { state.phase = 'idle'; state.file = null; state.result = null; render(); },
    }));

    const importBtn = Button({
      label: `Importar ${selectedCount} transacción${selectedCount !== 1 ? 'es' : ''}`,
      onClick: doImport,
      disabled: selectedCount === 0 || (!isInvestment && !state.accountId),
    });
    mount(footer, importBtn);
    mount(wrap, footer);

    async function doImport() {
      state.phase = 'importing';
      state.imported = 0;
      render();

      const toImport = items.filter((_, i) => state.selected.has(i));
      let ok = 0;

      for (const item of toImport) {
        try {
          const tx = {
            date: item.date,
            description: item.description || item.symbol || '',
            amount: Number(item.amount) || 0,
            type: item.type || 'expense',
            accountId: state.accountId || undefined,
            categoryId: (item.type === 'expense' ? defaultCategoryId : undefined) || undefined,
            currency: item.currency || result.currency || 'COP',
            importedFrom: bank.name || 'Import',
          };
          await dataService.mutate('transactions', 'create', tx);
          ok++;
          state.imported = ok;
        } catch (err) {
          toast(`Error en fila: ${err.message}`, { type: 'warning' });
        }
      }

      state.imported = ok;
      state.phase = 'done';
      render();
    }

    return wrap;
  }

  // ---------- Fase: Importando ----------
  function buildImporting() {
    const total = state.result?.items?.length || 0;
    const selTotal = state.selected?.size || 0;
    return el('div', { class: 'import-analyzing' }, [
      el('div', { class: 'import-spinner' }),
      el('p', { class: 'import-analyzing__label' }, [`Importando ${state.imported} de ${selTotal}…`]),
      el('p', { class: 'import-analyzing__sub' }, ['Creando transacciones y ajustando saldos']),
    ]);
  }

  // ---------- Fase: Done ----------
  function buildDone() {
    const wrap = el('div', { class: 'import-done' });
    mount(wrap, el('div', { class: 'import-done__icon' }, [icon('check')]));
    mount(wrap, el('h2', { class: 'import-done__title' }, [`${state.imported} transacción${state.imported !== 1 ? 'es' : ''} importada${state.imported !== 1 ? 's' : ''}`]));
    mount(wrap, el('p', { class: 'import-done__sub' }, ['Los saldos se actualizarán al sincronizar.']));

    const actions = el('div', { class: 'import-done__actions' });
    mount(actions, Button({
      label: 'Importar otro archivo',
      variant: 'outline',
      onClick: () => { state.phase = 'idle'; state.file = null; state.result = null; render(); },
    }));
    mount(actions, Button({
      label: 'Ver transacciones',
      onClick: () => { location.hash = '#/transactions'; },
    }));
    mount(wrap, actions);
    return wrap;
  }

  render();
  return root;
}
