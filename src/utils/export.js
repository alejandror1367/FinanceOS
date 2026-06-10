// utils/export.js — utilidades de exportación: descarga de archivos, CSV e impresión.

export function downloadFile(filename, content, mime = 'text/plain') {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// rows: array de objetos. columns opcional (array de claves).
// EXP-1: las columnas son la UNIÓN de claves de TODAS las filas (orden de primera
// aparición) — antes solo se usaba la primera fila y se perdían campos presentes en
// filas posteriores (p. ej. toAccountId de transferencias), violando exportabilidad total.
export function toCSV(rows, columns) {
  if (!rows || !rows.length) return '';
  let cols = columns;
  if (!cols) {
    const seen = new Set();
    cols = [];
    for (const r of rows) {
      for (const k of Object.keys(r)) {
        if (!seen.has(k)) { seen.add(k); cols.push(k); }
      }
    }
  }
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const head = cols.join(',');
  const body = rows.map((r) => cols.map((c) => esc(r[c])).join(',')).join('\n');
  return head + '\n' + body;
}

export function stamp() {
  return new Date().toISOString().slice(0, 10);
}

// Imprime un bloque HTML (el usuario puede "Guardar como PDF").
export function printHTML(html) {
  let area = document.getElementById('print-area');
  if (!area) {
    area = document.createElement('div');
    area.id = 'print-area';
    document.body.appendChild(area);
  }
  area.innerHTML = html;
  const cleanup = () => { area.innerHTML = ''; window.removeEventListener('afterprint', cleanup); };
  window.addEventListener('afterprint', cleanup);
  window.print();
}
