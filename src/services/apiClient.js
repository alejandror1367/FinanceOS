// services/apiClient.js — cliente HTTP del backend Apps Script.
// Lecturas por GET (?action=...), escrituras por POST.
// El POST usa content-type text/plain para evitar el preflight CORS que
// Apps Script no maneja (docs Fase 3). Respuesta: { success, data|error }.

import { CONFIG } from '../core/config.js';
import { auth } from '../core/auth.js';

const api = CONFIG.api;

function isConfigured() {
  return !!(api && api.baseUrl);
}

async function request(method, action, payload) {
  if (!isConfigured()) throw new Error('API no configurada (config.api.baseUrl).');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), api.timeoutMs || 15000);

  try {
    let response;
    if (method === 'GET') {
      const url = new URL(api.baseUrl);
      url.searchParams.set('action', action);
      const idToken = auth.getToken();
      if (idToken) url.searchParams.set('idToken', idToken);
      const params = payload || {};
      Object.keys(params).forEach((k) => {
        if (params[k] != null) url.searchParams.set(k, params[k]);
      });
      response = await fetch(url.toString(), {
        method: 'GET',
        signal: controller.signal,
        redirect: 'follow',
      });
    } else {
      response = await fetch(api.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, data: payload, idToken: auth.getToken() || undefined }),
        signal: controller.signal,
        redirect: 'follow',
      });
    }

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
  // Retry automático en GET para absorber ERR_ABORTED del cold start de Apps Script
  // (se manifiesta como TypeError: "Failed to fetch", no como AbortError de nuestro timeout).
  get: async (action, params) => {
    try {
      return await request('GET', action, params);
    } catch (err) {
      if (err instanceof TypeError) return request('GET', action, params);
      throw err;
    }
  },
  post: (action, data) => request('POST', action, data),
};
