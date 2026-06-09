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
| Tests financieros | ✅ **115/115** pasando (24 suites) |
| Módulo Import | ✅ Completamente funcional (BUG-P0-1/P1-1/P1-2/P1-3 corregidos) |
| Backend patrimonio neto | ✅ CC incluida como pasivo en `computeNetWorth_` (BUG-P0-2, desplegado) |
| Snapshots de patrimonio | ✅ Crear · eliminar (soft delete) · masivo · outliers — **eliminar arreglado** (sesión 06-03) |
| Inversiones avanzadas (Sprint 5) | ✅ Comisión + retención en fuente + multicuenta |
| Integridad de sync | ✅ Idempotencia + preservación de id en TODOS los `create` (backend, desplegado) |
| UX (Sprint 6) | ✅ Tooltips charts · validación inline (todos los forms) · **Command Palette ⌘K** |
| Bugs sesión 2026-06-03 | ✅ 7 fixes de sync/datos corregidos y desplegados (ver §"Cambios 2026-06-03") |
| Sprint 6 deudas/metas | ✅ avgRate multi-moneda · amortize con % · goalForecast repartido · savingsAvg activo |
| Sprint 7 charts/a11y  | ✅ LineChart: labels decimados+rotados (n>6) · tablas sr-only en charts · bottom-nav priorizado |
| Sprint 8 avanzado     | ✅ XIRR+CAGR (selectors) · roundMoney en _shiftBalance · fix docs Groq · comentario getDb_ |
| Sprint 9 QA + v1.0   | ✅ QA Playwright 15/15 PASS · proyección presupuesto suavizada · validación solapamiento |
| Verificación en vivo | ✅ Playwright: 14 rutas sin errores JS · Sprint 5/6 confirmados |
| Fix auto-refresh precios (`app.js`) | ✅ Corregido — `700ba60` |
| Alpaca API (`Quotes.gs`) | ✅ Implementado y desplegado — `527492b` |
| Secciones desplegables (Inversiones) | ✅ Implementado — `843fed3` |
| KPI desplegables (Dashboard) | ✅ Implementado y verificado en prod — `57f144e` |
| Fix backend CC balance negativo | ✅ Desplegado y verificado — `f0d8ff1` |
| Re-encolar dead-letter (BUG-CC-1) | ✅ Ejecutado — ops sincronizadas |
| Simulador FIRE (`#/fire`) | ✅ Implementado — `5da9b05` + `c385baf` |
| R0 — Pre-flight | ✅ Fix FE↔BE pasivos CC · `ccDebt`/`liabilitiesDebt` expuestos · TD-01 marcado · 5 `.gs` desplegados (2026-06-09) |
| R1 — FIRE + insights | ✅ Fecha estimada · ProgressBar · variantes Lean/Fat/Barista · EmptyState · `liquidityCoverageMonths` · `savingsStreak` · 3 insights nuevos |
| R2 — DismissService | ✅ `dismissService.js` · botón "Visto" en today.js y dashboard.js · tests |
| R3 — Snapshots desglose | ✅ 6 campos en `NetWorthSnapshots` · `saveNetWorthSnapshot_` · `networth.js` detalle · fix valores en vivo (priceService) · idempotencia fecha |
| R4 — Alertas portafolio | ✅ `portfolioAlerts` (concentración, CDT, P&L, diversificación) · `positionValue` · tests |
| R5 — Seguridad | ✅ `logAccessDenied_` rate-limit · `iss`/`exp` validados · `importMaxChars` 50K · parámetros en `Config.gs` — **desplegado** |
| Dashboard fix | ✅ `investmentsSummary` paridad exacta con sección Inversiones |
| Selectors CDT | ✅ `investmentsValue` y `positionValue` usan `cdtCurrentValue` para CDTs |
| Roadmap-Maestro.md | ✅ Fuente única de planificación — consolida 4 roadmaps + TechnicalDebt |
| Pendiente | Sprint A (FX multi-moneda P0) · Sprint B (ventas parciales) · Sprint C (accesibilidad) |

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
├── sw.js                   # Service Worker v0.2.43 (cache-first shell)
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
│   └── selectors.test.js   # 52 tests financieros (node --test)
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
| Analítica | `views/analytics.js` | ✅ | Flujo de caja (3 series + selector 3/6/12m) · tendencias por categoría (tabla top5×6m) · insights históricos |
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

### ✅ Toda la deuda P0/P1/P2 — COMPLETADA Y DESPLEGADA

Toda la deuda técnica P0, P1 y P2 ha sido resuelta en sesiones anteriores. Ver §18 para los Sprints 5–9 pendientes del roadmap.

### Roadmap pendiente (ver `docs/Roadmap-Implementacion-2026-06-02.md`)

| Sprint | Objetivo | Estado |
|---|---|---|
| **5** | Inversiones avanzadas (withholding, comisiones, indicadores) | 🔴 Pendiente |
| **6** | UX/UI (tooltips, micro-anim, validación inline, shortcuts) | 🔴 Pendiente |
| **7** | Performance (content-visibility, lazy load, paginación IndexedDB) | 🔴 Pendiente |
| **8** | Analítica avanzada (selector período, insights adicionales) | 🔴 Pendiente |
| **9** | Pulido final (TD-33–40, WCAG, v1.0) | 🔴 Pendiente |

### P3 — Deuda técnica restante (baja prioridad)

| ID | Descripción |
|---|---|
| TD-33 | Reactividad de grano grueso (re-render total de vista) |
| TD-34 | `store.set` shallow-merge mutable |
| TD-35 | Aporte a meta no genera transacción ni toca cuenta vinculada |
| TD-36 | Proyección de presupuesto sobre-proyecta días 1–3 |
| TD-37 | Sin validación de solapamiento de presupuestos |
| TD-38 | Rentabilidad sin anualización (TWR/IRR) |
| TD-39 | Recurrentes sin ejecución automática |
| TD-40 | Hex hardcoded en theming; charts sin responsividad de altura |

---

## 11. Bugs conocidos

Todos los bugs P0/P1/P2 identificados en la auditoría 2026-06-02 han sido corregidos.

| Bug | Estado | Commit |
|---|---|---|
| BUG-P0-1: `dataService.mutate()` no existe en import.js | ✅ RESUELTO | `76dcf2c` |
| BUG-P0-2: Backend `computeNetWorth_()` omite CC como pasivos | ✅ RESUELTO + desplegado | `8e537f8` |
| BUG-P1-1: Button API incorrecta en import.js (5 instancias) | ✅ RESUELTO | `76dcf2c` |
| BUG-P1-2: Íconos SVG como texto en drop zone/analyzing | ✅ RESUELTO | `76dcf2c` |
| BUG-P1-3: `appendChild(icon())` TypeError en preview | ✅ RESUELTO | `76dcf2c` |
| BUG-P1-4: analytics.js sin normPeriodKey + curMonthKey stale | ✅ RESUELTO | `32ffa4b` |
| BUG-P1-5: config.version desincronizado del SW | ✅ RESUELTO | `848292a` |
| BUG-P2-1: Snapshots de prueba distorsionan gráfico | ✅ RESUELTO (UI de gestión) | `495fe4d` |
| BUG-P2-2: getQuotes falla en primer intento (ERR_ABORTED) | ✅ RESUELTO | `511bf70` |
| BUG-P2-3: curMonthKey calculado en module load time | ✅ RESUELTO | `32ffa4b` |
| BUG-P2-4: CC vencimientos no en Vista Hoy | ✅ RESUELTO | `3aeed11` |

**Bugs P3 abiertos** (no bloquean funcionalidad):
- Proyección de presupuesto irreal días 1–3 del mes (TD-36)
- Sin validación de solapamiento de presupuestos (TD-37)
- Label "Apariencia" truncado como "T..." en Ajustes (cosmético)

---

## 12. Deuda técnica

Ver `docs/TechnicalDebt.md` para el registro completo.

