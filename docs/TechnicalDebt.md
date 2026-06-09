# Registro de Deuda Técnica — FinanceOS

**Fecha:** 2026-05-31
**Fuentes:** consolidación de `docs/Audit.md` (arquitectura), `docs/Audit-Financiero.md` (cálculos), `docs/Audit-Frontend.md` (Design System) y `docs/Audit-Backend.md` (Apps Script).
**Objetivo:** vista única priorizada de la deuda técnica con impacto, esfuerzo y recomendación. Documento de seguimiento; no modifica código.

> Hallazgos que aparecían en varias auditorías se han **fusionado** (se indica el origen). Contexto: app **personal, monousuario**; algunos riesgos de seguridad/escala están mitigados por ese contexto y se marcan como *aceptados* cuando aplica.

---

## Leyenda

**Prioridad**
- **P0 — Crítica:** afecta integridad de datos, correctitud de cifras maestras o una promesa central del producto. Atender primero.
- **P1 — Alta:** fiabilidad de sincronización, bugs activos, accesibilidad bloqueante.
- **P2 — Media:** mantenibilidad, escalabilidad, precisión, consistencia visual.
- **P3 — Baja / Futuro:** mejoras incrementales sin impacto inmediato.

**Esfuerzo** (estimación orientativa para un dev)
- **S** ≤ 0.5 día · **M** 0.5–2 días · **L** 2–5 días · **XL** > 5 días

---

## Resumen ejecutivo

| Prioridad | Nº ítems | Esfuerzo agregado aprox. |
|---|---|---|
| P0 — Crítica | 9 | ~10–16 días |
| P1 — Alta | 9 | ~6–9 días |
| P2 — Media | 14 | ~10–15 días |
| P3 — Baja/Futuro | 8 | incremental |
| **Total** | **40** | — |

La deuda se concentra en **tres temas de fondo**: (1) **modelo contable** (el ledger no mueve saldos; multi-moneda sin conversión), (2) **fiabilidad de sincronización** (cola, atomicidad, head-of-line), y (3) **promesas del DS no entregadas** (tipografía Inter, accesibilidad de gráficos/formularios). El backend es funcional pero **read-heavy** y escala mal con el histórico.

---

## P0 · Crítica

