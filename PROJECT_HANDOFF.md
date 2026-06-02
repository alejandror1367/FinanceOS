# PROJECT_HANDOFF.md — FinanceOS
**Fecha de generación:** 2026-06-02 (actualizado post-auditoría)
**Para:** nueva sesión de Claude Code en otro equipo  
**Estado del repo:** `main` · `origin/main` · up to date

---

## 1. Objetivo del proyecto

**FinanceOS** es un sistema operativo financiero personal y privado para **Alejo** (propietario único). No es SaaS, no es multiusuario, no tiene monetización.

Centraliza: patrimonio neto, presupuestos, flujo de caja, inversiones, metas, deudas, diario financiero e insights. La experiencia objetivo mezcla Copilot Money / Monarch Money (dominio financiero) con Linear / Stripe Dashboard / Apple (calidad visual).

**URL en producción:** `https://alejandror1367.github.io/FinanceOS/`

---

## 2. Estado actual real

| Dimensión | Estado |
|---|---|
| Roadmap fases 0–12 | ✅ Completadas y en producción |
| PWA instalada en celular | ✅ Funcionando |
| Google OAuth | ✅ Activo (`patitosalmir@gmail.com` + `alejandrorr1367@gmail.com`) |
| Backend Apps Script | ✅ Desplegado y verificado en producción |
| Tests financieros | ✅ 35/35 pasando |
| Modelo híbrido de saldos (TD-01) | ✅ Código + backend desplegados y verificados |
| Deuda técnica P0 | ✅ Toda resuelta |
| Deuda técnica P1 | 🟡 En progreso — hechos TD-13/14/15/16/17; pendientes TD-10, TD-18 |
| Deuda técnica P2 | 🔴 Pendiente (14 ítems) |

---

## 3. Arquitectura

```
┌────────────────────────────────────────────────────────────┐
│              NAVEGADOR (PWA – GitHub Pages)                 │
│  Views → Store ← Services ← SyncEngine ← IndexedDB        │
│               ↕ auth.getToken() (Google id_token)          │
└────────────────────────┬───────────────────────────────────┘
                         │ HTTPS (action-based API)
┌────────────────────────▼───────────────────────────────────┐
│           GOOGLE APPS SCRIPT (backend)                      │
│  doGet/doPost → router → Auth.gs (verifyGoogleToken_)      │
│  → servicios CRUD → ajuste de saldos → AuditLog            │
└────────────────────────┬───────────────────────────────────┘
                         │
┌────────────────────────▼───────────────────────────────────┐
│           GOOGLE SHEETS — FinanceOS_DB                      │
│  13 hojas: Accounts · Transactions · Categories · Budgets  │
│  Goals · Investments · Assets · Liabilities ·              │
│  NetWorthSnapshots · RecurringTransactions ·               │
│  Journal · AuditLog · Settings                             │
└────────────────────────────────────────────────────────────┘
```

**Flujo de datos:** `Services → Store → Views` · acciones `Views → Services` (nunca directamente a red o IndexedDB).

---

## 4. Estructura de carpetas

