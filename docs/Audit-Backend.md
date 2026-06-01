# Auditoría Backend (Google Apps Script) — FinanceOS

**Rol:** Experto en Google Apps Script
**Fecha:** 2026-05-31
**Alcance:** `Code.gs` (router), `Utils.gs` (repositorio genérico), `Reports.gs`, módulos CRUD por entidad, `Audit.gs`, `Setup.gs`, `Settings.gs`
**Foco:** rendimiento · llamadas a Sheets · uso de `Range` · escrituras masivas · escalabilidad · cuotas
**Buscando:** llamadas innecesarias · cuellos de botella · riesgos de cuota

> Documento de solo lectura. No modifica código. Complementa `docs/Audit.md`, `docs/Audit-Financiero.md` y `docs/Audit-Frontend.md`. Reglas: `CLAUDE.md`.

---

## Veredicto

El repositorio genérico (`Utils.gs`) es **limpio y mantenible**, pero está **diseñado para corrección, no para rendimiento**: cada mutación dispara **varias lecturas de hoja completa** y **múltiples `openById`**, y el `AuditLog` —la hoja que más rápido crece— **se relee entero en cada escritura**. Con un solo usuario y poco volumen funciona bien; **degrada de forma supra-lineal** a medida que crecen `Transactions` y `AuditLog`. No hay batching de escrituras ni endpoint de arranque unificado: la carga inicial cuesta **12 invocaciones**.

### Llamadas reales a Sheets por operación (trazado de `Utils.gs`)

| Operación | `openById` | Lecturas hoja completa | Escrituras | Notas |
|---|---|---|---|---|
| `createTransaction` | ~5 | **3** (Transactions, Categories, AuditLog) | 2 append | +`repoGet` post-append innecesario |
| `updateTransaction` | ~6 | **4** (Trans×2, Categories, AuditLog) | 1 setValues + 1 append | `findRowIndex` + `repoGet` = 2 escaneos |
| `deleteX` (soft) | ~4 | 3 | 1 setValues + 1 append | vía `repoUpdate` |
| `getDashboard` / `getNetWorth` | **8** | **8** (`loadContext_`) | 0 | una `openById` por entidad |
| `pullAll` (carga app) | **~12** | **~12** | 0 | 12 requests HTTP separados |

---

## 🔴 CRÍTICO

### GAS-C1 · El `AuditLog` se relee completo en cada escritura → coste creciente y compuesto

Cada CRUD llama `logAudit_` → `repoCreate_('AuditLog', …)`, y **`repoCreate_` termina con `repoGet_(record.id)` que hace `getDataRange().getValues()` de TODO el AuditLog** solo para devolver la fila recién creada (`Utils.gs:134`). Como el AuditLog es la hoja que **más rápido crece** (una fila por cada escritura de todo el sistema), **cada nueva escritura es más lenta que la anterior**: coste ~O(n) que se vuelve cuadrático sobre el histórico. Cuello de botella de escalabilidad nº1.

**Fix:** `repoCreate_` debe **devolver el `record` que ya construyó en memoria** (con `id`/timestamps) sin releer la hoja. Elimina 1 lectura completa por cada create (incluido cada audit).

### GAS-C2 · Carga de la app = 12 requests separados (sin endpoint de arranque)

`dataService.pullAll` hace 12 `doGet` independientes (`getAccounts`, `getTransactions`, … `getJournal`, `getSettings`, `getNetWorthSnapshots`). **Cada uno es una invocación completa de Apps Script** que reabre el spreadsheet y lee. 12 round-trips HTTP + 12 `openById` + 12 lecturas **en cada carga y cada "Actualizar"**. Es la mayor latencia extremo-a-extremo y multiplica el conteo de invocaciones (riesgo de *simultaneous executions* y de runtime diario).

