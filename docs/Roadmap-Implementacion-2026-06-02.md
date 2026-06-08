# Roadmap de Implementación — FinanceOS
**Fecha:** 2026-06-02  
**Basado en:** Auditoría global 2026-06-02  
**Estado de partida:** HEAD `dd68141` · SW v0.2.28 · Tests 45/45 · Deuda P0/P1/P2 resuelta

---

## Contexto

Toda la deuda técnica documentada (P0, P1, P2) ha sido resuelta. Lo que queda son:
1. **Bugs nuevos** descubiertos en esta auditoría (módulo Import roto, backend patrimonio incorrecto)
2. **Mejoras UX/UI** para acercar la app a las referencias objetivo
3. **Deuda P3** (mejoras incrementales ya documentadas)
4. **Funcionalidades nuevas** para cerrar gaps vs Snowball Analytics / Monarch Money

---

## Sprint 1 — Bugs críticos (Semana 1)
**Objetivo:** Dejar el módulo de importación completamente funcional y corregir el patrimonio neto en el backend.  
**Riesgo:** Bajo — todos son cambios quirúrgicos y aislados.

| # | Tarea | Archivo | Esfuerzo |
|---|---|---|---|
| 1.1 | `dataService.mutate()` → `create()` en import.js | `src/views/import.js` | S |
| 1.2 | Button API corregida (5 instancias) en import.js | `src/views/import.js` | S |
| 1.3 | Íconos SVG en drop zone e analyzing (html attr) | `src/views/import.js` | S |
| 1.4 | `appendChild(icon())` → elemento contenedor | `src/views/import.js` | S |
| 1.5 | Backend: CC en `computeNetWorth_()` | `backend/Reports.gs` | S + deploy |
| 1.6 | `config.version` sincronizado + hook pre-commit | `src/core/config.js` | S |
| 1.7 | `normPeriodKey()` en analytics.js (regresión TD-12) | `src/views/analytics.js` | S |
| 1.8 | `curMonthKey` calculado en render, no en module | `src/views/analytics.js` | S |

**Archivos afectados:** `src/views/import.js`, `src/views/analytics.js`, `src/core/config.js`, `backend/Reports.gs`  
**Impacto esperado:** Import funcional · Patrimonio neto correcto en backend · Analítica correcta  
**Esfuerzo total:** ~3 horas de desarrollo + 30 min deploy backend

---

## Sprint 2 — Integridad financiera (Semana 1–2)
**Objetivo:** Asegurar que todos los cálculos financieros sean confiables y verificables.

| # | Tarea | Archivo | Esfuerzo |
|---|---|---|---|
| 2.1 | Exportar `normPeriodKey` de selectors.js para reutilización | `src/store/selectors.js` | S |
| 2.2 | Tests para `analytics.js` buildInsights (regression) | `tests/selectors.test.js` | M |
| 2.3 | Validar `computeNetWorth_()` en backend con test manual | `backend/Reports.gs` | S |
| 2.4 | `selectors.upcomingPayments()` incluir CC vencimientos | `src/store/selectors.js` | M |
| 2.5 | Tests para `upcomingPayments` con CC | `tests/selectors.test.js` | S |
| 2.6 | Forecast de metas: usar promedio 3 meses en lugar de mes actual | `src/store/selectors.js` | M |
| 2.7 | Tests para `goalForecast` con promedio de meses | `tests/selectors.test.js` | S |

**Archivos afectados:** `src/store/selectors.js`, `src/views/analytics.js`, `tests/selectors.test.js`  
**Impacto esperado:** Insights y forecasts confiables · CC vencimientos en "Hoy"  
**Esfuerzo total:** ~1 día

---

## Sprint 3 — Sincronización y datos (Semana 2)
**Objetivo:** Cerrar gaps de sincronización y limpiar datos de prueba.

| # | Tarea | Archivo | Esfuerzo |
|---|---|---|---|
| 3.1 | Gestión de snapshots: eliminar individual desde UI | `src/views/networth.js` + backend | M |
| 3.2 | Backend: acción `deleteNetWorthSnapshot` + deploy | `backend/NetWorth.gs` | S + deploy |
| 3.3 | Multi-select y eliminación masiva de snapshots | `src/views/networth.js` | M |
| 3.4 | Detección automática de snapshots outliers en UI | `src/views/networth.js` | M |
| 3.5 | Retry automático en `apiClient.get()` para ERR_ABORTED | `src/services/apiClient.js` | S |

