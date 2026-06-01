// services/importService.js — pipeline de importación de archivos financieros.
// Flujo: detectar tipo → parsear → detectar banco → aplicar perfil nativo o Claude.

import { parseCSV } from './parsers/csvParser.js';
import { parseExcel } from './parsers/excelParser.js';
import { extractPdfText, isPdfTextBased } from './parsers/pdfParser.js';
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

function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
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

// Groq llama-3.1-8b-instant: ~20k TPM ≈ 80k chars. Truncamos a 60k para dejar margen al prompt.
const MAX_TEXT_CHARS = 60_000;

async function callClaude(payload) {
  const p = { ...payload };
  if (typeof p.fileContent === 'string' && p.fileContent.length > MAX_TEXT_CHARS) {
    p.fileContent = p.fileContent.slice(0, MAX_TEXT_CHARS);
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
      // Formato desconocido → Claude
      onProgress?.('ai');
      const result = await callClaude({ fileContent: text, fileName: file.name, mimeType: 'text/csv', bankHint: null });
      return claudeResultToImport(result, null);
    }

    if (isExcel) {
      const buffer = await readAsBuffer(file);
      const { headers, rows } = await parseExcel(buffer);
      const profile = detectBank(headers, file.name);
      if (profile) return applyProfile(profile, headers, rows);
      onProgress?.('ai');
      // Convierte a CSV para enviar texto (más barato que base64)
      const csvText = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
      const result = await callClaude({ fileContent: csvText, fileName: file.name, mimeType: 'application/vnd.ms-excel', bankHint: null });
      return claudeResultToImport(result, null);
    }

    if (isPdf) {
      onProgress?.('pdf');
      const buffer = await readAsBuffer(file);
      const bankFromName = BANK_PROFILES.find((p) => p.matchFilename?.test(file.name)) || null;
      let fileContent, mimeType;

      const hasText = await isPdfTextBased(buffer);
      if (hasText) {
        fileContent = await extractPdfText(buffer);
        mimeType = 'text/plain';
      } else {
        // PDF escaneado → enviar base64 para visión de Claude
        const b64 = bufferToBase64(buffer);
        if (b64.length > 9_000_000) throw new Error('PDF demasiado grande (>~6 MB). Intenta exportar como CSV desde la app del banco o dividirlo en páginas.');
        fileContent = b64;
        mimeType = 'application/pdf';
      }

      onProgress?.('ai');
      const result = await callClaude({ fileContent, fileName: file.name, mimeType, bankHint: bankFromName?.name || null });
      return claudeResultToImport(result, bankFromName);
    }

    throw new Error(`Formato no soportado: .${ext}. Usa CSV, Excel (.xlsx) o PDF.`);
  },
};