**Resumen actual:**
- P0 (TD-01–09): ✅ Todos resueltos
- P1 (TD-10–18): ✅ Todos resueltos (TD-18 touch targets: resuelto en Sprint 10a)
- P2 (TD-19–32): ✅ Todos resueltos (TD-19–32 completados en sesiones P2)
- P3 (TD-33–40): 🟡 8 ítems de baja prioridad — mejoras incrementales sin impacto en funcionalidad core

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
- Se descubrió módulo nuevo `#/import` — importación de extractos bancarios con IA (Groq, no Gemini)
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
HEAD:    06db320  docs: Roadmap-Maestro.md — fuente única de planificación unificada
SW:      v0.2.90  (sincronizado con config.version)
Status:  limpio · pusheado
```

### Commits recientes
```
06db320 docs: Roadmap-Maestro.md — fuente única de planificación unificada
ab655cb fix(snapshot): idempotencia por fecha — normalizar date antes de comparar
a3a5fe3 fix(snapshot): usar precios en vivo del frontend al guardar snapshot de patrimonio
2164d52 docs(apiClient): SEC-001 — comentario formal de aceptación para idToken en POST body
60a8637 sec(backend): Sprint 5 — auditoría de accesos denegados con rate-limit y ajuste de import
b0ca32d fix(dashboard): investmentsSummary para paridad exacta con sección Inversiones
4a92a49 fix(selectors): investmentsValue y positionValue usan cdtCurrentValue para CDTs
bdf03f6 feat(selectors): portfolioAlerts + positionValue — alertas determinísticas de portafolio (R4)
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

### En el nuevo equipo (una sola vez — bootstrap)
- [ ] `git clone https://github.com/alejandror1367/FinanceOS.git`
- [ ] `cd FinanceOS && git config core.hooksPath .githooks` (activa auto-bump del SW **y** config.version)
- [ ] `node --test tests/selectors.test.js` → debe dar **104/104** ✅
- [ ] `npx serve .` → verificar que carga en `localhost:3000`
- [ ] Leer `CLAUDE.md` (invariantes absolutos) + `docs/NEXT_SESSION.md` (estado actual)

### Sin acciones de backend pendientes
Todos los backends han sido desplegados. El estado del backend en producción es:
- `Reports.gs`: CC incluida en pasivos (`computeNetWorth_` + `getDashboard_`) ✅
- `NetWorth.gs`: `deleteNetWorthSnapshot_()` implementado ✅
- `Code.gs`: rutas `deleteNetWorthSnapshot` y `batchWrite` activas ✅

### Para el primer commit desde el nuevo equipo
- [ ] Verificar que el pre-commit hook funciona: commitear cualquier cambio en `src/`
- [ ] El log debe mostrar `[sw] auto-bump: v0.2.X → v0.2.Y` (y config.version también se actualiza)

### Verificación rápida del estado
```bash
git log --oneline -5          # HEAD debe ser ac570e8 (o el docs-handoff después)
node --test tests/selectors.test.js  # 104/104
grep "version" src/core/config.js   # debe coincidir con sw.js VERSION (v0.2.80)
```

---

## 18. Próximos pasos recomendados

**Roadmap activo: `docs/Roadmap-Maestro.md`** ← fuente única. Reemplaza todos los roadmaps anteriores.

**Plan Opus (R0–R8) completado:**

| Sprint | Estado | Commits clave |
|---|---|---|
| R0 Pre-flight + FE↔BE | ✅ | `9657ea3` `f3390c5` `68177c7` |
| R1 FIRE + insights | ✅ | `83782be` `9762873` `ac570e8` |
| R2 DismissService | ✅ | `28a6de9` `3ba0e32` `ac265d9` |
| R3 Snapshots desglose | ✅ + fixes | `81e07cf` `ac2f8f8` `a3a5fe3` `ab655cb` |
| R4 Alertas portafolio | ✅ | `bdf03f6` `4a92a49` `b0ca32d` |
| R5 Seguridad | ✅ desplegado | `60a8637` `2164d52` |

**Orden recomendado (Roadmap-Maestro Sprints A–J):**
1. **Sprint A — Integridad cifras P0** ← SIGUIENTE: FX backend (Quotes.gs) · soft-delete guard (Utils.gs) · withholdingRate (selectors.js) · deploy
2. **Sprint B — Ventas parciales P0**: modal cantidad · prorrateo comisión · cdtCurrentValue tope — sin deploy
3. **Sprint C — Accesibilidad P1**: todo S, sin deploy — contraste · aria · reduced-motion
4. **Sprint D — Cuentas remuneradas P1**: rediseñar `calcYield` — deploy
5. **Sprint E — Deudas y Metas P2**: avgRate · amortize % · goalForecast
6. **Sprint F — Import/Export P2**: fixtures primero · dupKey · export período
7. **Sprint G–J**: backend perf · charts · QA · avanzado (P3/opcionales)