**Archivos afectados:** `src/views/networth.js`, `src/services/apiClient.js`, `backend/NetWorth.gs`  
**Impacto esperado:** Historia patrimonial limpia · getQuotes confiable  
**Esfuerzo total:** ~1 día + deploy

---

## Sprint 4 — Patrimonio enriquecido (Semana 2–3)
**Objetivo:** Llevar el módulo Patrimonio al nivel de Kubera / Empower.

| # | Tarea | Archivo | Esfuerzo |
|---|---|---|---|
| 4.1 | Valores exactos en eje Y del BarChart (patrimonio) | `src/components/charts.js` | M |
| 4.2 | Tooltips en hover sobre barras del BarChart | `src/components/charts.js` | M |
| 4.3 | LineChart interactivo con tooltip de fecha+valor | `src/components/charts.js` | M |
| 4.4 | Historial completo de snapshots (expandible) | `src/views/networth.js` | S |
| 4.5 | Snapshot automático mensual (recordatorio o cron) | UX + docs | M |

**Archivos afectados:** `src/components/charts.js`, `src/views/networth.js`  
**Impacto esperado:** Evolución patrimonial visual y confiable  
**Esfuerzo total:** ~1.5 días

---

## Sprint 5 — Inversiones avanzadas (Semana 3)
**Objetivo:** Cerrar gap vs Snowball Analytics / Sharesight para las funcionalidades imprescindibles.

| # | Tarea | Clasificación | Esfuerzo |
|---|---|---|---|
| 5.1 | Retención en fuente para dividendos (campo opcional) | Imprescindible | S |
| 5.2 | Comisiones por operación (campo opcional en compra/venta) | Recomendado | S |
| 5.3 | Indicador de cobertura de retención (WITHHOLDING%) | Recomendado | S |
| 5.4 | XIRR / TIR por posición | Avanzado | L |
| 5.5 | CAGR del portafolio | Avanzado | M |
| 5.6 | Splits de acciones (ajuste de qty + precio) | Recomendado | M |
| 5.7 | Reinversión automática de dividendos (DRIP) | Avanzado | L |
| 5.8 | Sharpe ratio / Volatilidad | Avanzado | XL |

**Foco para este sprint:** Solo 5.1, 5.2, 5.3 (S+S+S = < 1 día).  
Los ítems avanzados (XIRR, Sharpe) son opcionales y complejos.

---

## Sprint 6 — UX/UI (Semana 3–4)
**Objetivo:** Acercar la experiencia visual a Linear / Stripe Dashboard.

| # | Tarea | Archivo | Esfuerzo |
|---|---|---|---|
| 6.1 | Tooltips en todos los gráficos SVG al hover | `src/components/charts.js` | M |
| 6.2 | Micro-animaciones de entrada de vistas (`opacity fade`) | `src/styles/layout.css` | S |
| 6.3 | Validación inline en formularios (blur handler) | `src/components/forms.js` | M |
| 6.4 | Selector de mes/período global en Dashboard | `src/views/dashboard.js` | M |
| 6.5 | Sparklines en KPI Cards (tendencia 3 meses) | `src/components/ui.js` | M |
| 6.6 | Shortcuts de teclado básicos (N=nueva tx, etc.) | `src/core/app.js` | M |
| 6.7 | Empty States más ricos por módulo | `src/views/*` | M |
| 6.8 | Fix truncamiento "T..." en Settings Apariencia | `src/views/settings.js` | S |

**Esfuerzo total:** ~2 días

---

## Sprint 7 — Performance (Semana 4)
**Objetivo:** Optimizar tiempos de carga y render.

| # | Tarea | Archivo | Esfuerzo |
|---|---|---|---|
| 7.1 | `content-visibility: auto` en listas largas (TD-33) | `src/styles/components.css` | S |
| 7.2 | Suscripciones granulares al store (solo rerenderizar sección) | `src/store/store.js` | L |
| 7.3 | Lazy load de vistas no visitadas | `src/core/router.js` | M |
| 7.4 | IndexedDB: paginación en `getTransactions` local | `src/services/db.js` | M |
| 7.5 | Lighthouse audit + documentar baseline | CI / docs | S |

