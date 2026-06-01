// services/parsers/csvParser.js — parser CSV sin dependencias.
// Maneja: delimitadores auto-detectados, campos entre comillas,
// BOM UTF-8, saltos Windows/Unix, wrappers de markdown (```csv...```),
// y CSVs con una sola columna (cada fila envuelta en comillas extra por Claude).

function detectDelimiter(text) {
  const sample = text.slice(0, 3000);
  const counts = { ',': 0, ';': 0, '\t': 0, '|': 0 };
  let inQ = false;
  for (const ch of sample) {
    if (ch === '"') { inQ = !inQ; continue; }
    if (!inQ && counts[ch] !== undefined) counts[ch]++;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function splitLine(line, delim) {
  const out = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === delim && !inQ) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur.trim());
  return out;
}

export function parseCSV(text) {
  // Eliminar fences de markdown (```csv ... ```) que Claude puede agregar
  const noFence = text.replace(/^```[a-z]*\r?\n?/m, '').replace(/\r?\n?```\s*$/m, '');
  const clean = noFence.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const delim = detectDelimiter(clean);
  const lines = clean.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  let headers = splitLine(lines[0], delim).map((h) => h.replace(/^"|"$/g, ''));
  let rows = lines.slice(1).map((l) => splitLine(l, delim));

  // Si solo se detectó 1 columna, el archivo probablemente tiene cada fila
  // envuelta en comillas extra. Re-parsea el contenido de cada celda como CSV.
  if (headers.length === 1) {
    const allCells = [headers[0], ...rows.map((r) => r[0] || '')];
    const reparsed = allCells.map((cell) => splitLine(cell, ','));
    if (reparsed[0].length > 1) {
      headers = reparsed[0];
      rows = reparsed.slice(1).filter((r) => r.some((c) => c.trim()));
    }
  }

  return { headers, rows };
}