```
FinanceOS/
├── index.html              # Entry point PWA
├── manifest.json           # PWA manifest
├── sw.js                   # Service Worker v0.2.4 (cache-first shell)
├── package.json            # { "type": "module" } — solo para node --test
├── .githooks/
│   └── pre-commit          # Auto-bump SW version al commitear src/*
├── assets/
│   ├── icon.svg
│   └── icon-maskable.svg
├── src/
│   ├── core/
│   │   ├── app.js          # Bootstrap: auth gate → shell → router → sync
│   │   ├── auth.js         # Google Identity Services (GIS) OAuth
│   │   ├── config.js       # api.baseUrl, auth.clientId
│   │   ├── router.js       # Hash router (#/ruta)
│   │   └── routes.js       # Declaración de 14 rutas
│   ├── store/
│   │   ├── store.js        # Estado reactivo (pub/sub)
│   │   └── selectors.js    # Derivaciones financieras puras (testeadas)
│   ├── services/
│   │   ├── apiClient.js    # HTTP client → Apps Script (envía id_token OAuth)
│   │   ├── dataService.js  # Orquesta local/sync · modelo híbrido saldos
│   │   ├── syncEngine.js   # Cola offline + reconciliación (flush cada 30 s)
│   │   ├── syncQueue.js    # Cola persistida en IndexedDB
│   │   ├── db.js           # Wrapper IndexedDB con promesas
│   │   ├── entities.js     # Mapa colecciones ↔ stores ↔ acciones backend
│   │   ├── theme.js        # Light/dark/system
│   │   └── toast.js        # Notificaciones
│   ├── components/
│   │   ├── ui.js           # Card, KpiCard, Button, Badge, BarChart...
│   │   ├── shell.js        # Sidebar, Topbar, BottomNav, SyncPill
│   │   ├── modal.js        # Modal accesible con focus-trap
│   │   ├── forms.js        # field(), textInput, select, segmented...
│   │   └── charts.js       # LineChart, Donut, Legend (SVG sin libs)
│   ├── views/              # 14 vistas (dashboard, today, transactions...)
│   ├── styles/
│   │   ├── tokens.css      # Primitivos (colores, tipografía, spacing)
│   │   ├── themes.css      # Semánticos dark/light
│   │   ├── base.css        # Reset + utilidades tipográficas
│   │   ├── layout.css      # Shell, sidebar, grid, responsive
│   │   └── components.css  # Card, KPI, button, input, modal...
│   ├── utils/
│   │   ├── format.js       # formatMoney, formatDate, relativeDay
│   │   ├── dom.js          # el(), mount(), $()
│   │   ├── icons.js        # SVG icons inline
│   │   ├── id.js           # newId() — ULID client-side
│   │   └── export.js       # PDF/CSV generation
│   └── data/
│       └── mock.js         # Datos mock (modo local sin backend)
├── backend/                # Google Apps Script (.gs)
│   ├── Config.gs           # APP config, SCHEMAS, ENUMS
│   ├── Utils.gs            # Repositorio genérico, validación, IDs
│   ├── Code.gs             # Router doGet/doPost + assertAuthorized_
│   ├── Auth.gs             # verifyGoogleToken_ con CacheService
│   ├── Accounts.gs         # CRUD + adjustBalance_ + applyTxBalanceDelta_
│   ├── Transactions.gs     # CRUD + ajuste de saldos en create/update/delete
│   ├── Migration.gs        # recalculateAccountBalances_ (correr una vez)
│   ├── [otras entidades]   # Categories, Budgets, Goals, Investments...
│   ├── Reports.gs          # getDashboard, computeNetWorth_
│   ├── Setup.gs            # setupDatabase() idempotente
│   ├── Audit.gs            # logAudit_
│   ├── Journal.gs          # CRUD diario financiero
│   └── appsscript.json     # Runtime V8
├── tests/
│   └── selectors.test.js   # 35 tests financieros (node --test)
├── docs/
│   ├── PRD.md · Architecture.md · Database.md · Roadmap.md
│   ├── Audit.md            # Auditoría de arquitectura
│   ├── Audit-Financiero.md # Auditoría de cálculos financieros
│   ├── Audit-Frontend.md   # Auditoría del Design System
│   ├── Audit-Backend.md    # Auditoría de Apps Script
│   └── TechnicalDebt.md    # Registro priorizado (40 ítems, P0-P3)
├── CLAUDE.md               # Fuente de verdad: reglas absolutas del proyecto
├── DEPLOY.md               # Instrucciones de despliegue en GitHub Pages
├── README.md               # Setup del repo, tests, configuración
└── PROJECT_HANDOFF.md      # Este archivo
```

---

## 5. Tecnologías utilizadas

| Capa | Tecnología | Notas |
|---|---|---|
| Frontend | HTML + CSS + JavaScript (ES Modules) | Sin frameworks, sin build, sin npm runtime |
| Backend | Google Apps Script | Funciones globales `.gs`, runtime V8 |
| Base de datos | Google Sheets (`FinanceOS_DB`) | 13 hojas |
| Hosting | GitHub Pages | Rama `main`, raíz `/` |
| PWA | Service Worker `v0.2.4` | Cache-first shell + fuentes cross-origin |
| Persistencia local | IndexedDB (datos) + localStorage (prefs) | Offline-first |
| Auth | Google Identity Services (GIS) | `accounts.google.com/gsi/client` |
| Tests | `node:test` (nativo Node 18+) | Sin jest, sin mocha |
| Tipografía | Inter (Google Fonts, cacheada por SW) | |

### Invariantes no negociables (ver `CLAUDE.md` para el detalle)
1. El artefacto servido es JS ejecutable en el navegador **sin build step** (sin
   frameworks que compilen: React/Vue/Angular/Svelte; sin bundlers: Vite/Webpack/Parcel).
2. Sin `.ts` con transpilación en lo servido. *Sí* se permite type-checking de dev vía
   **JSDoc + `tsc --checkJs --noEmit`** (no emite código; el artefacto sigue siendo JS plano).
3. Cero dependencias npm en el runtime del cliente (las libs de dev/test viven solo en dev).
4. El frontend no conoce la fuente de datos: todo pasa por `src/services/`.
5. Offline-first y exportabilidad total son requisitos, no opcionales.
6. Stack recomendado por defecto: Apps Script + Google Sheets + GitHub Pages (alternativas
   permitidas si respetan los invariantes; ver "Herramientas permitidas" en `CLAUDE.md`).
