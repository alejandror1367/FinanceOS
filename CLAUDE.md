# CLAUDE.md — FinanceOS

Sistema operativo financiero personal y privado para **Alejo** (propietario único).

> **Para retomar el desarrollo:** lee primero `PROJECT_HANDOFF.md` (estado real,
> arquitectura, pendientes) y `docs/TechnicalDebt.md` (deuda priorizada). Este
> documento define **principios y reglas**; el handoff define **el estado actual**.

---

## Contexto del proyecto

Aplicación web privada de gestión financiera personal avanzada. **No** es producto
comercial, SaaS, multiusuario, ni tiene facturación, onboarding, marketing o páginas
públicas. Es una herramienta personal para centralizar todas las finanzas de Alejo.

Combina: gestión financiera · patrimonio neto · presupuestos · flujo de caja · metas ·
inversiones · proyecciones · planeación patrimonial · analítica · diario financiero.

La experiencia objetivo mezcla **Copilot Money / Monarch Money / Wealthfront**
(dominio financiero) con **Linear / Arc / Apple / Raycast / Vercel / Stripe Dashboard**
(calidad visual).

**Producción:** https://alejandror1367.github.io/FinanceOS/

---

## Estado actual (orientación)

- Roadmap fases 0–12 completadas y en producción · PWA instalada · OAuth de Google activo.
- Versión actual: ver `src/core/config.js` (`version`) y `sw.js` (cache).
- Módulos extra ya en producción no descritos en la spec original: **`#/import`**
  (importación de extractos bancarios con IA) y **precios de mercado en vivo**
  (`src/services/priceService.js`).
- El detalle vivo (qué está hecho, qué falta, bugs conocidos) vive en
  `PROJECT_HANDOFF.md`, **no** aquí.

---

## Principios rectores (estos sí son invariantes)

Toda decisión técnica se evalúa contra estos principios, en este orden:

1. **Simplicidad** — la solución más simple que funcione gana. Sin abstracciones especulativas.
2. **Costo cero o mínimo** — preferir capas gratuitas (free tier). Nunca introducir
   un costo recurrente sin justificación explícita.
3. **Integridad de datos** — los datos financieros son sagrados: validación, auditoría, backups.
4. **Mantenibilidad** — un solo dueño debe poder entender y operar todo el sistema.
5. **Offline-first** — la app funciona sin red; la sincronización es diferida y reconciliable.
6. **Exportabilidad total** — los datos del usuario **nunca** quedan atrapados en un
   servicio propietario. Siempre debe existir export completo (CSV/JSON) y la BD debe
   ser migrable sin reescribir el frontend.
7. **Privacidad** — app de una sola persona; datos financieros sensibles. No se exponen
   secretos en repos públicos ni se envían datos a terceros sin necesidad real.

---

## Stack recomendado (el default)

Este es el stack por defecto. Salirse de él es posible (ver "Herramientas permitidas"),
pero requiere una razón que respete los principios rectores.

| Capa | Recomendado | Notas |
|---|---|---|
| Frontend | **HTML + CSS + JavaScript (ES Modules)** | Vanilla, sin build step, servido directo |
| Backend | **Google Apps Script** | Sin servidores que mantener |
| Base de datos | **Google Sheets** (`FinanceOS_DB`) | Backups nativos, exportable, familiar |
| Hosting | **GitHub Pages** | Estático, gratuito, despliegue por `git push` |
| PWA | Service Worker | Instalable, offline-first |
| Auth | **Google Identity Services (OAuth)** | Reemplazó el token compartido (TD-09) |
| Persistencia local | IndexedDB (datos) + localStorage (prefs/UI) | IndexedDB es la fuente local principal |
| Tests | `node:test` nativo | Sin frameworks de test |

---

## Invariantes no negociables

Reglas que **no** se rompen sin una conversación explícita con el dueño:

