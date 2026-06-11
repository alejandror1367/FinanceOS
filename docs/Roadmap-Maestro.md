# Roadmap Maestro — FinanceOS

**Generado:** 2026-06-09
**HEAD:** `ab655cb` (fix snapshot idempotencia por fecha)
**SW:** `v0.2.43` (ver `sw.js`)
**Tests:** 104/104 pasando (22 suites · `node --test tests/selectors.test.js`)
**Fuentes consolidadas:**
- `docs/Roadmap-Implementacion-2026-06-02.md` (Sprints 1–9, histórico)
- `docs/Roadmap-Implementacion-2026-06-03.md` (Sprints A–I de la 2ª auditoría)
- `docs/Roadmap-Revisado-Opus.md` (R0–R8, revisión arquitectónica)
- `docs/Auditoria-Estrategica-Revisada-Opus.md` (hallazgos verificados)
- `docs/TechnicalDebt.md` (TD-01…TD-53)
- `PROJECT_HANDOFF.md` (estado real del repo)
- `CLAUDE.md` (invariantes)

> **Este documento es la única fuente de verdad para planificación.**
> Los roadmaps anteriores quedan como histórico. Se actualiza en cada `/handoff`.
> Todo ítem mantiene su ID de hallazgo para trazabilidad.

---

## 1. Resumen ejecutivo

### Qué está hecho (completado y desplegado)

| Área | Items resueltos |
|---|---|
| Deuda P0/P1/P2 original (TD-01…TD-40) | ✅ Todos resueltos |
| R0 — Pre-flight + FE/BE pasivos CC | ✅ 5 `.gs` desplegados · fix `computeNetWorth_` · `ccDebt`/`liabilitiesDebt` expuestos |
| R1 — FIRE enriquecido + insights | ✅ Fecha FIRE · ProgressBar · variantes Lean/Fat/Barista · EmptyState · liquidityCoverageMonths · savingsStreak · 3 insights |
| R2 — Dismiss de pagos | ✅ dismissService · botón "Visto" en today.js y dashboard.js |
| R3 — Snapshots enriquecidos | ✅ 6 campos desglose en Config.gs · NetWorth.gs · networth.js muestra desglose |
| R4 — Alertas determinísticas | ✅ portfolioAlerts + positionValue en selectors.js + tests |
| R5 — Seguridad | ✅ Auth.gs valida iss/exp · logAccessDenied_ con rate-limit · Import.gs trunca fileContent · apiClient.js usa POST |
| Snaphot fixes | ✅ Idempotencia por fecha · usa precios en vivo del frontend |
| Dashboard paridad | ✅ investmentsSummary = sección Inversiones |
| CDT en selectores | ✅ investmentsValue y positionValue usan cdtCurrentValue |

### Qué queda (sprints pendientes)

Sprints A–J detallados en §4. Estimación total: **~18–22 días de desarrollo** + varios deploys de backend.

**Camino crítico de valor:** A → B → C (paralelo con B) → E → F → G → H → I → J (últimos dos opcionales).

### Criterios de "listo para v1.0"

Ver §5.

---

## 2. Estado de la deuda técnica

| Rango | Total | Resueltos | Pendientes |
|---|---|---|---|
| TD-01 … TD-09 (P0 original) | 9 | 9 ✅ | 0 |
| TD-10 … TD-18 (P1 original) | 9 | 9 ✅ | 0 |
| TD-19 … TD-32 (P2 original) | 14 | 14 ✅ | 0 |
| TD-33 … TD-40 (P3) | 8 | 4 ✅ | 4 abiertos (TD-33, TD-34, TD-35, TD-39) |
| TD-41 … TD-53 (auditoría 2026-06-03) | 13 | 13 ✅ | 0 |

**TD abiertos de baja prioridad:** TD-33 (reactividad grano grueso), TD-34 (store.set mutable), TD-35 (aporte a meta fuera del ledger), TD-39 (recurrentes sin ejecución automática).

---

## 3. Sprints completados (histórico comprimido)

