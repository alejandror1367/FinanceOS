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
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCSV } from '../src/services/parsers/csvParser.js';
import { detectBank, detectPdfBank, detectExcelBank, BANK_PROFILES, PDF_PROFILES, EXCEL_PROFILES, toIso, toIsoEs, parseMoney } from '../src/services/parsers/bankProfiles.js';
import { applyProfile, finishPdfResult, dupKey } from '../src/services/importService.js';
import { toCSV } from '../src/utils/export.js';

const __root = join(dirname(fileURLToPath(import.meta.url)), '..');

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

// ── Sprint L.2: perfil PDF RappiCuenta (texto extraído por pdfParser) ───────────

const FIX_RAPPICUENTA_PDF = `Periodo
  1 MAY - 31 MAY (31 días)
  Tipo de cuenta :
  RappiCuenta - Cuenta de ahorros
  Extracto de tu RappiCuenta
Resumen del periodo
Saldo anterior     $233,730.14
  Abonos     +$8,007.87
Intereses ganados     +$1,759.57
  Detalles de movimientos     Del 1 MAY - 31 MAY (31 días)
  Fecha     Descripción     Valor
  11 May 2026     Redención Cashback     +$8,007.87
  31 May 2026     Intereses ganados     +$1,759.57
  15 May 2026     Retiro a Nequi     -$50,000.00
  Los intereses son calculados de forma diaria sobre el saldo de la cuenta.`;

describe('PDF RappiCuenta (L.2 / F.5)', () => {
  test('toIsoEs convierte mes en español', () => {
    assert.equal(toIsoEs('11', 'May', '2026'), '2026-05-11');
    assert.equal(toIsoEs('1', 'dic.', '2025'), '2025-12-01');
    assert.equal(toIsoEs('5', 'xxx', '2026'), null);
  });
  test('detectPdfBank reconoce el extracto por su texto (no por filename)', () => {
    const p = detectPdfBank(FIX_RAPPICUENTA_PDF, 'extracto_RAPPICARD.pdf');
    assert.ok(p);
    assert.equal(p.id, 'rappicuenta');
  });
  test('parse extrae solo filas de movimientos (formato US), con signo', () => {
    const profile = PDF_PROFILES.find((p) => p.id === 'rappicuenta');
    const result = finishPdfResult(profile, profile.parse(FIX_RAPPICUENTA_PDF));
    assert.equal(result.items.length, 3);
    assert.deepEqual(result.items[0], { date: '2026-05-11', description: 'Redención Cashback', amount: 8007.87, type: 'income' });
    assert.deepEqual(result.items[1], { date: '2026-05-31', description: 'Intereses ganados', amount: 1759.57, type: 'income' });
    assert.deepEqual(result.items[2], { date: '2026-05-15', description: 'Retiro a Nequi', amount: 50000, type: 'expense' });
    // Las líneas del resumen ("Abonos +$8,007.87") no llevan fecha → no entran.
    assert.equal(result.period.from, '2026-05-11');
    assert.equal(result.period.to, '2026-05-31');
    assert.equal(result.currency, 'COP');
  });
  test('texto ajeno → null (cae al flujo del prompt de IA)', () => {
    assert.equal(detectPdfBank('Extracto de cuenta de ahorros Bancolombia', 'x.pdf'), null);
  });
  test('REAL (local; se salta si no existe): el extracto verdadero del dueño parsea', () => {
    const real = join(__root, 'tests', 'fixtures', 'import', 'private', 'extracto_2026-05-01_2026-05-31-RAPPICARD.extracted.txt');
    if (!existsSync(real)) return; // gitignored: solo corre en el PC del dueño
    const text = readFileSync(real, 'utf8');
    const p = detectPdfBank(text, 'extracto_RAPPICARD.pdf');
    assert.ok(p && p.id === 'rappicuenta');
    const result = finishPdfResult(p, p.parse(text));
    assert.ok(result.items.length >= 2, `esperaba ≥2 movimientos, hubo ${result.items.length}`);
    assert.ok(result.items.every((i) => i.date && i.amount > 0 && i.description));
  });
});

