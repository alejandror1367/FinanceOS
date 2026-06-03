# Roadmap de Implementación — FinanceOS

**Fecha:** 2026-06-03
**Basado en:** `Audit-Global-2026-06-03.md` (46 hallazgos · 4/5 áreas · QA en vivo Playwright pendiente)
**Estado de partida:** HEAD `933283a` · SW/config `v0.2.43` · Tests 54/54 · main sincronizado

---

## Contexto

La auditoría del 2026-06-03 (2ª pasada, post-Sprint 5/6) encontró que la deuda P0/P1/P2 del
ciclo anterior está mayormente cerrada, pero **Sprint 5 introdujo defectos de cifra** y dejó
**la multi-moneda (TD-02) viva**. El trabajo pendiente se concentra en:

1. **Integridad de cifras maestras** (P0): el backend quedó desincronizado del FE, FX silencioso 1:1, retención decorativa, resurrección de soft-deletes, doble conteo de saldo.
2. **Inversiones**: ventas parciales rotas y prorrateo de comisión incorrecto (deuda del propio Sprint 5).
3. **Accesibilidad / DS** (WCAG 2.2 AA): contraste, nombres accesibles, reduced-motion — casi todo de esfuerzo S.
4. **Backend perf/robustez**: O(n) por escritura, sin paginación, purgas costosas.
5. **Seguridad** (contexto monousuario): `iss`/`exp`, `id_token` en URL.
6. **Deudas/metas, charts responsive, P3 y QA en vivo**.

> **Regla:** ninguna tarea introduce build step, framework, bundler ni dep npm de runtime, ni
> rompe Apps Script + Sheets, offline-first, exportabilidad total o la PWA.
> Cada tarea conserva su **ID de hallazgo** para que `/implement` vuelva al criterio de aceptación.

---

## Sprint 1 — Integridad de cifras maestras (P0)
**Objetivo:** que ninguna cifra financiera mienta. Resolver los 5 P0 de integridad.
**Riesgo:** Medio — toca selectores y backend; exige tests + verificación numérica + deploy.
**Quick win primero:** 1.1 (un guard de 1 línea).

| # | Tarea | ID | Archivo | Esf | ¿Deploy? |
|---|-------|----|---------|-----|----------|
| 1.1 | Guard `if (hit.isDeleted) return null` en `idempotentHit_` (no resucitar soft-deletes) | BE-001 / TD-45 | `backend/Utils.gs:177-181` | S | ✅ |
| 1.2 | Poblar FX: acción `getFxRates` o incluir `USDCOP=X`/`EURCOP=X` en `getQuotes` | BE-003 / TD-02 | `backend/Quotes.gs:11-54` | M | ✅ |
| 1.3 | `priceService` consume FX y `investmentsValue/Cost` excluyen/flaggean posición sin tasa (no sumar nativo 1:1) | FIN-005 / TD-02 | `src/services/priceService.js`, `src/store/selectors.js:54,68` | M | — |
| 1.4 | `computeNetWorth_`: filtrar `!soldDate && !isDeleted`, sumar comisión, aplicar FX (paridad con FE) | FIN-001 / TD-41 | `backend/Reports.gs:24,77` | M | ✅ |
| 1.5 | Aplicar `withholdingRate` al P&L realizado (restar sobre ganancia al vender) | FIN-002 / TD-42 | `src/views/investments.js`, `src/store/selectors.js` | M | — |
| 1.6 | Ajuste de saldo local idempotente en `update` de tx (o forzar `pullData()` tras flush) | BE-002 / TD-46 | `src/services/dataService.js:233-248` | M | parcial |
| 1.7 | Tests: FX (con/sin tasa), exclusión de lotes vendidos, P&L neto de retención, paridad FE↔BE | FIN-001/002/005 | `tests/selectors.test.js` | M | — |

**Impacto esperado:** patrimonio FE = BE; inversiones USD convertidas; P&L neto real; sin saldos fantasma.
**Esfuerzo total:** ~3–4 días (incl. 2 deploys de backend).

