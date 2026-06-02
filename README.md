# FinanceOS

Sistema operativo financiero personal privado para Alejo. PWA instalable, offline-first.

- **Frontend:** HTML + CSS + JavaScript (ES Modules). Sin frameworks, sin build step,
  sin dependencias npm en el runtime del cliente.
- **Backend:** Google Apps Script (`backend/`).
- **Base de datos:** Google Sheets (`FinanceOS_DB`, 13 hojas).
- **Hosting:** GitHub Pages.
- **Auth:** Google OAuth (Google Identity Services), restringida a emails autorizados.

> Las reglas, principios e invariantes del proyecto están en **`CLAUDE.md`**.
> El estado real (qué está hecho, pendientes, bugs) en **`PROJECT_HANDOFF.md`**.

## Desarrollo local

Requiere servir por HTTP (los ES Modules y el Service Worker no funcionan con `file://`):

```bash
npx serve .
# o cualquier servidor estático apuntando a la raíz del repo
```

Abre `http://localhost:3000/`.

Con `api.baseUrl = null` en `src/core/config.js` la app corre en modo local con datos
mock (sin backend). Con `auth.clientId` vacío, la autenticación de Google se desactiva.

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

Deben pasar siempre antes de commitear. Node.js v18+ (para `node:test` nativo).

## Estructura

```
index.html · manifest.json · sw.js · assets/
src/
  core/        bootstrap, auth (OAuth), router, rutas, config
  store/       estado reactivo + selectores (derivaciones financieras, testeadas)
  services/    apiClient, dataService, sync, IndexedDB, priceService (precios en vivo),
               tema, datos
  components/  ui, shell, modal, formularios, charts
  views/       dashboard, hoy, transacciones, cuentas, presupuestos, recurrentes,
               patrimonio, inversiones, metas, deudas, analítica, diario,
               importar (#/import, extractos con IA), exportaciones, ajustes
  styles/      tokens, temas, base, layout, componentes
  utils/       formato, dom, ids, iconos, export
backend/       Google Apps Script (.gs) + README de despliegue
tests/         selectors.test.js (node:test)
docs/          ver abajo
```

## Documentación

- **`CLAUDE.md`** — reglas, principios e invariantes del proyecto (leer antes de cambiar).
- **`PROJECT_HANDOFF.md`** — estado real, arquitectura, pendientes y guía de retomada.
- **`DEPLOY.md`** — despliegue del frontend en GitHub Pages.
- `docs/PRD.md` · `docs/Architecture.md` · `docs/Database.md` · `docs/Roadmap.md` — diseño base.
- `docs/TechnicalDebt.md` — deuda técnica priorizada (P0→P3).
- `docs/Audit.md` · `Audit-Financiero.md` · `Audit-Frontend.md` · `Audit-Backend.md` ·
  `Audit-Funcional-2026-06-02.md` — auditorías.
- `docs/SessionState.md` — estado de sesión.

## Configuración del backend

En `src/core/config.js` define:

- `api.baseUrl` — URL `/exec` del Web App de Apps Script.
- `auth.clientId` — Client ID de Google Cloud Console (OAuth).

El backend valida el `id_token` de Google y restringe el acceso a `allowedEmails`
(en `backend/Config.gs`). Detalles de despliegue del backend en `backend/README.md`,
y del frontend en `DEPLOY.md`.