// ── Sprint L.4: perfil PDF Nu (tarjeta de crédito) ──────────────────────────────
// Fixture sintético (datos inventados, misma estructura del extracto real). El año
// viaja en la línea siguiente a cada fila; los pagos/abonos se saltan.

const FIX_NU_PDF = `Llegó tu extracto de Mayo
  Fecha límite de pago    Fecha de corte    Periodo facturado
  09 JUN 2026    18 MAY 2026    17 ABR - 17 MAY 2026
  Nu Financiera
NIT 901.658.107-2
  1 / 2

--- PÁGINA ---

Fecha  Descripción     Valor     Cuotas     Valor     Interés del mes    Total a pagar     Restante
  09 MAY  Gracias por tu  $450.450,50     -$24.838,05
2026  pago
  29 ABR  Amazon Prime     $24.900,00     1 de 1     $24.900,00  1.97%     $0,00  $24.900,00     $0,00
2026
29 MAR  Spotify Premio     $16.900,00     1 de 1     $0,00  1.89%     $610,42  $641,72     $0,00
2026
Intereses en  1.89%     $31,30
mora
20 MAR  Promo Viaje     $100.000,00     1 de 1     $0,00  1.89%     $3.017,20  $3.142,92     $0,00
2026
  Nu Colombia Compañía de Financiamiento S.A.
  2 / 2`;

describe('PDF Nu (L.4)', () => {
  test('detectPdfBank reconoce Nu por su texto (no por filename)', () => {
    const p = detectPdfBank(FIX_NU_PDF, 'Nu_2026-06-07.pdf');
    assert.ok(p);
    assert.equal(p.id, 'nu');
  });
  test('parse extrae compras como expense, con año de la línea siguiente', () => {
    const profile = PDF_PROFILES.find((p) => p.id === 'nu');
    const result = finishPdfResult(profile, profile.parse(FIX_NU_PDF));
    assert.equal(result.items.length, 3); // 3 compras; el pago se salta
    assert.deepEqual(result.items.find((i) => i.description === 'Amazon Prime'),
      { date: '2026-04-29', description: 'Amazon Prime', amount: 24900, type: 'expense' });
    assert.deepEqual(result.items.find((i) => i.description === 'Spotify Premio'),
      { date: '2026-03-29', description: 'Spotify Premio', amount: 16900, type: 'expense' });
    assert.deepEqual(result.items.find((i) => i.description === 'Promo Viaje'),
      { date: '2026-03-20', description: 'Promo Viaje', amount: 100000, type: 'expense' });
    assert.equal(result.currency, 'COP');
  });
  test('salta el pago/abono ("Gracias por tu pago")', () => {
    const profile = PDF_PROFILES.find((p) => p.id === 'nu');
    const result = profile.parse(FIX_NU_PDF);
    assert.ok(!result.items.some((i) => /gracias|pago/i.test(i.description)));
    assert.ok(result.skipped >= 1);
  });
  test('RappiCuenta NO se detecta como Nu (perfiles no colisionan)', () => {
    assert.equal(detectPdfBank(FIX_RAPPICUENTA_PDF, 'x.pdf').id, 'rappicuenta');
  });
  test('REAL (local; se salta si no existe): el extracto Nu verdadero parsea', () => {
    const real = join(__root, 'tests', 'fixtures', 'import', 'private', 'Nu_2026-06-07.extracted.txt');
    if (!existsSync(real)) return; // gitignored: solo corre en el PC del dueño
    const text = readFileSync(real, 'utf8');
    const p = detectPdfBank(text, 'Nu_2026-06-07.pdf');
    assert.ok(p && p.id === 'nu');
    const result = finishPdfResult(p, p.parse(text));
    assert.ok(result.items.length >= 2, `esperaba ≥2 compras, hubo ${result.items.length}`);
    assert.ok(result.items.every((i) => i.date && i.amount > 0 && i.description && i.type === 'expense'));
    assert.ok(!result.items.some((i) => /gracias por tu/i.test(i.description)), 'no debe incluir el pago');
  });
});