**Esfuerzo total:** ~1.5 días

---

## Sprint 8 — Analítica avanzada (Semana 4–5)
**Objetivo:** Insights automáticos más ricos y navegación temporal.

| # | Tarea | Archivo | Esfuerzo |
|---|---|---|---|
| 8.1 | Selector de período en Analítica (1M, 3M, 6M, 1A) | `src/views/analytics.js` | M |
| 8.2 | 5 insights adicionales (vencimiento CC, cobertura, streak) | `src/views/analytics.js` | M |
| 8.3 | Comparison insight: mes actual vs promedio histórico | `src/store/selectors.js` | M |
| 8.4 | Debt Center: simulador de escenario de pago extra | `src/views/debts.js` | L |
| 8.5 | Debt Center: calendario de vencimientos | `src/views/debts.js` | M |

**Esfuerzo total:** ~2 días

---

## Sprint 9 — Pulido final (Semana 5)
**Objetivo:** Cerrar P3 restante y preparar para v1.0.

| # | Tarea | ID | Esfuerzo |
|---|---|---|---|
| 9.1 | Proyección presupuesto suavizada (sin días 1–3) | TD-36 | S |
| 9.2 | Validar solapamiento de presupuestos | TD-37 | S |
| 9.3 | Recurrentes: ejecución automática con nextRunDate | TD-39 | L |
| 9.4 | Merge inmutable de store patches (TD-34) | TD-34 | S |
| 9.5 | Aporte a meta genera transacción (TD-35) | TD-35 | M |
| 9.6 | Theming: eliminar hex hardcodeados (TD-40) | TD-40 | M |
| 9.7 | Revisión final de accesibilidad WCAG 2.1 AA | WCAG | M |
| 9.8 | Actualizar PROJECT_HANDOFF y documentación | docs | S |

---

## Resumen ejecutivo por sprint

| Sprint | Objetivo | Esfuerzo | Impacto |
|---|---|---|---|
| **Sprint 1** | Bugs críticos (import + backend patrimonio) | ~3h | 🔴 Crítico |
| **Sprint 2** | Integridad financiera (cálculos + tests) | ~1d | 🔴 Alto |
| **Sprint 3** | Sync + snapshots | ~1d | 🟡 Alto |
| **Sprint 4** | Patrimonio enriquecido | ~1.5d | 🟡 Medio |
| **Sprint 5** | Inversiones avanzadas (imprescindibles) | ~1d | 🟡 Medio |
| **Sprint 6** | UX/UI | ~2d | 🟢 Medio |
| **Sprint 7** | Performance | ~1.5d | 🟢 Bajo |
| **Sprint 8** | Analítica avanzada | ~2d | 🟢 Medio |
| **Sprint 9** | Pulido + P3 | ~2d | 🟢 Bajo |
| ~~Sprint 10–13~~ | **SUPERSEDED** por el plan revisado Opus (ver abajo) | — | — |
| **Total Sprints 1–9** | | **~14 días** | (completados) |

---

## Criterios de "listo para v1.0"

- [ ] Módulo de importación 100% funcional (todos los bancos)
- [ ] Patrimonio neto: frontend = backend ± 0
- [ ] Todos los insights con datos confiables
- [ ] Gestión de snapshots con eliminación individual
- [ ] Tests ≥ 60/45 (expandir cobertura)
- [ ] Sin bugs P0/P1 abiertos
- [ ] Lighthouse Performance ≥ 85

---

## Plan revisado (Opus 2026-06-08) — reemplaza los Sprints 10–13 de Sonnet

> Los Sprints 10–13 generados por la auditoría estratégica de Sonnet
> (`docs/Audit-Estrategica-2026-06-08.md`) quedan **SUPERSEDED** por este plan,
> producto de la revisión arquitectónica independiente de Opus. Razón: la auditoría
> de Sonnet contenía afirmaciones falsas verificadas contra código (`portfolioCAGR`
> no existe, `calcYield` financieramente incorrecto, `ensureHeaders_` no es
> append-only idempotente) y omitía riesgos reales (divergencia FE↔BE en pasivos CC,
> backend pendiente de deploy, head-of-line blocking de la IA en el sync).
>
> **Detalle completo, tablas de tareas y justificación:**
> `docs/Roadmap-Revisado-Opus.md` · auditoría: `docs/Auditoria-Estrategica-Revisada-Opus.md`.
>
> Numeración del plan revisado (R0–R8); **no confundir** con los Sprints 1–9 ya
> completados. El orden refleja dependencias de seguridad, no de features.

