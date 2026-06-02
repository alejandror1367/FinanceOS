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
| **Total** | | **~12 días** | |

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

*Generado por auditoría global 2026-06-02*
