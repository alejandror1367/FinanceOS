/**
 * EmailCapture.gs — Sprint K: captura automática de compras con tarjeta desde Gmail.
 *
 * Un trigger temporal (cada 15 min) busca correos de alerta de compra de los bancos,
 * extrae monto/comercio/fecha+hora/últimos 4 dígitos, y crea la transacción como
 * gasto en la cuenta credit_card correspondiente vía createTransaction_ (que ya
 * aporta idempotencia por id, ajuste de saldo y AuditLog).
 *
 * Idempotencia: id determinista 'gm_' + messageId de Gmail → correr el trigger N
 * veces nunca duplica. Trazabilidad: etiquetas FinanceOS/procesado y FinanceOS/revisar
 * (lo no parseable queda etiquetado, jamás se pierde en silencio).
 *
 * Configuración en la hoja Settings (editable sin redeploy; JSON largo se edita
 * directo en la celda — setSetting_ trunca a 240 chars):
 *   emailcapture.enabled            'true' | 'false'
 *   emailcapture.cardmap            JSON {"8967":"<accountId>", "0808":"<accountId>", ...}
 *   emailcapture.categoryrules      JSON [["NETFLIX|YOUTUBE|SPOTIFY","<categoryId>"], ...]
 *                                   (regex case-insensitive sobre el comercio, primera que matchea gana)
 *   emailcapture.fallbackcategoryid categoryId (kind=expense) para comercios sin regla
 *
 * Puesta en marcha (una vez, desde el editor de Apps Script):
 *   1. Guardar este archivo → Google pedirá re-autorizar (scope de Gmail).
 *   2. Ejecutar setupEmailCapture() → crea etiquetas, claves de Settings y el trigger.
 *   3. Rellenar cardmap/fallbackcategoryid en la hoja Settings.
 * Prueba manual: acción runEmailCapture (POST autenticado) o ejecutar
 * processEmailCapture() desde el editor.
 */

var EMAIL_CAPTURE = {
  // Ventana de búsqueda: idempotencia por id permite re-escanear sin duplicar.
  // in:anywhere incluye Spam: los correos de bancos REENVIADOS (filtro o manual)
  // suelen fallar SPF y caer ahí; sin esto se perderían en silencio.
  query: 'in:anywhere newer_than:7d (from:noreply@rappicard.co OR from:alertasynotificaciones@an.notificacionesbancolombia.com OR "Realizaste una compra con tu RappiCard" OR "Bancolombia: Compraste")',
  labelProcessed: 'FinanceOS/procesado',
  labelReview: 'FinanceOS/revisar',
  maxMessagesPerRun: 50,
  triggerEveryMinutes: 15,
  keys: {
    enabled: 'emailcapture.enabled',
    cardMap: 'emailcapture.cardmap',
    rules: 'emailcapture.categoryrules',
    fallbackCategory: 'emailcapture.fallbackcategoryid',
  },
};

// ───────────────────────── Parsers puros ─────────────────────────
// Sin dependencias de Apps Script: se testean en node (tests/emailCapture.test.js).

// Montos formato colombiano: '.' miles y ',' decimales ("391.390,39", "20.900", "COP110.000,00").
function ecParseAmountCo_(s) {
  var t = String(s || '').replace(/[^\d.,]/g, '');
  if (!t) return NaN;
  if (t.indexOf(',') >= 0) {
    t = t.replace(/\./g, '').replace(/,/g, '.');
  } else {
    t = t.replace(/\./g, ''); // sin coma decimal: los puntos son separadores de miles
  }
  return Number(t);
}

// RappiCard (noreply@rappicard.co): bloques "Etiqueta\n\nValor".
// Devuelve { bank, amount, last4, merchant, dateIso } o null si no es de este formato.
function ecParseRappiCard_(body) {
  var text = String(body || '').replace(/\s+/g, ' ');
  if (!/Realizaste una compra con tu RappiCard/i.test(text)) return null;
  var amount = text.match(/Monto\s*\$\s*([\d.,]+)/i);
  var card = text.match(/M[ée]todo de pago\s*\*(\d{4})/i);
  var merchant = text.match(/Comercio\s+(.+?)\s+Fecha de la transacci[oó]n/i);
  var date = text.match(/Fecha de la transacci[oó]n\s+(\d{4}-\d{2}-\d{2})[\sT](\d{1,2}:\d{2}(?::\d{2})?)/i);
  if (!amount || !card || !merchant || !date) return null;
  var time = date[2].length === 5 ? date[2] + ':00' : date[2];
  return {
    bank: 'rappicard',
    amount: ecParseAmountCo_(amount[1]),
    last4: card[1],
    merchant: merchant[1].trim(),
    dateIso: date[1] + 'T' + time,
  };
}

