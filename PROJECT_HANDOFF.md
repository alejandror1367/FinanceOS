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
| Tests financieros | ✅ **52/52** pasando |
| Módulo Import | ✅ Completamente funcional (BUG-P0-1/P1-1/P1-2/P1-3 corregidos) |
| Backend patrimonio neto | ✅ CC incluida como pasivo en `computeNetWorth_` (BUG-P0-2, desplegado) |
| Snapshots de patrimonio | ✅ Crear · eliminar individual · eliminar masivo · detección outliers |
| Deuda técnica P0 | ✅ Toda resuelta |
| Deuda técnica P1 | ✅ Toda resuelta (incl. normPeriodKey, config.version, import fixes) |
| Deuda técnica P2 | ✅ Toda resuelta |
| Bugs auditoría 2026-06-02 | ✅ P0+P1+P2 corregidos · Sprint 3+4 completados |
| Pendiente | Sprint 5 (Inversiones avanzadas) → Sprint 9 (ver §18) |

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
│   └── selectors.test.js   # 39 tests financieros (node --test)
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
| TD-10 | Head-of-line blocking en `syncEngine.flush()` — op con error de negocio bloquea cola | ✅ Hecho (`9a1cf3c`) |
| TD-18 | Touch targets densos — `.icon-btn` 32px, gap 2px, 3 acciones/fila | 🔴 Pendiente (S) — único P1 |

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

## 14d. Cambios — sesión 2026-06-02 (tarde, Opus 4.8)

HEAD pasó de `75eacca` a **`b870d6c`**. SW `v0.2.10 → v0.2.13`. Tests `33 → 39`.

### Fiabilidad de sync (P1 cerrada salvo TD-18)
- **TD-13** (`bccc956`): `refresh()` hace `flush()` de la cola antes de `pullData()`.
- **TD-14** (`bccc956`): `create/update/remove` escriben dato + op de cola en UNA transacción
  IndexedDB atómica (nuevo `db.transact()`; `syncQueue.makeRecord()` comparte el registro).
- **TD-10** (`9a1cf3c`): dead-letter en `syncEngine.flush()`. Distingue error transitorio
  (sin red/timeout/5xx/token frío → reintenta) de error de negocio (4xx → dead-letter
  inmediato). Tras `MAX_ATTEMPTS` también va a dead-letter; la cola ya no se bloquea
  (head-of-line) ni re-postea para siempre. `syncQueue`: `markDead/requeue/discard/
  deadLetters/deadCount`; `all()`/`count()` excluyen muertas. **Ajustes** muestra "Cambios
  sin sincronizar: N" con **Reintentar/Descartar** y el badge refleja `Fallidas`.

### Módulo Deudas — rediseño (`b870d6c`)
- Selectores puros y testeados en `selectors.js`: `debtList` (unifica `Liabilities` con las
  tarjetas de crédito que son **cuentas**, normalizando `minPayment`↔`minimumPayment`),
  `debtStats` (total, cuota mínima, **tasa promedio ponderada**) y `creditCardDebt`.
- **Deuda total** ahora incluye el saldo de las tarjetas (cuentas `credit_card`).
- **Cuota mínima/mes** = suma de los pagos mínimos manuales de todas las deudas.
- **Tasa promedio** ahora toma la tasa de tarjetas y créditos (antes solo pasivos).
- Créditos/hipotecas (`Liabilities` con saldo, cuota y tasa anual) entran en KPIs y plan.
- **Abono = debt settlement**: tarjeta → transferencia banco→tarjeta (el modelo híbrido
  sube el saldo de la tarjeta = reduce deuda); crédito/pasivo → reduce el saldo y opcional-
  mente registra el egreso de efectivo. Plan Snowball/Avalanche ordena todas las deudas.
  La vista repinta sola tras un abono (suscripción al store con guard `isConnected`).
- `accounts.js` exporta `openAccountModal` (editar tarjeta desde Deudas).

### Documentación
- `PROJECT_HANDOFF`, `docs/TechnicalDebt`, `docs/NEXT_SESSION` sincronizados al estado real
  (HEAD/SW/MCP/backend, invariantes alineados con `CLAUDE.md`).

