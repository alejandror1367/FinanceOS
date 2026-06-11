// services/importService.js — pipeline de importación de archivos financieros.
// Estrategia: parseo nativo para bancos conocidos; mensaje con prompt de Claude
// para formatos desconocidos (más confiable que APIs con límites de tokens).

import { parseCSV } from './parsers/csvParser.js';
import { parseExcel, parseExcelRaw } from './parsers/excelParser.js';
import { parsePdf, PdfPasswordError } from './parsers/pdfParser.js';
import { BANK_PROFILES, detectBank, detectPdfBank, detectExcelBank } from './parsers/bankProfiles.js';

export { PdfPasswordError };

function readAsText(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = (e) => res(e.target.result);
    r.onerror = rej;
    r.readAsText(file, 'UTF-8');
  });
}

function readAsBuffer(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = (e) => res(e.target.result);
    r.onerror = rej;
    r.readAsArrayBuffer(file);
  });
}

// F.2: clave de deduplicación date|monto|descripción-normalizada. La descripción
// reduce falsos positivos (dos compras distintas el mismo día por el mismo valor
// ya no se marcan como duplicadas entre sí).
function normDesc(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9áéíóúñ]/g, '').slice(0, 16);
}
export function dupKey(item) {
  return `${item.date}|${Math.abs(item.amount || 0).toFixed(0)}|${normDesc(item.description)}`;
}

// Exportada para tests (F.1). F.4: filtra filas sin monto válido (0/NaN) — evita
// transacciones basura de $0 (p. ej. filas de broker sin movimiento de caja) y las
// cuenta en `skipped` para mostrarlo en el preview. Calcula period desde los items.
export function applyProfile(profile, headers, rows) {
  const items = [];
  let skipped = 0;
  for (const row of rows) {
    if (row.every((c) => !String(c).trim())) continue;
    try {
      const item = profile.mapRow(headers, row);
      if (!item) continue;
      // F.4: filas sin fecha o sin monto válido no son importables → contar y omitir.
      if (!item.date || !(Number(item.amount) > 0)) { skipped++; continue; }
      items.push(item);
    } catch (_) { /* fila malformada, se ignora */ }
  }
  const dates = items.map((i) => i.date).sort();
  return {
    bank: profile,
    type: profile.type || 'transactions',
    currency: profile.currency || 'COP',
    items,
    skipped,
    period: dates.length ? { from: dates[0], to: dates[dates.length - 1] } : null,
  };
}

// Error especial que la vista interpreta para mostrar el prompt de Claude.
export class UnknownFormatError extends Error {
  constructor(headers) {
    super('UNKNOWN_FORMAT');
    this.headers = headers;
  }
}

// Sprint L: completa el resultado de un perfil PDF al mismo shape de applyProfile.
export function finishPdfResult(profile, parsed) {
  const items = parsed.items.filter((i) => i.date && Number(i.amount) > 0);
  const skipped = (parsed.skipped || 0) + (parsed.items.length - items.length);
  const dates = items.map((i) => i.date).sort();
  return {
    bank: profile,
    type: profile.type || 'transactions',
    currency: profile.currency || 'COP',
    items,
    skipped,
    period: dates.length ? { from: dates[0], to: dates[dates.length - 1] } : null,
  };
}

export const importService = {
  // opts.password: contraseña del PDF (L.1) — solo en memoria, nunca se persiste.
  async processFile(file, onProgress, opts) {
    onProgress?.('reading');

    const ext = file.name.split('.').pop().toLowerCase();
    const isCsv = ext === 'csv' || file.type === 'text/csv';
    const isExcel = ['xlsx', 'xls', 'ods'].includes(ext);
    const isPdf = ext === 'pdf' || file.type === 'application/pdf';

    if (isCsv) {
      const text = await readAsText(file);
      const { headers, rows } = parseCSV(text);
      const profile = detectBank(headers, file.name);
      if (profile) return applyProfile(profile, headers, rows);
      throw new UnknownFormatError(headers);
    }

    if (isExcel) {
      const buffer = await readAsBuffer(file);
      // L.3: primero los perfiles de hojas crudas (extractos con metadata arriba y
      // varias tablas — p. ej. TC Bancolombia/Amex); si ninguno, el camino genérico
      // "1ª fila = headers" de siempre.
      const sheets = await parseExcelRaw(buffer);
      const rawProfile = detectExcelBank(sheets, file.name);
      if (rawProfile) return finishPdfResult(rawProfile, rawProfile.parse(sheets));
      const { headers, rows } = await parseExcel(buffer);
      const profile = detectBank(headers, file.name);
      if (profile) return applyProfile(profile, headers, rows);
      throw new UnknownFormatError(headers);
    }

    if (isPdf) {
      onProgress?.('pdf');
      const buffer = await readAsBuffer(file);
      // Lanza PdfPasswordError si está protegido → la vista pide la contraseña y reintenta.
      const { text } = await parsePdf(buffer, opts?.password);
      // Sprint L: perfiles nativos sobre el texto del PDF (RappiCuenta; Nu/Amex en L.3/L.4).
      const profile = detectPdfBank(text, file.name);
      if (profile) return finishPdfResult(profile, profile.parse(text));
      // Sin perfil → flujo del prompt de Claude (instrucciones en la vista).
      throw new UnknownFormatError([]);
    }

    throw new Error(`Formato no soportado: .${ext}. Usa CSV, Excel (.xlsx) o PDF.`);
  },
};