| Sprint | Objetivo | Fecha aprox. | Items clave |
|---|---|---|---|
| Sprints 1–4 (2026-06-02) | Bugs críticos · integridad financiera · sync · patrimonio visual | Jun 02 | import.js funcional · computeNetWorth_ CC · normPeriodKey · snapshots CRUD |
| Sprint 5 (2026-06-02) | Inversiones avanzadas | Jun 02 | withholding · comisiones · indicadores |
| Sprints 6–8 (2026-06-03) | UX/UI · performance · analítica avanzada | Jun 03 | tooltips · Command Palette · amortize · XIRR/CAGR · goalForecast |
| Sprint 9 QA (2026-06-03) | QA Playwright + v1.0 pulido | Jun 03 | 15/15 rutas PASS · proyección suavizada · validación solapamiento |
| Post-audit fixes (Jun 03–08) | 7 defectos de sync/cifras descubiertos en 2ª auditoría | Jun 03–08 | TD-41…53 todos resueltos · selectors correctos |
| R0 Pre-flight (2026-06-09) | Despliegue backend + fix FE/BE CC + docs | Jun 09 | 5 .gs desplegados · paridad testada · TD-01 ✅ |
| R1 FIRE + insights (2026-06-09) | UX FIRE + 3 insights corregidos | Jun 09 | fecha FIRE · variantes · liquidityCoverageMonths · savingsStreak |
| R2 Dismiss (2026-06-09) | Dismiss hasta próxima ocurrencia | Jun 09 | dismissService · "Visto" en today/dashboard |
| R3 Snapshots enriquecidos (2026-06-09) | 6 campos desglose patrimonial | Jun 09 | Config.gs + NetWorth.gs + networth.js · deploy |
| R4 Alertas portafolio (2026-06-09) | portfolioAlerts determinísticas | Jun 09 | positionValue · 4 reglas de alerta · tests |
| R5 Seguridad (2026-06-09) | Defensa en profundidad OAuth + import | Jun 09 | iss/exp · rate-limit · truncar fileContent · POST |

---

## 4. Sprints pendientes (roadmap activo)

> Orden de ejecución: P0 primero, luego P1, P2, P3.
> Dentro de igual prioridad: quick wins (S) antes que esfuerzo M/L.
> Tareas que requieren deploy de `.gs` marcadas con "deploy". El deploy lo hace el dueño manualmente.

---

### Sprint A — Integridad de cifras maestras (P0) ✅ COMPLETADO 2026-06-09

> **Estado:** A.1/A.4/A.5/A.6 ya estaban resueltos (TD-45/41/42/46). A.2/A.3/A.7 implementados en
> commits `f7e1330` + `34383ff` + `d77e1f5` — 136/136 tests. ⚠ **Deploy pendiente:** `Quotes.gs`,
> `Code.gs`, `Reports.gs`. Residual documentado como **TD-54** (tx en divisa con tasa histórica).

**Objetivo:** eliminar los errores silenciosos de cifras que aún persisten tras R0–R5.
**Prioridad:** P0 — cifras financieras incorrectas.
**Riesgo:** medio (toca selectores y backend; exige tests y deploy).
**Deploy:** sí (parcial — backend FX y computeNetWorth_).
**Dependencias:** ninguna (sprint autónomo).
**Esfuerzo estimado:** ~3–4 días.

| # | Tarea | ID origen | Archivo | Esf | Deploy |
|---|---|---|---|---|---|
| A.1 | Guard `if (hit.isDeleted) return null` en `idempotentHit_` (no resucitar soft-deletes) | BE-001 / TD-45 | `backend/Utils.gs:177-181` | S | ✅ |
| A.2 | FX rates en backend: acción `getFxRates` o incluir `USDCOP=X`/`EURCOP=X` en `getQuotes` para que `computeNetWorth_` convierta divisas | BE-003 / TD-02 | `backend/Quotes.gs` | M | ✅ |
| A.3 | `priceService` consume FX del backend; excluir/flaggear posición sin tasa en lugar de sumar 1:1 silencioso | FIN-005 / TD-02 | `src/services/priceService.js`, `src/store/selectors.js` | M | — |
| A.4 | `computeNetWorth_`: filtrar `!soldDate && !isDeleted`, sumar comisión, aplicar FX — paridad completa con FE | FIN-001 / TD-41 | `backend/Reports.gs` | M | ✅ |
| A.5 | Aplicar `withholdingRate` al P&L realizado en backend (restar sobre ganancia al vender) | FIN-002 / TD-42 | `src/views/investments.js`, `src/store/selectors.js` | M | — |
| A.6 | Ajuste de saldo local idempotente en `update` de tx (forzar `_recalcAccountBalance` o `pullData()` tras flush) | BE-002 / TD-46 | `src/services/dataService.js:233-248` | M | parcial |
| A.7 | Tests: FX con/sin tasa, exclusión de lotes vendidos, P&L neto de retención, paridad FE/BE con dataset completo | FIN-001/002/005 | `tests/selectors.test.js` | M | — |

**Criterio de aceptación:**
- `patrimonio_fe === patrimonio_be ± 0` con dataset incl. inversiones USD, CC y lotes vendidos.
- `node --test` verde (≥ 104 tests).
- Sin suma de divisas 1:1 silenciosa en ninguna ruta de código.

**Nota:** A.1 y A.4 pueden ya estar parcialmente resueltos (TD-45 y TD-41 marcados ✅ en TechnicalDebt.md). Verificar en git log antes de re-implementar.

---

### Sprint B — Inversiones: ventas parciales y valoración (P1) ✅ COMPLETADO (2026-06-10)

