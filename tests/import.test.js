/**
 * Tests de regresión del pipeline de importación (Sprint F.1) — fixtures sintéticos
 * que replican el formato de cada banco soportado. Cubren: parseCSV, detectBank,
 * mapRow por perfil, applyProfile (filtro de montos inválidos + período), dupKey
 * y toCSV (unión de columnas).
 *
 * Ejecutar: node --test tests/import.test.js
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseCSV } from '../src/services/parsers/csvParser.js';
import { detectBank, BANK_PROFILES, toIso, parseMoney } from '../src/services/parsers/bankProfiles.js';
import { applyProfile, dupKey } from '../src/services/importService.js';
import { toCSV } from '../src/utils/export.js';

function run(fixture, filename) {
  const { headers, rows } = parseCSV(fixture);
  const profile = detectBank(headers, filename);
  assert.ok(profile, `detectBank no reconoció ${filename}`);
  return { profile, result: applyProfile(profile, headers, rows) };
}

// ── Fixtures sintéticos por banco ────────────────────────────────────────────────

const FIX_BANCOLOMBIA = `Fecha,Descripción,Valor,Saldo,Referencia
2026-05-02,PAGO NOMINA EMPRESA,5000000,8200000,REF001
2026-05-03,COMPRA EXITO,-185000,8015000,REF002
05/05/2026,TRANSF A NEQUI,-300000,7715000,REF003`;

const FIX_NUBANK = `Date,Title,Amount
2026-05-01,Pago recibido,1200000
2026-05-04,Netflix,-47900`;

const FIX_NEQUI = `Fecha,Movimiento Nequi,Valor,Saldo
2026-05-02,Recarga desde Bancolombia,300000,350000
2026-05-06,Pago QR tienda,-42000,308000`;

const FIX_GLOBAL66 = `Date,Type,Amount Sent,Amount Received,Currency Received
2026-05-03,Remesa enviada,-120.50,,USD
2026-05-10,Remesa recibida,,480000,COP`;

const FIX_FINANCEOS = `fecha,descripcion,monto,tipo,categoria
2026-05-01,Nómina empresa,5000000,ingreso,Salario
2026-05-03,Rappi comida,-45000,gasto,Restaurantes
2026-05-10,Transferencia a Nu,-500000,transferencia,Transferencia`;

const FIX_XTB = `Symbol,Type,Volume,Open Price,Close Price,Profit
AAPL,BUY,2,180.5,,
VUG,SELL,1,310.2,335.8,25.6`;

// ── detectBank ───────────────────────────────────────────────────────────────────

describe('detectBank', () => {
  test('por filename gana sobre headers', () => {
    const p = detectBank(['x'], 'extracto-bancolombia-mayo.csv');
    assert.equal(p.id, 'bancolombia');
  });
  test('bancolombia por headers (fecha+valor+descripción)', () => {
    const { headers } = parseCSV(FIX_BANCOLOMBIA);
    assert.equal(detectBank(headers, 'archivo.csv').id, 'bancolombia');
  });
  test('nubank por headers (date+amount+title)', () => {
    const { headers } = parseCSV(FIX_NUBANK);
    assert.equal(detectBank(headers, 'movs.csv').id, 'nubank');
  });
  test('nequi por header con "nequi"', () => {
    const { headers } = parseCSV(FIX_NEQUI);
    assert.equal(detectBank(headers, 'movs.csv').id, 'nequi');
  });
  test('financeos por headers exactos (fecha+monto+tipo+categoria)', () => {
    const { headers } = parseCSV(FIX_FINANCEOS);
    assert.equal(detectBank(headers, 'export.csv').id, 'financeos');
  });
  test('xtb por headers (symbol+profit)', () => {
    const { headers } = parseCSV(FIX_XTB);
    assert.equal(detectBank(headers, 'historial.csv').id, 'xtb');
  });
  test('formato desconocido → null', () => {
    assert.equal(detectBank(['foo', 'bar'], 'algo.csv'), null);
  });
});

// ── mapRow / applyProfile por banco ─────────────────────────────────────────────

describe('Bancolombia', () => {
  test('mapea fechas ISO y DD/MM/YYYY, signo → tipo, monto absoluto', () => {
    const { result } = run(FIX_BANCOLOMBIA, 'bancolombia.csv');
    assert.equal(result.items.length, 3);
    const [nomina, exito, transf] = result.items;
    assert.equal(nomina.date, '2026-05-02');
    assert.equal(nomina.type, 'income');
    assert.equal(nomina.amount, 5000000);
    assert.equal(exito.type, 'expense');
    assert.equal(exito.amount, 185000);
    assert.equal(transf.date, '2026-05-05'); // DD/MM/YYYY normalizado
  });
});

describe('NuBank', () => {
  test('amount negativo → expense; positivo → income', () => {
    const { result } = run(FIX_NUBANK, 'nu.csv');
    assert.equal(result.items[0].type, 'income');
    assert.equal(result.items[1].type, 'expense');
    assert.equal(result.items[1].amount, 47900);
  });
});

describe('Nequi', () => {
  test('mapea movimientos con saldo', () => {
    const { result } = run(FIX_NEQUI, 'nequi.csv');
    assert.equal(result.items.length, 2);
    assert.equal(result.items[0].type, 'income');
    assert.equal(result.items[1].type, 'expense');
  });
});

describe('Global66', () => {
  test('recibido → income; enviado → expense (sincronizable, sin transfer huérfano)', () => {
    const { result } = run(FIX_GLOBAL66, 'global66.csv');
    assert.equal(result.items.length, 2);
    const [sent, received] = result.items;
    assert.equal(sent.type, 'expense');
    assert.equal(sent.amount, 120.5);
    assert.equal(received.type, 'income');
    assert.equal(received.amount, 480000);
    assert.equal(received.currency, 'COP');
  });
});

describe('FinanceOS CSV (prompt de Claude)', () => {
  test('tipo desde columna tipo; categoryName preservado; signo preservado en signedAmount', () => {
    const { result } = run(FIX_FINANCEOS, 'financeos-import.csv');
    assert.equal(result.items.length, 3);
    const [ing, gasto, transf] = result.items;
    assert.equal(ing.type, 'income');
    assert.equal(ing.categoryName, 'Salario');
    assert.equal(gasto.type, 'expense');
    assert.equal(gasto.amount, 45000);
    assert.equal(transf.type, 'transfer');
    assert.ok(transf.signedAmount < 0, 'transferencia saliente conserva signo negativo');
  });
});

describe('XTB (broker)', () => {
  test('filas sin monto de caja se OMITEN (no generan transacciones basura $0)', () => {
    const { result } = run(FIX_XTB, 'xtb.csv');
    // El perfil XTB es type:investment y sus filas no tienen amount → applyProfile
    // las filtra todas; skipped refleja el conteo.
    assert.equal(result.type, 'investment');
    assert.equal(result.items.length, 0);
    assert.equal(result.skipped, 2);
  });
});

// ── applyProfile: filtro de montos y período ────────────────────────────────────

describe('applyProfile', () => {
  const profile = BANK_PROFILES.find((p) => p.id === 'bancolombia');

  test('filtra filas con monto 0 o inválido y las cuenta en skipped', () => {
    const fixture = `Fecha,Descripción,Valor
2026-05-02,Válida,100000
2026-05-03,Monto cero,0
2026-05-04,Sin monto,`;
    const { headers, rows } = parseCSV(fixture);
    const result = applyProfile(profile, headers, rows);
    assert.equal(result.items.length, 1);
    assert.equal(result.skipped, 2);
  });

  test('calcula period {from,to} desde las fechas de los items', () => {
    const { result } = run(FIX_BANCOLOMBIA, 'bancolombia.csv');
    assert.equal(result.period.from, '2026-05-02');
    assert.equal(result.period.to, '2026-05-05');
  });
});

// ── dupKey (F.2) ────────────────────────────────────────────────────────────────

describe('dupKey', () => {
  test('misma fecha+monto+descripción → misma clave', () => {
    const a = { date: '2026-05-03', amount: 45000, description: 'Rappi comida' };
    const b = { date: '2026-05-03', amount: 45000, description: 'RAPPI COMIDA ' };
    assert.equal(dupKey(a), dupKey(b)); // normalización de descripción
  });
  test('misma fecha+monto pero DISTINTA descripción → claves distintas (sin falso positivo)', () => {
    const a = { date: '2026-05-03', amount: 45000, description: 'Rappi comida' };
    const b = { date: '2026-05-03', amount: 45000, description: 'Uber viaje' };
    assert.notEqual(dupKey(a), dupKey(b));
  });
  test('monto con signo distinto pero igual magnitud comparte clave (abs)', () => {
    const a = { date: '2026-05-03', amount: -45000, description: 'x' };
    const b = { date: '2026-05-03', amount: 45000, description: 'x' };
    assert.equal(dupKey(a), dupKey(b));
  });
});

// ── helpers de bankProfiles ──────────────────────────────────────────────────────

describe('parseMoney / toIso', () => {
  test('formato colombiano 1.234.567,89', () => {
    assert.equal(parseMoney('1.234.567,89'), 1234567.89);
  });
  test('formato estándar 1,234,567.89', () => {
    assert.equal(parseMoney('1,234,567.89'), 1234567.89);
  });
  test('con símbolo de moneda', () => {
    assert.equal(parseMoney('$45.000'), 45000);
  });
  test('toIso DD/MM/YYYY y YYYYMMDD', () => {
    assert.equal(toIso('05/05/2026'), '2026-05-05');
    assert.equal(toIso('20260505'), '2026-05-05');
  });
});

// ── toCSV (EXP-1: unión de columnas) ────────────────────────────────────────────

describe('toCSV', () => {
  test('incluye columnas presentes solo en filas posteriores (no pierde toAccountId)', () => {
    const rows = [
      { id: '1', type: 'expense', amount: 100 },
      { id: '2', type: 'transfer', amount: 50, toAccountId: 'a2' },
    ];
    const csv = toCSV(rows);
    const header = csv.split('\n')[0];
    assert.ok(header.includes('toAccountId'), `header debe incluir toAccountId: ${header}`);
    assert.ok(csv.split('\n')[2].includes('a2'));
  });
  test('escapa comas y comillas', () => {
    const csv = toCSV([{ a: 'hola, "mundo"' }]);
    assert.ok(csv.includes('"hola, ""mundo"""'));
  });
});