7. Trabajar por fases pequeñas y verificables.

---

## 6. Dependencias

**Runtime (cero dependencias npm):**
- Google Identity Services: `https://accounts.google.com/gsi/client` (cargado async en `index.html`)
- Inter font: `https://fonts.googleapis.com` (cacheada por SW tras primer load)

**Desarrollo (solo para tests):**
```json
{ "type": "module" }
```
Solo `package.json` con declaración ESM para que `node --test` funcione. Sin `node_modules`.

**Node.js requerido:** v18+ (para `node:test` nativo). En el equipo actual está en `C:\Program Files\nodejs`.

---

## 7. Variables de entorno / configuración sensible

Todo está en **`src/core/config.js`** (commiteado, ya que es una app privada personal):

```javascript
api: {
  baseUrl: "https://script.google.com/macros/s/AKfycbzeLPrGZzHOjwAnFOt6ZNhFv5DesN29dn1Sh0p3O7OM0hV7v3EfHutdMa6OUcvdfbtu/exec",
  token: null,   // Obsoleto — reemplazado por OAuth
  timeoutMs: 15000,
},
auth: {
  clientId: "444939967819-uv535tm5fg5glrj2fqc4l3llrqmhvqbb.apps.googleusercontent.com",
}
```

**Backend (`backend/Config.gs`):**
```javascript
allowedEmails: ['patitosalmir@gmail.com', 'alejandrorr1367@gmail.com'],
googleClientId: '444939967819-uv535tm5fg5glrj2fqc4l3llrqmhvqbb.apps.googleusercontent.com',
```

**Script Properties de Apps Script** (no en el repo, configuradas en la consola):
- `FINANCEOS_DB_ID` — ID del spreadsheet FinanceOS_DB (generado por `setupDatabase()`)
- `FINANCEOS_API_TOKEN` — ya no se usa (reemplazado por OAuth), puede quedar o borrarse

**Google Cloud Console:**
- Proyecto OAuth con Client ID: `444939967819-uv535tm5fg5glrj2fqc4l3llrqmhvqbb.apps.googleusercontent.com`
- Origen autorizado: `https://alejandror1367.github.io`

---

## 8. Estado de cada módulo

| Módulo | Vista | Estado | Notas |
|---|---|---|---|
| Dashboard | `views/dashboard.js` | ✅ | KPIs, evolución patrimonio, gastos por categoría, recientes, metas, próximos pagos |
| Hoy | `views/today.js` | ✅ | Copiloto diario: saldo, recientes, próximos pagos, metas prioritarias |
| Transacciones | `views/transactions.js` | ✅ | CRUD + duplicar, búsqueda, filtros. Ahora ajusta saldos automáticamente |
| Cuentas | `views/accounts.js` | ✅ | CRUD (efectivo, banco, ahorro, inversión, billetera) |
| Presupuestos | `views/budgets.js` | ✅ | Mensual/anual, consumido/disponible/proyectado |
| Recurrentes | `views/recurring.js` | ✅ | CRUD de pagos recurrentes |
| Patrimonio | `views/networth.js` | ✅ | Activos/pasivos, evolución por snapshots, CRUD assets y deudas |
| Inversiones | `views/investments.js` | ✅ | CRUD posiciones, valor/costo/rentabilidad, distribución |
| Metas | `views/goals.js` | ✅ | CRUD + avance, tiempo estimado, aporte rápido |
| Deudas | `views/debts.js` | ✅ | Snowball/Avalanche (orden, no amortización completa) |
| Analítica | `views/analytics.js` | ✅ | Flujo de caja, ahorro, patrimonio, categorías (donut), insights |
| Diario | `views/journal.js` | ✅ | CRUD reflexiones/decisiones/aprendizajes/objetivos |
| Exportaciones | `views/exports.js` | ✅ | CSV por colección, JSON completo, PDF mensual/patrimonial |
| Ajustes | `views/settings.js` | ✅ | Tema, sync, actualizar, recalcular saldos, cerrar sesión, vaciar caché |

---

## 9. Decisiones técnicas tomadas y motivos