| ID | Problema | Origen | Impacto | Esfuerzo | Recomendación |
|----|----------|--------|---------|----------|---------------|
| TD-01 ✅ | **Ledger desconectado de los saldos** (transacciones no mueven `account.balance`; transferencias no mueven dinero) | F-1 | Patrimonio/liquidez y movimientos/ahorro **nunca reconcilian**; cifras maestras incoherentes | L | **HECHO** (`b90163b`): modelo híbrido — `adjustBalance_()` y `applyTxBalanceDelta_()` en `Accounts.gs`; create/update/delete en `Transactions.gs` aplican/revierten efecto en saldos; `_adjustAccountBalances()` en `dataService.js` (Optimistic UI); `recalculateAccountBalances_()` para recálculo desde cero. **Regla de esquema**: `ensureHeaders_` NO es idempotente con `setValues` ciego — al cambiar el schema, agregar columnas solo al final (append-only); renombrar o reordenar descuadra la hoja. |
| TD-02 ✅ | **Multi-moneda sin conversión** (sumas mezclan divisas) | C-2 / F-3 | Patrimonio neto **incorrecto** en cuanto exista una 2ª divisa (latente) | S (bloqueo) / L (FX) | **HECHO** (Sprint A: `f7e1330`+`34383ff`+`d77e1f5`): `getFxRates` en backend (caché 1h); `computeNetWorth_` convierte o excluye (`fxExcludedCount`), nunca 1:1; FE: `convertToBase()`/`sumInBase()` en todos los selectores (liquidez, activos, pasivos, CC, deudas, XIRR, investmentsSummary), selector `fxGaps()`, aviso de exclusión en vista Inversiones. 136/136 tests. ⚠ **Requiere deploy:** `Quotes.gs`, `Code.gs`, `Reports.gs`. Residual: TD-54 (tx en divisa extranjera con tasa histórica). |
| TD-03 | **Doble conteo de cuentas de inversión** en `totalAssets` (incluye `balance` de cuenta *investment* + posiciones) | F-2 | Patrimonio **inflado** sin error visible; incoherente con `totalLiquidity` | S | Excluir `type==='investment'` de `totalAssets` o documentar que su `balance` es solo cash. |
| TD-04 | **Sin pruebas automatizadas** de la lógica financiera (`selectors.js`) | C-3 | Regresiones de cifras **silenciosas** (no rompen la app) | M | Suite `node --test` (sin build) con 20–30 casos sobre net worth, presupuestos, ahorro, rentabilidad. |
| TD-05 | **`AuditLog` se relee entero en cada escritura** (`repoCreate_`→`repoGet_`) | GAS-C1 | Cada escritura se vuelve más lenta a medida que crece el histórico (coste cuasi-cuadrático) | S | `repoCreate_` devuelve el `record` ya construido en memoria, sin releer la hoja. |
| TD-06 ✅ | **La tipografía Inter nunca se carga** (sin `@font-face`/`<link>`) | DS-C1 | **HECHO** (presente en repo): `index.html` carga Inter vía Google Fonts (`preconnect` + `rel=stylesheet`, `display=swap`). El SW la cachea tras el primer load; sin red usa `system-ui`. |
| TD-07 | **Gráficos sin alternativa textual** (`role="img"` sin `aria-label`) | DS-C2 | Toda la analítica es **inaccesible** a lectores de pantalla (WCAG 1.1.1) | S–M | `aria-label` con resumen y/o tabla `sr-only` en `LineChart`/`Donut`/`BarChart`. |
| TD-08 | **Labels de formulario no asociados** (primitiva `field()` sin `for`/`id`) | I-5 / DS-C3 | **Todos** los formularios fallan WCAG 1.3.1/4.1.2 | S | `field()` genera `id` y enlaza `label[for]` (1 primitiva → toda la app conforme). |
| TD-09 | **Token de API público** en repo y JS servido | C-1 | Lectura/escritura completa del backend por terceros | S | **Aceptado** por decisión (uso personal). Mitigar: rate-limit en backend + rotar `FINANCEOS_API_TOKEN` ante abuso. |

---

## P1 · Alta

| ID | Problema | Origen | Impacto | Esfuerzo | Recomendación |
|----|----------|--------|---------|----------|---------------|
| TD-10 ✅ | **Head-of-line blocking + operación atascada** en `syncEngine.flush` (error de negocio bloquea la cola para siempre) | I-2 / F-10 | Sincronización puede **congelarse** indefinidamente; cliente/servidor divergen | M | **HECHO** (`9a1cf3c`): `isTransient()` distingue error de red (reintentar) de negocio/4xx (a *dead-letter* inmediato); tras `MAX_ATTEMPTS` también va a dead-letter y la cola sigue. `syncQueue.markDead/requeue/discard`; Ajustes expone "Cambios sin sincronizar" con Reintentar/Descartar. |
| TD-11 | **Bug: estado de sync siempre `'idle'`** (`pending>0 ? 'idle' : 'idle'`) | I-3 | La píldora nunca muestra "pendiente" | S | Corregir ternario a `'pending'`/`'error'`. **Quick win (1 línea).** |
| TD-12 | **Dos métodos de *bucketing* de meses** (`sameMonth` por `Date` local vs `slice` string) | F-4 | `monthlyExpense` discrepa de `budgetConsumed` y del backend en bordes de mes | S | Reescribir `sameMonth` con comparación `YYYY-MM` string. **Quick win (1 línea).** |
| TD-13 ✅ | **`pullAll` (clear+replace) vs cola pendiente** | F-8 | `refresh()` manual borra creates pendientes / reaparecen deletes | S–M | **HECHO** (`bccc956`): `refresh()` hace `flush()` de la cola antes de `pullData()`; lo pendiente se recupera en la reconciliación tras el pull. |
| TD-14 ✅ | **No-atomicidad entre escritura local y encolado** (`db.put` + `enqueue` separados) | F-9 | Si el proceso muere entre ambas, dato local **sin** sync → divergencia permanente | M | **HECHO** (`bccc956`): nuevo `db.transact()` escribe dato + op de cola en una sola transacción IndexedDB atómica; `syncQueue.makeRecord()` comparte la forma del registro. |
| TD-15 ✅ | **Carga de app = 12 requests** (sin `getBootstrap`) | GAS-C2 | Latencia alta y ×12 invocaciones por carga/refresh | M | **HECHO** (`98f8c19`): acción `getBootstrap` (`Reports.gs`) lee las 12 hojas en una ejecución; frontend `pullData()` la usa con fallback a `pullAll`. ✅ Desplegado y confirmado en producción (1 sola petición). |
| TD-16 ✅ | **`SpreadsheetApp.openById` sin cachear** (5–8/req) | GAS-I1 | Aperturas repetidas caras por request | S | **HECHO** (`47f91e1`): `getDb_()` en `Utils.gs` memoiza el handle en `var _db`; todo acceso pasa por `getSheet_→getDb_()` → 1 `openById` por ejecución. (`Setup.gs` abre directo pero es setup manual, no per-request.) |
| TD-17 ✅ | **Foco de input tenue** (`outline:none` + box-shadow `--accent-bg`) | I-6 / DS-I4 | Posible <3:1; foco poco visible (WCAG 2.4.11) | S | **HECHO** (`47f91e1`): `base.css` `:focus-visible{outline:2px solid var(--focus-ring)}`; `.input:focus` usa borde `--accent` sólido + ring `--focus-ring` (0.45–0.55), ya no `--accent-bg`. |
| TD-18 ✅ | **Touch targets densos** (`.icon-btn` 32px, gap 2px, 3 acciones/fila) | DS-I3 | **HECHO** (presente en repo): `components.css` tiene `@media (pointer: coarse) { .icon-btn { min-width: 44px; min-height: 44px; } }` — cumple WCAG 2.5.8 en táctil. |

