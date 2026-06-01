// services/parsers/csvParser.js — parser CSV sin dependencias.
// Soporta: delimitadores auto-detectados (, ; \t |), campos entre comillas,
// BOM UTF-8, saltos de línea Windows/Unix.

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
  const clean = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const delim = detectDelimiter(clean);
  const lines = clean.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = splitLine(lines[0], delim).map((h) => h.replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map((l) => splitLine(l, delim));
  return { headers, rows };
}