**Objetivo:** cerrar la deuda que dejó la auditoría 2026-06-03 en el flujo de venta y renta fija.
**Prioridad:** P1 — bug activo en flujo de venta.
**Estado:** B.1–B.3 ✅ (TD-43/44) · B.4 ✅ `14bb7dc` · B.5 ✅ (suite). Siguiente: Sprint C (WCAG).
**Riesgo:** bajo-medio (lógica aislada en investments.js, cubierta por tests nuevos).
**Deploy:** no.
**Dependencias:** ninguna (puede ir en paralelo con C).
**Esfuerzo estimado:** ~1.5–2 días.

| # | Tarea | ID origen | Archivo | Esf | Deploy |
|---|---|---|---|---|---|
| B.1 | Modal de venta pide **cantidad a vender**; `soldQuantity = min(qtySolicitada, qtyLote)`; lote remanente visible | FIN-003 / TD-43 | `src/views/investments.js:118-124` | M | — |
| B.2 | `realizedPnL`: prorratear comisión de compra `× (qtyVendida/qtyLote)` y `soldCommission` por lo vendido | FIN-004 / TD-43 | `src/views/investments.js:79-83` | S | — |
| B.3 | `cdtCurrentValue`: capitalizar sobre capital puro (sin comisión) y topar `days` a vencimiento (`maturityDate`) | FIN-008 / TD-44 | `src/views/investments.js:130-135` | S | — |
| B.4 ✅ | `roundMoney(v, currency)` en acumulados y totales de la vista Inversiones (evitar penny drift) | FIN-009 / TD-21 | `src/views/investments.js:620-640` | S | ✅ `14bb7dc` (acumulados por sección) |
| B.5 ✅ | Tests: venta parcial, venta total, CDT capitalizado correctamente, P&L con comisión prorrateada | FIN-003/004/008 | `tests/selectors.test.js` | M | ✅ suites `lotRealizedPnL`, `cdtCurrentValue` |

**Criterio de aceptación:**
- Venta de 50 de 100 acciones genera lote remanente de 50 con costBasis proporcional.
- CDT de $1M al 10% EA a 180 días vale ≈ $1.048M a mitad; no crece después del vencimiento.
- `node --test` verde.

**Nota:** TD-43 y TD-44 están marcados ✅ en TechnicalDebt.md. Verificar en git log antes de re-implementar.

---

### Sprint C — Accesibilidad y Design System (WCAG 2.2 AA) (P1/P2) ✅ COMPLETADO (2026-06-10)

**Objetivo:** conformidad AA y limpieza de DS. Casi todo esfuerzo S, sin deploy.
**Prioridad:** P1 (contraste, nombres accesibles) / P2 (higiene DS).
**Riesgo:** muy bajo.
**Deploy:** no.
**Dependencias:** ninguna (puede ir en paralelo con B).
**Estado:** C.1–C.10 ✅. C.1/C.2/C.3/C.5/C.6/C.7/C.8/C.9 ya estaban hechos en sesiones previas; C.4 y C.10 cerrados esta sesión (`c8be635`, `66f7b5a`).

| # | Tarea | ID origen | Archivo | Esf | Deploy |
|---|---|---|---|---|---|
| C.1 ✅ | Subir luminancia de `--text-tertiary` (dark + light) hasta ≥ 4.5:1 | FE-002 / TD-40 | `src/styles/themes.css:37,91` | S | ✅ previo |
| C.2 ✅ | Quitar `aria-label` técnico de `textInput`/`select` (restaurar nombre visible al lector de pantalla) | FE-003 / TD-49 | `src/components/forms.js` | S | ✅ `b78eff6` |
| C.3 ✅ | Escapar `&<>"` en `<title>` y `aria-label` de charts (`esc()` de dom.js) | FE-001 / TD-48 | `src/components/charts.js` | S | ✅ `b78eff6` |
| C.4 ✅ | `@media (prefers-reduced-motion: reduce)` que anule duraciones de keyframes (regla universal WAI para keyframes con duración literal) | FE-004 / TD-40 | `src/styles/tokens.css:143-157` | S | ✅ `c8be635` |
| C.5 ✅ | `ProgressBar`: añadir `aria-valuemin`, `aria-valuemax`, `aria-label` | FE-007 / TD-40 | `src/components/ui.js:106` | S | ✅ previo |
| C.6 ✅ | `confirmDialog`: fallback de foco al botón submit o al contenedor si no hay input | FE-006 | `src/components/modal.js:80-90` | S | ✅ previo |
| C.7 ✅ | Reemplazar literales `10px`/`11px` por `var(--fs-micro)` en components.css | FE-009 / TD-40 | `src/styles/components.css` | S | ✅ previo (sin font-size px) |
| C.8 ✅ | `.preset-chip:hover` → usar `var(--accent-contrast)` (quitar hex crudo) | FE-010 / TD-40 | `src/styles/components.css:564` | S | ✅ previo |
| C.9 ✅ | `select`: añadir `padding-right` suficiente para que la flecha nativa no solape texto largo | FE-008 / TD-40 | `src/styles/components.css:282-283` | S | ✅ previo |
| C.10 ✅ | Fix truncamiento de label "Tema"/"Apariencia" en Ajustes (aparecía como "T…") | FE-013 | `src/views/settings.js:32-47` | S | ✅ `66f7b5a` |