---

## P2 · Media

| ID | Problema | Origen | Impacto | Esfuerzo | Recomendación |
|----|----------|--------|---------|----------|---------------|
| TD-19 ✅ | **Duplicación del andamiaje CRUD** en ~11 vistas | I-1 | Un cambio de UX obliga a editar 11 archivos | L | **HECHO** (`b7e2aa2`): `crud.js` con `guardedOp`/`guardedSave` — reemplaza 50+ bloques try/catch/toast en 10 vistas. |
| TD-20 ✅ | **Mapas paralelos `ENTITIES` y `WRITE`** | I-4 | Drift al añadir entidades | S | **HECHO** (`b7e2aa2`): acciones de escritura (create/update/remove) fusionadas en `ENTITIES`; eliminado mapa `WRITE`. |
| TD-21 ✅ | **`formatMoney` fuerza 0 decimales** para todas las divisas | F-6 | Oculta centavos en USD/cripto; *penny rounding mismatch* | S | **HECHO** (`b7e2aa2`): `CURRENCY_DECIMALS` en `format.js` — 0 COP, 2 USD/EUR, 8 BTC. |
| TD-22 ✅ | **Aritmética float para dinero** sin redondeo controlado | F-5 | Error acumulado en cripto/fracciones; umbrales sobre floats | M–L | **HECHO** (`b7e2aa2`): `roundMoney(amount, currency)` en `format.js`; aplicado en `investmentsValue`/`investmentsCost`. |
| TD-23 ✅ | **Snowball/Avalanche solo ordenan** (sin amortización) | F-7 | "Estrategias" no accionables (sin meses/intereses) | M | **HECHO** (Sprint 8 · `b7c0d4d`): `amortize()` en `debts.js` — cronograma mes a mes, intereses totales, fecha de cancelación. |
| TD-24 ✅ | **`repoUpdate_` hace 2 escaneos** (findRowIndex + repoGet) | GAS-I2 | Doble O(n) por update | S | **HECHO** (`dd68141`): lee la fila con `getRange(rowIndex, 1, 1, nCols)` — 1 operación Sheets, elimina `repoGet_`. |
| TD-25 ✅ | **`getDataRange().getValues()` carga todo** + sin paginación real | GAS-I5 | Lecturas O(n) crecientes; `getTransactions` lee todo y hace slice | M | **HECHO** (`dd68141`): `repoReadAll_` usa `getRange(2, 1, lastRow-1, nCols)` — salta cabecera, lee solo columnas del schema. |
| TD-26 ✅ | **Sin `batchWrite`** para la cola de sync | GAS-I6 | N invocaciones para N cambios offline | M | **HECHO** (`dd68141`): acción `batchWrite` en backend; `syncEngine` agrupa ≥2 ops con fallback op-a-op. |
| TD-27 ✅ | **Sin `LockService`** en escrituras | GAS-I3 | Carreras en multi-dispositivo / reintentos | S | **HECHO** (`dd68141`): `LockService.getScriptLock()` en `doPost` — exclusión mutua por ejecución. |
| TD-28 ✅ | **Soft-deletes nunca purgados** | GAS-I4 | Hojas crecen sin límite; lecturas más lentas | M | **HECHO** (`dd68141`): `purgeDeleted_()` en `Utils.gs`; acción POST `purgeDeleted`; botón en Ajustes. |
| TD-29 ✅ | **Dos sistemas de icon-button** (`.icon-btn` 32 vs `.btn--icon` 38) | DS-I1 | Inconsistencia de tamaño/estado | S | **HECHO** (`b7e2aa2`): `.icon-btn` unificado con `border`, `:focus-visible` y doc del sistema doble-tamaño. |
| TD-30 ✅ | **Variantes KPI duplicadas** (`--emerald`≡`--positive`, `--accent`≡`--info`) | DS-I2 | CSS redundante | S | **HECHO** (`b7e2aa2`): kpi--emerald y kpi--info unificados en reglas combinadas con alias CSS. |
| TD-31 ✅ | **Componentes del DS faltantes + botón "Buscar" muerto** | DS-I5 | Promesa de DS incompleta; control sin función | S (retirar botón) / L (implementar) | **VERIFICADO**: el botón muerto no existe en el código actual (el search es live-filter input en transacciones). |
| TD-32 ✅ | **CSS hardcoded en `exports.js`** (PDF) | DS-I6 | Estilos fuera de tokens; sin dark mode | S | **HECHO** (`dd68141`): documentado como *print stylesheet* intencional en comentario en `exports.js`. |