---

## Sprint 2 — Inversiones: ventas parciales y valoración
**Objetivo:** cerrar la deuda que dejó Sprint 5 en el flujo de venta y renta fija.
**Riesgo:** Bajo–Medio — lógica aislada en `investments.js`, cubierta por tests nuevos.

| # | Tarea | ID | Archivo | Esf | ¿Deploy? |
|---|-------|----|---------|-----|----------|
| 2.1 | Modal de venta pide **cantidad a vender**; `soldQuantity = min(qtySolic, qtyLote)`; lote remanente | FIN-003 / TD-43 | `src/views/investments.js:118-124` | M | — |
| 2.2 | `realizedPnL`: prorratear comisión de compra `× (qtyVendida/qtyLote)` y `soldCommission` por lo vendido | FIN-004 / TD-43 | `src/views/investments.js:79-83` | S | — |
| 2.3 | `cdtCurrentValue`: capitalizar sobre capital (sin comisión) y topar `days` a vencimiento | FIN-008 / TD-44 | `src/views/investments.js:130-135` | S | — |
| 2.4 | Penny-rounding: `roundMoney(v, base)` en acumulados/totales de Inversiones | FIN-009 / TD-21 | `src/views/investments.js:557-568` | S | — |
| 2.5 | Extraer `groupByTicker`/cálculo de lotes a módulo testeable + tests (venta total y parcial, CDT) | FIN-003/004/008 | `src/store/` + `tests/selectors.test.js` | M | — |

**Impacto esperado:** ventas parciales correctas, P&L realizado fiable, CDT bien valorado.
**Esfuerzo total:** ~1.5–2 días.

---

## Sprint 3 — Accesibilidad y Design System (WCAG 2.2 AA)
**Objetivo:** conformidad AA y limpieza de DS. **Casi todo esfuerzo S, sin deploy** → ideal primer PR de quick wins.
**Riesgo:** Muy bajo.

| # | Tarea | ID | Archivo | Esf | ¿Deploy? |
|---|-------|----|---------|-----|----------|
| 3.1 | Subir luminancia de `--text-tertiary` (dark + light) hasta ≥4.5:1 | FE-002 / TD-40 | `src/styles/themes.css:37,91` | S | — |
| 3.2 | Quitar `aria-label:name` de `textInput`/`select` (restaurar nombre visible) | FE-003 / TD-49 | `src/components/forms.js:20,37` | S | — |
| 3.3 | Escapar `&<>"` en `<title>`/`aria-label` de charts (`esc()`) | FE-001 / TD-48 | `src/components/charts.js:52,70,76,77` | S | — |
| 3.4 | `@media (prefers-reduced-motion)` que anule duraciones de keyframes | FE-004 / TD-40 | `src/styles/tokens.css:143-148` | S | — |
| 3.5 | `ProgressBar`: `aria-valuemin/max` + `aria-label` | FE-007 / TD-40 | `src/components/ui.js:92` | S | — |
| 3.6 | `confirmDialog`: fallback de foco (botón submit / contenedor) | FE-006 | `src/components/modal.js:81-96` | S | — |
| 3.7 | Reemplazar `10px/11px` literales por `var(--fs-micro)` | FE-009 / TD-40 | `src/styles/components.css:349,351,384,439,455` | S | — |
| 3.8 | `.preset-chip:hover` → `var(--accent-contrast)` (quitar hex crudo) | FE-010 / TD-40 | `src/styles/components.css:497` | S | — |
| 3.9 | `select`: `padding-right` para que la flecha no solape texto largo | FE-008 / TD-40 | `src/styles/components.css:233-236` | S | — |
| 3.10 | Fix truncamiento label "Apariencia" en Ajustes | FE-013 | `src/views/settings.js` | S | — |