| Decisión | Motivo | Alternativa descartada |
|---|---|---|
| Sin frameworks JS | Regla absoluta del proyecto. Longevidad y control total | React/Vue (viola CLAUDE.md) |
| Google Sheets como BD | Cero costo, backups nativos, API familiar | Supabase/Firebase (viola "sin servidores") |
| Apps Script como backend | Sin servidores que mantener, en el ecosistema Google | Node/Express (viola reglas) |
| OAuth Google en lugar de token compartido | Seguridad real: "si alguien toma el celular" no puede entrar | Token compartido (quedó en `api.token: null`) |
| Dos emails autorizados | `patitosalmir@gmail.com` (principal) + `alejandrorr1367@gmail.com` | Solo uno |
| Modelo híbrido de saldos | Transacciones mueven dinero (coherencia) + usuario puede reconciliar | Ledger puro (schema breaking change) · Declarado (incoherente) |
| `sessionStorage` anti-loop en apiClient | Previene bucle infinito en mobile PWA si el backend rechaza token | Reload directo (causaba bucle) |
| Fuentes Inter via Google Fonts + SW cache | Self-host requeriría archivos .woff2 en repo; Google Fonts es más simple | Sin fuente (system-ui fallback) |
| `node:test` nativo para tests | Sin dependencias. `node --test` disponible en Node 18+ | Jest/Vitest (violarían "sin build") |
| `.githooks/pre-commit` con Node.js | Auto-bump SW version al commitear. Previene mobile serving stale cache | Manual (olvidable y causó bugs) |
| `repoCreate_` devuelve record sin releer | Elimina 1 lectura completa de hoja por cada escritura (incluyendo AuditLog) | `repoGet_` post-append (coste cuadrático) |

---

## 10. Trabajo pendiente organizado por prioridad

### ✅ Modelo híbrido de saldos — DESPLEGADO

El backend de Apps Script ya tiene el modelo híbrido de saldos desplegado y verificado en
producción (commits `2a407b1`/`75eacca`): `Accounts.gs` (`adjustBalance_`/`applyTxBalanceDelta_`),
`Transactions.gs` (create/update/delete ajustan saldos), `Code.gs` (ruta `recalculateBalances`),
`Auth.gs` (sin bypass, `aud` con `indexOf`) y `Migration.gs` (`recalculateAccountBalances_`).
Las transacciones mueven saldos end-to-end. **Opcional:** ejecutar una vez **Ajustes →
Recalcular saldos** si se quiere recalcular desde 0 sumando el histórico completo.

### P1 — Alta prioridad (ver `docs/TechnicalDebt.md`)

| ID | Descripción | Estado |
|---|---|---|
| TD-11 | Bug: sync state siempre `'idle'` — `syncEngine.js` | ✅ Hecho |
| TD-12 | Timezone bucketing — `sameMonth()` usa `Date` local vs `slice(0,7)` | ✅ Hecho (`8d8d4d9`) |
| TD-15 | 12 requests en carga inicial → `getBootstrap` (1 request) | ✅ Hecho (`98f8c19`) |
| TD-16 | `openById` sin cachear — 5–8 aperturas/request | ✅ Hecho (`47f91e1`) |
| TD-17 | Foco de input tenue — posible fallo WCAG 2.4.11 | ✅ Hecho (`47f91e1`) |
| TD-13 | `refresh()` no hace flush antes de pull → creates pendientes desaparecen | ✅ Hecho (`bccc956`) |
| TD-14 | No-atomicidad `db.put` + `enqueue` — divergencia si el proceso muere | ✅ Hecho (`bccc956`) |
| TD-10 | Head-of-line blocking en `syncEngine.flush()` — op con error de negocio bloquea cola | 🔴 Pendiente (M) |
| TD-18 | Touch targets densos — `.icon-btn` 32px, gap 2px, 3 acciones/fila | 🔴 Pendiente (S) |

### P2 — Media prioridad

- TD-19: Duplicación de andamiaje CRUD en 11 vistas (factorías)
- TD-21: `formatMoney` fuerza 0 decimales para todas las divisas
- TD-22: Aritmética float sin redondeo controlado
- TD-23: Snowball/Avalanche sin cálculo de amortización real
- TD-24/25: Backend — lecturas O(n) + paginación real en `getTransactions`
- TD-26: `batchWrite` para cola offline (N requests → 1)
- TD-27: `LockService` en escrituras de Apps Script
- TD-28: Soft-deletes sin purga — hojas crecen indefinidamente
- TD-29/30/31/32: Limpieza del Design System

---

## 11. Bugs conocidos

| Bug | Archivo | Severidad | Descripción |
|---|---|---|---|
| ✅ ~~Sync state siempre idle~~ | `src/services/syncEngine.js` | — | RESUELTO (TD-11) |
| ✅ ~~Timezone en bucketing de meses~~ | `src/store/selectors.js` — `sameMonth()` | — | RESUELTO (TD-12, `8d8d4d9`) |
| ✅ ~~Carga inicial = 12 requests~~ | `src/services/dataService.js` | — | RESUELTO (TD-15 `getBootstrap`, `98f8c19`) — 1 request |
| Snowball/Avalanche sin amortización | `src/views/debts.js` | Baja | Solo ordena, no calcula cronograma de pago ni intereses ahorrados (TD-23) |

