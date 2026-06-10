// services/parsers/excelParser.js — lector de .xlsx via SheetJS (esm.sh CDN, carga perezosa).

let xlsxLib = null;

async function loadXLSX() {
  if (xlsxLib) return xlsxLib;
  try {
    // esm.sh convierte el paquete npm a ESM — más confiable que cdn.sheetjs.com
    xlsxLib = await import('https://esm.sh/xlsx');
  } catch (_) {
    // Trade-off offline-first conocido: la librería viene de CDN. CSV sí funciona sin red.
    throw new Error('No se pudo cargar el lector de Excel (requiere conexión a internet). El formato CSV funciona sin conexión.');
  }
  return xlsxLib;
}

export async function parseExcel(buffer) {
  const xlsx = await loadXLSX();
  const wb = xlsx.read(new Uint8Array(buffer), { type: 'array', raw: false, dateNF: 'yyyy-mm-dd' });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: 'yyyy-mm-dd', defval: '' });
  const headerRowIdx = data.findIndex((r) => r.some((c) => String(c || '').trim().length > 1));
  if (headerRowIdx < 0 || data.length < headerRowIdx + 2) return { headers: [], rows: [] };
  const headers = data[headerRowIdx].map((h) => String(h || '').trim());
  const rows = data.slice(headerRowIdx + 1)
    .filter((r) => r.some((c) => String(c || '').trim()))
    .map((r) => headers.map((_, i) => String(r[i] || '').trim()));
  return { headers, rows };
}