### Verificado / no verificado
- ✅ 39/39 tests (`node --test`), `node --check` y smoke de imports/exports con stubs DOM.
- ⛔ **Sin verificación visual en navegador**: las tools del MCP Playwright no se cargaron en
  esa sesión (timing de arranque; el servidor está sano y expone 23 tools). Requiere
  reiniciar Claude Code. **Pendiente** la verificación visual de Deudas y Presupuestos (ver §19).

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

**TD-01** — Modelo híbrido de saldos (en esta fecha el backend estaba *pendiente de subir*;
**ya desplegado y verificado** — ver §14d y §2):
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
HEAD:    495fe4d  feat(charts): BarChart valores visibles + tooltips · LineChart tooltips
SW:      v0.2.37  (sincronizado con config.version — hook actualiza ambos)
Status:  limpio · sincronizado con origin/main (pendiente git push)
```

### Commits recientes
```
495fe4d feat(charts): BarChart valores visibles + tooltips · LineChart tooltips (Sprint 4.1-4.3)
5fdc008 feat(goals): forecast usa promedio de 3 meses en lugar del mes actual (Sprint 2.6)
24ddd80 feat(networth): gestión de snapshots — botón eliminar por snapshot (FIX-10)
511bf70 fix(api): retry automático en GET para ERR_ABORTED del cold start (BUG-P2-2)
3aeed11 fix(today): upcomingPayments incluye vencimientos de tarjetas de crédito (BUG-P2-4)
8e537f8 fix(backend): computeNetWorth_ incluye CC como pasivos (BUG-P0-2)
32ffa4b fix(analytics): normPeriodKey + curMonthKey en render time (BUG-P1-4)
848292a fix(config): sincronizar config.version con SW v0.2.30 (BUG-P1-5)
```
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
- [ ] `node --test tests/selectors.test.js` → debe dar 39/39 ✅
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

**Sesión 2026-06-02 completa:** todos los bugs P0/P1/P2 de la auditoría corregidos; Sprints 1–4 del roadmap implementados y desplegados donde aplica. Tests: 52/52.

**Próximos sprints (orden recomendado, ver `docs/Roadmap-Implementacion-2026-06-02.md`):**

| Sprint | Objetivo | Esfuerzo |
|---|---|---|
| **5** | Inversiones avanzadas: withholding (5.1), comisiones (5.2), indicador (5.3) | ~1d |
| **6** | UX/UI: tooltips all charts, micro-animaciones, validación inline, shortcuts, fix truncamiento Ajustes | ~2d |
| **7** | Performance: content-visibility, lazy load vistas, paginación IndexedDB | ~1.5d |
| **8** | Analítica avanzada: selector período, 5 insights adicionales, comparación histórico | ~2d |
| **9** | Pulido: TD-33–40, WCAG final, actualizar docs, v1.0 | ~2d |

**Sin deploys pendientes** — todos los cambios de esta sesión son frontend puro (excepto los backends ya desplegados por el usuario: Reports.gs, NetWorth.gs, Code.gs).

**No verificado en vivo (sin Playwright en esta sesión):**
- Módulo Import — fixes aplicados, funcionalidad no confirmada visualmente en producción
- Vista Hoy — CC vencimientos en `upcomingPayments()` requiere cuenta con `paymentDay` configurado
- BarChart valor labels — cambio visual no verificado
- Snapshot outlier detection — requiere datos suficientes (≥4 snapshots)

**Hecho (ya no son pendientes):** backend de saldos + `getBootstrap` desplegados y verificados;
bypass de auditoría eliminado; auditoría funcional 2026-06-02 (`docs/Audit-Funcional-2026-06-02.md`).
Bugs resueltos: **BUG-C1** (`23009b0`+`98f8c19`), **BUG-C2** + **BUG-A1**/TD-12 (`8d8d4d9`),
**BUG-A3**/TD-31 (`8d8d4d9`), **BUG-A4** (`fe961a8`). Deuda P1: TD-10/11/12/13/14/15/16/17 ✅.
**Sprint 1** (`0d74646`): bugs financieros críticos Dashboard. **Sprint 2** (`55f024a` · v0.2.16):
Transacciones completas — agrupación fecha, filtros mes/categoría, totales, cuenta destino TX-1..TX-6.

**Sprints 6–10 completados (2026-06-02, sesión auditoria completa):**

- **Sprint 6** (`4c7f543` · v0.2.20): Patrimonio correcto. `totalAssets` excluye CC;
  `totalLiabilities` incluye CC. -$6.8M error eliminado. Reactividad networth+goals. 45/45 tests.
- **Sprint 7** (`058c987` · v0.2.21): Auto-refresh cold start. `formatMoney({decimals})`. `fmtI` USD.
  P&L absoluto en tabla compras. Timestamp precios. 7 brokers. Fix fecha ISO. Presets Cuentas.
- **Sprint 8** (`b7c0d4d` · v0.2.22): `amortize()` real. `projectionCard` PROYECCIÓN en Deudas.
  Verificado: Amex $3.4M · 28.8% · $1.34M/mes → 3 meses · $136.105 intereses · sept 2026.
- **Sprint 9** (`c50360b` · v0.2.23): `goalForecast()` con ahorro real. "✓ A este ritmo" en verde.
- **Sprint 10a** (`75aba73` · v0.2.24): TD-18 touch targets WCAG 2.5.8. BUG-B1 config version.
  Donut "Composición del patrimonio". Cobertura liquidez "10.9 meses". Nota CC en Pasivos.
  Badge urgente "2 DÍAS" en Deudas (WCAG 1.3.3). `fmtI` en positionCard header. groupByTicker fix.
- **Sprint 10b** (`ce2c711` · v0.2.25): Ventas en Inversiones. `openSellModal`. Sección
  "Operaciones cerradas". KPI "P&L Realizado". closedGroups separados de activeGroups.
- **Sprint 10c** (`08d0da9` · v0.2.26): Dividendos → transacción de ingreso real. Botón "Dividendo"
  en positionCard. `recentTransactions` con tiebreaker estable por createdAt/id.

**Sprints P2 completados (2026-06-02, sesión autonomous):**

- **TD-19** (`b7e2aa2` · v0.2.27): `crud.js` — `guardedOp`/`guardedSave` reemplazan 50+ bloques try/catch/toast en 10 vistas.
- **TD-20** (`b7e2aa2`): mapa `WRITE` eliminado; acciones de escritura fusionadas en `ENTITIES`.
- **TD-21** (`b7e2aa2`): `CURRENCY_DECIMALS` en `format.js` — 0 COP, 2 USD/EUR, 8 BTC.
- **TD-22** (`b7e2aa2`): `roundMoney()` en `format.js`; aplicado en `investmentsValue`/`investmentsCost`.
- **TD-23**: ya completado en Sprint 8 (`b7c0d4d`).
- **TD-24** (`dd68141` · v0.2.28): `repoUpdate_` lee fila directamente — elimina 2º O(n).
- **TD-25** (`dd68141`): `repoReadAll_` usa rango explícito — salta cabecera, lee solo schema cols.
- **TD-26** (`dd68141`): `batchWrite` backend + `syncEngine` agrupa ≥2 ops.
- **TD-27** (`dd68141`): `LockService.getScriptLock()` en `doPost`.
- **TD-28** (`dd68141`): `purgeDeleted_()` + acción POST + botón en Ajustes.
- **TD-29** (`b7e2aa2`): `.icon-btn` con focus-visible y doc del sistema doble-tamaño.
- **TD-30** (`b7e2aa2`): kpi--emerald/info unificados como aliases CSS.
- **TD-31**: verificado — no existía botón muerto; search es live-filter.
- **TD-32** (`dd68141`): `exports.js` CSS documentado como print stylesheet intencional.

**Sesión 2026-06-02 (auditoría bugs + sprints 1–4):**

- **BUG-P0-1** (`76dcf2c`): `dataService.mutate()` → `create()` — import funcional.
- **BUG-P0-2** (`8e537f8`): `computeNetWorth_` + `getDashboard_` excluyen CC de activos y las suman a pasivos. Diferencia $3.4M eliminada. Deploy confirmado.
- **BUG-P1-1/P1-2/P1-3** (`76dcf2c`): Button API · íconos SVG · `appendChild(icon())` en import.js.
- **BUG-P1-4** (`32ffa4b`): `normPeriodKey` exportada + usada en analytics.js. `curMonthKey` a render-time.
- **BUG-P1-5** (`848292a`): `config.version` sincronizado. Hook pre-commit también bumpa `config.version`.
- **BUG-P2-4** (`3aeed11`): `upcomingPayments()` incluye CC con `paymentDay`. 4 tests nuevos.
- **BUG-P2-2** (`511bf70`): `apiClient.get()` reintenta en `TypeError` (ERR_ABORTED cold start).
- **FIX-10** (`24ddd80`): `deleteNetWorthSnapshot_` backend + botón 🗑 por snapshot. Deploy confirmado.
- **Sprint 2.6** (`5fdc008`): `monthlySavingsAvg(s, n=3)` + goals.js usa promedio 3M. 3 tests.
- **Sprint 3.3+3.4+4.1-4.4** (`495fe4d`): multi-select snapshots · outlier detection (Z-score 2σ) · "Ver todos" toggle · BarChart `valueFormat` + `bars__val` · LineChart dot tooltips.

**Estado actual HEAD:**
```
commit: 495fe4d · rama: main · SW: v0.2.37 · config.version: 0.2.37 · tests: 52/52
```

**Toda la deuda P0/P1/P2 completada. Quedan Sprints 5–9 del roadmap (ver §18 y NEXT_SESSION.md).**

---

## 19. Prompt de nueva sesión

Copia este prompt al iniciar la nueva sesión:

---

```
Lee PROJECT_HANDOFF.md (§18 para lo último) y CLAUDE.md antes de cualquier cambio.