**Fix:** acción `getBootstrap` que lea **todas** las hojas en una sola ejecución (cacheando el handle del spreadsheet) y devuelva `{accounts, transactions, …}`. Reduce ~12× los round-trips.

---

## 🟠 IMPORTANTE

### GAS-I1 · `SpreadsheetApp.openById` sin cachear → 5-8 aperturas por request

`getDb_()` (`Utils.gs:17`) llama `openById(getSpreadsheetId_())` **en cada** `getSheet_`, y `getSheet_` se invoca por cada `repoReadAll_`/`repoFindRowIndex_`/`repoCreate_`. Un `getDashboard` abre el spreadsheet **8 veces**; un `update` ~6. `openById` es de las llamadas más caras.

**Fix:** memoizar el handle en una variable global de la ejecución (`var _ss; function getDb_(){ return _ss || (_ss = SpreadsheetApp.openById(...)); }`). 1 apertura por ejecución.

### GAS-I2 · `repoUpdate_` hace dos escaneos completos por actualización

`repoUpdate_` (`Utils.gs:137`) llama `repoFindRowIndex_` (lee toda la columna de ids) **y además** `repoGet_` (lee toda la hoja) para el mismo registro. Dos recorridos O(n) para un único update.

**Fix:** `repoFindRowIndex_` ya localiza la fila; leer esa fila puntual con `getRange(rowIndex,1,1,len)` en vez de `repoGet_` (lectura completa).

### GAS-I3 · Sin `LockService` → condiciones de carrera en escrituras

`appendRow`/`setValues` sin bloqueo. La cola offline hoy sincroniza secuencialmente (bajo riesgo con un cliente), pero **dos dispositivos, reintentos rápidos o flush concurrente** pueden colisionar en `appendRow`/índice de fila → filas duplicadas o updates perdidos.

**Fix:** `LockService.getScriptLock()` con `waitLock` alrededor de las mutaciones.

### GAS-I4 · Filas con *soft-delete* nunca se purgan → crecimiento ilimitado

`repoReadAll_` lee **todas** las filas (incluidas `isDeleted`) y filtra en JS. Los registros borrados **se acumulan para siempre**, engordando cada `getDataRange().getValues()`. Toda lectura se vuelve más lenta con el tiempo, aunque los datos "vivos" sean pocos.

**Fix:** rutina de compactación/archivado periódica (mover borrados a una hoja `_archive` o purgar tras X días).

### GAS-I5 · `getDataRange().getValues()` carga la hoja entera en memoria en cada lectura

Toda lectura materializa **todas las filas × todas las columnas** (`Utils.gs:93`). Para `Transactions`/`AuditLog` con miles de filas, cada `repoReadAll_` es O(n) en tiempo y memoria. Combinado con GAS-C1 (audit releído en cada write), el sistema escala mal por diseño de acceso.

**Fix:** lecturas dirigidas por rango/columna donde sea posible; paginación real en `getTransactions` (hoy `p.limit` lee todo y luego hace `slice` — `Transactions.gs:14`).

### GAS-I6 · Sin escritura por lotes para la cola de sincronización

El flush de la cola envía **un `doPost` por operación** = N invocaciones de Apps Script para N cambios offline. Tras estar offline un rato, sincronizar 20 cambios = 20 ejecuciones.

**Fix:** acción `batchWrite` que acepte un array de operaciones y las aplique en **una sola ejecución** (con `LockService` y un único flush). Recorta invocaciones y latencia.

---

## 🟢 MEJORA FUTURA

