// services/parsers/pdfParser.js — extracción de texto de PDFs via PDF.js (CDN).
// Para PDFs digitales extrae texto; para escaneados retorna vacío (Claude usará visión).

let pdfjs = null;

async function loadPdfJs() {
  if (pdfjs) return pdfjs;
  pdfjs = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs';
  return pdfjs;
}

export async function extractPdfText(buffer) {
  const lib = await loadPdfJs();
  const pdf = await lib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const pageTexts = [];
  for (let i = 1; i <= Math.min(pdf.numPages, 50); i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // Agrupa ítems por fila (coordenada Y redondeada), ordena por X → reconstruye líneas
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
  return pageTexts.join('\n\n--- PÁGINA ---\n\n');
}

// Devuelve true si el PDF contiene texto seleccionable suficiente.
export async function isPdfTextBased(buffer) {
  try {
    const lib = await loadPdfJs();
    const pdf = await lib.getDocument({ data: new Uint8Array(buffer) }).promise;
    // Muestra solo las primeras 3 páginas para decidir rápido
    let totalChars = 0;
    const pagesToCheck = Math.min(pdf.numPages, 3);
    for (let i = 1; i <= pagesToCheck; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      totalChars += content.items.reduce((s, it) => s + (it.str || '').length, 0);
    }
    return totalChars / pagesToCheck > 80;
  } catch {
    return false;
  }
}
