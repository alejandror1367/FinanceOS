// services/apiClient.js — cliente HTTP del backend Apps Script.
// Lecturas por GET (?action=...), escrituras por POST.
// El POST usa content-type text/plain para evitar el preflight CORS que
// Apps Script no maneja (docs Fase 3). Respuesta: { success, data|error }.

import { CONFIG } from '../core/config.js';

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
      if (api.token) url.searchParams.set('token', api.token);
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
        body: JSON.stringify({ action, data: payload, token: api.token || undefined }),
        signal: controller.signal,
        redirect: 'follow',
      });
    }

    if (!response.ok) throw new Error('HTTP ' + response.status);
    const json = await response.json();
    if (!json || json.success !== true) {
      throw new Error(json && json.error ? json.error : 'Respuesta inválida del backend.');
    }
    return json.data;
  } finally {
    clearTimeout(timer);
  }
}

export const apiClient = {
  isConfigured,
  get: (action, params) => request('GET', action, params),
  post: (action, data) => request('POST', action, data),
};