- **GAS-MF1 ·** `getBaseCurrency_()` hace una lectura completa de `Settings` en cada `getDashboard`/`getNetWorth`/`saveNetWorthSnapshot`. Cachear en `CacheService` (TTL corto) o dentro de `loadContext_`.
- **GAS-MF2 ·** `appendRow` es más lento y menos seguro que `getRange(getLastRow()+1, 1, 1, n).setValues([...])`; migrar en rutas calientes.
- **GAS-MF3 ·** `seedDefaults_` inserta categoría por categoría (7 `appendRow` + 7 relecturas). Usar `setValues` por lote.
- **GAS-MF4 ·** `loadContext_` lee 8 hojas aunque el endpoint solo use algunas (p. ej. `getNetWorth` no necesita `categories`/`transactions`/`recurring`). Cargar bajo demanda.
- **GAS-MF5 ·** Considerar `CacheService`/`PropertiesService` para datasets casi estáticos (categorías) y evitar releerlos en cada validación de transacción (`repoGet_('Categories')` en cada create/update).
- **GAS-MF6 ·** Índice id→fila en `CacheService` para evitar el escaneo lineal de `repoFindRowIndex_`.

---

## Tabla resumen

| ID | Área | Tipo | Severidad |
|----|------|------|-----------|
| GAS-C1 | AuditLog releído en cada escritura | Cuello de botella compuesto | 🔴 |
| GAS-C2 | 12 requests en la carga (sin bootstrap) | Llamadas innecesarias / cuota | 🔴 |
| GAS-I1 | `openById` sin cachear (5-8/req) | Llamada innecesaria | 🟠 |
| GAS-I2 | `repoUpdate_` = 2 escaneos | Range/lectura | 🟠 |
| GAS-I3 | Sin `LockService` | Riesgo de carrera | 🟠 |
| GAS-I4 | Soft-deletes nunca purgados | Escalabilidad | 🟠 |
| GAS-I5 | `getDataRange` carga todo | Escalabilidad | 🟠 |
| GAS-I6 | Sin `batchWrite` para la cola | Escrituras masivas / cuota | 🟠 |
| GAS-MF1–6 | Caché/lotes/lecturas dirigidas | Varios | 🟢 |

---

## Orden recomendado (por ROI)

1. **GAS-C1** que `repoCreate_` devuelva el record sin releer → quita 1 lectura completa por **cada** escritura (y por cada audit).
2. **GAS-I1** cachear `openById` → de 5-8 a 1 apertura/ejecución.
3. **GAS-C2** acción `getBootstrap` → carga inicial de 12 requests a 1.
4. **GAS-I6** `batchWrite` para la cola offline.
5. **GAS-I2 / GAS-I5** lecturas dirigidas por rango + paginación real.
6. **GAS-I3 / GAS-I4** `LockService` + purga de soft-deletes.

---

## Riesgo de cuota (cuenta consumidor)

Hoy lejos de los límites, pero los **multiplicadores** son GAS-C2 (×12 invocaciones por carga) y GAS-I6 (×N invocaciones por sincronización). El runtime de **6 min/ejecución** solo peligra si `Transactions` + `AuditLog` crecen a decenas de miles de filas con las relecturas actuales (GAS-C1/I5). Límites relevantes a vigilar: tiempo de ejecución por invocación, runtime total diario y ejecuciones simultáneas.

---

## Lo que está bien (no tocar)

- Repositorio genérico guiado por `SCHEMAS`: cada entidad ~40 líneas declarativas (DRY ejemplar).
- Router por `action` claro (`Code.gs`), con `READ_ACTIONS` separando lecturas (GET) de escrituras (POST).
- Auditoría resiliente: `logAudit_` envuelto en `try/catch` para no tumbar la operación principal.
- `setupDatabase()` idempotente; `ensureHeaders_` con cabeceras y fila congelada.
- Validación/sanitización autoritativa en el servidor (`requireFields_`, `requireEnum_`, `sanitizeString_`, `toAmount_`).

---

## Documentos relacionados

- `docs/Audit.md` — auditoría de arquitectura.
- `docs/Audit-Financiero.md` — auditoría de cálculos financieros.
- `docs/Audit-Frontend.md` — auditoría del Design System.
- `docs/Architecture.md` — modelo de sincronización offline-first.
- `CLAUDE.md` — fuente de verdad del proyecto.
