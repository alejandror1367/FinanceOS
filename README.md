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

## Setup del repositorio (una sola vez por clon)

Activa el git hook que auto-bumpa la versión del Service Worker cada vez que
se commitean archivos del shell (`src/`, `index.html`, `manifest.json`, `assets/`).
Evita que el mobile PWA sirva JS/CSS cacheados de versiones anteriores.

```bash
git config core.hooksPath .githooks
```

### Tests financieros

```bash
node --test tests/selectors.test.js
```

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

En `src/core/config.js` define:

- `api.baseUrl` — URL `/exec` del Web App de Apps Script.
- `auth.clientId` — Client ID de Google Cloud Console (OAuth).

Con `api.baseUrl = null` la app funciona en modo local con datos mock.
Con `auth.clientId` vacío, la autenticación de Google está desactivada.

Detalles de despliegue del backend en `backend/README.md`, y del frontend en `DEPLOY.md`.