**Impacto esperado:** WCAG 2.2 AA en contraste, nombres accesibles, reduced-motion y progressbars; DS sin hex crudos.
**Esfuerzo total:** ~1 día (un solo PR sin deploy).

---

## Sprint 4 — Backend: performance y robustez de sync
**Objetivo:** quitar O(n) de los hot paths y blindar la cola de sync. **Varios deploys de `.gs`.**
**Riesgo:** Medio — toca el repositorio genérico; probar con `recalculateBalances` de respaldo.

| # | Tarea | ID | Archivo | Esf | ¿Deploy? |
|---|-------|----|---------|-----|----------|
| 4.1 | Lectura puntual (`repoFindRowIndex_`+`getRange`) en `adjustBalance_` y validación de categoría; cachear `repoReadAll_` por request | BE-005 / TD-05,24 | `backend/Transactions.gs:40-63`, `Accounts.gs:70-75` | M | ✅ |
| 4.2 | `reconcileAndHydrate`: mezclar `{...existing, ...op.data}` para ops `update` | BE-004 / TD-47 | `src/services/dataService.js:78-85` | S | — |
| 4.3 | `flushBatch`: emparejar por `res.entityId === op.entityId` (no por índice) | BE-010 / TD-26 | `src/services/syncEngine.js:71-84` | S | — |
| 4.4 | `isTransient`: dead-letter directo si falta token local (no reintentar "No autorizado") | BE-011 / TD-10 | `src/services/syncEngine.js:43` | S | — |
| 4.5 | `purgeDeleted_`: reconstruir hoja (filtrar vivas + `setValues` en bloque) en vez de `deleteRow` en bucle | BE-007 / TD-28 | `backend/Utils.gs:189-214` | M | ✅ |
| 4.6 | Archivado/truncado de `AuditLog` por antigüedad (90 días) | BE-008 / TD-05,28 | `backend/Audit.gs`, `Utils.gs` | M | ✅ |
| 4.7 | Paginación por cursor en `getTransactions`; `getBootstrap` solo N recientes (ventana 12–24m) | BE-006 / TD-25 | `backend/Transactions.gs:10-16`, `Reports.gs:144` | L | ✅ |

**Impacto esperado:** escrituras O(1) en lectura puntual, cold-start menor, cola de sync robusta, hojas acotadas.
**Esfuerzo total:** ~3–4 días (varios deploys).

---

## Sprint 5 — Seguridad (defensa en profundidad, contexto monousuario)
**Objetivo:** endurecer OAuth y manejo de secretos sin sobre-ingeniería.
**Riesgo:** Bajo.

| # | Tarea | ID | Archivo | Esf | ¿Deploy? |
|---|-------|----|---------|-----|----------|
| 5.1 | Validar `iss∈{accounts.google.com, https://accounts.google.com}` y `exp` explícito | SEC-002 / TD-51 | `backend/Auth.gs:39-64` | S | ✅ |
| 5.2 | `.gitignore`: añadir `.env*`, `*.key`, `.clasp.json`, `settings.local.json` | SEC-004 | `.gitignore` | S | — |
| 5.3 | Mover lecturas sensibles a POST (body) o aceptar formalmente `id_token` en URL (TTL 1h) | SEC-001 / TD-50 | `src/services/apiClient.js:27`, `Code.gs:144` | M | ✅ |
| 5.4 | Truncar `fileContent` antes de enviar a Groq; documentar en UI qué se envía | SEC-005 | `backend/Import.gs:51,71-80` | S | ✅ |
| 5.5 | Persistir intentos de acceso denegados en `AuditLog` (con rate-limit) | SEC-006 / TD-09 | `backend/Auth.gs:50,57` | S | ✅ |

**Impacto esperado:** verificación de token estándar GIS, menos superficie de fuga, rastro de accesos denegados.
**Esfuerzo total:** ~1 día (deploys ligeros).

---

## Sprint 6 — Deudas y Metas (correctitud financiera P1/P2)
**Objetivo:** que estrategias de deuda y forecasts de metas sean realistas.
**Riesgo:** Bajo–Medio.

