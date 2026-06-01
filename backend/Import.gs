/**
 * Import.gs — Proxy hacia Gemini API para parseo inteligente de extractos.
 *
 * Requiere: Script Properties > GEMINI_API_KEY
 * Obtener GRATIS en: https://aistudio.google.com/app/apikey (sin tarjeta)
 * Configurar en: Apps Script → Configuración del proyecto → Propiedades del script
 *
 * Modelo: gemini-1.5-flash (1.500 requests/día gratis)
 * Soporta: texto plano, CSV, Excel (como texto) y PDF (base64)
 */

var GEMINI_MODEL_ = 'gemini-1.5-flash';
var GEMINI_URL_   = 'https://generativelanguage.googleapis.com/v1beta/models/' +
                    GEMINI_MODEL_ + ':generateContent?key=';

var EXTRACT_SCHEMA_ = {
  type: 'OBJECT',
  required: ['transactions', 'currency'],
  properties: {
    accountName: { type: 'STRING',  description: 'Nombre o número de cuenta detectado' },
    bankId: {
      type: 'STRING',
      description: 'ID del banco: bancolombia | nubank | nequi | global66 | xtb | aqrinvest | rappipay | otro',
    },
    currency: { type: 'STRING', description: 'Código ISO de moneda: COP, USD, EUR, etc.' },
    period: {
      type: 'OBJECT',
      properties: {
        from: { type: 'STRING', description: 'Fecha inicio YYYY-MM-DD' },
        to:   { type: 'STRING', description: 'Fecha fin YYYY-MM-DD' },
      },
    },
    transactions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        required: ['date', 'description', 'amount', 'type'],
        properties: {
          date:        { type: 'STRING',  description: 'Fecha ISO 8601: YYYY-MM-DD' },
          description: { type: 'STRING' },
          amount:      { type: 'NUMBER',  description: 'Monto siempre positivo' },
          type: {
            type: 'STRING',
            enum: ['income', 'expense', 'transfer'],
            description: 'income=ingreso/crédito, expense=gasto/débito, transfer=transferencia',
          },
          balance:   { type: 'NUMBER', description: 'Saldo después de la transacción (opcional)' },
          reference: { type: 'STRING', description: 'Número de referencia o comprobante (opcional)' },
        },
      },
    },
  },
};

function buildPrompt_(bankHint) {
  var hint = bankHint ? (' Este extracto parece ser de ' + bankHint + '.') : '';
  return 'Eres un extractor de datos financieros. Analiza este extracto bancario o de inversiones y extrae TODAS las transacciones.' +
    hint + '\n\n' +
    'Reglas:\n' +
    '- Fechas en formato YYYY-MM-DD\n' +
    '- Montos siempre positivos; usa "type" para la dirección\n' +
    '- income=crédito/depósito/ingreso, expense=débito/retiro/compra, transfer=entre cuentas\n' +
    '- Incluye TODAS las transacciones sin omitir ninguna\n' +
    '- Moneda en código ISO (COP, USD, EUR…)';
}

function parseStatement_(data) {
  var apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY no configurada. ' +
      'Obtén tu clave GRATIS en https://aistudio.google.com/app/apikey y ' +
      'agrégala en Apps Script → Configuración del proyecto → Propiedades del script.'
    );
  }

  var parts = [{ text: buildPrompt_(data.bankHint) }];

  if (data.mimeType === 'application/pdf') {
    parts.push({
      inline_data: { mime_type: 'application/pdf', data: data.fileContent },
    });
  } else {
    parts.push({ text: '\n\n---\n\n' + data.fileContent });
  }

  var payload = {
    contents: [{ role: 'user', parts: parts }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: EXTRACT_SCHEMA_,
      temperature: 0,
    },
  };

  var response = UrlFetchApp.fetch(GEMINI_URL_ + apiKey, {
    method: 'post',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  var code = response.getResponseCode();
  if (code !== 200) {
    var body = response.getContentText().slice(0, 400);
    throw new Error('Gemini API error ' + code + ': ' + body);
  }

  var result = JSON.parse(response.getContentText());
  var text = result.candidates &&
             result.candidates[0] &&
             result.candidates[0].content &&
             result.candidates[0].content.parts &&
             result.candidates[0].content.parts[0] &&
             result.candidates[0].content.parts[0].text;

  if (!text) throw new Error('Gemini no pudo extraer datos del archivo. Verifica que el archivo sea legible.');

  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error('Respuesta de Gemini no es JSON válido: ' + String(text).slice(0, 200));
  }
}