// Bancolombia (alertasynotificaciones@an.notificacionesbancolombia.com), 2 variantes:
//  "Compraste COP110.000,00 en S.C.A.R.E. con tu T.Cred *0808, el 04/06/2026 a las 15:18."
//  "Compraste COP29.900,00 en PAYU*NETFLIX V, el 22/04/2026 a las 02:47. ... asociada a T.Cred *3147."
function ecParseBancolombia_(body) {
  var text = String(body || '').replace(/\s+/g, ' ');
  var m = text.match(/Bancolombia:\s*Compraste\s+COP\s*([\d.,]+)\s+en\s+(.+?)(?:\s+con tu T\.?\s?Cred\s*\*(\d{4}))?,\s*el\s+(\d{1,2})\/(\d{1,2})\/(\d{4})\s+a las\s+(\d{1,2}:\d{2})/i);
  if (!m) return null;
  var last4 = m[3];
  if (!last4) {
    var assoc = text.match(/asociada a\s+T\.?\s?Cred\s*\*(\d{4})/i);
    if (assoc) last4 = assoc[1];
  }
  if (!last4) return null;
  var dd = ('0' + m[4]).slice(-2), mm = ('0' + m[5]).slice(-2);
  var hhmm = m[7].length === 4 ? '0' + m[7] : m[7];
  return {
    bank: 'bancolombia',
    amount: ecParseAmountCo_(m[1]),
    last4: last4,
    merchant: m[2].trim(),
    dateIso: m[6] + '-' + mm + '-' + dd + 'T' + hhmm + ':00',
  };
}

// Detección + parse. Devuelve null si el correo no es una alerta de compra conocida.
function ecParseAlert_(body) {
  var parsed = ecParseRappiCard_(body) || ecParseBancolombia_(body);
  if (!parsed) return null;
  if (!(parsed.amount > 0)) return null; // monto cero/negativo o no numérico: a revisión
  return parsed;
}

// ¿El correo PARECE una compra con tarjeta de crédito? El remitente de Bancolombia
// también manda notificaciones de cuenta (transferencias, pagos, recepciones) que NO
// nos interesan: esas se ignoran en silencio. Solo va a FinanceOS/revisar lo que
// parece compra con TC pero no parseó (plantilla cambiada).
function ecLooksLikeCardPurchase_(body) {
  var text = String(body || '').replace(/\s+/g, ' ');
  if (/Realizaste una compra con tu RappiCard/i.test(text)) return true;
  return /Compraste/i.test(text) && /T\.?\s?Cred/i.test(text);
}

// Primera regla cuyo regex (case-insensitive) matchea el comercio; si ninguna, fallback.
// rules: [["NETFLIX|YOUTUBE","cat_x"], ...] — regex inválido se ignora (no rompe el batch).
function ecResolveCategory_(merchant, rules, fallbackId) {
  for (var i = 0; i < (rules || []).length; i++) {
    var pattern = rules[i] && rules[i][0], catId = rules[i] && rules[i][1];
    if (!pattern || !catId) continue;
    try {
      if (new RegExp(pattern, 'i').test(merchant)) return catId;
    } catch (e) { /* regex inválido en Settings: ignorar la regla */ }
  }
  return fallbackId || '';
}

// ───────────────────────── Captura (Apps Script) ─────────────────────────

function ecGetSettings_() {
  var rows = repoReadAll_('Settings');
  var map = {};
  rows.forEach(function (r) { map[r.key] = r.value; });
  var parseJson = function (s, def) {
    if (!s) return def;
    try { return JSON.parse(s); } catch (e) { return def; }
  };
  return {
    enabled: String(map[EMAIL_CAPTURE.keys.enabled] || 'true') !== 'false',
    cardMap: parseJson(map[EMAIL_CAPTURE.keys.cardMap], {}),
    rules: parseJson(map[EMAIL_CAPTURE.keys.rules], []),
    fallbackCategory: map[EMAIL_CAPTURE.keys.fallbackCategory] || '',
  };
}