---

## P3 · Baja / Futuro

| ID | Problema | Origen | Recomendación |
|----|----------|--------|---------------|
| TD-33 | Reactividad de grano grueso (re-render total de la vista) | MF-1 / DS-MF6 | Suscripción por sección / `content-visibility` si escala. |
| TD-34 | `store.set` muta el patch y hace shallow-merge | MF-2 | Merge inmutable o documentar invariante. |
| TD-35 | Aporte a meta no genera transacción ni toca cuenta vinculada | F-12 | Integrar con el ledger cuando se resuelva TD-01. |
| TD-36 ✅ | Proyección de presupuesto lineal sobre-proyecta días 1–3 | F-13 | **HECHO** (`316911f`): `budgetStats` no proyecta cuando `day ≤ 3`; `projected = consumed` (sin alarma artificial los primeros días del mes). |
| TD-37 ✅ | Sin validación de solapamiento de presupuestos | F-14 | **HECHO** (`316911f`): `openBudgetModal` verifica antes de guardar que no exista otro presupuesto con la misma (categoryId, period, periodKey). Error inline en el campo categoryId. |
| TD-38 ✅ | Rentabilidad sin anualización (TWR/IRR) | F-15 | **HECHO** (`c94a5b5`): `selectors.xirr()` (Newton-Raphson), `selectors.cagr()`, `investmentXIRR()`, `investmentCAGR()`, `portfolioXIRR()`. 9 tests. |
| TD-39 | Recurrentes sin ejecución automática | F-16 / SessionState | Trigger que genere la tx al vencer y avance `nextRunDate`. |
| TD-40 | Theming con hex crudos; sin tokens de densidad; charts no responsive en altura; `font-size` SVG fijo; doble implementación FE/BE de la misma matemática | DS-MF1–7 / MF-3 / F-17 / GAS-MF1–6 | Higiene incremental del DS y del backend (caché, lotes, lecturas dirigidas). |