**Criterio de aceptación:**
- `--text-tertiary` en dark y light pasa contraste 4.5:1 (verificable con DevTools).
- ProgressBar anuncia su valor correctamente con lector de pantalla.
- No quedan hex crudos en `.preset-chip:hover`.
- `node --test` verde.

**Nota:** C.2 (TD-49) y C.3 (TD-48) están marcados ✅ en TechnicalDebt.md. Verificar en git log.

---

### Sprint D — Cuentas remuneradas (P1) ✅ COMPLETADO Y DESPLEGADO (2026-06-10)

**Objetivo:** soportar Global66/RappiCuenta con cálculo de rendimiento financieramente correcto.
**Prioridad:** P1 (fórmula incorrecta infla patrimonio).
**Riesgo:** P1 sin rediseño de fórmula (ver hallazgo C3 en Auditoria-Estrategica-Revisada-Opus.md).
**Deploy:** sí.
**Dependencias:** ninguna, pero la implementación NO arranca hasta tener fórmula correcta (D.1 es bloqueante).
**Estado:** D.1–D.6, D.8 ✅ (`4ec3836`, `9cc4fd6`, `28ebde0`, `1f05f94`). **D.7 deploy pendiente del dueño.**

| # | Tarea | ID origen | Archivo | Esf | Deploy |
|---|---|---|---|---|---|
| D.1 ✅ | **`calcYield`** sobre saldo PROMEDIO ponderado por tiempo (NO balance actual); `accountAvgBalance` reconstruye saldo histórico; fórmula EA compuesta | C3 / Opus | `src/store/selectors.js` | M | — |
| D.2 ✅ | Schema `Accounts`: `lastYieldDate` al final (append-only) + `interestRate` anotado como EA | Opus Sprint 5 | `backend/Config.gs` | S | ✅ |
| D.3 ✅ | Badge "X% EA" si savings/bank con `interestRate > 0` + campo tasa en el form | Opus Sprint 5 | `src/views/accounts.js` | S | — |
| D.4 ✅ | Modal "Registrar rendimiento": preview → confirmar → tx ingreso + `lastYieldDate`; idempotencia por período (lastYieldDate) | Opus Sprint 5 | `src/views/accounts.js` | M | — |
| D.5 ✅ | Fuente única: rendimiento = 1 tx `income` que sube el saldo una vez (sin doble conteo con liquidez) | R10 / Opus | `src/views/accounts.js` | S | — |
| D.6 ✅ | Preset `RappiCuenta` (savings, 9 EA, COP); presets pueden fijar `interestRate` | Opus Sprint 5 | `src/views/accounts.js` | S | — |
| D.7 ✅ | Deploy `Config.gs`; `setupDatabase()` ejecutado → columna `lastYieldDate` creada (2026-06-10) | backend | — | M | ✅ |
| D.8 ✅ | Tests `calcYield`/`accountAvgBalance`/`txEffectOnAccount`: saldo constante, depósito/retiro intra-período, tasa 0, período inválido (+12) | Opus Sprint 5 | `tests/selectors.test.js` | M | — |

**Criterio de aceptación:**
- ✅ `calcYield` usa saldo promedio ponderado por tiempo: con −900K el día 16 sobre saldo final 100K, el interés se calcula sobre ~550K (promedio), no sobre 100K (actual) ni sobre el pico. (La cifra "~950K" del criterio original era ilustrativa; el método correcto es el saldo promedio del período.)
- ✅ Idempotencia: tras registrar, `lastYieldDate = hoy` → un segundo registro el mismo período estima $0 y se bloquea.
- ✅ `node --test` verde (148/148).

> **✅ DEPLOY HECHO (D.7, 2026-06-10):** `backend/Config.gs` desplegado y `setupDatabase()` ejecutado;
> la columna `lastYieldDate` ya existe en la hoja Accounts. `lastYieldDate` sincroniza FE↔BE.

---

### Sprint E — Deudas y Metas (P1/P2) ✅ COMPLETADO (2026-06-10) · sin deploy

**Objetivo:** estrategias de deuda y forecasts de metas financieramente realistas.
**Prioridad:** P1 (avgRate en divisas incorrecta), P2 (amortización, forecasts).
**Estado:** E.1–E.6 ✅. E.1/E.2/E.4/E.5 ya estaban hechos en sesiones previas; E.3 (extraído a selector `goalSavingsSplit`) y E.6 (tests sameMonth + reparto) cerrados esta sesión (`ee27d5b`).