// ── Sprint L.4b: perfil PDF RappiCard (Davivienda, tarjeta de crédito) ──────────
// Fecha ISO en la fila. Fila MERCADO PAGO con descripción envuelta; PAGOS POR PSE
// negativo se salta. Fixture sintético (estructura del extracto real).

const FIX_RAPPICARD_PDF = `  Producto emitido por Davivienda S.A.
  Extracto de tarjeta de crédito
  Número de tarjeta Virtual     8967

--- PÁGINA ---

Detalle de transacciones: ALEJANDRO ROJAS RODERO (Titular)
  Tarjeta     Fecha     Descripción     facturado  Cuotas  pendiente
  -     2026-04-30     GASTOS DE COBRANZA     $1.471,00     $1.471,00     N/A     $0,00     0%     0,00%
Virtual     2026-05-05     NETFLIX     $29.900,00     $29.900,00     1 de 1     $0,00     0,0000%     0,00%
Virtual     2026-05-07     AMAZON PRIME*4G10P2BC3     $28.928,39     $28.928,39     1 de 1     $0,00     0,0000%     0,00%
MERCADO
Virtual     2026-05-09     $119.416,00     $13.268,44     1 de 9     $106.147,56     0,0000%     0,00%
PAGO*MERCADOLI
Virtual     2026-05-09     CLAUDE.AI SUBSCRIPTION     $76.450,04     $76.450,04     1 de 1     $0,00     0,0000%     0,00%
-     2026-05-09     PAGOS POR PSE     $-481.872,99     N/A     N/A     N/A     0%     0,00%
Virtual     2026-05-11     OPENAI *CHATGPT SUBSCR     $20.900,00     $20.900,00     1 de 1     $0,00     0,0000%     0,00%

--- PÁGINA ---

  Paga tu RappiCard fácilmente desde tu cuenta RappiPay o PSE.
Banco Davivienda S.A NIT860.034.313-7`;

describe('PDF RappiCard / Davivienda (L.4b)', () => {
  test('detectPdfBank reconoce RappiCard por su texto', () => {
    const p = detectPdfBank(FIX_RAPPICARD_PDF, '00200001CREDIT_CARD_STATEMENT.pdf');
    assert.ok(p);
    assert.equal(p.id, 'rappicard');
  });
  test('parse extrae compras como expense, salta el pago PSE negativo', () => {
    const profile = PDF_PROFILES.find((p) => p.id === 'rappicard');
    const result = finishPdfResult(profile, profile.parse(FIX_RAPPICARD_PDF));
    assert.equal(result.items.length, 6); // 6 cargos; PAGOS POR PSE (negativo) se salta
    assert.deepEqual(result.items.find((i) => i.description === 'NETFLIX'),
      { date: '2026-05-05', description: 'NETFLIX', amount: 29900, type: 'expense' });
    assert.deepEqual(result.items.find((i) => i.description === 'GASTOS DE COBRANZA'),
      { date: '2026-04-30', description: 'GASTOS DE COBRANZA', amount: 1471, type: 'expense' });
    assert.ok(!result.items.some((i) => /PSE/.test(i.description)), 'no debe incluir el pago PSE');
    assert.equal(result.currency, 'COP');
  });
  test('reconstruye descripción envuelta (MERCADO PAGO) y usa el valor facturado', () => {
    const profile = PDF_PROFILES.find((p) => p.id === 'rappicard');
    const result = profile.parse(FIX_RAPPICARD_PDF);
    const mp = result.items.find((i) => i.date === '2026-05-09' && i.amount === 119416);
    assert.ok(mp, 'fila MercadoPago presente con valor facturado completo (no la cuota)');
    assert.match(mp.description, /MERCADO.*PAGO/);
  });
  test('REAL (local; se salta si no existe): el extracto RappiCard verdadero parsea', () => {
    const real = join(__root, 'tests', 'fixtures', 'import', 'private', '00200001000000161284CREDIT_CARD_STATEMENT.extracted.txt');
    if (!existsSync(real)) return; // gitignored: solo corre en el PC del dueño
    const text = readFileSync(real, 'utf8');
    const p = detectPdfBank(text, 'x.pdf');
    assert.ok(p && p.id === 'rappicard');
    const result = finishPdfResult(p, p.parse(text));
    assert.ok(result.items.length >= 5, `esperaba ≥5 cargos, hubo ${result.items.length}`);
    assert.ok(result.items.every((i) => i.date && i.amount > 0 && i.description && i.type === 'expense'));
    assert.ok(!result.items.some((i) => /PSE/.test(i.description)), 'no debe incluir el pago PSE');
  });
});