---

## Roadmap sugerido (por ROI)

**Sprint 0 — Quick wins (≈1–2 días, riesgo casi nulo)**
- TD-11 fix estado de sync (1 línea) · TD-12 unificar bucketing de meses (1 línea) · TD-05 `repoCreate_` sin relectura · TD-16 cachear `openById` · TD-06 self-host Inter · TD-03 excluir cuentas de inversión del patrimonio · TD-30 desduplicar KPI · TD-31 retirar botón "Buscar" muerto.

**Sprint 1 — Integridad de datos (P0 de fondo)**
- TD-01 decisión y refactor del modelo de saldos · TD-02 bloqueo de divisa única · TD-04 tests de selectores · TD-08 labels accesibles · TD-07 charts accesibles.

**Sprint 2 — Fiabilidad de sincronización**
- TD-10 dead-letter · TD-13 flush antes de pull · TD-14 atomicidad outbox · TD-15 `getBootstrap` · TD-26 `batchWrite`.

**Sprint 3 — Mantenibilidad y escala**
- TD-19 factorías CRUD · TD-20 unificar ENTITIES/WRITE · TD-22/TD-21 precisión monetaria · TD-24/TD-25/TD-27/TD-28 backend (rangos, lock, purga).

**Continuo**
- TD-09 vigilancia del token · P3 según necesidad.

---

---

## TD nuevos — Auditoría 2026-06-03 (TD-41…TD-53)

> Incorporados tras la auditoría global del 2026-06-03. Ver `docs/Audit-Global-2026-06-03.md`.

### P0 · Crítica (nuevos)

| ID | Problema | Origen | Impacto | Esf | Estado |
|----|----------|--------|---------|-----|--------|
| TD-41 ✅ | **`computeNetWorth_` desincronizado de Sprint 5** — suma lotes vendidos, ignora comisión y FX | FIN-001 | Patrimonio backend ≠ FE; PDF/snapshots incorrectos | M | **HECHO** (`8751f9a`): filtra `!soldDate && !isDeleted`, suma `commission`, FX best-effort. `Reports.gs` **desplegado** (2026-06-09). También incluye fix R0-A: `ccDebt`/`liabilitiesDebt` expuestos (`9657ea3`). |
| TD-42 ✅ | **`withholdingRate` decorativa** — capturada y mostrada pero nunca aplicada al P&L | FIN-002 | Usuario cree ver P&L neto; es bruto (+~4% sesgo) | M | **HECHO** (`4073ddf`): `applyWithholding()` en `selectors.js`; descuenta ganancia realizada al vender. Tests incluidos. |
| TD-45 ✅ | **`idempotentHit_` resucita registros soft-deleted** — devuelve hit borrado como válido | BE-001 | Saldo nunca aplicado + registro fantasma | S | **HECHO** (`45b47ec`): guard `if (hit.isDeleted) return null`. `Utils.gs` **desplegado** (2026-06-09). |
| TD-46 ✅ | **Doble conteo de saldo en `update` de tx offline** — `_adjustAccountBalances` no idempotente | BE-002 | Saldo local divergente en multi-edición offline | M | **HECHO** (`b23a4f6`): `_recalcAccountBalance` recalcula desde IndexedDB (idempotente) en lugar de ajustar con deltas. |

### P1 · Alta (nuevos)

