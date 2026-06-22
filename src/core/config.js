// core/config.js — configuración global del frontend.
export const CONFIG = {
  appName: 'FinanceOS',
  version: '0.2.147',
  owner: 'Alejo',
  dbName: 'financeos',
  storageKeys: {
    theme: 'financeos.theme',
  },
  api: {
    baseUrl: "https://script.google.com/macros/s/AKfycbzeLPrGZzHOjwAnFOt6ZNhFv5DesN29dn1Sh0p3O7OM0hV7v3EfHutdMa6OUcvdfbtu/exec",
    token: null, // Obsoleto — reemplazado por Google OAuth (TD-09). El backend ya no lo usa.
    timeoutMs: 15000,
  },
  // Google OAuth (TD-09): protege la app con la cuenta de Google del propietario.
  // Obtén el clientId en console.cloud.google.com → APIs → Credenciales → OAuth 2.0
  // Origen autorizado: https://alejandror1367.github.io
  auth: {
    clientId: '444939967819-uv535tm5fg5glrj2fqc4l3llrqmhvqbb.apps.googleusercontent.com',
  },
};
