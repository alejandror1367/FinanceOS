/**
 * Tests de los parsers de EmailCapture.gs (Sprint K) contra los fixtures reales
 * de tests/fixtures/email/. Los parsers son funciones puras sin dependencias de
 * Apps Script, así que el .gs (JS plano V8) se evalúa directo en Node.
 *
 * Ejecutar: node --test tests/emailCapture.test.js
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const gsSource = readFileSync(join(root, 'backend', 'EmailCapture.gs'), 'utf8');

// El .gs declara funciones globales (estilo Apps Script); las extraemos evaluando
// el archivo dentro de un scope de función. Las funciones de captura referencian
// GmailApp/repoReadAll_ solo al INVOCARSE, no al definirse, así que el eval es seguro.
const { ecParseAmountCo_, ecParseRappiCard_, ecParseBancolombia_, ecParseAlert_, ecResolveCategory_ } =
  new Function(`${gsSource}; return { ecParseAmountCo_, ecParseRappiCard_, ecParseBancolombia_, ecParseAlert_, ecResolveCategory_ };`)();

const fixtureFile = readFileSync(join(root, 'tests', 'fixtures', 'email', 'AMEXBANCOLOMBIA-RAPPICARD-COMPRAS-EJEMPLOS.TXT'), 'utf8');

// ── ecParseAmountCo_ (formato colombiano) ────────────────────────────────────────

describe('ecParseAmountCo_ (montos formato CO)', () => {
  test('miles con punto sin decimales', () => {
    assert.equal(ecParseAmountCo_('$20.900'), 20900);
    assert.equal(ecParseAmountCo_('$150.000'), 150000);
  });
  test('miles con punto y decimales con coma', () => {
    assert.equal(ecParseAmountCo_('$391.390,39'), 391390.39);
    assert.equal(ecParseAmountCo_('COP110.000,00'), 110000);
    assert.equal(ecParseAmountCo_('COP29.900,00'), 29900);
  });
  test('entrada vacía o basura → NaN', () => {
    assert.ok(Number.isNaN(ecParseAmountCo_('')));
    assert.ok(Number.isNaN(ecParseAmountCo_('sin monto')));
  });
});

// ── RappiCard ────────────────────────────────────────────────────────────────────

const RAPPI_SAMPLE = `¡Hola,
Realizaste una compra con tu RappiCard.

Detalle de tu transacción:

Monto

$391.390,39

Método de pago

*8967

No. de autorización

385047

Comercio

Amazon Marketplace

Fecha de la transacción

2026-06-09 00:03:39`;

describe('ecParseRappiCard_', () => {
  test('parsea el bloque completo (monto, tarjeta, comercio, fecha+hora)', () => {
    const p = ecParseRappiCard_(RAPPI_SAMPLE);
    assert.ok(p);
    assert.equal(p.bank, 'rappicard');
    assert.equal(p.amount, 391390.39);
    assert.equal(p.last4, '8967');
    assert.equal(p.merchant, 'Amazon Marketplace');
    assert.equal(p.dateIso, '2026-06-09T00:03:39');
  });
  test('comercio con varias palabras y mayúsculas', () => {
    const p = ecParseRappiCard_(RAPPI_SAMPLE.replace('Amazon Marketplace', 'OPENAI CHATGPT SUBSCR'));
    assert.equal(p.merchant, 'OPENAI CHATGPT SUBSCR');
  });
  test('correo ajeno → null', () => {
    assert.equal(ecParseRappiCard_('Tu extracto ya está disponible'), null);
  });
});

// ── Bancolombia (2 variantes) ────────────────────────────────────────────────────

const BCOL_V1 = 'Bancolombia: Compraste COP110.000,00 en S.C.A.R.E. con tu T.Cred *0808, el 04/06/2026 a las 15:18. Si tienes dudas, encuentranos aqui: 6045109095.';
const BCOL_V2 = 'Bancolombia: Compraste COP29.900,00 en PAYU*NETFLIX V, el 22/04/2026 a las 02:47. Esta compra esta asociada a T.Cred *3147. Si tienes dudas.';

describe('ecParseBancolombia_', () => {
  test('variante 1: tarjeta inline ("con tu T.Cred *NNNN")', () => {
    const p = ecParseBancolombia_(BCOL_V1);
    assert.ok(p);
    assert.equal(p.amount, 110000);
    assert.equal(p.last4, '0808');
    assert.equal(p.merchant, 'S.C.A.R.E.');
    assert.equal(p.dateIso, '2026-06-04T15:18:00');
  });
  test('variante 2: tarjeta en frase posterior ("asociada a T.Cred *NNNN")', () => {
    const p = ecParseBancolombia_(BCOL_V2);
    assert.ok(p);
    assert.equal(p.amount, 29900);
    assert.equal(p.last4, '3147');
    assert.equal(p.merchant, 'PAYU*NETFLIX V');
    assert.equal(p.dateIso, '2026-04-22T02:47:00');
  });
  test('hora de un dígito se rellena', () => {
    const p = ecParseBancolombia_(BCOL_V1.replace('a las 15:18', 'a las 2:47'));
    assert.equal(p.dateIso, '2026-06-04T02:47:00');
  });
  test('sin tarjeta en ninguna variante → null (a revisión, no inventa cuenta)', () => {
    assert.equal(ecParseBancolombia_('Bancolombia: Compraste COP10.000,00 en TIENDA, el 01/06/2026 a las 10:00.'), null);
  });
});

// ── ecParseAlert_ sobre los 8 fixtures reales del dueño ─────────────────────────

describe('ecParseAlert_ — fixtures reales (4 RappiCard + 4 Bancolombia)', () => {
  // El TXT del dueño contiene los 8 correos; cada alerta es parseable individualmente.
  // Los separamos por los marcadores del formato de cada banco.
  const rappiBlocks = fixtureFile.split(/¡Hola,/).slice(1).map((b) => '¡Hola,' + b);
  const bcolBlocks = fixtureFile.match(/Bancolombia: Compraste[^\n]+/g) || [];

  test('los 4 bloques RappiCard parsean', () => {
    assert.equal(rappiBlocks.length, 4);
    const expected = [
      { amount: 20900, merchant: 'OPENAI CHATGPT SUBSCR', dateIso: '2026-06-10T19:46:02' },
      { amount: 391390.39, merchant: 'Amazon Marketplace', dateIso: '2026-06-09T00:03:39' },
      { amount: 150000, merchant: 'STARLINK DL', dateIso: '2026-06-03T06:03:55' },
      { amount: 8900, merchant: 'YouTube', dateIso: '2026-06-03T16:25:19' },
    ];
    rappiBlocks.forEach((block, i) => {
      const p = ecParseAlert_(block);
      assert.ok(p, `bloque RappiCard #${i + 1} no parseó`);
      assert.equal(p.bank, 'rappicard');
      assert.equal(p.last4, '8967');
      assert.equal(p.amount, expected[i].amount);
      assert.equal(p.merchant, expected[i].merchant);
      assert.equal(p.dateIso, expected[i].dateIso);
    });
  });

  test('las 4 líneas Bancolombia parsean', () => {
    assert.equal(bcolBlocks.length, 4);
    const expected = [
      { amount: 110000, merchant: 'S.C.A.R.E.', last4: '0808', dateIso: '2026-06-04T15:18:00' },
      { amount: 283020, merchant: 'TIENDA D1 MALAGA', last4: '0808', dateIso: '2026-05-30T14:35:00' },
      { amount: 36400, merchant: 'DL*DIDI RIDES CO', last4: '3147', dateIso: '2026-05-03T18:45:00' },
      { amount: 29900, merchant: 'PAYU*NETFLIX V', last4: '3147', dateIso: '2026-04-22T02:47:00' },
    ];
    bcolBlocks.forEach((line, i) => {
      const p = ecParseAlert_(line);
      assert.ok(p, `línea Bancolombia #${i + 1} no parseó`);
      assert.equal(p.bank, 'bancolombia');
      assert.equal(p.amount, expected[i].amount);
      assert.equal(p.merchant, expected[i].merchant);
      assert.equal(p.last4, expected[i].last4);
      assert.equal(p.dateIso, expected[i].dateIso);
    });
  });

  test('monto cero o negativo → null (K: validación antes de crear)', () => {
    assert.equal(ecParseAlert_(BCOL_V1.replace('COP110.000,00', 'COP0,00')), null);
  });
});

// ── ecResolveCategory_ (reglas comercio→categoría) ──────────────────────────────

describe('ecResolveCategory_', () => {
  const rules = [
    ['NETFLIX|YOUTUBE|SPOTIFY', 'cat_streaming'],
    ['RAPPI|UBER|DIDI', 'cat_transporte'],
    ['D1|EXITO|CARULLA', 'cat_mercado'],
  ];
  test('primera regla que matchea gana (case-insensitive)', () => {
    assert.equal(ecResolveCategory_('PAYU*NETFLIX V', rules, 'cat_otros'), 'cat_streaming');
    assert.equal(ecResolveCategory_('YouTube', rules, 'cat_otros'), 'cat_streaming');
    assert.equal(ecResolveCategory_('DL*DIDI RIDES CO', rules, 'cat_otros'), 'cat_transporte');
    assert.equal(ecResolveCategory_('TIENDA D1 MALAGA', rules, 'cat_otros'), 'cat_mercado');
  });
  test('sin match → fallback', () => {
    assert.equal(ecResolveCategory_('STARLINK DL', rules, 'cat_otros'), 'cat_otros');
  });
  test('regex inválido se ignora sin romper', () => {
    assert.equal(ecResolveCategory_('ABC', [['[invalid(', 'cat_x'], ['ABC', 'cat_ok']], 'cat_fb'), 'cat_ok');
  });
  test('sin reglas ni fallback → string vacío', () => {
    assert.equal(ecResolveCategory_('ABC', [], ''), '');
  });
});