1. **El frontend servido es JavaScript ejecutable directamente en el navegador, sin
   build step.** Lo que llega a producción son los mismos archivos `.js`/`.css`/`.html`
   del repo — sin transpilación ni bundling. Esto descarta TypeScript-con-transpile,
   frameworks que requieran compilación (React/Vue/Angular/Svelte/Next) y bundlers
   (Vite/Webpack/Parcel/Rollup) **en el artefacto entregado**.
   *No descarta* type-checking opcional vía **JSDoc + `tsc --checkJs --noEmit`** como
   herramienta de dev/CI (no emite código; los archivos servidos siguen siendo JS plano),
   ni el resto del tooling de desarrollo (Node, Playwright, Actions).
   Razón: longevidad, control total, cero pipeline que mantener, depuración directa.
2. **Cero dependencias npm en el runtime del cliente.** Lo que llega al navegador no
   importa paquetes npm. Las librerías de dev (test, lint, e2e) viven solo en desarrollo.
3. **El frontend no conoce la fuente de datos.** Toda lectura/escritura pasa por la capa
   de servicios (`src/services/`). Las vistas nunca hablan directo con red, IndexedDB ni
   con la BD. Esto permite cambiar de backend/BD sin reescribir vistas.
4. **Offline-first y exportabilidad total** (principios 5 y 6) son requisitos, no opcionales.
5. **Trabajar por fases pequeñas y verificables.** Nunca implementar todo de una vez.

---

## Herramientas y servicios permitidos

El stack recomendado es el default, pero estas herramientas están **explícitamente
permitidas** cuando aportan valor real y respetan los principios rectores.

### Tooling de desarrollo y testing (build/test-time, no runtime)
- **Node.js** — para tests (`node --test`), servidor local (`npx serve`), git hooks y scripts.
- **Type-checking opcional** — **JSDoc + `tsc --checkJs --noEmit`** sobre el JS vanilla.
  Verifica tipos (útil en la lógica financiera: selectors, FX, saldos) sin emitir código:
  el artefacto servido sigue siendo JS plano. Nunca se introduce `.ts` con transpilación.
- **Playwright** y **MCP Playwright** — pruebas e2e y auditoría funcional automatizada.
- **GitHub Actions** — CI: correr tests en cada push/PR, validaciones, despliegues asistidos.
- **MCPs de asistencia:** Context7 (docs de librerías), GitHub MCP (issues/PRs),
  Filesystem MCP, Sequential Thinking (razonamiento estructurado).

> Estas herramientas **no** alteran el invariante de "Vanilla sin build": operan en
> desarrollo/CI, no producen un bundle que se sirva al cliente.

### Datos de mercado financiero (precios en vivo, FX)
Permitidos para cotizaciones de inversiones y tasas de cambio:
- **Yahoo Finance** (fuente principal actual), **Stooq**, **Alpha Vantage**,
  **Twelve Data**, **Financial Modeling Prep**.

Condiciones: preferir free tier · **cachear** resultados (ver `priceService.js`, TTL) ·
degradar con elegancia offline (último precio conocido) · si una API exige clave, la
clave **no** se expone en el repo público (usar proxy en Apps Script / Worker).

### Servicios de IA / asistencia
Permitidos para parsing de extractos (`#/import`), generación de insights y asistencia:
- **Gemini** (usado hoy en `#/import`), **OpenAI**, **Claude**.

Condiciones: **opt-in** y consciente del costo · enviar el **mínimo** de datos necesario
(datos financieros sensibles) · claves **fuera** del repo público (proxy server-side) ·
la app debe seguir siendo plenamente usable **sin** IA (la IA enriquece, no es requisito).

### Backends y bases de datos alternativos (rutas opcionales / futuras)
Apps Script + Sheets sigue siendo el default. Estas alternativas están permitidas como
evolución, siempre que respeten los invariantes (frontend abstraído tras servicios +
exportabilidad total + offline-first):
- **Cloudflare Workers** (compute serverless), **Cloudflare D1** (SQLite gestionado),
  **Cloudflare R2** (almacenamiento de objetos / backups / exports).
- **Supabase**, **PostgreSQL**, **SQLite**.

