// services/parsers/pdfParser.js — extracción de texto de PDFs via PDF.js (CDN).
// Devuelve { text, isTextBased } en una sola pasada para evitar detached ArrayBuffer.

let pdfjs = null;

async function loadPdfJs() {
  if (pdfjs) return pdfjs;
  pdfjs = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs';
  return pdfjs;
}

// Extrae texto y determina si el PDF tiene contenido seleccionable.
// Usa buffer.slice(0) para no dejar el ArrayBuffer original en estado "detached".
export async function parsePdf(buffer) {
  const lib = await loadPdfJs();
  // Copia defensiva: PDF.js transfiere el ArrayBuffer internamente
  const data = new Uint8Array(buffer.slice(0));
  const pdf = await lib.getDocument({ data }).promise;

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
