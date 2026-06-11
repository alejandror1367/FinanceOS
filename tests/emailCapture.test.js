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
const { ecParseAmountCo_, ecParseRappiCard_, ecParseBancolombia_, ecParseGlobal66_, ecParseAlert_, ecResolveCategory_, ecLooksLikeCardPurchase_ } =
  new Function(`${gsSource}; return { ecParseAmountCo_, ecParseRappiCard_, ecParseBancolombia_, ecParseGlobal66_, ecParseAlert_, ecResolveCategory_, ecLooksLikeCardPurchase_ };`)();

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
  test('comercio con separador de guiones del render real → se limpia (caso K.8 en vivo)', () => {
    const real = RAPPI_SAMPLE.replace('Amazon Marketplace', 'Amazon Prime Video\n\n------------------------------');
    const p = ecParseRappiCard_(real);
    assert.equal(p.merchant, 'Amazon Prime Video');
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

// ── Global66 Smart Card (débito, moneda del comercio) ───────────────────────────

const G66_SAMPLE = `Hola

Acá está el detalle de la compra con tu Smart Card:

Tarjeta Virtual: **** **** **** 7292

Monto: $ 66.873,00 COP

Comercio: ELECTRIFICADORA DE SAN
Fecha: 06/06/2026

Hora: 15:44

Saludos

Equipo Global66`;

describe('ecParseGlobal66_', () => {
  test('parsea monto, moneda, tarjeta, comercio y fecha+hora', () => {
    const p = ecParseGlobal66_(G66_SAMPLE);
    assert.ok(p);
    assert.equal(p.bank, 'global66');
    assert.equal(p.amount, 66873);
    assert.equal(p.currency, 'COP');
    assert.equal(p.last4, '7292');
    assert.equal(p.merchant, 'ELECTRIFICADORA DE SAN');
    assert.equal(p.dateIso, '2026-06-06T15:44:00');
  });
  test('compra en USD conserva la moneda del comercio', () => {
    const p = ecParseGlobal66_(G66_SAMPLE.replace('$ 66.873,00 COP', '$ 25,99 USD'));
    assert.equal(p.amount, 25.99);
    assert.equal(p.currency, 'USD');
  });
  test('compra en EUR conserva la moneda', () => {
    const p = ecParseGlobal66_(G66_SAMPLE.replace('$ 66.873,00 COP', '$ 110,50 EUR'));
    assert.equal(p.amount, 110.5);
    assert.equal(p.currency, 'EUR');
  });
  test('los 3 fixtures reales del dueño parsean', () => {
    const g66File = readFileSync(join(root, 'tests', 'fixtures', 'email', 'GLOBAL66-COMPRAS-EJEMPLOS.txt'), 'utf8');
    const blocks = g66File.split(/#\d/).slice(1);
    assert.equal(blocks.length, 3);
    const expected = [
      { amount: 66873, merchant: 'ELECTRIFICADORA DE SAN', dateIso: '2026-06-06T15:44:00' },
      { amount: 111000, merchant: 'MERCADOPAGO', dateIso: '2026-06-01T15:29:00' },
      { amount: 60314, merchant: 'UNE TELCO UNE PAGO EXP', dateIso: '2026-05-06T19:37:00' },
    ];
    blocks.forEach((b, i) => {
      const p = ecParseAlert_(b);
      assert.ok(p, `bloque Global66 #${i + 1} no parseó`);
      assert.equal(p.bank, 'global66');
      assert.equal(p.last4, '7292');
      assert.equal(p.currency, 'COP');
      assert.equal(p.amount, expected[i].amount);
      assert.equal(p.merchant, expected[i].merchant);
      assert.equal(p.dateIso, expected[i].dateIso);
    });
  });
  test('correo ajeno → null', () => {
    assert.equal(ecParseGlobal66_('Tu transferencia Global66 fue exitosa'), null);
  });
});

// ── ecLooksLikeCardPurchase_ (filtro: solo compras con TC; el resto se ignora) ──

describe('ecLooksLikeCardPurchase_', () => {
  test('compras con tarjeta de crédito → true', () => {
    assert.equal(ecLooksLikeCardPurchase_(RAPPI_SAMPLE), true);
    assert.equal(ecLooksLikeCardPurchase_(BCOL_V1), true);
    assert.equal(ecLooksLikeCardPurchase_(BCOL_V2), true);
  });
  test('Global66 Smart Card (débito) → true (excepción intencional: sí se captura)', () => {
    assert.equal(ecLooksLikeCardPurchase_(G66_SAMPLE), true);
  });
  test('notificaciones de cuenta Bancolombia (transferencias, pagos, recepciones) → false (se ignoran en silencio)', () => {
    assert.equal(ecLooksLikeCardPurchase_('Bancolombia: Transferiste COP500.000,00 desde tu cuenta de ahorros *1234 a NEQUI, el 05/06/2026 a las 10:00.'), false);
    assert.equal(ecLooksLikeCardPurchase_('Bancolombia: Recibiste COP1.000.000,00 en tu cuenta de ahorros *1234, el 05/06/2026.'), false);
    assert.equal(ecLooksLikeCardPurchase_('Bancolombia: Pagaste COP200.000,00 de tu factura, el 05/06/2026 a las 09:00.'), false);
    assert.equal(ecLooksLikeCardPurchase_('Tu extracto del mes ya está disponible.'), false);
  });
  test('compra con TC pero plantilla cambiada → true (irá a FinanceOS/revisar, no se pierde)', () => {
    assert.equal(ecLooksLikeCardPurchase_('Bancolombia: Compraste con tu T.Cred *0808 — formato nuevo sin monto'), true);
  });
  test('compra débito (sin T.Cred) → false (fuera del alcance: solo tarjetas de crédito)', () => {
    assert.equal(ecLooksLikeCardPurchase_('Bancolombia: Compraste COP50.000,00 en TIENDA con tu Tarjeta Débito *9999, el 05/06/2026 a las 12:00.'), false);
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

// ── Reglas recomendadas (backend/EmailCapture.settings.example.json) ────────────

describe('reglas recomendadas del example.json', () => {
  const example = JSON.parse(readFileSync(join(root, 'backend', 'EmailCapture.settings.example.json'), 'utf8'));
  const rules = example['emailcapture.categoryrules'];
  const fallback = example['emailcapture.fallbackcategoryid'];
  const CAT = {
    restaurantes: '01KSZWJN0FBP406DNKJJHV1RHX', mercado: '01KSZWJP1S7HPJT3S0GNQ4RXJ4',
    transporte: '01KSZWJQJYKSS8SG5MFM5NZ9MB', suscripciones: '01KSZWJRDXNHCEHTQ1G6XBCPZ3',
    tecnologia: '01KSZZSZKZJQQ6F0NGTS2HD070', otros: '01KTG03AFZMDVMRCMFXYG8E7TQ',
  };

  test('estructura válida: pares [regex, categoryId] y regex compilables', () => {
    assert.ok(Array.isArray(rules) && rules.length >= 15);
    rules.forEach(([pattern, catId]) => {
      assert.ok(typeof pattern === 'string' && pattern.length);
      assert.match(catId, /^01[A-Z0-9]{24}$/);
      new RegExp(pattern, 'i'); // lanza si es inválido
    });
  });

  test('los comercios de los fixtures reales categorizan bien', () => {
    assert.equal(ecResolveCategory_('OPENAI CHATGPT SUBSCR', rules, fallback), CAT.suscripciones);
    assert.equal(ecResolveCategory_('STARLINK DL', rules, fallback), CAT.suscripciones);
    assert.equal(ecResolveCategory_('YouTube', rules, fallback), CAT.suscripciones);
    assert.equal(ecResolveCategory_('Amazon Marketplace', rules, fallback), CAT.tecnologia);
    assert.equal(ecResolveCategory_('TIENDA D1 MALAGA', rules, fallback), CAT.mercado);
    assert.equal(ecResolveCategory_('DL*DIDI RIDES CO', rules, fallback), CAT.transporte);
    assert.equal(ecResolveCategory_('PAYU*NETFLIX V', rules, fallback), CAT.suscripciones);
    assert.equal(ecResolveCategory_('S.C.A.R.E.', rules, fallback), CAT.otros); // sin regla → fallback
    assert.equal(ecResolveCategory_('ELECTRIFICADORA DE SAN', rules, fallback), '01KSZZSA11MAFWVMQFJHP9FCZG'); // Servicios
    assert.equal(ecResolveCategory_('UNE TELCO UNE PAGO EXP', rules, fallback), '01KSZZSA11MAFWVMQFJHP9FCZG'); // Servicios
  });

  test('el orden desambigua: específico gana sobre genérico', () => {
    assert.equal(ecResolveCategory_('UBER EATS BOGOTA', rules, fallback), CAT.restaurantes);
    assert.equal(ecResolveCategory_('UBER *TRIP', rules, fallback), CAT.transporte);
    assert.equal(ecResolveCategory_('RAPPI PRIME', rules, fallback), CAT.suscripciones);
    assert.equal(ecResolveCategory_('RAPPI*RESTAURANTE XYZ', rules, fallback), CAT.restaurantes);
    assert.equal(ecResolveCategory_('AMAZON PRIME CO', rules, fallback), CAT.suscripciones);
    assert.equal(ecResolveCategory_('MERCADO PAGO*VENDEDOR', rules, fallback), CAT.tecnologia);
  });
});
