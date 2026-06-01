// services/importService.js — pipeline de importación de archivos financieros.
// Flujo: detectar tipo → parsear → detectar banco → aplicar perfil nativo o Claude.

import { parseCSV } from './parsers/csvParser.js';
import { parseExcel } from './parsers/excelParser.js';
import { parsePdf } from './parsers/pdfParser.js';
import { BANK_PROFILES, detectBank } from './parsers/bankProfiles.js';
import { apiClient } from './apiClient.js';

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

// Groq free tier: 6k TPM. Sistema prompt ~600 tokens → usuario max ~2.5k tokens ≈ 8k chars.
// 100 filas cubre cualquier extracto mensual (bancos colombianos: 30-80 tx/mes típico).
const MAX_AI_CHARS = 8_000;
const MAX_AI_ROWS  = 100;

function compactCsv(headers, rows) {
  const limited = rows.slice(0, MAX_AI_ROWS);
  return [headers.join(','), ...limited.map((r) => r.map((c) => `"${String(c).replace(/"/g, '')}"`).join(','))].join('\n');
}

async function callClaude(payload) {
  const p = { ...payload };
  if (typeof p.fileContent === 'string' && p.fileContent.length > MAX_AI_CHARS) {
    p.fileContent = p.fileContent.slice(0, MAX_AI_CHARS);
  }
  return apiClient.post('parseStatement', p);
}

function claudeResultToImport(result, fallbackBank) {
  const profile = BANK_PROFILES.find((p) => p.id === result.bankId) || fallbackBank || null;
  return {
    bank: profile || { name: result.accountName || 'Desconocido', color: 'var(--bg-surface-2)', textColor: 'var(--text-primary)' },
    type: 'transactions',
    currency: result.currency || 'COP',
    items: result.transactions || [],
    period: result.period || null,
  };
}

export const importService = {
  // Procesa un File y devuelve { bank, type, currency, items[], period }.
  // onProgress(step): 'reading' | 'pdf' | 'ai' — para actualizar la UI.
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
      // Formato desconocido → IA (solo headers + primeras MAX_AI_ROWS filas)
      onProgress?.('ai');
      const result = await callClaude({ fileContent: compactCsv(headers, rows), fileName: file.name, mimeType: 'text/csv', bankHint: null });
      return claudeResultToImport(result, null);
    }

    if (isExcel) {
      const buffer = await readAsBuffer(file);
      const { headers, rows } = await parseExcel(buffer);
      const profile = detectBank(headers, file.name);
      if (profile) return applyProfile(profile, headers, rows);
      onProgress?.('ai');
      const result = await callClaude({ fileContent: compactCsv(headers, rows), fileName: file.name, mimeType: 'application/vnd.ms-excel', bankHint: null });
      return claudeResultToImport(result, null);
    }

    if (isPdf) {
      onProgress?.('pdf');
      const buffer = await readAsBuffer(file);
      const bankFromName = BANK_PROFILES.find((p) => p.matchFilename?.test(file.name)) || null;

      const { text, isTextBased } = await parsePdf(buffer);

      if (!isTextBased) {
        throw new Error(
          'Este PDF es escaneado (imagen) y no tiene texto extraíble. ' +
          'Descarga el extracto en formato CSV desde la app de tu banco e inténtalo de nuevo.'
        );
      }

      onProgress?.('ai');
      const result = await callClaude({ fileContent: text, fileName: file.name, mimeType: 'text/plain', bankHint: bankFromName?.name || null });
      return claudeResultToImport(result, bankFromName);
    }

    throw new Error(`Formato no soportado: .${ext}. Usa CSV, Excel (.xlsx) o PDF.`);
  },
};
