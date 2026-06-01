# FinanceOS

Sistema operativo financiero personal privado. PWA instalable, offline-first.

- **Frontend:** HTML + CSS + JavaScript (ES Modules). Sin frameworks, sin build, sin dependencias npm.
- **Backend:** Google Apps Script (`backend/`).
- **Base de datos:** Google Sheets.
- **Hosting:** GitHub Pages.

## Desarrollo local

Requiere servir por HTTP (los ES Modules y el Service Worker no funcionan con `file://`):

```bash
npx serve .
# o cualquier servidor estático apuntando a la raíz del repo
```

Abre `http://localhost:3000/`.

## Estructura

```
index.html · manifest.json · sw.js · assets/
src/
  core/        bootstrap, router, rutas, config
  store/       estado reactivo + selectores
  services/    apiClient, sync, IndexedDB, tema, datos
  components/  UI, shell, modal, formularios, charts
  views/       dashboard, hoy, transacciones, cuentas, presupuestos,
               recurrentes, patrimonio, inversiones, metas, deudas,
               analítica, diario, exportaciones, ajustes
  styles/      tokens, temas, base, layout, componentes
  utils/       formato, dom, ids, iconos, export
backend/       Google Apps Script (.gs) + README de despliegue
docs/          PRD, Architecture, Database, Roadmap
```

## Configuración del backend

Copia `src/core/config.js` y define `api.baseUrl` (URL `/exec` del Web App) y `api.token`.
Con `api.baseUrl = null` la app funciona en modo local con datos mock.

Detalles de despliegue del backend en `backend/README.md`, y del frontend en `DEPLOY.md`.
