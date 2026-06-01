/**
 * Auth.gs — Verificación de Google ID Token (TD-09 opción C).
 * Reemplaza la autenticación por token compartido.
 * El frontend envía el id_token de Google en cada request;
 * aquí se verifica contra la API pública de Google y se cachea.
 */

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

    // 1. Email verificado por Google
    if (!data.email_verified || data.email_verified === 'false') {
      cache.put(cacheKey, '0', 60);
      return false;
    }

    // 2. Email del propietario autorizado
    if (data.email !== APP.allowedEmail) {
      cache.put(cacheKey, '0', 300); // 5 min para cuentas no autorizadas
      Logger.log('[Auth] Intento de acceso no autorizado: ' + data.email);
      return false;
    }

    // 3. Audience: el token debe ser para este cliente de Google (si está configurado)
    if (APP.googleClientId && data.aud !== APP.googleClientId) {
      cache.put(cacheKey, '0', 60);
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