Condiciones: migrar implica cambiar **solo la capa de servicios/backend**, nunca las
vistas · todo dato debe seguir siendo exportable en CSV/JSON · preferir free tier ·
no introducir costo recurrente sin acuerdo explícito.

> **Criterio general:** si una herramienta no está en esta lista, no está prohibida por
> defecto — evalúala contra los principios rectores. Lo único realmente cerrado son los
> *invariantes no negociables*.

---

## Filosofía visual

La app debe sentirse **premium, moderna, sofisticada, clara, minimalista y rápida**.
Evitar apariencia de ERP, CRM, banca antigua o dashboard corporativo genérico.
Inspiraciones: Linear, Arc, Apple, Raycast, Vercel, Stripe Dashboard.

---

## Design System

Implementado y completo. Light/Dark mode. Tipografía **Inter**
(Display/H1/H2/H3/Body/Caption). Paleta basada en Slate, Graphite, Emerald, Blue,
Amber, Red. **El color solo comunica significado.**

Tokens en `src/styles/` (`tokens.css` primitivos → `themes.css` semánticos → `base/layout/components`).

### Componentes base (reutilizables)
Card · KPI Card · Data Table · Modal · Drawer · Bottom Sheet · Toast · Badge ·
Chart Container · Empty State · Skeleton Loader · Search Box · Command Palette ·
Tabs · Dropdown · Context Menu.

---

## Arquitectura frontend

Arquitectura modular. **Nunca mezclar** UI, lógica financiera, persistencia y sincronización.

```
src/
  core/        bootstrap, auth, router, rutas, config
  store/       estado reactivo (pub/sub) + selectores (derivaciones puras, testeadas)
  services/    apiClient, dataService, sync, IndexedDB, priceService, tema, datos
  components/  ui, shell, modal, forms, charts
  views/       las vistas de cada módulo
  styles/      tokens, temas, base, layout, componentes
  utils/       formato, dom, ids, iconos, export
```

**Flujo de datos:** `Services → Store → Views`. **Acciones:** `Views → Services`
(jamás directo a red o IndexedDB). Los valores derivados (patrimonio, consumido, etc.)
se calculan en `selectors.js`, no se persisten.

---

## Backend

**Recomendado: Google Apps Script** (runtime V8). API basada en acciones vía `doGet`/`doPost`.

Archivos actuales en `backend/`:
`Config.gs` (config, SCHEMAS, ENUMS) · `Utils.gs` (repositorio genérico, validación, IDs) ·
`Code.gs` (router + `assertAuthorized_`) · `Auth.gs` (`verifyGoogleToken_` con CacheService) ·
`Accounts.gs` · `Transactions.gs` · `Categories.gs` · `Budgets.gs` · `Goals.gs` ·
`Investments.gs` · `Assets.gs` · `Liabilities.gs` · `Reports.gs` (`getDashboard`,
`computeNetWorth_`) · `Journal.gs` · `Migration.gs` (`recalculateAccountBalances_`) ·
`Setup.gs` (`setupDatabase()` idempotente) · `Audit.gs` (`logAudit_`).

> Backends alternativos (Cloudflare Workers, Supabase, etc.) están permitidos como
> evolución futura respetando los invariantes (ver "Herramientas permitidas").

### Contrato de API
Acciones vía parámetro `action` (`?action=getDashboard`, `getTransactions`,
`createTransaction`, `updateTransaction`, `deleteTransaction`, `getBudgets`,
`getGoals`, `getInvestments`, `recalculateBalances`, …). Respuestas **siempre JSON**:

```json
{ "success": true, "data": {} }
{ "success": false, "error": "" }
```

---

## Base de datos

**Recomendada: Google Sheets** (`FinanceOS_DB`).

**13 hojas:** Accounts · Transactions · Categories · Budgets · Goals · Investments ·
Assets · Liabilities · NetWorthSnapshots · RecurringTransactions · Journal ·
AuditLog · Settings.

**Reglas de esquema:** cada registro tiene `id` único, `createdAt`, `updatedAt`.
Fechas en **ISO 8601**. Toda entidad tiene esquema definido (`SCHEMAS` en `Config.gs`).
Sin estructuras ambiguas.