| ID | Problema | Origen | Impacto | Esf | Estado |
|----|----------|--------|---------|-----|--------|
| TD-43 ✅ | **Ventas parciales imposibles** — `soldQuantity`=qty comprada; comisión mal prorrateada | FIN-003/004 | Liquidación siempre total; P&L realizado incorrecto en ventas parciales | M | **HECHO** (`f1f1bd0`+`a8dec52`): modal con campo qty, parcial/total, `lotRealizedPnL` prorateado. |
| TD-44 ✅ | **`cdtCurrentValue` sobrevalora CDT** — capitaliza sobre `totalCost` (incl. comisión) sin tope en vencimiento | FIN-008 | CDT sobrevalorado; sigue creciendo tras vencer | S | **HECHO** (`a8dec52`): capitaliza sobre `quantity` (capital puro), topa en `maturityDate`. |
| TD-47 ✅ | **`reconcileAndHydrate` reduce `update` a su patch** — `db.put(store, op.data)` reemplaza el registro entero | BE-004 | Pérdida temporal de campos tras refresh con update pendiente | S | **HECHO** (`7a4c43e`): merge `{...existing, ...op.data}` para ops `update`. |
| TD-48 ✅ | **Inyección de markup en SVG de charts** — labels de usuario interpolados crudos en `<title>`/`aria-label` | FE-001 | Donut/LineChart roto con `&<>"` en nombre de categoría | S | **HECHO** (`b78eff6`): `esc()` en `dom.js`, aplicado en todos los `<title>` y `aria-label` de charts. |
| TD-49 ✅ | **`aria-label` técnico sobrescribe label visible** — regresión de TD-08 en `forms.js` | FE-003 | Lector anuncia "amount"/"categoryId"; WCAG 2.5.3/4.1.2 | S | **HECHO** (`b78eff6`): `aria-label` removido de `textInput`/`select`; solo como param opcional. |

### P2 · Media (nuevos)

| ID | Problema | Origen | Impacto | Esf | Estado |
|----|----------|--------|---------|-----|--------|
| TD-50 ✅ | **`id_token` en querystring GET** — viaja en URL; queda en logs/historial/proxy | SEC-001 | Fuga de token de sesión (TTL 1h) | M | **HECHO** (`7242f95`): `apiClient.js` usa siempre POST — `idToken` viaja en body JSON, nunca en URL. `Code.gs` **desplegado** (2026-06-09). |
| TD-51 ✅ | **`verifyGoogleToken_` sin validar `iss` ni `exp` explícito** | SEC-002 | Falta defensa en profundidad estándar GIS | S | **HECHO** (`7242f95`): `Auth.gs` valida `iss ∈ {accounts.google.com, https://…}` y `exp > now` antes de las comprobaciones de email/aud. `Auth.gs` **desplegado** (2026-06-09). |
| TD-52 ✅ | **`goalForecast` usa `monthlySavingsAvg` global** — cada meta reclama el 100% del ahorro | FIN-011 | Fechas de cumplimiento optimistas con N metas activas | M | **HECHO** (`0fcb1ab`): `savingsPerGoal = avg / activePending.length`; cada meta recibe su cuota proporcional. |
| TD-53 ✅ | **`monthlySavingsAvg` no excluye meses sin datos** — diluye el promedio en histórico corto | FIN-012 | Forecast subestimado para usuarios nuevos | S | **HECHO** (`0fcb1ab`): filtra `active = cf.filter(m => m.income>0 || m.expense>0)` antes de promediar. |

---

## TD nuevos — Sprint A 2026-06-09 (TD-54)

### P2 · Media

| ID | Problema | Origen | Impacto | Esf | Estado |
|----|----------|--------|---------|-----|--------|
| TD-54 | **Transacciones en divisa extranjera suman 1:1** en `monthlyIncome/Expense`, `cashflow` y presupuestos — convertir bien exige tasa histórica a la fecha de la tx, no la actual | Sprint A residual (FIN-005) | Flujo de caja/presupuestos distorsionados si hay tx en USD/EUR | M | Pendiente — requiere diseño propio (fuente de tasas históricas). Mitigación: `fxGaps()`/`hasMixedCurrencies` permiten flaggear en UI. Quick win asociado: Dashboard aún no consume `fxGaps` para aviso global (Inversiones sí tiene aviso propio). |

---

## Documentos relacionados

- `docs/Audit.md` · `docs/Audit-Financiero.md` · `docs/Audit-Frontend.md` · `docs/Audit-Backend.md`
- `docs/Audit-Global-2026-06-03.md` · `docs/Bugs-Criticos-2026-06-03.md` · `docs/QuickWins-2026-06-03.md`
- `docs/Roadmap-Implementacion-2026-06-03.md` — roadmap activo (9 sprints)
- `docs/SessionState.md` — estado operativo · `CLAUDE.md` — fuente de verdad.