**Verificaciones pendientes en vivo:**
- Snapshots nuevo formato (valores de priceService) — Playwright
- Flujo venta parcial/total en UI Inversiones

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
commit: e6b3c77 · rama: main · SW: v0.2.43 · config.version: 0.2.43 · tests: 54/54
```

**Toda la deuda P0/P1/P2 + Sprints 5 y 6 completados. Quedan Sprints 7–9 del roadmap (ver §18 y NEXT_SESSION.md).**

---

## CONTEXTO MÍNIMO PARA /HANDOFF

> Leer esto antes que cualquier otra sección. Máximo 100 líneas. Fuente de verdad para retomar de inmediato.

**HEAD:** `06db320` · **SW/config.version:** `v0.2.90` · **Tests:** 115/115 (24 suites) · **Rama:** main · **Sync:** al día (pusheado)

> **Sesión 2026-06-09 (completa):** R2 ✅ · R3 ✅ · R4 ✅ · R5-Seguridad ✅ · fixes snapshot (valores en vivo, idempotencia fecha) · `Roadmap-Maestro.md` creado como fuente única de planificación.

> **MCP:** `.mcp.json` versionado con **playwright** + **context7** (scope de proyecto).
> Tras `git pull`: **aprobar** ambos y **reiniciar Claude Code** (las tools MCP se fijan al arrancar).

### Estado actual real
- **App en producción:** https://alejandror1367.github.io/FinanceOS/ (PWA v0.2.90, OAuth activo)
- **Backend Apps Script:** ✅ **Todo desplegado** — Auth.gs · Code.gs · Config.gs · Import.gs · NetWorth.gs (2026-06-09)
- **Tests:** **115/115** en `tests/selectors.test.js` — 24 suites
- **Roadmap activo:** `docs/Roadmap-Maestro.md` ← FUENTE ÚNICA. Reemplaza todos los roadmaps anteriores.
- **Plan Opus (R0–R8):** R0 ✅ R1 ✅ R2 ✅ R3 ✅ R4 ✅ R5-Seguridad ✅ — **Sprint A (FX cifras) es el siguiente P0**.

### Deploy — todo desplegado ✅
Backend al día. Próximo deploy: Sprint A (Quotes.gs FX + Utils.gs soft-delete guard).

### Arquitectura actual
```
GitHub Pages (Vanilla JS ES Modules) → Apps Script → Google Sheets
PWA offline-first · IndexedDB local · OAuth Google · sin frameworks · sin build step
```
Flujo: `Views → Services → Store → Views` (never direct to net/IndexedDB from views)

### Funcionalidades implementadas (completas)
- Dashboard (KPIs desplegables, investmentsSummary correcto) · Hoy · Transacciones · Cuentas · Presupuestos · Recurrentes
- Patrimonio (snapshots con desglose en vivo 6 campos, valores reales de priceService, idempotencia por fecha)
- Inversiones (ventas parciales/totales, CDT cdtCurrentValue, XIRR/CAGR, portfolioAlerts, positionValue)
- Metas · Deudas (Snowball/Avalanche, amortización) · Diario · Ajustes
- Analítica: flujo de caja 3 series + selector 3/6/12m · 7 insights (cobertura, racha, concentración)
- Exportaciones · Command Palette (⌘K) · Validación inline · Import con Groq (truncado a 50K chars)
- **Simulador FIRE** · **DismissService** (pagos vencidos "Visto")
- Seguridad: `logAccessDenied_` rate-limit · `iss`/`exp` validados · `importMaxChars` configurable

### Bugs abiertos
- 🟡 Verificación en vivo snapshots nuevo formato (priceService values) — pendiente Playwright
- 🟡 FX multi-moneda: patrimonio USD se suma 1:1 a COP sin tasa (Sprint A P0)

### Pendientes en orden — ROADMAP-MAESTRO (Sprints A–J)
> Detalle completo: `docs/Roadmap-Maestro.md`.
1. **Sprint A — Integridad cifras P0** ← SIGUIENTE: FX en backend · soft-delete guard · withholdingRate · saldo idempotente · deploy
2. **Sprint B — Inversiones ventas parciales P0**: modal cantidad · prorrateo comisión · cdtCurrentValue tope days
3. **Sprint C — Accesibilidad WCAG AA P1**: todo S, sin deploy — contraste · aria · reduced-motion · progressbar
4. **Sprint D — Cuentas remuneradas P1**: rediseñar `calcYield` (saldo promedio, NO balance actual) · deploy
5. **Sprint E — Deudas y Metas P2**: avgRate multi-moneda · amortize % · goalForecast repartido
6. **Sprint F — Import/Export P2**: fixtures primero · dupKey · export por período
7. **Sprint G — Backend perf P3**: O(1) en adjustBalance_ · paginación · purgeDeleted_ en bloque
8. **Sprint H — Charts responsive P3** · **Sprint I — QA + v1.0** · **Sprint J — Avanzado + opcionales**

### Riesgos abiertos
- FX multi-moneda silencioso: patrimonio USD×~4000 se suma 1:1 → cifra inflada (Sprint A P0)
- `calcYield` sobreestima hasta ~7× → rediseño obligatorio antes de Sprint D
- `analyzePortfolio` tomaría LockService → congela cola de sync
- Sesión de facto perpetua sin app-lock; 2º email en `allowedEmails` con acceso total

### Decisiones arquitectónicas importantes
- `totalLiabilities` excluye `type=credit_card` (FIN-014) — también en `computeNetWorth_`
- `doSaveSnapshot()` envía valores en vivo del frontend (priceService) al backend — `NetWorth.gs` los usa con fallback
- `liquidityCoverageMonths` usa promedio 3m · `savingsStreak` excluye mes en curso
- `apiClient.js` siempre POST, idToken en body (SEC-001) · `verifyGoogleToken_` valida iss+exp
- `logAccessDenied_`: rate-limit via CacheService (5/60s) — 5 paths de rechazo auditados
- Precios en vivo: `priceService.js` · `investments.js` escribe · `selectors.js` lee

### Archivos críticos
```
CLAUDE.md                          — Invariantes absolutos (leer SIEMPRE primero)
docs/Roadmap-Maestro.md            — ★ FUENTE ÚNICA de planificación (reemplaza todos los roadmaps)
src/store/selectors.js             — Lógica financiera pura (115 tests)
src/views/networth.js              — doSaveSnapshot envía payload con precios en vivo
src/services/dataService.js        — saveSnapshot(frontendValues) pasa valores al backend
backend/NetWorth.gs                — saveNetWorthSnapshot_ usa valores FE si vienen; idempotencia fecha corregida
backend/Auth.gs                    — logAccessDenied_ con rate-limit; iss/exp validados
backend/Config.gs                  — APP.importMaxChars · APP.accessDeniedRateLimitMax/Ttl
tests/selectors.test.js            — 115/115 tests (24 suites)
```

---

## Cambios realizados en sesión 2026-06-08 (tarde)

### Auditoría estratégica — 9 iniciativas, Sprints 10–13

**Auditorías realizadas:**
- Análisis estratégico completo del estado del proyecto vs 9 iniciativas propuestas
- Generado `docs/Audit-Estrategica-2026-06-08.md` con: auditoría de viabilidad, gap analysis, arquitectura propuesta, riesgos, quick wins, roadmap actualizado

**Implementaciones:** Ninguna (sesión de solo análisis)

**Decisiones arquitectónicas:**
- I1 (Autenticación Biométrica): **descartada** — OAuth+FedCM suficiente para app personal; complejidad desproporcionada
- I3 (Multicuenta/Multiusuario): **descartada** — viola concepto central del producto; familiares deben usar instancia separada
- I7 (IA Inversiones): versión reducida — alertas determinísticas (concentración, CDT, P&L negativo, diversificación) + narrativa Groq opt-in solo descriptiva (no prescriptiva, sin riesgo AMV)

**Roadmap generado (Sprints 10–13):**
- Sprint 10: FIRE enriquecido + 3 insights analítica (~1 día, sin deploy)
- Sprint 11: Snooze pagos + Snapshot enriquecido (~1 día + deploy)
- Sprint 12: Cuentas remuneradas + Alertas portafolio (~1.5 días + deploy)
- Sprint 13: IA narrativa + Import/Export mejorado (~1.5 días + deploy)

**Archivos modificados:**
- `docs/Audit-Estrategica-2026-06-08.md` (nuevo, ~350 líneas)
- `docs/Roadmap-Implementacion-2026-06-02.md` (Sprints 10–13 añadidos)

**Commits:**
- `d2be879` docs: auditoría estratégica 2026-06-08 — 9 iniciativas, sprints 10-13

---

## Cambios realizados en sesión 2026-06-08 (noche)

### Revisión arquitectónica independiente (Opus) de la auditoría de Sonnet

**Auditorías realizadas:** segunda opinión crítica de `docs/Audit-Estrategica-2026-06-08.md`, verificada contra el código real (3 sub-agentes: financial-analyst, backend-reviewer, security-reviewer).

**Afirmaciones FALSAS de Sonnet detectadas (code-verified):**
- `portfolioCAGR` / `portfolioVsBenchmark` "ya existen" → **NO existen** (solo per-position). Infla esfuerzo I7.
- `calcYield` (I8) sobre balance actual → **financieramente incorrecto**, sobreestima hasta ~7×.
- `liquidityCoverageMonths` con `monthlyExpense` (mes actual) → "60 meses" absurdo a inicio de mes.
- `ensureHeaders_` "append-only idempotente" → **falso** (`setValues` ciego; seguro solo por disciplina).
- `accountsValue` ≡ `liquidity` → campo redundante; `totalLiquidity` no existe en backend.

**Riesgos omitidos por Sonnet (hallazgos propios):**
- 🔴 Divergencia FE↔BE pasivos CC (`Reports.gs:50` sin filtro FIN-014).
- 🔴 5 `.gs` "⚠ pendiente deploy" vs handoff "todo desplegado" → I9 sobre backend viejo = snapshots corruptos.
- 🟠 `analyzePortfolio` tomaría LockService → congela cola de sync mientras Groq responde.
- 🟡 I1: sesión de facto perpetua sin app-lock (Sonnet rechazó WebAuthn pero ignoró app-lock local).
- 🟡 I3: aislamiento ya roto — 2 emails comparten BD completa.
- TD-01 efectivamente resuelto en código; `TechnicalDebt.md:42` sin ✅ (drift documental).

**Decisiones arquitectónicas:**
- Roadmap oficial adopta el **plan revisado Opus (R0–R8)**; Sprints 10–13 de Sonnet → SUPERSEDED.
- **R0 (pre-flight)** es el siguiente y es BLOQUEANTE de R3/R5: deploy verificado + fix FE↔BE + rediseño `calcYield`.
- I2 reframeado: dismiss (no snooze que reaparece). I7 bifurcado: alertas (alto valor) vs Groq (opcional).
- I1/I3 no descartados del todo: app-lock local opcional + limpieza `allowedEmails` añadidos en R8.

**Implementaciones:** Ninguna (sesión de solo análisis + docs).

**Archivos modificados:**
- `docs/Auditoria-Estrategica-Revisada-Opus.md` (nuevo)
- `docs/Roadmap-Revisado-Opus.md` (nuevo)
- `docs/Roadmap-Implementacion-2026-06-02.md` (Sprints 10–13 → plan revisado R0–R8)
- `PROJECT_HANDOFF.md` (CONTEXTO MÍNIMO, §18, §19, este registro)

**Commits:**
- `590cfd1` docs: revisión arquitectónica independiente (Opus) de la auditoría de Sonnet

---

## Cambios realizados en sesión 2026-06-07 (tarde)

### feat: KPI desplegables en Dashboard

**Mejoras UX/UI:**
- Cada KPI del dashboard tiene ahora un `<details>` nativo que se expande al clicar "Detalle ▾"
- **Gastos del mes:** top 7 transacciones del mes por monto desc + "+N más"
- **Ingresos del mes:** todas las transacciones de ingreso del mes
- **Ahorro del mes:** ingresos − gastos + tasa de ahorro (muestra la fórmula)
- **Liquidez disponible:** cada cuenta líquida con su saldo individual
- **Patrimonio neto:** cuentas + inversiones + otros activos − tarjetas − créditos
- **Inversiones:** valor de mercado / costo base / P&L no realizado / rentabilidad
- **Score financiero:** 4 factores con puntos obtenidos / máximo (tasa ahorro · presupuestos · metas · cobertura liquidez)

**Verificación matemática realizada:**
- Ahorro = 4.236.000 − 5.064.458 = −828.458 ✓
- Tasa = −19.6% ✓
- Score 35 = 0 (ahorro neg) + 20 (ppto) + 10 (metas) + 5 (liquidez 0.76×) ✓

**Archivos modificados:**
- `src/components/ui.js` — `KpiCard` acepta nuevo prop `details?: {label,value}[]`
- `src/styles/components.css` — clases `.kpi__details`, `.kpi__dtrig`, `.kpi__dchev`, `.kpi__dlist`, `.kpi__drow`, `.kpi__dlabel`, `.kpi__dvalue`
- `src/store/selectors.js` — nuevo método `financialScoreBreakdown(s)` (4 factores)
- `src/views/dashboard.js` — importa `isExpenseLike`, computa y pasa `details` a cada KpiCard

**Verificado en vivo:** ⛔ no verificable sin auth activa en Playwright local/producción.

**Commits:**
- `57f144e` feat(dashboard): desplegable de detalle en cada KPI card

---

## Cambios realizados en sesión 2026-06-07 (mañana)

### Diagnóstico y fix — dead-letter queue / CC balance negativo

**Auditorías realizadas:** ninguna formal.

**Bugs corregidos:**
- **BUG-CC-1**: `updateAccount` para tarjetas de crédito fallaba silenciosamente. Las ops quedaban en dead-letter con error `"El monto no puede ser negativo en balance"`. Causa: `toAmount_()` en `Utils.gs` rechaza `n < 0`, pero desde `1b0e979` el frontend almacena saldos CC como negativos. Fix: nueva función `toSignedAmount_()` (permite negativo, solo valida `isNaN`); `createAccount_` y `updateAccount_` usan `toSignedAmount_` para el campo `balance`; todos los demás campos monetarios (creditLimit, interestRate, etc.) conservan `toAmount_`.

**Bugs pendientes:**
- Deploy del fix (`f0d8ff1`) a Apps Script todavía no realizado.
- Ops en dead-letter (seqs 131/132/139/140/152/153/174) deben re-encolarse tras el deploy.

**Archivos modificados:**
- `backend/Utils.gs` — agrega `toSignedAmount_`
- `backend/Accounts.gs` — usa `toSignedAmount_` para `balance` en create/update

**Commits relevantes:**
- `f0d8ff1` fix(backend): permitir balance negativo en cuentas CC (toSignedAmount_)

---

## Cambios realizados en sesión 2026-06-04 (análisis y planificación IA)

### Resumen
Sesión de análisis estratégico — sin cambios de código. Se evaluaron integraciones de IA y se identificaron dos bugs en el auto-refresh de precios.

### Análisis realizado
- **Claude Artifacts / Live Artifacts**: evaluación técnica completa. Conclusión: los Artifacts son iframes sandboxeados en claude.ai — no pueden autenticarse con OAuth. Útiles para análisis ad-hoc con datos exportados, no como integración directa.
- **Roadmap IA en 4 fases**: Fase 1 Simulador FIRE + insights determinísticos · Fase 2 reportes automáticos Groq · Fase 3 chat IA con contexto financiero · Fase 4 agente autónomo.
- **Agente de inversiones**: explicado en detalle — 60% del valor es aritmética pura (alertas de concentración, CDTs próximos, comparación benchmark), solo la narrativa requiere IA.
- **Matriz comparativa 8 opciones**: ver `docs/Live-Artifacts-Prompt.md`.

### Bugs encontrados (sin fix aún)
| Bug | Archivo | Línea | Descripción |
|-----|---------|-------|-------------|
| Auto-refresh bloqueado | `src/core/app.js` | 112 | Guardia `!priceService.isStale` impide refresh al reabrir app en <15 min |
| Parser formato incorrecto | `src/core/app.js` | 121-124 | Itera `{ quotes, fxRates }` como si fuera el objeto de quotes; escribe `prices.quotes = {...}` en lugar de `prices.AAPL = {...}` |

### Propuesta Alpaca API
- Reemplazar Yahoo Finance para acciones US/ETFs/crypto con Alpaca (API oficial, free tier, más fiable)
- Mantener Yahoo para BVC Colombia (.CL) y tasas FX (USDCOP=X)
- Arquitectura detallada en `docs/Live-Artifacts-Prompt.md` y memoria `project_alpaca_integration.md`
- Requiere: implementar `fetchAlpaca_()` en `Quotes.gs` + `ALPACA_KEY_ID`/`ALPACA_SECRET_KEY` en Script Properties + deploy

### Archivos nuevos
- `docs/Live-Artifacts-Prompt.md` — análisis completo de integraciones IA (prompt + respuesta)

### Commits relevantes
```
(ninguno — sesión de análisis sin código)
```

---

## Cambios realizados en sesión 2026-06-04 (tarde — Alpaca + fixes + UX Inversiones)

### Resumen
Sesión de implementación: 3 features/fixes completados y pusheados. SW v0.2.63 → v0.2.65.

### Bugs corregidos
| Bug | Commit | Descripción |
|-----|--------|-------------|
| Auto-refresh bloqueado | `700ba60` | Eliminado `!priceService.isStale` — precios siempre refrescan al arrancar |
| Parser `{ quotes, fxRates }` | `700ba60` | `backgroundRefreshPrices` iteraba objeto raíz; corregido con patrón de investments.js |

### Mejoras backend
- **Alpaca API** (`527492b`): `Quotes.gs` integra Alpaca Markets como fuente primaria para acciones US/ETFs/crypto.
  - `isUsEquity_()` enruta sin `.CL` ni `=X` → Alpaca; resto → Yahoo.
  - `fetchAlpacaSnapshots_()` hace ≤2 requests batch (equity + crypto) vs N individuales.
  - Fallback automático a Yahoo si Alpaca falla para algún ticker.
  - Claves en Script Properties: `ALPACA_KEY_ID` / `ALPACA_SECRET_KEY` — desplegado y verificado en producción.

### Mejoras UX/UI
- **Secciones desplegables** (`843fed3`): cada sección de Inversiones (Acciones y ETFs, Criptomonedas, FIC, CDT, Operaciones cerradas) tiene header clicable con chevron animado.
  - Estado persistido en `localStorage` (`financeOS:inv:collapsed`) — sobrevive recargas y re-renders reactivos.
  - "Operaciones cerradas" colapsada por defecto (info secundaria).
  - `aria-expanded` en cada header.
  - `chevronDown` añadido a `icons.js`.

### Decisiones arquitectónicas
- Estado de colapso en variable **módulo-level** (`_collapsed` Set) fuera de `renderInvestments` — única forma de sobrevivir a los re-renders reactivos del store sin perder el estado visual.

### Archivos modificados
- `src/core/app.js` — backgroundRefreshPrices corregido
- `backend/Quotes.gs` — Alpaca integrado
- `src/views/investments.js` — secciones desplegables
- `src/utils/icons.js` — chevronDown
- `src/styles/components.css` — estilos toggle

### Commits relevantes
```
843fed3 feat(investments): secciones desplegables con estado persistente
527492b feat(quotes): integrar Alpaca Markets como fuente primaria para equity US/ETF/crypto
700ba60 fix(prices): corregir backgroundRefreshPrices — guardia isStale + parser BE-003
```

### Estado posterior a esta sesión
- Fix auto-refresh ✅ · Alpaca API ✅ (desplegado) · Secciones desplegables ✅
- Simulador FIRE 🔴 pendiente · Reportes Groq 🔴 pendiente
- Verificaciones en vivo 🟡 pendientes (venta parcial/total, getBootstrap 24m, Analítica tendencias)

---

## Cambios realizados en sesión 2026-06-03 (noche — Analítica + Exportaciones)

### Auditorías realizadas
- Auditoría de la sección Analítica: diagnóstico de duplicación con Dashboard (4 de 5 bloques duplicados) y propuesta de rediseño con identidad propia.
- Revisión del PDF patrimonial: identificados 2 bugs en `netWorthStatement` (accountsValue incluía CC/investment; liabRows ignoraba cuentas CC).

### Mejoras UX/UI — Analítica reestructurada (`06d2c4c`)
**Eliminado** (duplicaba Dashboard):
- Card "Patrimonio neto" (snapshots ya en Dashboard)
- Card "Ahorro mensual" separada
- Donut "Gastos por categoría del mes" (ya en Dashboard)

**Nuevo layout — identidad "más allá del mes actual":**
1. **Insights mejorados**: tasa de ahorro muestra promedio histórico 3m para contexto; variación de categoría filtra por monto mínimo (≥ $10.000) para evitar ruido estadístico
2. **Flujo de caja unificado**: 3 series (Ingresos / Gastos / Ahorro) en una sola card con selector de período **3m / 6m / 12m** en el header
3. **Tabla de tendencias por categoría** (nuevo): top 5 categorías de gasto × últimos 6 meses, con coloreado por calor dentro de cada fila (pico = rojo, medio = amarillo)

**Nuevo selector** `categoryTrends(s, n, topN)` en `selectors.js`: devuelve top N categorías por gasto acumulado en n meses, con desglose mensual por categoría.

### Bugs corregidos — PDF estado patrimonial (`06d2c4c`)
| Bug | Causa | Fix |
|-----|-------|-----|
| "Sin deudas" en PDF aunque hay deuda en tarjetas | `liabRows` solo leía `s.liabilities`, ignoraba cuentas `credit_card` | Usa `selectors.debtList(s)` (unifica ambas fuentes) |
| Fila "Cuentas" no cuadra con KPI Activos | `accountsValue` incluía cuentas `investment` y `credit_card` | Mismo filtro que `totalAssets`: excluye `investment` y `credit_card` |

### Archivos modificados
`src/store/selectors.js` (nuevo `categoryTrends`) · `src/views/analytics.js` (reescritura completa) · `src/views/exports.js` (fix `netWorthStatement`)

### Commits relevantes
```
06d2c4c feat(analytics): reestructurar Analítica + fix PDF patrimonial
```

---

## Cambios realizados en sesión 2026-06-03 (tarde — Sprints 2, 3, 4 + FIN-014)

### Mejoras financieras (Sprint 2)
- `f1f1bd0`: modal de venta con campo **qty a vender**; ventas parciales (lote remanente) y totales
- `a8dec52`: `lotRealizedPnL` — comisión de compra prorateada por fracción vendida (TD-43/FIN-004)
- `a8dec52`: `cdtCurrentValue` — capitaliza sobre capital puro, topa en `maturityDate` (TD-44/FIN-008)
- `a8dec52`: penny-rounding `roundMoney` en acumulados del portafolio (FIN-009/TD-21 inversiones)
- +9 tests nuevos (64→74 total)

### Accesibilidad y Design System (Sprint 3)
- `7c38299`: `--text-tertiary` ≥4.5:1 en ambos temas; `10px/11px` → `var(--fs-micro)`; `.preset-chip:hover` usa token; `select` con padding-right; fix truncamiento label "Apariencia"
- `b78eff6`: `aria-label` redundante removido de inputs/selects (TD-49); `esc()` en SVG charts (TD-48); `ProgressBar` con ARIA completo; `confirmDialog` mueve foco al abrirse
- SW auto-bumpeado a v0.2.50

### Fix patrimonio (FIN-014)
- `cd839e9`: `totalLiabilities` filtra `type=credit_card` de liabilities (evita doble conteo con cuentas CC)
- `cd839e9`: sección Pasivos muestra cada CC como fila real (no nota al pie)
- `cd839e9`: `credit_card` removido de las opciones del formulario "Nueva deuda"
- +1 test nuevo (75/75)

### Backend performance + robustez de sync (Sprint 4)
- `7a4c43e`: `isTransient` — "No autorizado" → dead-letter, no reintenta (TD-10/BE-011)
- `7a4c43e`: `flushBatch` empareja por `entityId`, no por índice (TD-26/BE-010)
- `7a4c43e`: `reconcileAndHydrate` mergea `{...existing, ...op.data}` para updates (TD-47/BE-004)
- `056a5ba`: `repoReadAll_` con caché per-request + `repoCacheInvalidate_` en writes (TD-05/BE-005)
- `056a5ba`: `purgeDeleted_` reconstruye hoja en bloque — de N→2 ops Sheets (TD-28/BE-007)
- `6b45621`: `truncateAuditLog_()` purga AuditLog >90 días (TD-05/BE-008); acción admin expuesta
- `6b45621`: `getBootstrap_` ventanea transactions a 24 meses; `listTransactions_` acepta `since` (TD-25/BE-006)

### Archivos modificados
`src/store/selectors.js` · `src/services/syncEngine.js` · `src/services/dataService.js` · `src/views/investments.js` · `src/views/networth.js` · `src/styles/themes.css` · `src/styles/components.css` · `src/utils/dom.js` · `src/components/charts.js` · `src/components/forms.js` · `src/components/modal.js` · `src/components/ui.js` · `backend/Utils.gs` · `backend/Accounts.gs` · `backend/Audit.gs` · `backend/Code.gs` · `backend/Reports.gs` · `backend/Transactions.gs` · `tests/selectors.test.js`

### Commits relevantes
```
6b45621 perf(backend): Sprint 4 Grupo B-2 — AuditLog archivado y ventana 24m en bootstrap
056a5ba perf(backend): Sprint 4 Grupo B-1 — caché per-request y purgeDeleted en bloque
7a4c43e fix(sync): Sprint 4 Grupo A — robustez del motor de sincronización frontend
cd839e9 fix(networth): FIN-014 evitar doble conteo CC en totalLiabilities y mejorar UI de Pasivos
b78eff6 fix(a11y): Sprint 3 — accesibilidad JS
7c38299 fix(a11y/ds): Sprint 3 — contraste, tokens y DS
a8dec52 feat(selectors): FIN-004/008/009 selectores puros de lotes CDT y penny-rounding
f1f1bd0 feat(investments): FIN-003 modal de venta con campo qty y ventas parciales
```

---

## Cambios realizados en sesión 2026-06-03

> Sesión larga: Sprint 5 + Sprint 6 completos + cadena de 7 fixes de integridad de sync +
> verificación en vivo con Playwright. Cierre en HEAD `f3e8699` · v0.2.43 · 54/54 tests.

### Mejoras financieras (Sprint 5 — Inversiones avanzadas)
- `ef740f8` (parte) y commit Sprint 5: campo **`commission`** (compra) y **`soldCommission`** (venta,
  prorrateada por lote) · campo **`withholdingRate`** (retención en fuente %) con métrica + Badge
  `Ret. X%` en `positionCard`. Cost basis y P&L realizado netos de comisiones.
- `selectors.investmentsCost` ahora suma la comisión (consistencia con el Dashboard). +2 tests (54/54).

### Bugs corregidos (7 fixes de sync/datos — todos desplegados)
| Bug | Commit | Causa / Fix |
|---|---|---|
| Ticker `BRK.B` sin precio | `9a6fc31` | Yahoo usa guion (`BRK-B`). Backend reintenta punto→guion si no hay datos |
| Snapshots reaparecían al borrar | `95bcd51` | Faltaba columna `isDeleted`; se añadió + soft delete (rápido) en vez de hard delete |
| Borrado masivo snapshots: loop "sincronizando" | `2fdbc40`+`95bcd51` | Ruta batchWrite no acotaba reintentos transitorios → bucle. Ahora cuenta intentos → dead-letter |
| Compras multicuenta no sincronizaban | `ef740f8` | `name` vacío en "+ Compra" → backend lo exige. Fallback a símbolo + prellena nombre/moneda |
| Broker inline → referencia colgada | `5e46331` | `createAccount_` reasignaba id. Ahora preserva el ULID del cliente + idempotente |
| Categoría offline → "Categoría inexistente" | `8c12920` | Mismo patrón en `createCategory_` |
| Duplicados/saldo doble en reintentos de sync | `12e103d` | Idempotencia + preservación de id en los 10 `create*` (helper `idempotentHit_`) |

### Mejoras UX/UI (Sprint 6)
- `00ac288`: tooltips por segmento en **Donut** + tooltip de % en **ProgressBar** (completa el set de charts).
- `00ac288`/`8e2861b`: **validación inline** reutilizable (`setFieldError`/`focusFieldError`) aplicada
  a Inversiones + Transacciones, Presupuestos, Metas, Patrimonio, Cuentas, Diario, Recurrentes, Deudas.
- `f3e8699`: **Command Palette** (`commandPalette.js`) — ⌘K/Ctrl K · '/' · '?' · botón lupa en topbar.
  Navega a los 15 módulos + cambiar tema. Teclado completo (↑↓/↵/esc), accesible.

### Mejoras backend
- Backend estricto al SCHEMA documentado; `idempotentHit_` + `repoHardDelete_` (luego retirado) en Utils.gs.
- Schema `Investments` ampliado (commission/soldCommission/withholdingRate/soldPrice/soldDate/soldQuantity).
- Schema `NetWorthSnapshots` con `isDeleted`. Todos los `.gs` tocados redeployados por el dueño.

### Decisiones arquitectónicas
- Preservar el id (ULID) del cliente en todo `create*` → elimina remapeo de ids en reconciliación.
- Idempotencia de creación vía `repoFindRowIndex_` (lee solo la columna id, barato).
- `initShortcuts()` antes de la carga de datos (atajos no dependen de la red).

### Verificación en vivo (Playwright + Chromium, JWT de prueba)
- 14/14 rutas sin errores JS (pageerror). Sprint 5 (campos comisión/retención) y validación inline
  confirmados visualmente. Command Palette: abre/filtra/navega/cierra. **Detectó y corrigió** que los
  atajos quedaban inactivos esperando `dataService.init()` (movidos antes de la carga).

### Archivos modificados
`backend/` (Quotes, NetWorth, Config, Utils, Accounts, Categories, Assets, Goals, Liabilities, Journal,
Recurring, Budgets, Investments, Transactions) · `src/views/` (investments, transactions, budgets, goals,
networth, accounts, journal, recurring, debts, analytics) · `src/components/` (commandPalette [nuevo],
shell, ui, charts, forms) · `src/services/syncEngine.js` · `src/store/selectors.js` · `src/core/app.js` ·
`src/styles/components.css` · `tests/selectors.test.js`.

### Riesgos pendientes
- Happy-path autenticado real con datos no verificable sin login del dueño (ver lista en CONTEXTO MÍNIMO).
- Paginación de transacciones sigue pendiente (Sprint 7).

---

## Cambios realizados en sesión 2026-06-02

### Auditorías realizadas
- **Auditoría global** (12 fases): funcional, frontend, UX/UI, financiera, patrimonio, inversiones, metas, deudas, backend, sincronización, PWA, tests. Documentada en `docs/Audit-Global-2026-06-02.md`.
- **Auditoría funcional con Playwright MCP**: 12/14 rutas visitadas en producción. Screenshots validados.
- **Auditoría UX/UI**: scoring 7.0/10 vs referencias (Copilot Money, Linear, Stripe). `docs/UX-Recommendations-2026-06-02.md`.
- **Auditoría financiera**: patrimonio neto, liquidez, inversiones, presupuestos, metas, deudas verificados.
- **Auditoría backend**: rendimiento, seguridad, bugs de `computeNetWorth_`.
- **Auditoría sincronización**: dead-letter, atomicidad, batchWrite verificados.
- **Auditoría PWA**: SW, manifest, cache strategy verificados.

### Bugs corregidos
| Bug | Commit | Deploy |
|---|---|---|
| BUG-P0-1: `dataService.mutate()` → `create()` en import.js | `76dcf2c` | No |
| BUG-P0-2: Backend `computeNetWorth_` omite CC como pasivos (divergencia $3.4M) | `8e537f8` | ✅ Sí |
| BUG-P1-1: Button API incorrecta en import.js (5 instancias) | `76dcf2c` | No |
| BUG-P1-2: Íconos SVG como texto en drop zone e import-analyzing | `76dcf2c` | No |
| BUG-P1-3: `appendChild(icon())` TypeError en buildPreview/buildDone | `76dcf2c` | No |
| BUG-P1-4: analytics.js usa `periodKey ===` sin `normPeriodKey()` | `32ffa4b` | No |
| BUG-P1-5: `config.version` 0.2.23 ≠ SW 0.2.28 | `848292a` | No |
| BUG-P2-1: Sin UI para eliminar snapshots de prueba | `495fe4d` | No |
| BUG-P2-2: getQuotes ERR_ABORTED en primer intento | `511bf70` | No |
| BUG-P2-3: `curMonthKey` calculado en module load time | `32ffa4b` | No |
| BUG-P2-4: CC vencimientos no aparecen en Vista Hoy | `3aeed11` | No |

### Bugs pendientes
- TD-36: Proyección presupuesto irreal días 1–3 (P3)
- TD-37: Sin validación de solapamiento de presupuestos (P3)
- Label truncado "T..." en Ajustes Apariencia (cosmético, P3)

### Refactors realizados
- `normPeriodKey` exportada de `selectors.js` (antes privada)
- Hook pre-commit: ahora actualiza `config.version` además de `sw.js`
- `analytics.js`: `curMonthKey`/`now` movidos de module-level a render-time
- `selectors.upcomingPayments()`: fusiona recurring + CC con paymentDay
- `selectors.monthlySavingsAvg(s, n=3)`: nuevo selector para promedio de ahorro
- `outlierIds()`: helper en networth.js para detección estadística de outliers (Z-score 2σ)

### Mejoras UX/UI implementadas
- BarChart: valores visibles sobre cada barra (`bars__val` span) + opción `valueFormat`
- BarChart: tooltip nativo mejorado "label: valor" formateado en hover
- LineChart: `<title>` SVG en cada dot → fecha+valor al hover
- Snapshot evolution: checkboxes de multi-select + botón "Eliminar N seleccionados"
- Snapshot evolution: badge "Dato atípico" para outliers (Z-score ≥ 2σ)
- Snapshot evolution: toggle "Ver todos (N) / Ver menos" cuando hay >8 snapshots
- `BarChart` en networth.js pasa `valueFormat: formatMoney compact`

### Mejoras financieras implementadas
- `selectors.monthlySavingsAvg(s, n=3)`: promedio de ahorro excluyendo mes actual
- `goals.js`: forecast usa `monthlySavingsAvg(3)` en lugar de solo el mes actual (más estable)
- `selectors.upcomingPayments()`: incluye CC con `paymentDay` configurado como próximo vencimiento

### Mejoras backend implementadas
- `computeNetWorth_()`: excluye CC de activos (`type !== 'credit_card'`) y suma `Math.abs(CC.balance)` a pasivos
- `getDashboard_()`: liquidez excluye CC (`type !== 'credit_card'`)
- `deleteNetWorthSnapshot_(d)`: nueva función en NetWorth.gs — soft-delete + audit log
- `Code.gs`: ruta `deleteNetWorthSnapshot` registrada en ROUTES

### Mejoras de sincronización implementadas
- `apiClient.get()`: retry automático en `TypeError` (ERR_ABORTED del cold start de Apps Script)
- `entities.js`: `netWorthSnapshots` ahora tiene `remove: 'deleteNetWorthSnapshot'`

### Mejoras de patrimonio implementadas
- Eliminar snapshot individual: botón 🗑 con `confirmDialog` por cada fila
- Eliminar snapshots masivo: checkboxes + "Eliminar N seleccionados" + confirmación
- Detección automática de outliers: Z-score ≥ 2σ sobre todos los snapshots, mínimo 4
- Historia expandible: "Ver todos (N) / Ver menos" para ver más de 8 snapshots
- BarChart con valores monetarios formateados sobre cada barra

### Decisiones arquitectónicas tomadas
1. **Outlier detection con Z-score 2σ** (no IQR ni rango fijo): más robusto para datasets pequeños
2. **Retry solo en `TypeError`** (not `AbortError`): los timeouts propios no se reintentan
3. **`monthlySavingsAvg` excluye mes actual**: `cashflow(n+1).slice(0,n)` — el mes actual está incompleto
4. **Hook pre-commit actualiza ambos**: `sw.js` y `src/core/config.js` — eliminación de desincronización futura
5. **`normPeriodKey` exportada**: enables import desde otros módulos sin duplicar

### Riesgos mitigados
- Módulo Import completamente roto → funcional
- Backend patrimonio diverge $3.4M del frontend → alineado
- CC vencimientos invisibles en Vista Hoy → incluidos en `upcomingPayments()`
- `apiClient.get()` falla en cold start → retry automático
- Snapshots de prueba sin forma de eliminarlos desde UI → gestión completa

### Riesgos pendientes
- FX rates ausentes → inversiones USD sumadas sin conversión (silent error)
- >5000 transacciones → `listTransactions_` lento (TD-25 mitigado, no resuelto 100%)
- `monthlySavingsAvg` con 0 meses completos retorna 0 (inicio de app o datos insuficientes)

### Archivos modificados
```
src/views/import.js          — 4 bugs (P0-1, P1-1, P1-2, P1-3), icon check en done
src/views/analytics.js       — normPeriodKey + now/curMonthKey a render-time
src/views/goals.js           — monthlySavingsAvg(3)
src/views/networth.js        — multi-select, outliers, toggle, BarChart valueFormat
src/store/selectors.js       — export normPeriodKey, monthlySavingsAvg, upcomingPayments CC
src/services/apiClient.js    — retry en get()
src/services/entities.js     — remove: 'deleteNetWorthSnapshot'
src/components/ui.js         — BarChart: valueFormat + bars__val
src/components/charts.js     — LineChart dots con <title>
src/styles/components.css    — bars__val, bars height 160px, hover opacity
src/core/config.js           — version: '0.2.37' (gestionado automáticamente por hook)
backend/Reports.gs           — computeNetWorth_ + getDashboard_ excluyen CC
backend/NetWorth.gs          — deleteNetWorthSnapshot_()
backend/Code.gs              — ruta deleteNetWorthSnapshot
.githooks/pre-commit         — también bumpa config.version
tests/selectors.test.js      — monthlySavingsAvg (3 tests) + upcomingPayments (4 tests)
docs/NEXT_SESSION.md         — actualizado
PROJECT_HANDOFF.md           — actualizado
```

### Commits relevantes
```
629e1f4 docs: handoff sesión 2026-06-02 — Sprints 1-4 + bugs P0/P1/P2 completados
495fe4d feat(charts): BarChart valores visibles + tooltips · LineChart tooltips (Sprint 4.1-4.3)
5fdc008 feat(goals): forecast usa promedio de 3 meses en lugar del mes actual (Sprint 2.6)
24ddd80 feat(networth): gestión de snapshots — botón eliminar por snapshot (FIX-10)
511bf70 fix(api): retry automático en GET para ERR_ABORTED del cold start (BUG-P2-2)
3aeed11 fix(today): upcomingPayments incluye vencimientos de tarjetas de crédito (BUG-P2-4)
8e537f8 fix(backend): computeNetWorth_ incluye CC como pasivos (BUG-P0-2)
32ffa4b fix(analytics): normPeriodKey + curMonthKey en render time (BUG-P1-4)
848292a fix(config): sincronizar config.version con SW v0.2.30 (BUG-P1-5)
76dcf2c fix(import): corregir 4 bugs en módulo de importación (BUG-P0-1, P1-1, P1-2, P1-3)
9cde3e8 docs: auditoría global 2026-06-02 — 5 entregables
```

---

## Estado posterior a la auditoría

### Completado ✅
- Todos los bugs P0/P1/P2 de la auditoría 2026-06-02
- Sprint 1 (bugs críticos): import funcional, backend patrimonio correcto
- Sprint 2 (integridad financiera): normPeriodKey, monthlySavingsAvg, upcomingPayments CC
- Sprint 3 (snapshots): gestión individual/masiva, outlier detection
- Sprint 4 (charts): BarChart valores visibles + tooltips, LineChart tooltips, historia expandible
- Hook pre-commit actualiza config.version + sw.js atómicamente
- Tests: 52/52 (11 suites)
- Backend desplegado: Reports.gs, NetWorth.gs, Code.gs

### Parcialmente completado 🟡
- **Módulo Import**: bugs del código corregidos, pero flujo completo no verificado en producción con Playwright
- **Vista Hoy CC vencimientos**: código correcto, pero requiere `account.paymentDay` configurado para verificar
- **BarChart visual**: `bars__val` implementado, no verificado en pantalla real
- **Outlier detection**: activo solo con ≥4 snapshots; en producción solo hay datos de prueba que ya se pueden eliminar

### Pendiente 🔴
- Sprint 5: Inversiones avanzadas (withholding, comisiones, indicadores)
- Sprint 6: UX/UI (micro-animaciones, validación inline, shortcuts de teclado, empty states ricos)
- Sprint 7: Performance (content-visibility, lazy load, paginación IndexedDB)
- Sprint 8: Analítica avanzada (selector de período, 5 insights adicionales)
- Sprint 9: Pulido final + WCAG + v1.0
- QW-12: Truncamiento "T..." en Ajustes Apariencia
- TD-33–40: Deuda P3 restante

---

## Cambios realizados en sesión 2026-06-09

### R0 — Pre-flight (completado)

**Bugs corregidos:**
- `computeNetWorth_` (`Reports.gs`) ahora excluye `type=credit_card` de `totalLiabilities` (FIN-014 paridad FE↔BE) — commit `9657ea3`
- `computeNetWorth_` expone `ccDebt` y `liabilitiesDebt` en el return (prep R3) — mismo commit

**Deploy realizado (manual por Alejo):**
- `Auth.gs` (TD-51 — validaciones iss+exp) · `Code.gs` (TD-50 — idToken en body POST)
- `Utils.gs` (TD-45 — guard isDeleted) · `Quotes.gs` (TD-02 — Alpaca primario)
- `Reports.gs` (TD-41 + R0-A — filtros + ccDebt/liabilitiesDebt)

**Tests añadidos:**
- FIN-014 paridad FE↔BE: `totalLiabilities` excluye `type=credit_card` — `f3390c5`

**Docs:**
- TD-01 marcado ✅ en TechnicalDebt.md con regla `ensureHeaders_` append-only — `68177c7`

### R1 — FIRE enriquecido + insights corregidos (completado)

**Nuevos selectores (`src/store/selectors.js`):**
- `liquidityCoverageMonths(s)` — promedio gasto 3 meses completos (no mes parcial actual)
- `savingsStreak(s)` — meses consecutivos con ahorro, excluyendo mes en curso

**Mejoras `src/views/fire.js`:**
- Fecha estimada de independencia financiera (`≈ YYYY`) en KpiCard "Años hasta FIRE"
- ProgressBar de avance (patrimonio / objetivo FIRE, clamped 0–100%)
- Variantes Lean (5%) · Standard (4%) · Fat (3.5%) · Barista (5.5%) — radio buttons que ajustan SWR
- EmptyState cuando no hay datos financieros registrados
- Tooltips en campos SWR y rendimiento

**Nuevos insights (`src/views/analytics.js` → `buildInsights`):**
- Cobertura de liquidez (meses cubiertos, variante positive/info/warning)
- Racha de ahorro (meses consecutivos, excluyendo mes en curso)
- Concentración de gastos (top categoría ≥40% del total)

**Tests:** 104/104 (22 suites) — +6 tests nuevos (liquidityCoverageMonths, savingsStreak)

**Commits:**
- `9657ea3` fix(backend): excluir CC de totalLiabilities en computeNetWorth_ + exponer ccDebt/liabilitiesDebt (R0)
- `f3390c5` test(selectors): paridad FIN-014 totalLiabilities excluye credit_card (R0-B)
- `68177c7` docs(debt): marcar TD-01 resuelto + regla ensureHeaders_ append-only (R0-C)
- `83782be` feat(selectors): liquidityCoverageMonths y savingsStreak con promedio 3m (R1)
- `9762873` feat(fire): fecha estimada, ProgressBar, variantes FIRE y EmptyState (R1)
- `ac570e8` feat(analytics): insights cobertura de liquidez, racha de ahorro y concentración (R1)

### Archivos modificados
- `backend/Reports.gs` — fix FE↔BE CC + ccDebt/liabilitiesDebt (requirió deploy)
- `src/store/selectors.js` — liquidityCoverageMonths + savingsStreak
- `src/views/fire.js` — FIRE enriquecido
- `src/views/analytics.js` — 3 insights nuevos
- `tests/selectors.test.js` — +7 tests (FIN-014 + 6 nuevos)
- `docs/TechnicalDebt.md` — TD-01 ✅, TD-41/45/50/51/02 deploy marcado

### Riesgos mitigados
- Drift de deploy: 5 `.gs` pendientes → desplegados ✅
- Divergencia FE↔BE pasivos CC → corregida ✅
- Insights sobreestimados (mes parcial) → corrección en selectores ✅

### Verificaciones pendientes en vivo (post R1)
- fire.js variantes / ProgressBar / fecha estimada — Playwright
- analytics.js 3 insights nuevos — Playwright
- Flujo venta parcial/total en UI Inversiones

### R2 — DismissService (completado, sin deploy)

**Archivos nuevos/modificados:**
- `src/services/dismissService.js` — `dismiss(id, untilDate)`, `isDismissed(id)`, `clearStale()` vía localStorage
- `src/views/today.js` — botón "Visto ✓" en upcomingPayments; filtro en vista (selector intacto)
- `src/views/dashboard.js` — idem
- `tests/selectors.test.js` — tests dismiss: expiry por ocurrencia, clear

**Commits:** `28a6de9` `3ba0e32` `ac265d9`

### R3 — Snapshots desglose (completado, deploy realizado)

**Backend (`backend/NetWorth.gs`):**
- 6 campos nuevos en `saveNetWorthSnapshot_`: `investmentsValue`, `investmentsCost`, `accountsValue`, `otherAssets`, `ccDebt`, `liabilitiesDebt`
- Idempotencia por fecha: `String(s.date).slice(0,10) === date` (fix auto-conversión Sheets `Date`)
- Frontend values tienen precedencia (backend no puede consultar Yahoo Finance → precios stale)

**Frontend (`src/views/networth.js`):**
- `doSaveSnapshot()` envía valores en vivo desde store+priceService como payload
- Vista muestra desglose cuando campos disponibles, `—` en snapshots previos

**`src/services/dataService.js`:**
- `saveSnapshot(frontendValues = {})` acepta y pasa payload al API

**Bug fix snapshot:** $314k venía de `investmentsValue` backend con `currentPrice=0` stale. Ahora el frontend envía el valor real ($12.9M patrimonio).

**Commits:** `81e07cf` `ac2f8f8` `a3a5fe3` `ab655cb`

### R4 — Alertas portafolio (completado, sin deploy)

**Selectores nuevos (`src/store/selectors.js`):**
- `positionValue(position, s)` — usa `cdtCurrentValue` para CDTs, priceService para otros
- `portfolioAlerts(s)` — concentración >30%, CDT próximo a vencer (<30d), P&L <-20%, sin diversificación

**Fix dashboard:** `investmentsSummary` paridad exacta con sección Inversiones

**Commits:** `bdf03f6` `4a92a49` `b0ca32d`

### R5 — Seguridad (completado, deploy realizado)

**`backend/Auth.gs`:** `logAccessDenied_(reason, email)` con rate-limit CacheService (5/60s) — 5 paths auditados: iss, exp, emailVerified, audience, allowedEmails

**`backend/Config.gs`:** `APP.importMaxChars = 50000`, rate-limit params

**`backend/Import.gs`:** usa `APP.importMaxChars` (era hardcoded 40000)

**`backend/Code.gs`:** docblock formal SEC-001

**`src/services/apiClient.js`:** comentario SEC-001

**Commits:** `60a8637` `2164d52`

### Roadmap-Maestro.md (nuevo)

Fuente única de planificación que consolida: Roadmap-Revisado-Opus, Roadmap-Implementacion-2026-06-02/03, TechnicalDebt. 408 líneas, Sprints A–J definidos con IDs, archivos, esfuerzo, deploy.

---

## Estado posterior a la sesión 2026-06-09

### Completado ✅
- R0: fix FE↔BE CC · ccDebt/liabilitiesDebt · TD-01 · deploy 5 .gs
- R1: FIRE enriquecido · liquidityCoverageMonths · savingsStreak · 3 insights
- R2: dismissService.js · botón "Visto ✓" · tests
- R3: snapshots 6 campos · frontend values · idempotencia fecha · deploy
- R4: portfolioAlerts · positionValue · cdtCurrentValue · tests
- R5: logAccessDenied_ rate-limit · iss/exp validados · importMaxChars 50K · deploy
- Roadmap-Maestro.md como fuente única

### Pendiente 🔴
- Sprint A (P0): FX backend · soft-delete guard · withholdingRate — deploy
- Sprint B (P0): ventas parciales · modal cantidad · prorrateo comisión
- Sprint C (P1): accesibilidad WCAG AA — todo JS, sin deploy
- Sprint D (P1): calcYield rediseño (NO balance actual — sobreestima ~7×) — deploy
- Sprint E–J: según Roadmap-Maestro.md

---

## 19. Prompt de nueva sesión

Copia este prompt al iniciar la nueva sesión:

---

```text
Lee PROJECT_HANDOFF.md (CONTEXTO MÍNIMO primero, luego §18) y CLAUDE.md antes de cualquier cambio.

