// services/parsers/bankProfiles.js — perfiles de detección y mapeo por banco/fuente.
// Soportados nativamente: Bancolombia, NuBank, Nequi, Global66, RappiPay, XTB.
// AQR Invest y formatos desconocidos → Claude vía Import.gs.

function norm(s) { return String(s || '').toLowerCase().trim(); }

// Convierte string de fecha a ISO YYYY-MM-DD.
export function toIso(str) {
  if (!str) return null;
  const s = String(str).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // DD/MM/YYYY o DD-MM-YYYY
  const m1 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m1) return `${m1[3]}-${m1[2].padStart(2, '0')}-${m1[1].padStart(2, '0')}`;
  // YYYYMMDD
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  return null;
}

// Parsea montos: soporta formato colombiano (1.234.567,89) y estándar (1,234,567.89).
export function parseMoney(str) {
  if (str === null || str === undefined || str === '') return 0;
  if (typeof str === 'number') return str;
  const s = String(str).trim().replace(/\s/g, '').replace(/[$€£COP\s]/g, '');
  if (!s || s === '-') return 0;
  // Formato colombiano: 1.234.567,89 o 1.234.567
  if (/^-?\d{1,3}(\.\d{3})*(,\d{1,2})?$/.test(s)) {
    return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
  }
  // Formato estándar con coma como miles: 1,234,567.89
  if (/^-?\d{1,3}(,\d{3})*(\.\d{1,2})?$/.test(s)) {
    return parseFloat(s.replace(/,/g, '')) || 0;
  }
  return parseFloat(s.replace(/,/g, '')) || 0;
}

function getter(headers, row) {
  const h = headers.map(norm);
  return (...keys) => {
    for (const k of keys) {
      const i = h.findIndex((x) => x.includes(k));
      if (i >= 0 && row[i] !== undefined) return row[i];
    }
    return '';
  };
}