// Núcleo SIN lock: doPost ya sostiene el ScriptLock cuando llega vía runEmailCapture.
function emailCaptureRun_() {
  var cfg = ecGetSettings_();
  // ignoredSubjects/reviewSubjects: diagnóstico (máx 10) para saber QUÉ se descartó.
  var summary = { created: 0, skipped: 0, review: 0, ignored: 0, scanned: 0, errors: [], ignoredSubjects: [], reviewSubjects: [] };
  if (!cfg.enabled) { summary.disabled = true; return summary; }

  var labelOk = GmailApp.getUserLabelByName(EMAIL_CAPTURE.labelProcessed) || GmailApp.createLabel(EMAIL_CAPTURE.labelProcessed);
  var labelRev = GmailApp.getUserLabelByName(EMAIL_CAPTURE.labelReview) || GmailApp.createLabel(EMAIL_CAPTURE.labelReview);

  var threads = GmailApp.search(EMAIL_CAPTURE.query, 0, EMAIL_CAPTURE.maxMessagesPerRun);
  for (var t = 0; t < threads.length; t++) {
    var messages = threads[t].getMessages();
    var threadOk = false, threadReview = false;
    for (var m = 0; m < messages.length; m++) {
      var msg = messages[m];
      summary.scanned++;
      var txId = 'gm_' + msg.getId();
      try {
        // Salta si la fila YA EXISTE, incluso soft-deleted: si el dueño borró la tx
        // auto-creada en la app, el scan NO debe resucitarla (idempotentHit_ devuelve
        // null para isDeleted=true y createTransaction_ la recrearía).
        if (repoFindRowIndex_('Transactions', txId) > 0) { summary.skipped++; threadOk = true; continue; }
        var body = msg.getPlainBody();
        var parsed = ecParseAlert_(body);
        if (!parsed) {
          if (!ecLooksLikeCardPurchase_(body)) {
            // Notificación de cuenta (transferencia, pago, etc.): no nos interesa.
            summary.ignored++;
            if (summary.ignoredSubjects.length < 10) summary.ignoredSubjects.push(sanitizeString_(msg.getSubject(), 80));
            continue;
          }
          // Parece compra con TC pero el formato no parseó → a revisión, nunca se pierde.
          summary.review++; threadReview = true;
          if (summary.reviewSubjects.length < 10) summary.reviewSubjects.push(sanitizeString_(msg.getSubject(), 80));
          logAudit_('review', 'EmailCapture', msg.getId(), 'Alerta no parseable: ' + sanitizeString_(msg.getSubject(), 120));
          continue;
        }
        var accountId = cfg.cardMap[parsed.last4];
        if (!accountId) {
          summary.review++; threadReview = true;
          logAudit_('review', 'EmailCapture', msg.getId(), 'Tarjeta *' + parsed.last4 + ' sin cuenta en ' + EMAIL_CAPTURE.keys.cardMap);
          continue;
        }
        createTransaction_({
          id: txId,
          type: 'expense',
          date: parsed.dateIso,
          amount: parsed.amount,
          currency: APP.baseCurrency,
          accountId: accountId,
          categoryId: ecResolveCategory_(parsed.merchant, cfg.rules, cfg.fallbackCategory),
          description: parsed.merchant,
        });
        summary.created++; threadOk = true;
      } catch (err) {
        // Un correo malo no tumba el batch (p. ej. fallbackcategoryid sin configurar).
        summary.review++; threadReview = true;
        summary.errors.push(msg.getId() + ': ' + (err.message || String(err)));
        logAudit_('review', 'EmailCapture', msg.getId(), 'Error: ' + sanitizeString_(err.message || String(err), 160));
      }
    }
    if (threadOk) threads[t].addLabel(labelOk);
    if (threadReview) threads[t].addLabel(labelRev);
  }
  if (summary.created || summary.review) {
    logAudit_('run', 'EmailCapture', '', 'created=' + summary.created + ' skipped=' + summary.skipped + ' review=' + summary.review + ' scanned=' + summary.scanned);
  }
  return summary;
}

// Entrada del TRIGGER temporal: toma el mismo ScriptLock que doPost para no
// pisarse con escrituras del frontend. Si no lo consigue, lo intenta el próximo run.
function processEmailCapture() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return;
  try {
    emailCaptureRun_();
  } finally {
    lock.releaseLock();
  }
}

// Puesta en marcha idempotente — ejecutar UNA VEZ a mano desde el editor.
function setupEmailCapture() {
  // Etiquetas
  if (!GmailApp.getUserLabelByName(EMAIL_CAPTURE.labelProcessed)) GmailApp.createLabel(EMAIL_CAPTURE.labelProcessed);
  if (!GmailApp.getUserLabelByName(EMAIL_CAPTURE.labelReview)) GmailApp.createLabel(EMAIL_CAPTURE.labelReview);

  // Claves de Settings (solo si faltan; no pisa valores ya configurados)
  var existing = {};
  repoReadAll_('Settings').forEach(function (r) { existing[r.key] = true; });
  [
    [EMAIL_CAPTURE.keys.enabled, 'true'],
    [EMAIL_CAPTURE.keys.cardMap, '{}'],
    [EMAIL_CAPTURE.keys.rules, '[]'],
    [EMAIL_CAPTURE.keys.fallbackCategory, ''],
  ].forEach(function (kv) {
    if (!existing[kv[0]]) setSetting_({ key: kv[0], value: kv[1] });
  });

  // Trigger temporal (borra duplicados del mismo handler antes de crear)
  ScriptApp.getProjectTriggers().forEach(function (tr) {
    if (tr.getHandlerFunction() === 'processEmailCapture') ScriptApp.deleteTrigger(tr);
  });
  ScriptApp.newTrigger('processEmailCapture').timeBased().everyMinutes(EMAIL_CAPTURE.triggerEveryMinutes).create();

  return 'OK: etiquetas + settings + trigger cada ' + EMAIL_CAPTURE.triggerEveryMinutes + ' min. Configura ' + EMAIL_CAPTURE.keys.cardMap + ' y ' + EMAIL_CAPTURE.keys.fallbackCategory + ' en la hoja Settings.';
}
