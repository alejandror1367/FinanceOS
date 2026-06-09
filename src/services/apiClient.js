// services/apiClient.js — cliente HTTP del backend Apps Script.
// Todas las peticiones usan POST con body text/plain para evitar el preflight
// CORS que Apps Script no maneja (docs Fase 3) y para mantener idToken
// fuera de la URL (SEC-001/TD-50). Respuesta: { success, data|error }.
//
// SEC-001: el idToken viaja SIEMPRE en el POST body (campo "idToken"), nunca
// en la URL. apiClient.get() es un alias semántico para acciones de lectura
// pero sigue usando method:'POST'. El backend doGet solo se expone como
// fallback de diagnóstico manual — ver comentario SEC-001 en Code.gs.

import { CONFIG } from '../core/config.js';
import { auth } from '../core/auth.js';

const api = CONFIG.api;

function isConfigured() {
  return !!(api && api.baseUrl);
}

async function request(action, payload) {
  if (!isConfigured()) throw new Error('API no configurada (config.api.baseUrl).');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), api.timeoutMs || 15000);

  try {
    const response = await fetch(api.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, data: payload || {}, idToken: auth.getToken() || undefined }),
      signal: controller.signal,
      redirect: 'follow',
    });

    if (!response.ok) throw new Error('HTTP ' + response.status);
    const json = await response.json();
    if (!json || json.success !== true) {
      const err = json && json.error ? json.error : 'Respuesta inválida del backend.';
      // Sesión expirada: recargar UNA SOLA VEZ por sesión de browser para evitar bucle.
      // sessionStorage sobrevive a location.reload() pero no a cerrar el tab.
      // BUG-C1: solo cerramos sesión si el token local REALMENTE expiró/falta. Si el
      // token sigue siendo válido localmente, un "No autorizado." es transitorio (la
      // verificación fría del backend en el cold start): destruir la sesión reventaría
      // el store y dejaría todo en $0. En ese caso solo propagamos el error y dejamos
      // que el reintento de pullAll() se recupere.
      if (err === 'No autorizado.' || err === 'No autorizado: falta credencial.') {
        if (!auth.getToken() && !sessionStorage.getItem('financeos.auth.reload')) {
          sessionStorage.setItem('financeos.auth.reload', '1');
          auth.signOut(); // limpia token + recarga
        }
      }
      throw new Error(err);
    }
    return json.data;
  } finally {
    clearTimeout(timer);
  }
}

export const apiClient = {
  isConfigured,
  // Retry automático para absorber ERR_ABORTED del cold start de Apps Script
  // (se manifiesta como TypeError: "Failed to fetch", no como AbortError de nuestro timeout).
  get: async (action, params) => {
    try {
      return await request(action, params);
    } catch (err) {
      if (err instanceof TypeError) return request(action, params);
      throw err;
    }
  },
  post: (action, data) => request(action, data),
};