| # | Tarea | ID origen | Archivo | Esf | Deploy |
|---|---|---|---|---|---|
| E.1 ✅ | `avgRate`: pondera tasas sobre saldos convertidos a base (COP) — multi-moneda | FIN-006 / TD-02 | `src/store/selectors.js:debtStats` | S | — |
| E.2 ✅ | `amortize()` con `paymentPct`/`paymentFloor` + `chainedPayoff` Snowball/Avalanche | FIN-007 / TD-23 | `src/store/selectors.js` | M | — |
| E.3 ✅ | Reparto del ahorro entre metas activas → selector `goalSavingsSplit` (`avg / N`) | FIN-011 / TD-52 | `src/store/selectors.js` · `src/views/goals.js` | M | — |
| E.4 ✅ | `monthlySavingsAvg`: promedia solo meses con actividad (`income>0 || expense>0`) | FIN-012 / TD-53 | `src/store/selectors.js` | S | — |
| E.5 ✅ | `sameMonth`: normaliza `ref` string con `slice(0,7)` (exportado para test) | FIN-010 / TD-12 | `src/store/selectors.js:15` | S | — |
| E.6 ✅ | Tests: amortización %, chained Snowball, reparto N metas, savingsAvg meses vacíos, sameMonth | FIN-006/007/011/012/010 | `tests/selectors.test.js` | M | — |

**Criterio de aceptación:**
- ✅ "Fecha libre de deudas" Snowball correcta con dos deudas encadenadas (suite `chainedPayoff`).
- ✅ Dos metas activas reciben la mitad del ahorro mensual cada una (`goalSavingsSplit` → 600K/2 = 300K).
- ✅ `sameMonth('2026-06', new Date(2026,5,15))` retorna `true`.
- ✅ `node --test` verde (155/155).

---

### Sprint F — Import/Export mejorado (P2) ✅ COMPLETADO (2026-06-10) · sin deploy · F.5 diferido

**Objetivo:** robustez del módulo crítico de integridad y exportabilidad total.
**Estado:** auditoría completa del módulo + F.1–F.4/F.6 ✅ (`30d9c9b`, `b85427f`). La auditoría destapó y corrigió 4 bugs P0/P1 no listados (ver abajo). **F.5 diferido** (sin extracto RappiCuenta de muestra — sería adivinar el formato; el filename `/rappi/i` ya matchea el perfil RappiPay).

| # | Tarea | ID origen | Archivo | Esf | Deploy |
|---|---|---|---|---|---|
| F.1 ✅ | Fixtures de regresión SINTÉTICOS de los 6 perfiles (24 tests: detect+map+applyProfile+dupKey+toCSV) | Opus Sprint 6 | `tests/import.test.js` | M | — |
| F.2 ✅ | `dupKey` = `date\|amount\|descNorm(16)` en importService (testeable) | Opus Sprint 6 | `src/services/importService.js` | S | — |
| F.3 ✅ | Pantalla final con resumen de calidad: filas fallidas + % categoría automática (alerta >30%) | Opus Sprint 6 | `src/views/import.js` | S | — |
| F.4 ✅ | `applyProfile` filtra filas sin fecha/monto válido (`skipped` visible en el meta) | Opus Sprint 6 | `src/services/importService.js` | S | — |
| F.5 🔵 | Perfil `RappiCuenta` — DIFERIDO hasta tener extracto de muestra real | Opus Sprint 6 | `bankProfiles.js` | S | — |
| F.6 ✅ | Card "Transacciones por período": desde/hasta + contador en vivo + export CSV del rango | Opus Sprint 6 | `src/views/exports.js` | M | — |

**Bugs corregidos por la auditoría (no estaban en el roadmap):**
- **IMP-1/IMP-3 (P0):** todo INGRESO importado iba sin `categoryId` (y el match por nombre ignoraba `kind`) → el backend lo rechazaba → dead-letter silencioso. Fix: `resolveCategoryId` kind-aware con fallback.
- **IMP-2 (P0):** transferencias importadas sin `toAccountId` (Global66 mapeaba todo a transfer) → rechazo backend garantizado. Fix: conversión por signo + perfil Global66 a income/expense.
- **ORDEN de perfiles (P1):** el CSV del prompt de Claude se detectaba como Bancolombia (perdía tipo/categoría) salvo filename "financeos". Fix: financeos primero.
- **EXP-1 (P1):** `toCSV` solo usaba las claves de la primera fila → columnas perdidas (p. ej. `toAccountId`) en TODO export. Fix: unión de claves.
- **IMP-4 (P1):** import XTB creaba N gastos de $0 en la primera cuenta. Fix: filtro F.4.

**Criterio de aceptación:**
- ✅ Los 6 perfiles parsean los fixtures sin regresiones (24/24).
- ✅ Filas con monto cero se omiten antes del preview y se reportan ("N filas sin monto omitidas").
- ✅ Export con rango de fechas incluye solo transacciones del período (contador en vivo).

**Pendientes del módulo (futuro):** restore del backup JSON (hay export, no import del respaldo) · XTB→posiciones de inversión reales (riesgo doble conteo, decisión aparte) · F.5 con muestra real.

