/**
 * Import.gs — Proxy hacia Claude API para parseo inteligente de extractos.
 *
 * Requiere: Script Properties > ANTHROPIC_API_KEY
 * Configurar en Apps Script → Configuración del proyecto → Propiedades del script.
 *
 * Acción: parseStatement
 * Input:  { fileContent, fileName, mimeType, bankHint }
 *   - mimeType "application/pdf"  → fileContent es base64 del PDF
 *   - mimeType "text/plain"|"text/csv"|otros → fileContent es texto plano
 */

var EXTRACT_TOOL_ = {
  name: 'extract_transactions',
  description: 'Extrae transacciones financieras estructuradas de un extracto bancario o de inversiones.',
  input_schema: {
    type: 'object',
    required: ['transactions', 'currency'],
    properties: {
      accountName:  { type: 'string',  description: 'Nombre o número de cuenta detectado' },
      bankId: {
        type: 'string',
        description: 'ID del banco: bancolombia | nubank | nequi | global66 | xtb | aqrinvest | rappipay | otro',
      },
      currency: { type: 'string', description: 'Código ISO de moneda: COP, USD, EUR, etc.' },
      period: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'Fecha inicio YYYY-MM-DD' },
          to:   { type: 'string', description: 'Fecha fin YYYY-MM-DD' },
        },
      },
      transactions: {
        type: 'array',
        description: 'Lista completa de transacciones del extracto',
        items: {
          type: 'object',
          required: ['date', 'description', 'amount', 'type'],
          properties: {
            date:        { type: 'string',  description: 'Fecha ISO 8601: YYYY-MM-DD' },
            description: { type: 'string' },
            amount:      { type: 'number',  description: 'Monto siempre positivo (usa type para indicar dirección)' },
            type: {
              type: 'string',
              enum: ['income', 'expense', 'transfer'],
              description: 'income=ingreso/crédito, expense=gasto/débito, transfer=transferencia',
            },
            balance:   { type: 'number', description: 'Saldo después de la transacción (si aparece)' },
            reference: { type: 'string', description: 'Número de referencia o comprobante' },
          },
        },
      },
    },
  },
};

function buildPrompt_(bankHint) {
  var hint = bankHint ? (' Este extracto parece ser de ' + bankHint + '.') : '';
  return 'Eres un extractor de datos financieros preciso. Analiza este extracto bancario o de inversiones y extrae TODAS las transacciones usando la herramienta extract_transactions.' +
    hint + '\n\n' +
    'Reglas estrictas:\n' +
    '- Fechas en formato YYYY-MM-DD\n' +
    '- Montos siempre positivos; usa "type" para la dirección\n' +
    '- income = crédito / depósito / ingreso; expense = débito / retiro / compra; transfer = entre cuentas\n' +
    '- Incluye TODAS las transacciones, sin omitir ninguna\n' +
    '- La moneda debe ser código ISO (COP, USD, EUR…)\n' +
    '- Si aparece el saldo, inclúyelo en "balance"';
}

function parseStatement_(data) {
  var apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY no configurada. ' +
      'Ve a Apps Script → Configuración del proyecto → Propiedades del script y agrégala.'
    );
  }

  var isPdfBase64 = data.mimeType === 'application/pdf';
  var userContent;

  if (isPdfBase64) {
    userContent = [
      {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: data.fileContent },
      },
      { type: 'text', text: buildPrompt_(data.bankHint) },
    ];
  } else {
    userContent = buildPrompt_(data.bankHint) + '\n\n---\n\n' + data.fileContent;
  }

  var payload = {
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    tools: [EXTRACT_TOOL_],
    tool_choice: { type: 'tool', name: 'extract_transactions' },
    messages: [{ role: 'user', content: userContent }],
  };

  var response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  var code = response.getResponseCode();
  if (code !== 200) {
    var body = response.getContentText().slice(0, 300);
    throw new Error('Claude API error ' + code + ': ' + body);
  }

  var result = JSON.parse(response.getContentText());
  var toolUse = result.content && result.content.filter(function (b) { return b.type === 'tool_use'; })[0];
  if (!toolUse) throw new Error('Claude no pudo extraer datos del archivo. Verifica que el archivo sea legible.');

  return toolUse.input;
}