---

## 12. Deuda técnica

Ver `docs/TechnicalDebt.md` para el registro completo (40 ítems con ID, impacto y esfuerzo).

**Resumen:**
- P0 (todos resueltos en sesión 2026-06-01): TD-01 a TD-09
- P1 (9 ítems pendientes): ~6–9 días de trabajo
- P2 (14 ítems): ~10–15 días
- P3 (8 ítems): mejoras incrementales

---

## 13. Riesgos actuales

| Riesgo | Severidad | Mitigación |
|---|---|---|
| `config.js` en repo público con URL del backend y OAuth Client ID | Aceptado | Client ID no es secreto. Backend protegido por OAuth (solo 2 emails). Rotar si hay abuso |
| Backend no actualizado con modelo de saldos | Alta | Subir los 5 archivos .gs y publicar nueva versión (ver §10) |
| AuditLog crece sin límite (sin purga) | Media | Añadir rutina de archivado periódico (TD-28) |
| `UrlFetchApp` en Apps Script para verificación OAuth agrega latencia ~200ms/req | Baja | Cacheado 25 min en `CacheService`. Implementar `getBootstrap` (TD-15) reduciría llamadas |
| Tokens Google expiran en 1h — sin refresh proactivo garantizado | Baja | One Tap hace refresh silencioso. Sesión revienta solo si la app está cerrada 1h+ |

---

## 14b. Cambios — sesión 2026-06-01 (tarde, en casa)

### Módulo Inversiones — refactor completo de precios en vivo

**`src/services/priceService.js`** ← archivo nuevo  
Registro global de precios en vivo compartido entre `investments.js` (escribe) y `selectors.js` (lee), sin pasar por el store. Persiste en `localStorage` con TTL de 15 min. Se restaura automáticamente al cargar la app; el dashboard ve precios correctos desde el primer render aunque el usuario nunca haya visitado Inversiones.

**`src/views/investments.js`**
- Migrado de variables de módulo propias a `priceService`
- Auto-refresh de precios al entrar a la sección (`priceService.isStale`)
- Precios persisten en F5 vía `localStorage` (restaurados por `priceService` al arrancar)
- Brokers XTB y ARQ Invest aparecen como opciones quick-create en el formulario de nueva compra. Si se seleccionan, se crea la cuenta automáticamente antes de guardar la inversión
- Guard `bodyMount.isConnected` en la suscripción al store: renders anteriores desconectados del DOM dejan de ejecutar `paint()` — elimina fuga de suscripciones que acumulaba trabajo con cada navegación
- Eliminado `_applyPricesToStore()` que causaba ciclo `store.set → onStoreChange → renderInvestments → store.set → …` que congelaba la sección

**`src/store/selectors.js`**
- `investmentsValue()` usa `priceService.priceFor(symbol)` para precio real con fallback a `currentPrice`; convierte USD/EUR→COP usando `priceService.fxRates`
- `investmentsCost()` convierte divisas y usa `avgCost || purchasePrice` (fix para inversiones creadas manualmente que guardan `purchasePrice`, no `avgCost`)

### Service Worker — actualizaciones sin Ctrl+Shift+R

**`sw.js`** v0.2.6
- Estrategia de fetch: **network-first** para todos los assets JS/CSS (antes cache-first). Online: siempre descarga la versión más reciente; Offline: fallback al caché
- Instalación: ya no llama `skipWaiting()` en `install` — espera el mensaje `SKIP_WAITING` del cliente para activar
- Handler `message` que recibe `{ type: 'SKIP_WAITING' }` y activa el nuevo SW inmediatamente

**`src/core/app.js`**
- Cuando se detecta un SW nuevo instalado (`sw.state === 'installed'`): muestra toast "Actualizando…" y envía `SKIP_WAITING`
- Listener `controllerchange` recarga la página automáticamente cuando el nuevo SW toma el control
- Resultado: F5 después del primer load ya trae siempre la versión más reciente; sin necesidad de Ctrl+Shift+R

### Hooks de accessibility — eliminados (bloqueaban edición)
Los hooks `UserPromptSubmit`/`PreToolUse`/`PostToolUse` de `accessibility-agents` instalados en `~/.claude/settings.json` requerían `python3` que no está disponible en Windows → salía error en cada prompt y bloqueaban todos los edits a archivos en `src/`. Se eliminaron del settings global.

---

## 14c. Cambios — sesión 2026-06-02 (auditoría)