| Sprint (rev.) | Objetivo | Esfuerzo | Riesgo | Deploy | ROI |
|---|---|---|---|---|---|
| **R0** — Pre-flight | Verificar/desplegar backend pendiente (TD-41/45/50/51/02) · **fix FE↔BE pasivos CC** (`Reports.gs:50` ← FIN-014) + test paridad · exponer `ccDebt`/`liabilitiesDebt` · marcar TD-01 ✅ | ~0.5–1d | Alto si se omite | **Sí** | 🔴 Máximo |
| **R1** — FIRE + insights | FIRE enriquecido (fecha, ProgressBar, tooltips, variantes, EmptyState) · `liquidityCoverageMonths` **con promedio** · `savingsStreak` **excluyendo mes en curso** · concentración gastos | ~1d | Ninguno | No | 🟢 Alto |
| **R2** — Dismiss de pagos | `dismissService` con semántica **dismiss hasta próxima ocurrencia** (no snooze que reaparece) · filtro en vista (selector intacto) | ~0.5d | Ninguno | No | 🟡 Alto |
| **R3** — Snapshots enriquecidos | 6 campos append (**sin `liquidity`** ≡ accountsValue) · **requiere R0 (deploy + fix)** | ~1d | P0 sin R0 | **Sí** | 🟡 Alto |
| **R4** — Alertas portafolio (I7a) | `portfolioAlerts` determinísticas · **construir `positionValue`/`totalPortfolioValue` (NO existen)** · degradar con precios stale | ~1d | Bajo | No | 🟡 Alto |
| **R5** — Cuentas remuneradas (I8) | **Rediseñar `calcYield`** (saldo promedio / acumulación diaria; NO balance actual) · `lastYieldDate` · `interestRate` EA · idempotencia `(accountId, periodo)` | ~1.5d | P1 sin rediseño | **Sí** | 🟡 Medio |
| **R6** — Import/Export | Fixtures de regresión ANTES de `dupKey` · resumen calidad · validación montos · perfil RappiCuenta · export por período | ~1.5d | Medio | No | 🟢 Alto |
| **R7** — Narrativa Groq (I7b) — **OPCIONAL** | `analyzePortfolio` **sin script lock** · datos minimizados · anti prompt-injection · caché · disclaimer | ~1.5d | Medio | **Sí** | 🟢 Bajo-Medio |
| **R8** — Endurecimientos P2 — **OPCIONAL** | App-lock local opcional (PIN + auto-lock) · confirmar/documentar/eliminar 2º email de `allowedEmails` | ~1d | Ninguno | Parcial | 🟢 Medio |

**Camino crítico:** R0 → (R1 ∥ R2 ∥ R4) → R3 → R5 → R6 → (R7, R8 opcionales). Total ~9–10 días + 4 deploys.

**Precondición dura:** R3 y R5 NO arrancan sin R0 completo (deploy verificado + fix FE↔BE + rediseño de fórmula).

---

## Iniciativas evaluadas y descartadas

| Iniciativa | Decisión | Motivo |
|---|---|---|
| Autenticación Biométrica (WebAuthn/Passkeys) **como reemplazo de OAuth** | No implementar | OAuth+FedCM suficiente. Complejidad desproporcionada para 1 usuario. (Opus conserva el **app-lock local opcional** en R8 — Sonnet lo descartó de más.) |
| Multicuenta / Multiusuario | No implementar | Viola el concepto monousuario. Familiares: clonar repo + instancia separada. (Opus añade en R8 la **limpieza de `allowedEmails`** — el aislamiento ya está roto con 2 emails sobre 1 BD.) |

---

*Sprints 1–9 generados por auditoría global 2026-06-02*
*Sprints 10–13 (Sonnet, 2026-06-08) **SUPERSEDED** por el plan revisado Opus (R0–R8, 2026-06-08)*