| # | Tarea | ID | Archivo | Esf | ¿Deploy? |
|---|-------|----|---------|-----|----------|
| 6.1 | `avgRate`: convertir balances a base antes de ponderar | FIN-006 / TD-02 | `src/store/selectors.js:215-216` | S | — |
| 6.2 | `amortize()`: soportar `minPayment` % del saldo; simular bola de nieve encadenada (Snowball/Avalanche) | FIN-007 / TD-23 | `src/views/debts.js:26-40,297-302` | M | — |
| 6.3 | `goalForecast`: repartir `monthlySavingsAvg` entre metas activas | FIN-011 / TD-52 | `src/views/goals.js:205,51-59` | M | — |
| 6.4 | `monthlySavingsAvg`: promediar solo meses con actividad | FIN-012 / TD-53 | `src/store/selectors.js:118-122` | S | — |
| 6.5 | `sameMonth`: normalizar `ref` string con `slice(0,7)` | FIN-010 / TD-12 | `src/store/selectors.js:17-18` | S | — |
| 6.6 | Tests: amortización (cuota %, encadenada), reparto de metas, savingsAvg parcial | FIN-006/007/011/012 | `tests/selectors.test.js` | M | — |

**Impacto esperado:** "fecha libre de deudas" realista, forecasts de metas no optimistas.
**Esfuerzo total:** ~1.5–2 días.

---

## Sprint 7 — Charts responsive y a11y avanzada
**Objetivo:** charts legibles en móvil y accesibles por teclado.
**Riesgo:** Bajo (pendiente de validar en vivo con Playwright).

| # | Tarea | ID | Archivo | Esf | ¿Deploy? |
|---|-------|----|---------|-----|----------|
| 7.1 | Rotar/decimar labels de eje X por `n`; `font-size` relativo al viewBox; altura responsiva | FE-005 / TD-40 | `src/components/charts.js:13,43,49,74-75` | M | — |
| 7.2 | Tabla `sr-only` con valores por serie/segmento (detalle por teclado) | FE-011 / TD-07 | `src/components/charts.js:37,70` | M | — |
| 7.3 | Bottom-nav móvil: ítem "Más" o priorizar por uso (Inversiones/Presupuestos) | FE-012 | `src/core/routes.js:48` | S | — |

**Esfuerzo total:** ~1 día.

---

## Sprint 8 — Avanzado y limpieza P3
**Objetivo:** métricas avanzadas y deuda de baja prioridad.
**Riesgo:** Bajo.

| # | Tarea | ID | Archivo | Esf | ¿Deploy? |
|---|-------|----|---------|-----|----------|
| 8.1 | XIRR / CAGR por posición y portafolio (métrica avanzada) | FIN-013 / TD-38 | `src/store/selectors.js:73-77` | L | — |
| 8.2 | `_shiftBalance`/`adjustBalance_`: `roundMoney(v, currency)` (centavos USD/EUR) | BE-013 / TD-22 | `src/services/dataService.js:315`, `Accounts.gs:74` | S | ✅ |
| 8.3 | Comentario aclaratorio en `getDb_` (memo intra-request) | BE-012 / TD-16 | `backend/Utils.gs:17-20` | S | — |
| 8.4 | Corregir docs: `#/import` usa **Groq**, no Gemini; título *stale* de TD-09 | doc | `CLAUDE.md`, `PROJECT_HANDOFF.md`, `TechnicalDebt.md` | S | — |

**Esfuerzo total:** ~1 día (sin contar XIRR si se difiere).

---

## Sprint 9 — QA en vivo + pulido v1.0
**Objetivo:** completar la 5ª área de auditoría y cerrar P3 de presupuestos.
**Riesgo:** Bajo.

