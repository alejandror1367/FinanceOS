// core/config.js — configuración global del frontend.
export const CONFIG = {
  appName: 'FinanceOS',
  version: '0.1.0', // Fase 1
  owner: 'Alejo',
  dbName: 'financeos',
  storageKeys: {
    theme: 'financeos.theme',
  },
  // Conexión con el backend (Apps Script). El frontend solo conoce este
  // endpoint y el contrato action-based, nunca Google Sheets.
  //
  // Para conectar (Fase 3):
  //   1. baseUrl = URL "/exec" de tu Web App desplegada como
  //      "Cualquiera con el enlace".
  //   2. token   = mismo valor que la propiedad de script
  //      FINANCEOS_API_TOKEN del backend (opcional pero recomendado).
  // Con baseUrl en null, la app funciona en modo local/mock.
  api: {
    baseUrl: null,
    token: null,
    timeoutMs: 15000,
  },
};