> **Cuidado conocido:** Google Sheets puede auto-convertir strings tipo `'YYYY-MM'`
> (p. ej. `periodKey` de presupuestos) en objetos `Date`. Normalizar al leer
> (ver `normPeriodKey`/`parsePeriodKey`).

BDs alternativas (D1, Supabase, Postgres, SQLite) permitidas si preservan
exportabilidad total y la abstracción del frontend (ver "Herramientas permitidas").

---

## Sincronización y persistencia local

App offline-first. Implementar: Optimistic UI · cola offline · reintentos automáticos ·
reconciliación de cambios · sincronización diferida. Las acciones se ejecutan **primero
localmente** y luego sincronizan.

Persistencia local: **IndexedDB** (fuente local principal de datos) + **localStorage**
(solo preferencias, configuración visual y estado de UI).

---

## Módulos funcionales

- **Dashboard** — centro de comando: patrimonio neto, ingresos/gastos/ahorro del mes,
  liquidez, inversiones, metas activas, próximos pagos.
- **Hoy** — copiloto diario: saldo, movimientos recientes, próximos pagos, metas prioritarias.
- **Transacciones** — crear/editar/eliminar/duplicar/buscar/filtrar. Tipos: ingreso/gasto/transferencia.
- **Cuentas** — efectivo, banco, ahorro, inversión, billetera digital, tarjeta de crédito.
- **Presupuestos** — mensual/anual: consumido, disponible, proyectado.
- **Recurrentes** — pagos recurrentes.
- **Patrimonio** — Patrimonio Neto = Activos − Pasivos; evolución histórica por snapshots.
- **Inversiones** — acciones, ETFs, fondos, bonos, CDT, cripto. Costo promedio, valor
  actual (precios en vivo), rentabilidad, distribución.
- **Metas** — fondo de emergencia, vivienda, viaje, retiro, vehículo: avance, tiempo
  estimado, aporte recomendado.
- **Deudas** — saldo, tasa, cuota, vencimiento. Estrategias Snowball / Avalanche.
- **Analítica** — flujo de caja, patrimonio, gastos por categoría, ahorro histórico,
  tendencias, insights automáticos.
- **Diario financiero** — reflexiones, decisiones, aprendizajes, objetivos.
- **Importar (`#/import`)** — importación de extractos bancarios con IA (parsing).
  Bancos soportados: Bancolombia, Nu, Nequi, Global66, RappiPay, XTB, ARQ Invest.
- **Exportaciones** — CSV por colección, JSON completo, PDF (mensual / patrimonial).
- **Ajustes** — tema, sync, actualizar, recalcular saldos, sesión, vaciar caché.

### Insights
Generar insights automáticos. Ej.: "Tus gastos en restaurantes aumentaron 14%",
"Estás 10% por encima del presupuesto", "A este ritmo ahorrarás X este mes".

---

## Seguridad

App privada de un solo dueño.

- **Autenticación: Google OAuth (GIS).** Reemplazó al token compartido. El backend
  valida el `id_token` y restringe a los emails autorizados (`allowedEmails` en `Config.gs`).
- Validación y sanitización de entradas (cliente y backend).
- Auditoría básica (`AuditLog`).
- Backups exportables (export total CSV/JSON).
- **Secretos:** el `clientId` de OAuth no es secreto. Las **claves de APIs de pago**
  (IA, datos de mercado) nunca van en el repo público: proxy server-side (Apps Script/Worker).
- No implementar sistemas empresariales innecesarios.

---

## Forma de trabajo

En cada cambio:
1. Explicar **qué** se modificará y **por qué**.
2. Mantener compatibilidad; no eliminar funcionalidad existente sin justificación.
3. Indicar **cómo probar** (y correr `node --test tests/selectors.test.js` → debe pasar).
4. Trabajar en fases pequeñas y verificables; esperar validación entre fases.
5. Commits descriptivos; el hook pre-commit auto-bumpea la versión del Service Worker.

Nunca entregar fragmentos incompletos cuando se pide un archivo completo.