// ── Sprint L.3: perfil Excel TC Bancolombia/Amex (hojas crudas) ─────────────────

const FIX_AMEX_SHEETS = [
  {
    name: 'DOLARES',
    rows: [
      ['Información Cliente:', '', ''],
      ['Información de la Tarjeta', '***********0808', ''],
      ['Moneda: ', 'DOLARES', ''],
      ['Movimientos durante el periodo', '', '', '', '', '', '', '', ''],
      ['Número de autorización', 'Fecha', 'Movimientos', 'Valor Movimiento', 'Número de cuotas', 'Valor cuota/abono', 'Interés mensual (%)', 'Interés anual (%)', 'Saldo pendiente'],
      ['111111', '10/05/2026', 'AMAZON US', '25.99', '1/1', '25.99', '0,0000', '00,0000', '0,00'],
    ],
  },
  {
    name: 'PESOS',
    rows: [
      ['Información Cliente:', '', ''],
      ['Información de la Tarjeta', '***********0808', ''],
      ['Moneda: ', 'PESOS', ''],
      ['Pago total', '3.126.176,00', ''],
      ['Movimientos durante el periodo', '', '', '', '', '', '', '', ''],
      ['Número de autorización', 'Fecha', 'Movimientos', 'Valor Movimiento', 'Número de cuotas', 'Valor cuota/abono', 'Interés mensual (%)', 'Interés anual (%)', 'Saldo pendiente'],
      ['', '18/05/2026', 'INTERESES CORRIENTES', '70.838,00', '', '70.838,00', '', '', '0,00'],
      ['000000', '18/05/2026', 'CUOTA DE MANEJO', '18.495,00', '', '18.495,00', '', '', '0,00'],
      ['191651', '05/05/2026', 'ABONO SUCURSAL VIRTUAL', '-2.886.877,00', '', '-2.886.877,00', '', '', '0,00'],
      ['458659', '03/05/2026', 'DL*DIDI RIDES CO', '36.400,00', '1/1', '36.400,00', '0,0000', '00,0000', '0,00'],
      ['393744', '19/04/2026', 'MERCADO PAGO', '-480.000,00', '', '-480.000,00', '', '', '0,00'],
      ['393744', '19/04/2026', 'MERCADO PAGO', '480.000,00', '1/6', '80.000,00', '0,0000', '00,0000', '400.000,00'],
      ['', '', '', '', '', '', '', '', ''],
      ['Movimientos antes del periodo', '', '', '', '', '', '', '', ''],
      ['Número de autorización', 'Fecha', 'Movimientos', 'Valor Movimiento', 'Número de cuotas', 'Valor cuota/abono', 'Interés mensual (%)', 'Interés anual (%)', 'Saldo pendiente'],
      ['516566', '20/03/2026', 'MERCADOPAGO COLOMBIA', '706.000,00', '2/3', '235.333,33', '1,9110', '25,5026', '235.333,34'],
    ],
  },
];