MCP: .mcp.json versionado con playwright y context7 (scope de proyecto).
Tras git pull deben APROBARSE y REINICIARSE Claude Code: las tools MCP se fijan al arrancar.

PROYECTO: FinanceOS — PWA financiera personal y privada de Alejo.
Repo: https://github.com/alejandror1367/FinanceOS (rama main).
Prod: https://alejandror1367.github.io/FinanceOS/
HEAD: ver `git log --oneline -1` · SW v0.2.90 · Tests 115/115 (24 suites)

INVARIANTES (ver CLAUDE.md): JS ES Modules sin build step · sin frameworks/bundlers ·
cero deps npm en runtime · frontend abstraído tras src/services/ · Apps Script +
Google Sheets (13 hojas) + GitHub Pages + OAuth de Google · offline-first.

ROADMAP ACTIVO: docs/Roadmap-Maestro.md ← fuente única.
Sprints R0–R5 (plan Opus) completados y desplegados en sesión 2026-06-09.

HECHO Y DESPLEGADO (sesión 2026-06-09):
- R0 ✅: fix FE↔BE pasivos CC · ccDebt/liabilitiesDebt expuestos · 5 .gs desplegados
- R1 ✅: liquidityCoverageMonths · savingsStreak · FIRE (variantes/ProgressBar/fecha) · 3 insights analytics
- R2 ✅: dismissService.js · botón "Visto ✓" hoy/dashboard · tests
- R3 ✅: snapshots 6 campos desglose · frontend values (fix INV=$0) · idempotencia fecha · deploy
- R4 ✅: portfolioAlerts · positionValue · cdtCurrentValue · fix dashboard investmentsSummary
- R5 ✅: logAccessDenied_ rate-limit · iss/exp · importMaxChars 50K · deploy
- Roadmap-Maestro.md como fuente única de planificación

