// views/import.js — Módulo de importación de extractos (CSV, Excel, PDF).
// Soporta: Bancolombia, NuBank, Nequi, Global66, RappiPay, XTB (nativo) + cualquier PDF (Gemini).

import { el } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { store } from '../store/store.js';
import { dataService } from '../services/dataService.js';
import { importService, UnknownFormatError, dupKey } from '../services/importService.js';
import { formatMoney, formatDate } from '../utils/format.js';
import { Button, Badge } from '../components/ui.js';
import { toast } from '../services/toast.js';

const ACCEPT = '.csv,.xlsx,.xls,.pdf';

const SOURCES = [
  { name: 'Bancolombia', hint: 'CSV / PDF' },
  { name: 'NuBank',      hint: 'CSV desde app' },
  { name: 'Nequi',       hint: 'CSV / PDF' },
  { name: 'Global66',    hint: 'CSV historial' },
  { name: 'RappiPay',    hint: 'PDF extracto' },
  { name: 'XTB',         hint: 'Excel / CSV' },
  { name: 'AQR Invest',  hint: 'Excel / PDF' },
];

const TYPE_LABEL = { income: 'Ingreso', expense: 'Gasto', transfer: 'Transferencia' };
const TYPE_COLOR  = { income: 'positive', expense: 'negative', transfer: 'neutral' };