export const BANK_PROFILES = [
  // ⚠ ORDEN IMPORTA: financeos va PRIMERO. Su matchHeaders es el más específico
  // (fecha+monto+tipo+categoria); si Bancolombia se evalúa antes, captura el CSV
  // del prompt de Claude (tiene fecha+monto+descripcion) y se pierden tipo/categoría.
  {
    id: 'financeos',
    name: 'FinanceOS Import',
    color: 'var(--accent)',
    textColor: '#fff',
    currency: 'COP',
    matchFilename: /financeos/i,
    matchHeaders(h) {
      const n = h.map(norm);
      return n.includes('fecha') && n.includes('monto') && n.includes('tipo') && n.includes('categoria');
    },
    mapRow(headers, row) {
      const get = getter(headers, row);
      const monto = parseMoney(get('monto'));
      const tipo = norm(get('tipo', 'type'));
      let type = 'expense';
      if (tipo.includes('ingreso') || tipo === 'income') type = 'income';
      else if (tipo.includes('transfer')) type = 'transfer';
      else if (tipo.includes('gasto') || tipo === 'expense') type = 'expense';
      return {
        date: toIso(get('fecha', 'date')),
        description: get('descripcion', 'description', 'descripción'),
        amount: Math.abs(monto),
        // signedAmount conserva el signo original: permite convertir transferencias sin
        // toAccountId en gasto (saliente) o ingreso (entrante) al importar (IMP-2).
        signedAmount: monto,
        type,
        categoryName: get('categoria', 'category') || '',
        balance: parseMoney(get('saldo')) || undefined,
      };
    },
  },
  {
    id: 'bancolombia',
    name: 'Bancolombia',
    color: '#FBDB00',
    textColor: '#111',
    currency: 'COP',
    matchFilename: /bancolombia/i,
    matchHeaders(h) {
      const n = h.map(norm);
      return n.some((x) => x.includes('fecha')) &&
        (n.some((x) => x.includes('valor')) || n.some((x) => x.includes('monto'))) &&
        n.some((x) => x.includes('referencia') || x.includes('descripci') || x.includes('detalle') || x.includes('concepto'));
    },
    mapRow(headers, row) {
      const get = getter(headers, row);
      const amount = parseMoney(get('valor', 'monto', 'importe'));
      return {
        date: toIso(get('fecha')),
        description: get('descripci', 'concepto', 'detalle', 'oficina'),
        amount: Math.abs(amount),
        type: amount < 0 ? 'expense' : 'income',
        balance: parseMoney(get('saldo')) || undefined,
        reference: get('referencia', 'ref'),
      };
    },
  },
  {
    id: 'nubank',
    name: 'NuBank',
    color: '#8A05BE',
    textColor: '#fff',
    currency: 'COP',
    matchFilename: /nubank|nu[_\-\s]/i,
    matchHeaders(h) {
      const n = h.map(norm);
      return (n.includes('date') || n.includes('fecha')) &&
        (n.includes('amount') || n.includes('valor')) &&
        (n.includes('title') || n.includes('description') || n.some((x) => x.includes('descripci')));
    },
    mapRow(headers, row) {
      const get = getter(headers, row);
      const amount = parseMoney(get('amount', 'valor', 'monto'));
      return {
        date: toIso(get('date', 'fecha')),
        description: get('title', 'description', 'descripci', 'concepto') || 'NuBank',
        amount: Math.abs(amount),
        type: amount < 0 ? 'expense' : 'income',
      };
    },
  },
  {
    id: 'nequi',
    name: 'Nequi',
    color: '#FF0068',
    textColor: '#fff',
    currency: 'COP',
    matchFilename: /nequi/i,
    matchHeaders(h) {
      const n = h.map(norm);
      return n.some((x) => x.includes('nequi') || x.includes('bolsillo'));
    },
    mapRow(headers, row) {
      const get = getter(headers, row);
      const amount = parseMoney(get('valor', 'monto', 'importe'));
      return {
        date: toIso(get('fecha', 'date')),
        description: get('descripci', 'concepto', 'movimiento', 'detalle') || 'Nequi',
        amount: Math.abs(amount),
        type: amount < 0 ? 'expense' : 'income',
        balance: parseMoney(get('saldo')) || undefined,
      };
    },
  },
  {
    id: 'global66',
    name: 'Global66',
    color: '#00C5A0',
    textColor: '#fff',
    currency: 'multi',
    matchFilename: /global.?66/i,
    matchHeaders(h) {
      const n = h.map(norm);
      return n.some((x) => x.includes('global66') || x.includes('remesa') || (x.includes('send') && x.includes('amount')));
    },
    mapRow(headers, row) {
      const get = getter(headers, row);
      const received = parseMoney(get('received', 'recibido', 'amount_received', 'monto_recibido'));
      const sent = parseMoney(get('sent', 'enviado', 'amount_sent', 'monto_enviado', 'amount', 'monto', 'valor'));
      const amount = received || sent;
      const currency = (get('currency_received', 'currency', 'moneda') || 'COP').toUpperCase().trim() || 'COP';
      // IMP-2: 'transfer' exige toAccountId en el backend (que el extracto no trae) y
      // moriría en dead-letter al sincronizar. Dinero recibido → income; enviado → expense.
      return {
        date: toIso(get('date', 'fecha', 'created_at', 'created')),
        description: get('type', 'tipo', 'description', 'descripci') || 'Transferencia Global66',
        amount: Math.abs(amount),
        type: received ? 'income' : 'expense',
        currency,
      };
    },
  },
  {
    id: 'xtb',
    name: 'XTB',
    color: '#E8001D',
    textColor: '#fff',
    currency: 'USD',
    type: 'investment',
    matchFilename: /xtb/i,
    matchHeaders(h) {
      const n = h.map(norm);
      return (n.some((x) => x.includes('symbol') || x.includes('instrument') || x.includes('item'))) &&
        (n.some((x) => x.includes('profit') || x.includes('close price') || x.includes('open price')));
    },
    mapRow(headers, row) {
      const get = getter(headers, row);
      const typeRaw = norm(get('type', 'tipo', 'operation', 'operacion'));
      return {
        date: toIso(get('open time', 'opentime', 'time', 'date', 'fecha')),
        symbol: (get('symbol', 'instrument', 'item') || '').toUpperCase().trim(),
        tradeType: typeRaw.includes('sell') || typeRaw.includes('venta') ? 'sell' : 'buy',
        quantity: Math.abs(parseMoney(get('volume', 'size', 'qty', 'cantidad'))),
        price: Math.abs(parseMoney(get('open price', 'openprice', 'price', 'precio'))),
        closePrice: Math.abs(parseMoney(get('close price', 'closeprice'))),
        profit: parseMoney(get('profit', 'ganancia', 'resultado', 'result', 'p/l')),
        currency: (get('currency', 'moneda') || 'USD').toUpperCase().slice(0, 3) || 'USD',
        description: `${(get('symbol', 'instrument', 'item') || '').toUpperCase()} ${typeRaw}`,
      };
    },
  },
  {
    id: 'rappipay',
    name: 'RappiPay',
    color: '#FF441B',
    textColor: '#fff',
    currency: 'COP',
    matchFilename: /rappi/i,
    matchHeaders(h) {
      return h.map(norm).some((x) => x.includes('rappi'));
    },
    mapRow(headers, row) {
      const get = getter(headers, row);
      const amount = parseMoney(get('valor', 'monto', 'amount'));
      return {
        date: toIso(get('fecha', 'date')),
        description: get('descripci', 'concepto', 'description') || 'RappiPay',
        amount: Math.abs(amount),
        type: amount < 0 ? 'expense' : 'income',
      };
    },
  },
];