---

### Sprint G — Backend: performance y robustez de sync (P2) ✅ COMPLETADO Y DESPLEGADO (2026-06-10)

**Objetivo:** quitar O(n) de hot paths y blindar la cola de sync contra condiciones de carrera.
**Estado:** G.1–G.7 ✅. G.1–G.6 ya estaban implementados en sesiones previas (verificado en código); **G.7 cursor cerrado esta sesión** (`bdde64a`) — antes solo estaba la ventana de 24m; faltaba la paginación por cursor (estaba diferida).

| # | Tarea | ID origen | Archivo | Esf | Deploy |
|---|---|---|---|---|---|
| G.1 ✅ | `repoReadAll_` cacheado por request + `repoGet_`/`repoFindRowIndex_` puntual en `adjustBalance_` | BE-005 / TD-05,24 | `backend/Accounts.gs:73`, `Utils.gs:115` | M | ✅ |
| G.2 ✅ | `reconcileAndHydrate`: merge `{...existing, ...op.data}` para ops `update` | BE-004 / TD-47 | `src/services/dataService.js:89` | S | — |
| G.3 ✅ | `flushBatch`: empareja respuestas por `entityId` (no por índice) | BE-010 / TD-26 | `src/services/syncEngine.js:76` | S | — |
| G.4 ✅ | `isTransient`: errores de negocio/"No autorizado" → dead-letter (no reintenta) | BE-011 / TD-10 | `src/services/syncEngine.js:40` | S | — |
| G.5 ✅ | `purgeDeleted_`: reconstruye la hoja en bloque (`clearContent`+`setValues`) | BE-007 / TD-28 | `backend/Utils.gs:236` | M | ✅ |
| G.6 ✅ | `truncateAuditLog_`: archiva entradas > 90 días en bloque | BE-008 / TD-05,28 | `backend/Audit.gs:34` | M | ✅ |
| G.7 ✅ | Cursor opt-in en `getTransactions` (`{items,nextCursor}`) + ventana 24m en `getBootstrap_` | BE-006 / TD-25 | `backend/Transactions.gs:14`, `Reports.gs:228` | L | ✅ |

**Criterio de aceptación:**
- ✅ `adjustBalance_` usa `repoGet_` sobre caché por request (sin O(n) por escritura tras la 1ª lectura).
- ✅ `truncateAuditLog_` deja solo los 90 días recientes (acción admin `truncateAuditLog`).
- ✅ `getTransactions` con `paginate=true` devuelve `nextCursor` para la siguiente página.

> **✅ DEPLOY HECHO (G.7, 2026-06-10):** `backend/Transactions.gs` en producción. Cambio aditivo y
> retrocompatible (sin `paginate`/`cursor` devuelve el array de siempre); `getBootstrap_` y clientes actuales intactos.

---

### Sprint H — Charts responsive y a11y avanzada (P2) ✅ COMPLETADO (2026-06-10) · sin deploy

**Objetivo:** charts legibles en móvil y accesibles por teclado.
**Estado:** H.1–H.3 ✅. H.1 y H.2 ya estaban implementados en sesiones previas; **H.3 cerrado esta sesión** (`82b913a`).

| # | Tarea | ID origen | Archivo | Esf | Deploy |
|---|---|---|---|---|---|
| H.1 ✅ | Rotación (n>6) + decimación (n>8) de labels eje X · `font-size` en unidades del viewBox (escala con el ancho) · `height:auto` | FE-005 / TD-40 | `src/components/charts.js:58-105` | M | — |
| H.2 ✅ | Tablas `sr-only` con valores por serie/segmento (`buildLineSrTable`/`buildDonutSrTable`) | FE-011 / TD-07 | `src/components/charts.js:12,32` | M | — |
| H.3 ✅ | Bottom-nav móvil = Dashboard·Hoy·Transacciones·Inversiones·Ajustes (preferencia del dueño); resto vía ☰ y ⌘K | FE-012 | `src/core/routes.js:49-53` | S | — |

**Criterio de aceptación:**
- ✅ En viewport 375px LineChart rota labels (n>6) y decima (n>8) → no solapan.
- ✅ LineChart y Donut adjuntan `<table class="sr-only">` con valores por serie/segmento.
- ✅ Bottom-nav móvil expone 5 rutas (Dashboard·Hoy·Transacciones·Inversiones·Ajustes).

---

### Sprint I — QA en vivo + pulido v1.0 (P2/P3) ✅ COMPLETO (2026-06-10) · I.1 ejecutado con sesión real

**Objetivo:** completar QA automatizado y cerrar P3 de presupuestos y documentación.
**Estado:** I.1–I.5 ✅. I.1 ejecutado 2026-06-10 con la sesión OAuth real del dueño (GIS silent refresh en el browser Playwright): 16 rutas (15 + `#/fire`) × desktop/375px × light/dark = 64 combinaciones, **0 errores JS · 0 fallos de red** (solo warning GSI/FedCM benigno). Hallazgos visuales menores registrados como **TD-55/TD-56** (overflow horizontal a 375px en budgets/goals y transactions/exports).

