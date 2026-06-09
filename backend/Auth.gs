/**
 * Auth.gs — Verificación de Google ID Token (TD-09 opción C).
 * Reemplaza la autenticación por token compartido.
 * El frontend envía el id_token de Google en cada request;
 * aquí se verifica contra la API pública de Google y se cachea.
 *
 * SEC-006: los accesos denegados se registran en AuditLog con rate-limit
 * (APP.accessDeniedRateLimitMax intentos por APP.accessDeniedRateLimitTtl segundos
 * por clave email/razón) para evitar flood del AuditLog en ataques de fuerza bruta.
 */

/**
 * Registra un acceso denegado en AuditLog respetando el rate-limit configurado.
 * Usa CacheService para contar intentos por clave dentro de la ventana TTL.
 * @param {string} reason — razón del rechazo ('ISS_INVALID'|'EXP_INVALID'|'EMAIL_UNVERIFIED'|'EMAIL_UNAUTHORIZED'|'AUD_INVALID')
 * @param {string|null} email — email intentado (si decodificable del payload)
 */
function logAccessDenied_(reason, email) {
  try {
    var max = APP.accessDeniedRateLimitMax || 5;
    var ttl = APP.accessDeniedRateLimitTtl || 60;
    var rateKey = 'auth_deny_' + reason + '_' + (email || 'unknown');
    var cache = CacheService.getScriptCache();
    var countStr = cache.get(rateKey);
    var count = countStr ? parseInt(countStr, 10) : 0;
    if (count >= max) {
      // Límite superado: solo loguear en Logger, no escribir al AuditLog
      Logger.log('[Auth] rate-limit activo para ' + rateKey + ' (' + count + ' intentos)');
      return;
    }
    cache.put(rateKey, String(count + 1), ttl);
    var summary = reason + (email ? ' email=' + email : '');
    logAudit_('ACCESS_DENIED', 'Auth', null, summary);
  } catch (e) {
    Logger.log('[Auth] logAccessDenied_ error: ' + e.message);
  }
}

/**
 * Verifica el id_token de Google y valida que el email pertenezca al propietario.
 * Cachea el resultado 25 minutos para no llamar a tokeninfo en cada request.
 * @param {string} idToken — JWT emitido por Google Identity Services.
 * @returns {boolean}
 */
function verifyGoogleToken_(idToken) {
  if (!idToken || typeof idToken !== 'string') return false;

  var cache = CacheService.getScriptCache();
  // Clave de caché: hash MD5 del token (no lo exponemos en claro)
  var hash = Utilities.base64Encode(
    Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, idToken)
  ).slice(0, 24);
  var cacheKey = 'gauth_' + hash;

  var cached = cache.get(cacheKey);
  if (cached === '1') return true;
  if (cached === '0') return false;

  try {
    var res = UrlFetchApp.fetch(
      'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken),
      { muteHttpExceptions: true }
    );

    if (res.getResponseCode() !== 200) {
      cache.put(cacheKey, '0', 60); // caché negativo corto (1 min)
      return false;
    }

    var data = JSON.parse(res.getContentText());

    // 0. Issuer — defensa en profundidad (SEC-002/TD-51)
    var VALID_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];
    if (VALID_ISSUERS.indexOf(data.iss) === -1) {
      Logger.log('[Auth] Issuer inválido: ' + data.iss);
      cache.put(cacheKey, '0', 60);
      logAccessDenied_('ISS_INVALID', data.email || null);
      return false;
    }

    // 0b. Expiración — defensa en profundidad (SEC-002/TD-51)
    var nowSec = Math.floor(Date.now() / 1000);
    if (!data.exp || parseInt(data.exp, 10) <= nowSec) {
      Logger.log('[Auth] Token expirado: exp=' + data.exp);
      cache.put(cacheKey, '0', 60);
      logAccessDenied_('EXP_INVALID', data.email || null);
      return false;
    }

    // 1. Email verificado por Google
    if (!data.email_verified || data.email_verified === 'false') {
      cache.put(cacheKey, '0', 60);
      logAccessDenied_('EMAIL_UNVERIFIED', data.email || null);
      return false;
    }

    // 2. Email en la lista de autorizados
    if (APP.allowedEmails.indexOf(data.email) === -1) {
      cache.put(cacheKey, '0', 300); // 5 min para cuentas no autorizadas
      Logger.log('[Auth] Intento de acceso no autorizado: ' + data.email);
      logAccessDenied_('EMAIL_UNAUTHORIZED', data.email);
      return false;
    }

    // 3. Audience: el campo aud debe contener el clientId de este proyecto.
    // Usamos indexOf porque en algunos contextos aud puede ser una lista separada por espacios.
    if (APP.googleClientId && String(data.aud || '').indexOf(APP.googleClientId) === -1) {
      Logger.log('[Auth] Audience no válida: ' + data.aud);
      cache.put(cacheKey, '0', 60);
      logAccessDenied_('AUD_INVALID', data.email || null);
      return false;
    }

    // Verificación exitosa — cachear 25 minutos (tokens duran 1 h)
    cache.put(cacheKey, '1', 1500);
    return true;

  } catch (e) {
    Logger.log('[Auth] Error verificando token: ' + e.message);
    return false; // No cachear errores de red
  }
}