// ───────────────── Perfiles de PDF (texto extraído por pdfParser) ─────────────────
// Sprint L: parseo determinista del TEXTO del PDF (sin IA). Cada perfil expone
// detect(text, filename) y parse(text) → { items, skipped } con el mismo shape de
// item que mapRow. El servicio completa bank/currency/period (ver importService).

const MESES_ES = { ene: '01', feb: '02', mar: '03', abr: '04', may: '05', jun: '06', jul: '07', ago: '08', sep: '09', oct: '10', nov: '11', dic: '12' };

// "11 May 2026" → "2026-05-11" (mes en español abreviado, con o sin punto).
export function toIsoEs(dd, mes, yyyy) {
  const m = MESES_ES[norm(mes).replace('.', '').slice(0, 3)];
  if (!m) return null;
  return `${yyyy}-${m}-${String(dd).padStart(2, '0')}`;
}

export const PDF_PROFILES = [
  {
    // L.2 / F.5 — RappiCuenta (cuenta de ahorros RappiPay). Tabla:
    //   "Detalles de movimientos ... / Fecha Descripción Valor /
    //    11 May 2026     Redención Cashback     +$8,007.87"
    // ⚠ Montos en formato US (',' miles · '.' decimales) — parseMoney lo soporta.
    id: 'rappicuenta',
    name: 'RappiCuenta',
    color: '#FF441B',
    textColor: '#fff',
    currency: 'COP',
    detect(text) {
      return /Extracto de tu RappiCuenta/i.test(text);
    },
    parse(text) {
      const items = [];
      let skipped = 0;
      for (const line of String(text).split('\n')) {
        const m = line.match(/^\s*(\d{1,2})\s+([a-zA-Záéíóú]{3,5})\.?\s+(\d{4})\s{2,}(.+?)\s{2,}([+-]?)\s?\$\s?([\d.,]+)\s*$/);
        if (!m) continue;
        const date = toIsoEs(m[1], m[2], m[3]);
        const amount = parseMoney(m[6]);
        if (!date || !(amount > 0)) { skipped++; continue; }
        items.push({
          date,
          description: m[4].trim(),
          amount: Math.abs(amount),
          type: m[5] === '-' ? 'expense' : 'income',
        });
      }
      return { items, skipped };
    },
  },
];

export function detectPdfBank(text, filename) {
  for (const p of PDF_PROFILES) {
    if (p.detect && p.detect(text, String(filename || ''))) return p;
  }
  return null;
}

export function detectBank(headers, filename) {
  const name = String(filename || '').toLowerCase();
  for (const p of BANK_PROFILES) {
    if (p.matchFilename && p.matchFilename.test(name)) return p;
  }
  if (headers && headers.length) {
    for (const p of BANK_PROFILES) {
      if (p.matchHeaders && p.matchHeaders(headers)) return p;
    }
  }
  return null;
}