### Auditoría funcional completa con Playwright MCP
- Recorridas las 15 rutas de la app (14 documentadas + `#/import` nuevo)
- Informe completo en `docs/Audit-Funcional-2026-06-02.md`
- Se descubrió módulo nuevo `#/import` — importación de extractos bancarios con IA (Gemini)
- Plugins habilitados (`.claude/settings.json`): `playwright`, `context7`, `code-simplifier`
- MCPs (`claude mcp list` 2026-06-02): `github` ✓, `playwright` ✓, `context7` ✓ — los tres
  conectan. El GitHub MCP ahora funciona vía HTTP (`api.githubcopilot.com/mcp/`) con
  `GITHUB_PERSONAL_ACCESS_TOKEN` configurada

### Bypass temporal de auth (ya revertido)
Para la auditoría se agregó un bypass temporal en `backend/Auth.gs` que aceptaba el token `financeos-audit-2026-06-02`. **Este bypass fue eliminado del repo local.** El usuario debe haber deployado la versión sin bypass a Apps Script.

⚠️ Si `Auth.gs` en Apps Script todavía tiene las líneas del bypass, eliminarlas y publicar nueva versión antes de continuar desarrollo.

---

## 14. Últimos cambios importantes (sesión 2026-06-01)

### Deuda técnica P0 implementada

**TD-02** — `selectors.hasMixedCurrencies()`: detecta divisas mixtas en todos los stores.

**TD-03** — `selectors.totalAssets()` excluye cuentas `type==='investment'` (eliminado doble conteo con `investmentsValue`). Mismo fix en `backend/Reports.gs`.

**TD-04** — Suite de 33 tests financieros en `tests/selectors.test.js` usando `node:test` nativo. Sin dependencias.

**TD-05** — `repoCreate_` en `backend/Utils.gs` devuelve el record construido en memoria sin releer la hoja completa. Elimina 1 lectura O(n) por cada escritura del sistema (incluido AuditLog).

**TD-06** — Inter tipografía añadida via Google Fonts (`index.html` + estrategia cache-first cross-origin en `sw.js`).

**TD-07** — `aria-label` + `<title>` en `LineChart`, `Donut` (`charts.js`) y `role="img"` + `aria-label` en `BarChart` (`ui.js`). WCAG 1.1.1.

**TD-08** — `field()` en `forms.js` genera `id` aleatorio y enlaza `label[for]`. Todos los formularios ahora conformes con WCAG 1.3.1/4.1.2.

**TD-09** — Google OAuth completo:
- Frontend: `src/core/auth.js` (GIS, One Tap, sesión en localStorage, 45-min refresh silencioso)
- `app.js`: gate de auth antes del bootstrap
- `apiClient.js`: envía `idToken` en lugar de token compartido. Anti-loop con `sessionStorage`
- `settings.js`: fila de sesión activa + botón "Cerrar sesión"
- Backend: `Auth.gs` (verifyGoogleToken_ con CacheService 25 min), `Code.gs` (assertAuthorized_ usa OAuth)
- Emails autorizados: `patitosalmir@gmail.com`, `alejandrorr1367@gmail.com`

**TD-01** — Modelo híbrido de saldos (código listo, backend pendiente de subir):
- `backend/Accounts.gs`: `adjustBalance_()` y `applyTxBalanceDelta_()`
- `backend/Transactions.gs`: create/update/delete ajustan saldo(s) de cuenta automáticamente
- `backend/Migration.gs`: `recalculateAccountBalances_()` (correr una vez desde Settings)
- `src/services/dataService.js`: `_adjustAccountBalances()` y `_shiftBalance()` para Optimistic UI
- `src/views/settings.js`: botón "Recalcular saldos" con confirmación

### Infraestructura
- **`.githooks/pre-commit`**: auto-bump del patch version del SW cada vez que se commitean archivos de `src/`, `index.html`, `manifest.json` o `assets/`. Previene que la PWA mobile sirva JS/CSS cacheados de versiones anteriores.
- **`README.md`** actualizado con setup del repo, tests y configuración real.

---

## 15. Estado de Git

```
Rama:    main
Remote:  https://github.com/alejandror1367/FinanceOS.git
HEAD:    bccc956  fix: TD-13 flush antes de pull + TD-14 escritura atómica dato+cola
SW:      v0.2.11 (auto-bump del pre-commit)
```

### Commits recientes
```
bccc956 fix: TD-13 flush antes de pull + TD-14 escritura atómica dato+cola
75eacca docs: marcar TD-17 hecho y confirmar backend de saldos desplegado/verificado
2a407b1 docs: confirmar en vivo BUG-C1 + TD-15 tras desplegar backend
8082e22 docs: marcar TD-16 hecho (memoización de openById ya estaba en 47f91e1)
56d0290 docs: marcar BUG-A4 resuelto
fe961a8 fix: BUG-A4 Deudas — KPI "Tarjetas de crédito" consolida liabilities credit_card
617821c docs: marcar BUG-C1 resuelto y TD-15 hecho
98f8c19 feat: TD-15 getBootstrap — cargar las 12 colecciones en 1 request
23009b0 fix: BUG-C1 cold start auth — warm-up + reintento, no destruir sesión válida
```