export function renderImport() {
  const root = el('div');

  const state = {
    phase: 'idle',
    progress: 'reading',
    file: null,
    result: null,
    accountId: '',
    defaultCategoryId: '',
    selected: new Set(),
    dupIndices: new Set(),
    imported: 0,
  };

  // ---------- render: reemplaza contenido del root de una vez ----------
  function render() {
    let body;
    if (state.phase === 'idle')           body = buildIdle();
    else if (state.phase === 'analyzing') body = buildAnalyzing();
    else if (state.phase === 'preview')   body = buildPreview();
    else if (state.phase === 'importing') body = buildImporting();
    else if (state.phase === 'unknown')   body = buildUnknown();
    else                                  body = buildDone();

    const header = el('div', { class: 'view-header' }, [
      el('h1', { class: 'view-title' }, ['Importar datos']),
    ]);
    root.replaceChildren(header, body);
  }

  // ---------- onFile ----------
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
      if (!result) return;
      state.result = result;
      state.selected = new Set(result.items.map((_, i) => i));

      const existingKeys = new Set((store.get().transactions || []).map(dupKey));
      state.dupIndices = new Set();
      result.items.forEach((item, i) => {
        if (existingKeys.has(dupKey(item))) {
          state.dupIndices.add(i);
          state.selected.delete(i);
        }
      });

      const accounts = (store.get().accounts || []).filter((a) => !a.isArchived);
      state.accountId = accounts[0]?.id || '';

      state.phase = 'preview';
      render();
    }).catch((err) => {
      if (err instanceof UnknownFormatError) {
        state.phase = 'unknown';
        state.unknownHeaders = err.headers;
      } else {
        state.phase = 'idle';
        toast(err.message || 'Error al procesar el archivo.', { type: 'negative' });
      }
      render();
    });
  }

  // ---------- Idle ----------
  function buildIdle() {
    const wrap = el('div', { class: 'import-wrap' });

    // Input oculto + label como drop zone
    const fileInput = el('input', {
      type: 'file', accept: ACCEPT, id: 'import-file-input',
      style: 'display:none',
    });
    fileInput.addEventListener('change', () => { if (fileInput.files[0]) onFile(fileInput.files[0]); });

    const zone = el('label', { class: 'drop-zone', for: 'import-file-input' });
    zone.appendChild(el('div', { class: 'drop-zone__icon', html: icon('importFile') }));
    zone.appendChild(el('p', { class: 'drop-zone__title' }, ['Arrastra tu extracto aquí']));
    zone.appendChild(el('p', { class: 'drop-zone__sub' }, ['o haz clic para seleccionar']));
    zone.appendChild(el('p', { class: 'drop-zone__formats' }, ['CSV · Excel (.xlsx) · PDF']));
    zone.appendChild(fileInput);

    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('dragover');
      const f = e.dataTransfer?.files?.[0];
      if (f) onFile(f);
    });

    wrap.appendChild(zone);

    // Fuentes soportadas
    const sourcesLabel = el('p', { class: 'import-sources-label' }, ['Fuentes soportadas']);
    const sourcesGrid = el('div', { class: 'import-sources' });
    SOURCES.forEach(({ name, hint }) => {
      const chip = el('div', { class: 'import-source-chip' });
      chip.appendChild(el('span', { class: 'import-source-name' }, [name]));
      chip.appendChild(el('span', { class: 'import-source-hint' }, [hint]));
      sourcesGrid.appendChild(chip);
    });

    wrap.appendChild(sourcesLabel);
    wrap.appendChild(sourcesGrid);

    const help = el('div', { class: 'import-help' });
    help.appendChild(el('p', {}, [
      'Para Bancolombia, NuBank, Nequi y Global66 descarga el CSV desde la app o portal web. ' +
      'Para XTB usa la exportación de historial de operaciones. ' +
      'Los PDFs y formatos desconocidos se convierten con un prompt guiado de IA (se muestran las instrucciones paso a paso).',
    ]));
    wrap.appendChild(help);

    return wrap;
  }

  // ---------- Unknown format ----------
  function buildUnknown() {
    const CLAUDE_PROMPT = `Eres un asistente de finanzas personales. Analiza el extracto bancario adjunto y extrae TODAS las transacciones.

Devuelve ÚNICAMENTE el CSV puro, sin explicaciones, sin bloques de código, sin markdown.

Formato obligatorio — exactamente estas columnas:
fecha,descripcion,monto,tipo,categoria

Reglas:
- fecha: YYYY-MM-DD
- descripcion: máximo 60 caracteres
- monto: NEGATIVO para gastos/débitos, POSITIVO para ingresos (sin símbolos de moneda)
- tipo: exactamente una de estas: gasto | ingreso | transferencia
- categoria: elige la más apropiada de esta lista (respeta mayúsculas exactas):
  GASTOS: Restaurantes, Mercado, Arriendo, Transporte, Suscripciones, Salud, Educación, Ropa, Hogar, Entretenimiento, Servicios, Tecnología, Viajes, Otros gastos
  INGRESOS: Salario, Freelance, Inversiones, Otros ingresos
  TRANSFERENCIAS: Transferencia

Ejemplo:
fecha,descripcion,monto,tipo,categoria
2026-05-01,Nómina empresa,5000000,ingreso,Salario
2026-05-03,Rappi comida,-45000,gasto,Restaurantes
2026-05-05,Netflix,-47900,gasto,Suscripciones
2026-05-10,Transferencia a Nu,-500000,transferencia,Transferencia

Extrae TODAS las transacciones sin omitir ninguna.`;

    const wrap = el('div', { class: 'import-wrap' });

    const infoCard = el('div', { class: 'card card--pad' });
    infoCard.appendChild(el('h3', { style: 'margin:0 0 8px;font-size:var(--fs-h3)' }, ['Formato no reconocido']));
    infoCard.appendChild(el('p', { style: 'margin:0 0 12px;color:var(--text-secondary);font-size:var(--fs-caption)' }, [
      `Archivo: ${state.file?.name || ''} · Los headers detectados no coinciden con ningún banco configurado. `,
      'Usa el siguiente prompt en claude.ai para convertir el extracto al formato FinanceOS CSV e importarlo sin problemas.',
    ]));
    if (state.unknownHeaders?.length) {
      infoCard.appendChild(el('p', { style: 'margin:0 0 12px;color:var(--text-tertiary);font-size:var(--fs-micro);word-break:break-word' }, [
        `Columnas detectadas: ${state.unknownHeaders.join(' · ')}`,
      ]));
    }

    const steps = el('ol', { style: 'margin:0 0 16px;padding-left:20px;font-size:var(--fs-caption);color:var(--text-secondary);line-height:2' });
    ['Copia el prompt de abajo.', 'Abre claude.ai y sube el PDF o pega el contenido del extracto.', 'Claude te devuelve un CSV listo.', 'Guárdalo como financeos-import.csv y arrástralo aquí.'].forEach((s) => {
      steps.appendChild(el('li', {}, [s]));
    });
    infoCard.appendChild(steps);
    wrap.appendChild(infoCard);

    const promptCard = el('div', { class: 'card card--pad', style: 'position:relative' });
    promptCard.appendChild(el('p', { style: 'margin:0 0 8px;font-size:var(--fs-caption);font-weight:var(--fw-semibold);color:var(--text-secondary)' }, ['PROMPT PARA CLAUDE']));

    const pre = el('pre', { style: 'margin:0;font-size:11px;line-height:1.5;white-space:pre-wrap;word-break:break-word;color:var(--text-primary);max-height:260px;overflow-y:auto' });
    pre.textContent = CLAUDE_PROMPT;
    promptCard.appendChild(pre);

    const copyBtn = Button('Copiar prompt', {
      variant: 'outline',
      onClick: () => {
        navigator.clipboard.writeText(CLAUDE_PROMPT).then(() => {
          copyBtn.textContent = '¡Copiado!';
          setTimeout(() => { copyBtn.textContent = 'Copiar prompt'; }, 2000);
        });
      },
    });
    copyBtn.style.marginTop = '12px';
    promptCard.appendChild(copyBtn);
    wrap.appendChild(promptCard);

    const backBtn = Button('← Volver', { variant: 'ghost', onClick: () => { state.phase = 'idle'; state.file = null; render(); } });
    backBtn.style.marginTop = '8px';
    wrap.appendChild(backBtn);

    return wrap;
  }

  // ---------- Analyzing ----------
  function buildAnalyzing() {
    const STEPS = {
      reading: { label: 'Leyendo archivo…',          sub: 'Procesando en tu dispositivo' },
      pdf:     { label: 'Extrayendo texto del PDF…',  sub: 'Analizando con PDF.js' },
    };
    const step = STEPS[state.progress] || STEPS.reading;

    const wrap = el('div', { class: 'import-analyzing' });
    wrap.appendChild(el('div', { class: 'import-analyzing__icon', html: icon('importFile') }));
    wrap.appendChild(el('p', { class: 'import-analyzing__file' }, [state.file?.name || '']));
    wrap.appendChild(el('div', { class: 'import-spinner' }));
    wrap.appendChild(el('p', { class: 'import-analyzing__label' }, [step.label]));
    wrap.appendChild(el('p', { class: 'import-analyzing__sub' }, [step.sub]));
    return wrap;
  }

  // ---------- Preview ----------
  function buildPreview() {
    const { result, accountId } = state;
    const { bank, items, currency, period } = result;
    const s = store.get();
    // Incluye todas las cuentas no archivadas, incluidas tarjetas de crédito
    const accounts   = (s.accounts   || []).filter((a) => !a.isArchived);
    const categories = (s.categories || []).filter((c) => c.kind === 'expense');
    const isInvestment = result.type === 'investment';

    const wrap = el('div', { class: 'import-preview' });

    // Header banco
    const bankBadge = el('span', { class: 'import-bank-badge' });
    bankBadge.style.background = bank.color || 'var(--accent)';
    bankBadge.style.color = bank.textColor || '#fff';
    bankBadge.textContent = bank.name || 'Desconocido';

    const periodText = period ? ` · ${formatDate(period.from)} – ${formatDate(period.to)}` : '';
    const skippedText = result.skipped > 0 ? ` · ${result.skipped} fila${result.skipped > 1 ? 's' : ''} sin monto omitida${result.skipped > 1 ? 's' : ''}` : '';
    const meta = el('span', { class: 'import-preview-meta' }, [
      `${items.length} transacciones · ${currency}${periodText}${skippedText}`,
    ]);
    const previewHeader = el('div', { class: 'import-preview-header' });
    previewHeader.appendChild(bankBadge);
    previewHeader.appendChild(meta);
    wrap.appendChild(previewHeader);

    // Advertencia duplicados
    if (state.dupIndices.size > 0) {
      const n = state.dupIndices.size;
      const warn = el('div', { class: 'import-warning' });
      warn.appendChild(el('span', { html: icon('bell') }));
      warn.appendChild(el('span', {}, [
        `${n} posible${n > 1 ? 's' : ''} duplicado${n > 1 ? 's' : ''} detectado${n > 1 ? 's' : ''} y deseleccionado${n > 1 ? 's' : ''} automáticamente.`,
      ]));
      wrap.appendChild(warn);
    }

    // IMP-2: las transferencias del extracto no traen cuenta destino (toAccountId),
    // que el backend exige; se importan como gasto/ingreso según el signo original.
    if (items.some((it) => it.type === 'transfer')) {
      const warn = el('div', { class: 'import-warning import-warning--info' });
      warn.appendChild(el('span', { html: icon('transactions') }));
      warn.appendChild(el('span', {}, [
        'Las transferencias se importarán como gasto (salida) o ingreso (entrada) — el extracto no indica la cuenta destino.',
      ]));
      wrap.appendChild(warn);
    }

    // Advertencia inversiones
    if (isInvestment) {
      const warn = el('div', { class: 'import-warning import-warning--info' });
      warn.appendChild(el('span', { html: icon('investments') }));
      warn.appendChild(el('span', {}, [
        'Archivo de broker detectado. Se importarán como transacciones. Actualiza posiciones en Inversiones.',
      ]));
      wrap.appendChild(warn);
    }

    // Selector cuenta
    if (!isInvestment && accounts.length) {
      const accSel = el('select', { class: 'input import-account-sel' });
      accounts.forEach((a) => {
        const opt = el('option', { value: a.id }, [a.name]);
        if (a.id === accountId) opt.selected = true;
        accSel.appendChild(opt);
      });
      accSel.addEventListener('change', () => { state.accountId = accSel.value; });
      const row = el('div', { class: 'import-account-row' });
      row.appendChild(el('label', { class: 'import-account-label' }, ['Importar a cuenta']));
      row.appendChild(accSel);
      wrap.appendChild(row);
    }

    // Selector categoría por defecto
    const catSel = el('select', { class: 'input import-account-sel' });
    catSel.appendChild(el('option', { value: '' }, ['Sin categoría']));
    categories.forEach((c) => catSel.appendChild(el('option', { value: c.id }, [c.name])));
    catSel.addEventListener('change', () => { state.defaultCategoryId = catSel.value; });
    const catRow = el('div', { class: 'import-account-row' });
    catRow.appendChild(el('label', { class: 'import-account-label' }, ['Categoría por defecto']));
    catRow.appendChild(catSel);
    wrap.appendChild(catRow);

    // Tabla
    const allChk = el('input', { type: 'checkbox' });
    allChk.checked = state.selected.size === items.length;
    allChk.addEventListener('change', () => {
      if (allChk.checked) items.forEach((_, i) => state.selected.add(i));
      else state.selected.clear();
      updateRows();
      updateBtn();
    });

    const thead = el('thead');
    thead.appendChild(el('tr', {}, [
      el('th', {}, [allChk]),
      el('th', {}, ['Fecha']),
      el('th', {}, ['Descripción']),
      el('th', { class: 'text-right' }, ['Monto']),
      el('th', {}, ['Tipo']),
    ]));

    const tbody = el('tbody');
    const rows = [];

    items.forEach((item, i) => {
      const tr = el('tr', {});
      const chk = el('input', { type: 'checkbox' });
      chk.checked = state.selected.has(i);

      const sign = item.type === 'income' ? '+' : item.type === 'expense' ? '−' : '±';
      const amtClass = `import-amount import-amount--${item.type === 'income' ? 'pos' : item.type === 'expense' ? 'neg' : 'neu'}`;
      const desc = String(item.description || item.symbol || '').slice(0, 55);

      tr.appendChild(el('td', {}, [chk]));
      tr.appendChild(el('td', { class: 'import-date' }, [item.date || '—']));
      tr.appendChild(el('td', { class: 'import-desc', title: item.description || '' }, [desc]));
      tr.appendChild(el('td', { class: amtClass }, [`${sign} ${formatMoney(item.amount || 0)}`]));
      const typeTd = el('td', {});
      typeTd.appendChild(Badge(TYPE_LABEL[item.type] || item.type || '—', TYPE_COLOR[item.type] || ''));
      if (state.dupIndices.has(i)) typeTd.appendChild(Badge('Dup?', 'warning'));
      tr.appendChild(typeTd);

      function applyRowStyle() {
        tr.className = [
          'import-row',
          state.dupIndices.has(i) ? 'import-row--dup' : '',
          !state.selected.has(i) ? 'import-row--desel' : '',
        ].join(' ').trim();
      }
      applyRowStyle();

      chk.addEventListener('change', () => {
        if (chk.checked) state.selected.add(i);
        else state.selected.delete(i);
        allChk.checked = state.selected.size === items.length;
        applyRowStyle();
        updateBtn();
      });

      rows.push({ tr, applyRowStyle });
      tbody.appendChild(tr);
    });

    function updateRows() { rows.forEach((r) => r.applyRowStyle()); }

    const table = el('table', { class: 'import-table' });
    table.appendChild(thead);
    table.appendChild(tbody);
    const tableWrap = el('div', { class: 'import-table-wrap' });
    tableWrap.appendChild(table);
    wrap.appendChild(tableWrap);

    // Footer
    const importBtn = el('button', { class: 'btn btn--primary' });
    function updateBtn() {
      const n = state.selected.size;
      importBtn.textContent = `Importar ${n} transacción${n !== 1 ? 'es' : ''}`;
      importBtn.disabled = n === 0 || (!isInvestment && !state.accountId);
    }
    updateBtn();
    importBtn.addEventListener('click', doImport);

    const cancelBtn = Button('Cancelar', { variant: 'ghost', onClick: () => {
      state.phase = 'idle'; state.file = null; state.result = null; render();
    }});

    const footer = el('div', { class: 'import-footer' });
    footer.appendChild(cancelBtn);
    footer.appendChild(importBtn);
    wrap.appendChild(footer);

    // IMP-1/IMP-3: el backend exige categoryId para income/expense, con kind que
    // coincida con el tipo. Resolver SIEMPRE una categoría del kind correcto:
    // nombre del CSV (si matchea kind) → default del selector (solo gastos) →
    // fallback "Otros …" o primera categoría del kind. Sin esto, todo ingreso
    // importado moría en dead-letter al sincronizar.
    function resolveCategoryId(item, type) {
      const kind = type === 'income' ? 'income' : 'expense';
      const cats = (store.get().categories || []).filter((c) => c.kind === kind && !c.isDeleted);
      if (item.categoryName) {
        const m = cats.find((c) => c.name.toLowerCase().trim() === item.categoryName.toLowerCase().trim());
        if (m) return { id: m.id, auto: false };
      }
      if (kind === 'expense' && state.defaultCategoryId) return { id: state.defaultCategoryId, auto: false };
      const fallback = cats.find((c) => /^otros/i.test(c.name)) || cats[0];
      return { id: fallback?.id, auto: !!fallback };
    }

    async function doImport() {
      state.phase = 'importing';
      state.imported = 0;
      render();

      const toImport = items.filter((_, i) => state.selected.has(i));
      let ok = 0, failed = 0, autoCat = 0;
      for (const item of toImport) {
        try {
          // IMP-2: transfer sin toAccountId es invalidable por el backend →
          // convertir según el signo original (negativo = salida → gasto).
          let type = item.type || 'expense';
          if (type === 'transfer') {
            type = (item.signedAmount ?? -1) < 0 ? 'expense' : 'income';
          }
          const cat = resolveCategoryId(item, type);
          if (cat.auto) autoCat++;
          await dataService.create('transactions', {
            date: item.date,
            description: item.description || item.symbol || '',
            amount: Number(item.amount) || 0,
            type,
            accountId: state.accountId || undefined,
            categoryId: cat.id,
            currency: item.currency || result.currency || 'COP',
            importedFrom: bank.name || 'Import',
          });
          ok++;
          state.imported = ok;
        } catch (err) {
          failed++;
          toast(`Error importando fila: ${err.message}`, { type: 'warning' });
        }
      }
      state.imported = ok;
      state.failed = failed;
      state.autoCat = autoCat;
      state.phase = 'done';
      render();
    }

    return wrap;
  }

  // ---------- Importing ----------
  function buildImporting() {
    const wrap = el('div', { class: 'import-analyzing' });
    wrap.appendChild(el('div', { class: 'import-spinner' }));
    wrap.appendChild(el('p', { class: 'import-analyzing__label' }, [
      `Importando ${state.imported} de ${state.selected?.size || 0}…`,
    ]));
    wrap.appendChild(el('p', { class: 'import-analyzing__sub' }, ['Creando transacciones y ajustando saldos']));
    return wrap;
  }

  // ---------- Done ----------
  function buildDone() {
    const wrap = el('div', { class: 'import-done' });
    const iconWrap = el('div', { class: 'import-done__icon', html: icon('check') });
    wrap.appendChild(iconWrap);
    wrap.appendChild(el('h2', { class: 'import-done__title' }, [
      `${state.imported} transacción${state.imported !== 1 ? 'es' : ''} importada${state.imported !== 1 ? 's' : ''}`,
    ]));
    wrap.appendChild(el('p', { class: 'import-done__sub' }, ['Saldos actualizados; la sincronización corre en segundo plano.']));

    // F.3: resumen de calidad de la importación — fallos y categorías auto-asignadas.
    if (state.failed > 0) {
      wrap.appendChild(el('p', { class: 't-caption text-negative' }, [
        `⚠ ${state.failed} fila${state.failed > 1 ? 's' : ''} fallaron y no se importaron.`,
      ]));
    }
    if (state.autoCat > 0) {
      const pct = state.imported ? Math.round((state.autoCat / state.imported) * 100) : 0;
      wrap.appendChild(el('p', { class: pct > 30 ? 't-caption text-negative' : 't-caption text-tertiary' }, [
        `${state.autoCat} de ${state.imported} (${pct}%) con categoría asignada automáticamente${pct > 30 ? ' — revísalas en Transacciones' : ''}.`,
      ]));
    }

    const actions = el('div', { class: 'import-done__actions' });
    actions.appendChild(Button('Importar otro', {
      variant: 'outline',
      onClick: () => { state.phase = 'idle'; state.file = null; state.result = null; render(); },
    }));
    actions.appendChild(Button('Ver transacciones', {
      onClick: () => { location.hash = '#/transactions'; },
    }));
    wrap.appendChild(actions);
    return wrap;
  }

  render();
  return root;
}