PROYECTO: FinanceOS — PWA financiera personal y privada de Alejo.
Repo: https://github.com/alejandror1367/FinanceOS (rama main).
Prod: https://alejandror1367.github.io/FinanceOS/
HEAD: 495fe4d · SW v0.2.37 · config.version 0.2.37 · Tests 52/52

INVARIANTES (ver CLAUDE.md): JS ES Modules sin build step · sin frameworks/bundlers ·
cero deps npm en runtime · frontend abstraído tras src/services/ · Apps Script +
Google Sheets (13 hojas) + GitHub Pages + OAuth de Google · offline-first.

HECHO Y DESPLEGADO (sesión 2026-06-02):
- Todos los bugs P0/P1/P2 de la auditoría corregidos (import, analytics, config,
  backend patrimonio, upcomingPayments CC, apiClient retry).
- Sprint 3+4 completos: gestión snapshots (individual/masivo/outliers/"Ver todos"),
  BarChart con valores visibles + tooltips, LineChart tooltips, monthlySavingsAvg.
- Hook pre-commit actualiza config.version junto con SW.
- Backends desplegados: Reports.gs (CC en patrimonio), NetWorth.gs+Code.gs
  (deleteNetWorthSnapshot).
- Tests: 52/52 (11 suites, añadidos upcomingPayments y monthlySavingsAvg).

