// services/parsers/pdfParser.js — extracción de texto de PDFs via PDF.js (CDN).
// Devuelve { text, isTextBased } en una sola pasada para evitar detached ArrayBuffer.

let pdfjs = null;

async function loadPdfJs() {
  if (pdfjs) return pdfjs;
  try {
    pdfjs = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs');
  } catch (_) {
    // Trade-off offline-first conocido: PDF.js viene de CDN. CSV sí funciona sin red.
    throw new Error('No se pudo cargar el lector de PDF (requiere conexión a internet). El formato CSV funciona sin conexión.');
  }
  pdfjs.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs';
  return pdfjs;
}

// L.1: el PDF exige contraseña (extractos de Nu, RappiCuenta/RappiCard). La vista
// la pide y reintenta; la contraseña vive solo en memoria durante el parse.
export class PdfPasswordError extends Error {
  constructor(incorrect) {
    super(incorrect ? 'Contraseña incorrecta.' : 'Este PDF está protegido con contraseña.');
    this.name = 'PdfPasswordError';
    this.incorrect = !!incorrect;
  }
}

// Extrae texto y determina si el PDF tiene contenido seleccionable.
// Usa buffer.slice(0) para no dejar el ArrayBuffer original en estado "detached".
export async function parsePdf(buffer, password) {
  const lib = await loadPdfJs();
  // Copia defensiva: PDF.js transfiere el ArrayBuffer internamente
  const data = new Uint8Array(buffer.slice(0));
  let pdf;
  try {
    pdf = await lib.getDocument({ data, password: password || undefined }).promise;
  } catch (err) {
    // PasswordException.code: 1 = falta contraseña, 2 = contraseña incorrecta.
    if (err && err.name === 'PasswordException') throw new PdfPasswordError(err.code === 2);
    throw err;
  }

  const pageTexts = [];
  for (let i = 1; i <= Math.min(pdf.numPages, 50); i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // Agrupa items por fila (Y redondeado), ordena por columna (X)
    const byY = {};
    for (const item of content.items) {
      const y = Math.round(item.transform[5]);
      if (!byY[y]) byY[y] = [];
      byY[y].push({ x: item.transform[4], str: item.str });
    }
    const lines = Object.entries(byY)
      .sort((a, b) => Number(b[0]) - Number(a[0]))
      .map(([, items]) => items.sort((a, b) => a.x - b.x).map((it) => it.str).join('  '))
      .filter((l) => l.trim());
    pageTexts.push(lines.join('\n'));
  }

  const text = pageTexts.join('\n\n--- PÁGINA ---\n\n');
  const avgCharsPerPage = text.length / Math.max(pdf.numPages, 1);
  return { text, isTextBased: avgCharsPerPage > 80 };
}