| # | Tarea | ID origen | Archivo | Esf | Deploy |
|---|---|---|---|---|---|
| I.1 ✅ | Re-lanzar Playwright: 15 rutas, responsive 375px, dark/light, sin errores JS/red — **PASS 2026-06-10** (64 combinaciones, 0 errores; TD-55/56 visuales) | QA en vivo | — | M | — |
| I.2 ✅ | Proyección de presupuesto: no proyecta cuando `day ≤ 3` (`projected = day>3 ? (consumed/day)*diasMes : consumed`) | TD-36 | `src/store/selectors.js:424-432` | S | — |
| I.3 ✅ | Solapamiento de presupuestos: `(categoryId, period, periodKey)` único, error inline | TD-37 | `src/views/budgets.js:105-113` | S | — |
| I.4 ✅ | Housekeeping `TechnicalDebt.md`: TD-11 marcado resuelto (SyncPill); TD-54 nota de mitigación actualizada (banner fxGaps) | housekeeping | `docs/TechnicalDebt.md` | S | — |
| I.5 ✅ | `PROJECT_HANDOFF.md` + roadmap + checklist v1.0 al estado real | docs | `docs/` | S | — |

**Criterio de aceptación:**
- ✅ Playwright 15/15 sin errores JS, 375px, dark/light — **PASS (I.1, 2026-06-10)**.
- ✅ No hay bug P0/P1 abierto en el código (los únicos abiertos son TD-54 P2 y verificaciones en vivo).

---

### Sprint J — Avanzado y limpieza P3 (P3, opcional)

**Objetivo:** métricas avanzadas, narrativa IA y endurecimientos de bajo costo.
**Prioridad:** P3 (si hay holgura).
**Riesgo:** bajo (J.1–J.2); medio (J.3 — IA + privacidad + lock de scripts).
**Deploy:** parcial (J.2: deploy; J.3: deploy).
**Dependencias:** J.3 depende del Sprint A (alertas listas como contexto para la narrativa).
**Esfuerzo estimado:** ~2–3 días.

| # | Tarea | ID origen | Archivo | Esf | Deploy |
|---|---|---|---|---|---|
| J.1 | XIRR/CAGR por posición y portafolio (métrica avanzada de rentabilidad anualizada) | FIN-013 / TD-38 | `src/store/selectors.js:73-77` | L | — |
| J.2 | `roundMoney` en `_shiftBalance`/`adjustBalance_` (centavos USD/EUR sin acumulación de error) | BE-013 / TD-22 | `src/services/dataService.js:315`, `backend/Accounts.gs:74` | S | ✅ |
| J.3 | Narrativa Groq de portafolio (OPCIONAL): `analyzePortfolio` **sin script lock** · datos minimizados (% relativos, no montos COP) · anti prompt-injection en `Investments.name` · caché CacheService · disclaimer "no es asesoría" · botón opt-in | Opus Sprint 7 | `backend/Analysis.gs` (nuevo), `src/views/investments.js` | M | ✅ |
| J.4 ✅ | App-lock local opcional: PIN 4–6 dígitos (hash PBKDF2-SHA256 en localStorage) + auto-lock por inactividad/segundo plano + fallback re-login OAuth | N5 / Opus Sprint 8 | `src/core/applock.js` | M | — `53083b3` |
| J.4b ✅ | Desbloqueo biométrico (huella/Face ID) vía **WebAuthn** — opt-in, con PIN de respaldo; clave en chip seguro, solo `credentialId` en localStorage | N5 / I1 (reconsiderado) | `src/core/applock.js`, `src/views/settings.js` | M | — `57ac36c` |
| J.5 ✅ | Confirmar identidad del segundo email en `allowedEmails`; documentar o eliminar — **confirmado por el dueño (2026-06-10): es su cuenta alternativa; documentado en `Config.gs`, no se elimina** | N6 / Opus Sprint 8 | `backend/Config.gs:18` | S | — (solo comentario) |

**Criterio de aceptación para J.3 (si se hace):**
- `analyzePortfolio` nunca toma el `LockService.getScriptLock()` (no hace writes a Sheets).
- La narrativa se cachea en `CacheService` con TTL; no llama a Groq en cada render.
- Los datos enviados a Groq son solo porcentajes y categorías, sin montos COP absolutos ni símbolos de tickers identificables.

**Nota:** TD-38 (J.1) y TD-22 (J.2) están marcados ✅ en TechnicalDebt.md. Verificar en git log antes de re-implementar.

---

## 5. Criterios de "listo para v1.0"