| # | Tarea | ID | Archivo | Esf | ¿Deploy? |
|---|-------|----|---------|-----|----------|
| 9.1 | Re-lanzar `playwright-reviewer`: 15 rutas, responsive 375px, dark/light, console/red | QA (pendiente) | — | M | — |
| 9.2 | Proyección de presupuesto suavizada (sin días 1–3) | TD-36 | `src/views/budgets.js`/`selectors.js` | S | — |
| 9.3 | Validar solapamiento de presupuestos (categoría+periodo único) | TD-37 | `src/views/budgets.js` | S | — |
| 9.4 | Integrar TD-41…TD-53 en `docs/TechnicalDebt.md` (registro de deuda al día) | TD-41..53 | `docs/TechnicalDebt.md` | S | — |
| 9.5 | Actualizar `PROJECT_HANDOFF.md` y documentación a estado v1.0 | docs | docs | S | — |

**Esfuerzo total:** ~1 día.

---

## Resumen ejecutivo por sprint

| Sprint | Objetivo | Esfuerzo | Impacto | Deploy |
|---|---|---|---|---|
| **1** | Integridad de cifras maestras (5 P0) | ~3–4d | 🔴 Crítico | 2× backend |
| **2** | Inversiones: ventas parciales y valoración | ~1.5–2d | 🟠 Alto | — |
| **3** | Accesibilidad y DS (WCAG AA) | ~1d | 🟠 Alto | — |
| **4** | Backend perf + robustez de sync | ~3–4d | 🟠 Alto | varios |
| **5** | Seguridad (defensa en profundidad) | ~1d | 🟡 Medio | sí |
| **6** | Deudas y metas (correctitud) | ~1.5–2d | 🟡 Medio | — |
| **7** | Charts responsive + a11y avanzada | ~1d | 🟡 Medio | — |
| **8** | Avanzado + limpieza P3 | ~1d | 🟢 Bajo | 1× backend |
| **9** | QA en vivo + pulido v1.0 | ~1d | 🟢 Bajo | — |
| **Total** | | **~14–17 días** | | |

**Top 3 por ROI:**
1. **Sprint 1.1 / BE-001** (P0, S, deploy) — un guard de 1 línea evita corrupción de saldo por soft-deletes.
2. **Sprint 3** completo (P1/P2, todo S, sin deploy) — un solo PR deja la app conforme WCAG AA en contraste, nombres accesibles y reduced-motion.
3. **Sprint 1.2+1.3 / FX (TD-02)** (P0, M, deploy) — elimina el error silencioso ×~4000 en patrimonio multi-moneda.

**Tareas que requieren deploy manual de backend (`.gs`):** 1.1, 1.2, 1.4, 4.1, 4.5, 4.6, 4.7, 5.1, 5.3, 5.4, 5.5, 8.2. Agruparlas por sprint para minimizar despliegues.

---

## Criterios de "listo para v1.0"

- [ ] Patrimonio neto: frontend = backend ± 0 (incluido FX, comisión, lotes vendidos) — FIN-001
- [ ] FX rates poblados; ninguna suma de divisas 1:1 silenciosa — TD-02
- [ ] Retención en fuente aplicada al P&L (no decorativa) — FIN-002
- [ ] Ventas parciales correctas; P&L realizado fiable — FIN-003/004
- [ ] Sin resurrección de soft-deletes ni doble conteo de saldo — BE-001/002
- [ ] WCAG 2.2 AA: contraste ≥4.5:1, nombres accesibles, reduced-motion, progressbars — Sprint 3
- [ ] `getTransactions` paginado; cold-start aceptable con histórico grande — BE-006
- [ ] `iss`/`exp` validados en el backend — SEC-002
- [ ] Tests ≥ 70 (cubrir FX, ventas parciales, amortización, metas)
- [ ] QA en vivo (Playwright) sin errores JS en las 15 rutas, responsive y temas OK — QA
- [ ] Sin bugs P0/P1 abiertos · TD-41…TD-53 integrados en `TechnicalDebt.md`

---

*Generado por `/roadmap` a partir de la auditoría global del 2026-06-03.*
