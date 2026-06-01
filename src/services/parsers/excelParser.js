// services/parsers/excelParser.js — lector de .xlsx via SheetJS (CDN, carga perezosa).

let XLSX = null;

async function loadXLSX() {
  if (XLSX) return XLSX;
  const mod = await import('https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.mjs');
  XLSX = mod;
  return XLSX;
}

export async function parseExcel(buffer) {
  const xlsx = await loadXLSX();
  const wb = xlsx.read(new Uint8Array(buffer), { type: 'array', raw: false, dateNF: 'yyyy-mm-dd' });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: 'yyyy-mm-dd', defval: '' });
  // Encuentra la primera fila que parece encabezado (no vacía)
  const headerRowIdx = data.findIndex((r) => r.some((c) => String(c || '').trim().length > 1));
  if (headerRowIdx < 0 || data.length < headerRowIdx + 2) return { headers: [], rows: [] };
  const headers = data[headerRowIdx].map((h) => String(h || '').trim());
  const rows = data.slice(headerRowIdx + 1)
    .filter((r) => r.some((c) => String(c || '').trim()))
    .map((r) => headers.map((_, i) => String(r[i] || '').trim()));
  return { headers, rows };
}