- [x] Patrimonio neto: frontend = backend ± 0 (incluido FX, comisión, lotes vendidos, CC) — FIN-001 / Sprint A ✅ desplegado
- [x] FX rates poblados en backend; ninguna suma de divisas 1:1 silenciosa — TD-02 / Sprint A ✅ desplegado
- [x] Retención en fuente aplicada al P&L realizado (no decorativa) — FIN-002 / Sprint A
- [x] Ventas parciales correctas; P&L realizado fiable con comisión prorrateada — FIN-003/004 / Sprint B
- [x] CDT valorado sobre capital puro, topado en vencimiento — FIN-008 / Sprint B
- [x] Sin resurrección de soft-deletes ni doble conteo de saldo — BE-001/002 / Sprint A
- [x] WCAG 2.2 AA: contraste ≥ 4.5:1, nombres accesibles, reduced-motion, progressbars — Sprint C
- [x] `calcYield` con fórmula correcta (saldo promedio del período) — Sprint D ✅ desplegado
- [x] Snowball/Avalanche con amortización real mes a mes — FIN-007 / Sprint E
- [x] `getTransactions` paginado; cold-start aceptable con histórico grande — BE-006 / Sprint G ✅ desplegado
- [x] `iss`/`exp` validados en el backend — SEC-002 / R5
- [x] Tests ≥ 120 (cubrir FX, ventas parciales, amortización, cuentas remuneradas) — **155/155**
- [x] QA en vivo (Playwright) sin errores JS en las 15 rutas, responsive y temas OK — **I.1 PASS 2026-06-10 (sesión real)**
- [x] Sin bugs P0/P1 abiertos en el código (único abierto: TD-54 P2 — tx divisa extranjera en cashflow/presupuestos)
- [x] `TechnicalDebt.md` al día (todos los TD resueltos marcados ✅) — I.4
- [x] `PROJECT_HANDOFF.md` sincronizado con el estado real del repo — I.5

> **Estado v1.0:** ✅ **TODOS los criterios cumplidos** (2026-06-10). I.1 PASS con sesión real · Sprint F ✅ · TD-54 ✅ desplegado · TD-55/56 ✅ corregidos. Queda opcional: J.3 (Groq).

---

## 6. Deuda técnica cerrada (referencia)

Todos los siguientes IDs están marcados ✅ en `docs/TechnicalDebt.md`:

**TD original (P0–P2):** TD-01, TD-06, TD-08 parcial (via forms.js), TD-10, TD-13, TD-14, TD-15, TD-16, TD-17, TD-18, TD-19, TD-20, TD-21, TD-22, TD-23, TD-24, TD-25, TD-26, TD-27, TD-28, TD-29, TD-30, TD-31, TD-32.

**TD auditoría 2026-06-03:** TD-41, TD-42, TD-43, TD-44, TD-45, TD-46, TD-47, TD-48, TD-49, TD-50, TD-51, TD-52, TD-53.

**TD P3 resueltos:** TD-36, TD-37, TD-38.

**Aún abiertos (P3, baja prioridad):** TD-33, TD-34, TD-35, TD-39.
**Abiertos con trabajo parcial:** TD-02 (FX: FE+BE convierten/excluyen ✅ desplegado; resta solo TD-54 = tasa histórica en cashflow/presupuestos), TD-03 (doble conteo cuentas inversión en totalAssets — sin resolver). **Resueltos esta tanda:** TD-05/G.6 (truncado AuditLog ✅), TD-07/H.2 (tablas sr-only en charts ✅), TD-11/I.4 (estado de sync ✅), TD-25/G.7 (paginación cursor ✅ desplegado).

---

## 7. Reglas del documento

1. **Este documento es la única fuente de verdad para planificación.** Los roadmaps anteriores (`Roadmap-Implementacion-2026-06-02.md`, `Roadmap-Implementacion-2026-06-03.md`, `Roadmap-Revisado-Opus.md`) quedan como histórico de decisiones; no se ejecuta contra ellos.
2. **Se actualiza en cada `/handoff`** al final de cada sesión de trabajo.
3. **Cada tarea conserva su ID de hallazgo** para que `/implement` pueda volver al criterio de aceptación original.
4. **Antes de implementar cualquier tarea**, verificar en `git log` y `TechnicalDebt.md` que no esté ya resuelta (marcada ✅). Si ya está resuelta, marcarlo como "ya en <commit>" y pasar a la siguiente.
5. **No romper invariantes de `CLAUDE.md`**: sin build step, sin framework, sin dep npm de runtime, frontend detrás de `src/services/`, offline-first, exportabilidad total.
6. **No implementar todo el roadmap de golpe**: una tarea o un sprint a la vez, con tests verdes antes de commitear.
7. **Los sprints que requieren deploy de `.gs` los despliega el dueño manualmente**; el implementador deja el cambio listo y avisa "requiere deploy".

---

*Consolidado a partir de los 4 roadmaps y 2 auditorías del ciclo 2026-06-02 / 2026-06-09.*
*Generado por `/implement` (documentation mode) — no se modificó código.*