---

## 16. Instrucciones para levantar el proyecto desde cero

### Requisitos previos
- Git
- Node.js v18+ (solo para tests)
- Navegador moderno (Chrome recomendado para mobile PWA)
- Cuenta de Google con acceso al proyecto de Apps Script

### Pasos

```bash
# 1. Clonar el repositorio
git clone https://github.com/alejandror1367/FinanceOS.git
cd FinanceOS

# 2. Activar el git hook (UNA SOLA VEZ por clon)
git config core.hooksPath .githooks

# 3. Ejecutar tests para verificar que todo está bien
node --test tests/selectors.test.js

# 4. Levantar servidor local
npx serve .
# Abrir http://localhost:3000

# 5. (Opcional) Para desarrollo offline, la app funciona en modo mock
#    sin backend. Con backend real, los datos se sincronizan con Sheets.
```

### Para que funcione con el backend real
La app ya tiene `config.js` con las URLs reales commiteadas. Solo necesitas:
1. Tener acceso a la cuenta `patitosalmir@gmail.com` o `alejandrorr1367@gmail.com`
2. El backend de Apps Script debe tener los archivos actualizados (ver §10)

### Para el celular (PWA)
1. Abre `https://alejandror1367.github.io/FinanceOS/` en Chrome (Android) o Safari (iOS)
2. Menú → "Añadir a pantalla de inicio" / "Instalar app"
3. Inicia sesión con uno de los emails autorizados

---

## 17. Checklist exacto para continuar el desarrollo

### En el nuevo equipo (una sola vez)
- [ ] `git clone https://github.com/alejandror1367/FinanceOS.git`
- [ ] `git config core.hooksPath .githooks` (activa auto-bump del SW)
- [ ] `node --test tests/selectors.test.js` → debe dar 35/35 ✅
- [ ] `npx serve .` → verificar que carga en `localhost:3000`
- [ ] Leer `CLAUDE.md` (reglas absolutas), `docs/TechnicalDebt.md` (trabajo pendiente)

### Acción urgente pendiente (backend)
- [ ] Abrir `script.google.com` → proyecto FinanceOS
- [ ] Copiar `backend/Accounts.gs` → reemplazar en el editor
- [ ] Copiar `backend/Transactions.gs` → reemplazar
- [ ] Copiar `backend/Code.gs` → reemplazar
- [ ] Copiar `backend/Auth.gs` → reemplazar
- [ ] Crear nuevo archivo `Migration.gs` → pegar contenido de `backend/Migration.gs`
- [ ] **Implementar → Nueva versión**
- [ ] Verificar: `curl {URL}?action=ping` debe responder `{success:true}`
- [ ] En la app: **Ajustes → Recalcular saldos** → confirmar (migra saldos desde transacciones)

### Para el primer commit desde el nuevo equipo
- [ ] Verificar que el pre-commit hook funciona haciendo un cambio en `src/` y commiteando
- [ ] El log debe mostrar `[sw] auto-bump: v0.2.X → v0.2.Y`

---

## 18. Próximos pasos recomendados

**Inmediato (antes de cualquier desarrollo):**
1. Subir los 5 archivos .gs al backend y publicar Nueva versión
2. Ejecutar "Recalcular saldos" desde la app
3. ⚠️ Verificar que el bypass de auditoría fue eliminado de Auth.gs (ver §14b)

**Auditoría funcional completada (2026-06-02):**
Ver `docs/Audit-Funcional-2026-06-02.md` para el informe completo con bugs priorizados.

Bugs más urgentes identificados en la auditoría:
- **BUG-C1** (Crítico): Cold start — todos los KPIs en $0 hasta hacer click en "Actualizar" — ✅ RESUELTO (`23009b0`+`98f8c19`); happy-path **confirmado en producción**: la primera carga hace 1 sola petición `getBootstrap`, sin "No autorizado"
- **BUG-C2** (Crítico): Presupuestos — fecha del período renderiza como `Date.toString()` crudo
- **BUG-A1** (Alto): Presupuestos — consumido siempre $0 (confirma TD-12, fix = 1 línea)
- **BUG-A3** (Alto): Botón "Buscar" en topbar no hace nada (confirma TD-31)
- **BUG-A4** (Alto): Deudas — KPI "Tarjetas de crédito" muestra $0 aunque hay $3.83M — ✅ RESUELTO (`fe961a8`): el KPI consolida cuentas + liabilities `credit_card`