describe('Excel TC Bancolombia/Amex (L.3)', () => {
  const profile = EXCEL_PROFILES.find((p) => p.id === 'amex_bancolombia');

  test('detectExcelBank por contenido de hojas (sin depender del filename)', () => {
    assert.equal(detectExcelBank(FIX_AMEX_SHEETS, 'cualquier.xlsx'), profile);
    assert.equal(detectExcelBank([{ name: 'Hoja1', rows: [['Date', 'Amount'], ['2026-01-01', '5']] }], 'movs.xlsx'), null);
  });

  test('importa SOLO "durante el periodo"; la sección "antes del periodo" queda fuera', () => {
    const result = finishPdfResult(profile, profile.parse(FIX_AMEX_SHEETS));
    assert.ok(!result.items.some((i) => i.description.includes('MERCADOPAGO COLOMBIA')),
      'las cuotas viejas no deben importarse (duplicarían deuda)');
  });

  test('el signo decide: abonos/reversos negativos se saltan (D2), compras quedan', () => {
    const result = finishPdfResult(profile, profile.parse(FIX_AMEX_SHEETS));
    assert.ok(!result.items.some((i) => i.description.includes('ABONO')), 'abono saltado');
    const mp = result.items.filter((i) => i.description === 'MERCADO PAGO');
    assert.equal(mp.length, 1, 'del par MercadoPago solo entra la compra positiva');
    assert.equal(mp[0].amount, 480000, 'valor TOTAL de la compra en cuotas (D1), no la cuota');
    assert.equal(result.skipped, 2); // ABONO + reverso MercadoPago
  });

  test('cargos del banco (intereses, cuota de manejo) son gastos válidos', () => {
    const result = finishPdfResult(profile, profile.parse(FIX_AMEX_SHEETS));
    assert.ok(result.items.some((i) => i.description === 'INTERESES CORRIENTES' && i.amount === 70838));
    assert.ok(result.items.some((i) => i.description === 'CUOTA DE MANEJO' && i.amount === 18495));
  });

  test('hoja DOLARES → items con currency USD; hoja PESOS sin currency (COP del result)', () => {
    const result = finishPdfResult(profile, profile.parse(FIX_AMEX_SHEETS));
    const usd = result.items.find((i) => i.description === 'AMAZON US');
    assert.ok(usd);
    assert.equal(usd.currency, 'USD');
    assert.equal(usd.amount, 25.99);
    assert.ok(!result.items.find((i) => i.description === 'DL*DIDI RIDES CO').currency);
    assert.equal(result.currency, 'COP');
  });

  test('fechas DD/MM/YYYY normalizadas y tipo expense en todo', () => {
    const result = finishPdfResult(profile, profile.parse(FIX_AMEX_SHEETS));
    assert.ok(result.items.every((i) => /^\d{4}-\d{2}-\d{2}$/.test(i.date) && i.type === 'expense'));
    assert.equal(result.items.find((i) => i.description === 'DL*DIDI RIDES CO').date, '2026-05-03');
  });

  test('REAL (local; se salta si falta archivo o lib xlsx): el XLSX verdadero parsea', async () => {
    const real = join(__root, 'tests', 'fixtures', 'import', 'private', 'Extracto_202605_Amex_Detallado_0808.xlsx');
    if (!existsSync(real)) return;
    let XLSX;
    try { XLSX = await import('xlsx'); } catch { return; } // dev-only --no-save
    const wb = XLSX.read(readFileSync(real));
    const sheets = wb.SheetNames.map((name) => ({
      name,
      rows: XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, defval: '' })
        .map((r) => r.map((c) => String(c || '').trim())),
    }));
    const p = detectExcelBank(sheets, 'Extracto_202605_Amex_Detallado_0808.xlsx');
    assert.ok(p && p.id === 'amex_bancolombia');
    const result = finishPdfResult(p, p.parse(sheets));
    // Mayo 2026: 13 filas "durante el periodo" en PESOS − ABONO − reverso MercadoPago = 11
    assert.equal(result.items.length, 11);
    assert.equal(result.skipped, 2);
    assert.ok(result.items.every((i) => i.date && i.amount > 0 && i.type === 'expense'));
    assert.ok(!result.items.some((i) => /ABONO|MERCADOPAGO COLOMBIA|BATH & BODY|AMERICAN EAGLE|LA COLINA|DAFITI/i.test(i.description)),
      'sin abonos ni cuotas viejas');
    const mp = result.items.filter((i) => i.description === 'MERCADO PAGO');
    assert.equal(mp.length, 1);
    assert.equal(mp[0].amount, 480000);
  });
});
