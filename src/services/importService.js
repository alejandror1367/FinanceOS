// services/importService.js — pipeline de importación de archivos financieros.
// Estrategia: parseo nativo para bancos conocidos; mensaje con prompt de Claude
// para formatos desconocidos (más confiable que APIs con límites de tokens).

import { parseCSV } from './parsers/csvParser.js';
import { parseExcel } from './parsers/excelParser.js';
import { parsePdf } from './parsers/pdfParser.js';
import { BANK_PROFILES, detectBank } from './parsers/bankProfiles.js';

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

function applyProfile(profile, headers, rows) {
  const items = [];
  for (const row of rows) {
    if (row.every((c) => !String(c).trim())) continue;
    try {
      const item = profile.mapRow(headers, row);
      if (item && item.date) items.push(item);
    } catch (_) { /* fila malformada, se ignora */ }
  }
  return {
    bank: profile,
    type: profile.type || 'transactions',
    currency: profile.currency || 'COP',
    items,
    period: null,
  };
}

// Error especial que la vista interpreta para mostrar el prompt de Claude.
export class UnknownFormatError extends Error {
  constructor(headers) {
    super('UNKNOWN_FORMAT');
    this.headers = headers;
  }
}

export const importService = {
  async processFile(file, onProgress) {
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
      const { headers, rows } = await parseExcel(buffer);
      const profile = detectBank(headers, file.name);
      if (profile) return applyProfile(profile, headers, rows);
      throw new UnknownFormatError(headers);
    }

    if (isPdf) {
      onProgress?.('pdf');
      const buffer = await readAsBuffer(file);
      const { isTextBased } = await parsePdf(buffer);
      // PDFs requieren Claude — lanzar UnknownFormatError para mostrar el prompt
      if (!isTextBased) throw new UnknownFormatError([]);
      throw new UnknownFormatError([]);
    }

    throw new Error(`Formato no soportado: .${ext}. Usa CSV, Excel (.xlsx) o PDF.`);
  },
};
