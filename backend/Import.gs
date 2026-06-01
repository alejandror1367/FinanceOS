/**
 * Import.gs — Proxy hacia Groq API para parseo inteligente de extractos.
 *
 * Requiere: Script Properties > GROQ_API_KEY
 * Obtener GRATIS (sin tarjeta) en: https://console.groq.com → API Keys
 * Configurar en: Apps Script → Configuración del proyecto → Propiedades del script
 *
 * Modelo: llama-3.3-70b-versatile (6.000 requests/día gratis)
 * Soporta: texto plano, CSV, Excel (como texto) — PDFs digitales via PDF.js
 *
 * NOTA: Groq no procesa PDFs base64 directamente (solo texto).
 * Para PDFs, PDF.js extrae el texto primero y lo envía como texto plano.
 * PDFs escaneados (sin texto) no son soportados sin un modelo de visión.
 */

var GROQ_MODEL_  = 'llama-3.3-70b-versatile';
var GROQ_URL_    = 'https://api.groq.com/openai/v1/chat/completions';

var SYSTEM_PROMPT_ =
  'Eres un extractor de datos financieros experto. Cuando recibas un extracto bancario ' +
  'o de inversiones, extraes TODAS las transacciones y devuelves ÚNICAMENTE un objeto JSON ' +
  'válido con esta estructura exacta, sin texto adicional ni markdown:\n' +
  '{\n' +
  '  "accountName": "string (nombre/número de cuenta)",\n' +
  '  "bankId": "string (bancolombia|nubank|nequi|global66|xtb|aqrinvest|rappipay|otro)",\n' +
  '  "currency": "string (código ISO: COP, USD, EUR...)",\n' +
  '  "period": { "from": "YYYY-MM-DD", "to": "YYYY-MM-DD" },\n' +
  '  "transactions": [\n' +
  '    {\n' +
  '      "date": "YYYY-MM-DD",\n' +
  '      "description": "string",\n' +
  '      "amount": number (siempre positivo),\n' +
  '      "type": "income|expense|transfer",\n' +
  '      "balance": number (opcional, saldo después de la transacción),\n' +
  '      "reference": "string (opcional, número de referencia)"\n' +
  '    }\n' +
  '  ]\n' +
  '}\n\n' +
  'Reglas: fechas en YYYY-MM-DD, montos siempre positivos, ' +
  'income=crédito/depósito/ingreso, expense=débito/retiro/compra, transfer=entre cuentas. ' +
  'Incluye TODAS las transacciones sin omitir ninguna.';

function buildUserMessage_(data) {
  var hint = data.bankHint ? ('Este extracto es de ' + data.bankHint + '.\n\n') : '';
  if (data.mimeType === 'application/pdf') {
    throw new Error(
      'PDF escaneado no soportado sin modelo de visión. ' +
      'Descarga el extracto en formato CSV desde la app de tu banco e inténtalo de nuevo.'
    );
  }
  return hint + 'Extracto a procesar:\n\n' + data.fileContent;
}

function parseStatement_(data) {
  var apiKey = PropertiesService.getScriptProperties().getProperty('GROQ_API_KEY');
  if (!apiKey) {
    throw new Error(
      'GROQ_API_KEY no configurada. ' +
      'Obtén tu clave GRATIS (sin tarjeta) en https://console.groq.com → API Keys y ' +
      'agrégala en Apps Script → Configuración del proyecto → Propiedades del script.'
    );
  }

  var userMessage;
  try {
    userMessage = buildUserMessage_(data);
  } catch (e) {
    throw e;
  }

  var payload = {
    model: GROQ_MODEL_,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT_ },
      { role: 'user',   content: userMessage },
    ],
    response_format: { type: 'json_object' },
    temperature: 0,
    max_tokens: 8192,
  };

  var response = UrlFetchApp.fetch(GROQ_URL_, {
    method: 'post',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  var code = response.getResponseCode();
  if (code !== 200) {
    var body = response.getContentText().slice(0, 400);
    throw new Error('Groq API error ' + code + ': ' + body);
  }

  var result = JSON.parse(response.getContentText());
  var text = result.choices &&
             result.choices[0] &&
             result.choices[0].message &&
             result.choices[0].message.content;

  if (!text) throw new Error('Groq no devolvió contenido. Intenta de nuevo.');

  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error('Respuesta de Groq no es JSON válido: ' + String(text).slice(0, 200));
  }
}