**Sprint de quick wins (~1-2 horas):**
- BUG-C2: Fecha presupuestos — `formatDate(budget.startDate)` en `src/views/budgets.js`
- BUG-A1/TD-12: `sameMonth()` con `slice(0,7)` en `src/store/selectors.js` (1 línea)
- BUG-A3/TD-31: Quitar botón "Buscar" de `src/components/shell.js`
- BUG-B1: Versión `config.js` → `'0.2.6'`
- TD-11: `syncEngine.js:84` — `'pending'` en lugar de `'idle'` (1 línea)

**Sprint BUG-C1 (cold start auth) — ✅ HECHO:**
- `apiClient`: guard contra `signOut()` destructivo si el token local sigue válido (`23009b0`).
- `dataService`: warm-up secuencial + retry en `init()` (`23009b0`).
- **TD-15 `getBootstrap`** (`98f8c19`): 12 colecciones en 1 request (frontend con fallback +
  backend `Code.gs`/`Reports.gs`). Cura la raíz (la estampida de verificación de token).
  ✅ Backend desplegado y **confirmado en producción**: la carga hace 1 sola petición `getBootstrap`.

---

## 19. Prompt de continuación para nueva sesión de Claude Code

> ⚠️ El bloque de abajo es **histórico** (2026-06-01). El prompt de continuación
> vigente está en **`docs/NEXT_SESSION.md`**, regenerado al estado actual.

Copia este prompt al iniciar una nueva sesión:

---

```
Lee PROJECT_HANDOFF.md en la raíz del repositorio. Aquí el contexto rápido:

PROYECTO: FinanceOS — sistema operativo financiero personal y privado para Alejo (PWA).
URL producción: https://alejandror1367.github.io/FinanceOS/
Repo: https://github.com/alejandror1367/FinanceOS (rama main)

STACK (reglas absolutas — no romper nunca):
- Frontend: HTML + CSS + JavaScript ES Modules puro. SIN React/Vue/Svelte/Angular.
- SIN TypeScript. SIN Vite/Webpack/build tools. SIN dependencias npm en runtime.
- Backend: solo Google Apps Script. BD: solo Google Sheets.
- Commits automáticos: hacer commit+push después de cada cambio verificado.

ARCHIVOS CLAVE:
- CLAUDE.md → reglas absolutas (leer antes de cualquier cambio)
- src/core/config.js → api.baseUrl + auth.clientId (valores reales commiteados)
- src/services/priceService.js → caché compartido de precios en vivo (nuevo, sesión tarde)
- src/store/selectors.js → usa priceService para investmentsValue con conversión FX
- src/views/investments.js → DCA, precios Yahoo Finance, brokers XTB/ARQ
- sw.js → v0.2.6, network-first, auto-update via SKIP_WAITING
- docs/TechnicalDebt.md → registro priorizado de deuda técnica (P0→P3)
- tests/selectors.test.js → 33 tests financieros (deben pasar siempre)

ESTADO AL 2026-06-01 (sesión tarde):
✅ Inversiones: auto-refresh de precios al entrar, persistencia F5 via localStorage,
   brokers XTB y ARQ Invest en formulario nueva compra
✅ Dashboard: card de Inversiones muestra valor real con precios en vivo y conversión USD→COP
✅ SW: F5 ya trae versión nueva sin Ctrl+Shift+R; auto-reload cuando hay update
✅ Fix freeze al navegar a Inversiones (ciclo store.set eliminado con priceService)

PENDIENTE URGENTE (de sesiones anteriores — NO olvidar):
- Subir 5 archivos .gs al backend Apps Script + publicar Nueva versión:
  backend/Accounts.gs, Transactions.gs, Code.gs, Auth.gs, Migration.gs (nuevo)
  Activan el modelo híbrido de saldos (transacciones mueven dinero automáticamente)
- Luego: Ajustes → Recalcular saldos en la app (migra saldos existentes)

DEUDA TÉCNICA P1 PENDIENTE (docs/TechnicalDebt.md):
- TD-11: syncEngine.js:84 — state: pending > 0 ? 'idle' : 'idle'  (1 línea)
- TD-12: sameMonth() usa Date local → drift UTC-5  (1 línea)
- TD-16: openById sin cachear en Utils.gs → 5-8 aperturas/request  (3 líneas)
- TD-17: .input:focus con opacidad baja → puede fallar WCAG 2.4.11
- TD-10/13/15: syncEngine, flush antes de pull, getBootstrap

Para tests: node --test tests/selectors.test.js → 33/33
Para servidor local: npx serve . → http://localhost:3000
```

---

*Actualizado el 2026-06-02 por Claude Opus 4.8: TD-13/TD-14 hechos (`bccc956`), estado de
git/SW/MCP/backend sincronizado, invariantes alineados con `CLAUDE.md`.*