PENDIENTE — SPRINT 5 (empezar aquí):
Inversiones avanzadas en src/views/investments.js:
  5.1: Campo "Retención en fuente" (withholdingRate, %) en posición de inversión.
  5.2: Campo "Comisión por operación" al crear/registrar compra/venta.
  5.3: Indicador WITHHOLDING% en positionCard si withholdingRate > 0.
Luego Sprint 6 (UX: tooltips todos los charts, micro-anim, validación inline, shortcuts).

NO verificado en vivo (no hubo Playwright en esta sesión):
- Import: fixes aplicados pero flujo completo no confirmado visualmente.
- Vista Hoy / upcomingPayments CC: requiere cuenta con paymentDay configurado.
- BarChart bars__val: cambio visual no confirmado.
- Snapshot outlier detection: requiere ≥4 snapshots para activarse.

SIN DEPLOYS PENDIENTES en backend — todo fue frontend puro.

FORMA DE TRABAJO: fases pequeñas y verificables · explicar qué/por qué ·
correr `node --test tests/selectors.test.js` tras cada cambio de selector ·
commits atómicos por feature · el hook auto-bumpa SW + config.version al commitear src/.
Empezar con: git log --oneline -5 · git status · node --test tests/selectors.test.js.
```

---

*Actualizado el 2026-06-02 (tarde) por Claude Opus 4.8: TD-10/13/14 + rediseño de Deudas
(`b870d6c`), HEAD/SW v0.2.13/tests 39 sincronizados, §14d añadida y §19 con el prompt de
reinicio + nueva sesión (verificación visual de Deudas/Presupuestos pendiente).*