HALLAZGOS VIGENTES:
- calcYield (Sprint D) DEBE usar saldo promedio/acumulación diaria, NO balance actual (sobreestima ~7×).
- ensureHeaders_ NO es append-only idempotente: solo appendear al final.
- getBootstrap_ limita a 24m de transacciones (confirmar impacto histórico).

PENDIENTES EN ORDEN (Roadmap-Maestro Sprints A–J):

1. Sprint A — Integridad cifras P0 ← SIGUIENTE (deploy):
   - FX backend en Quotes.gs (COP/USD/EUR, caché 1h).
   - soft-delete guard en Utils.gs (rechazar update/delete en isDeleted=true).
   - withholdingRate en selectors.js (rentabilidad neta de retención).

2. Sprint B — Ventas parciales P0 (sin deploy):
   - Modal "Vender" con campo cantidad parcial o total.
   - Prorrateo proporcional de comisiones al costo base.
   - cdtCurrentValue: no exceder valor nominal.

3. Sprint C — Accesibilidad WCAG AA P1 (sin deploy, todo JS):
   - Contraste · aria-label · aria-live · reduced-motion.

4. Sprint D — Cuentas remuneradas P1 (deploy):
   - REDISEÑAR calcYield: saldo promedio o acumulación diaria — NO balance actual.
   - lastYieldDate · interestRate EA · idempotencia (accountId, periodo).

5. Sprint E–J: Deudas/Metas · Import/Export · Backend perf · Charts · QA · Avanzado.
   Ver Roadmap-Maestro.md para detalle.

BUGS / VERIFICACIONES PENDIENTES:
- 🟡 Verificación en vivo R1 (fire.js variantes + analytics insights) — Playwright.
- 🟡 Flujo venta parcial/total en UI Inversiones — por confirmar en vivo.

RIESGOS ABIERTOS:
- calcYield sobreestima patrimonio hasta ~7× → Sprint D obligatorio.
- Sesión de facto perpetua sin app-lock; 2º email con acceso total.
- getBootstrap_ limita a 24m de transacciones.

FORMA DE TRABAJO: fases pequeñas y verificables · explicar qué/por qué ·
correr node --test tests/selectors.test.js tras cada cambio de selector (115/115 base) ·
commits atómicos por feature · hook auto-bumpa SW + config.version al commitear src/.
Para mensajes de commit multilínea en PowerShell: git commit -F _commitmsg.txt (archivo temporal).
Empezar con: git log --oneline -5 · git status · node --test tests/selectors.test.js.
```

---

*Actualizado el 2026-06-04 por Claude Sonnet 4.6: Alpaca API + fix auto-refresh + secciones desplegables. HEAD 843fed3 · v0.2.65 · 97/97 tests.*
