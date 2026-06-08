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
| **Sprint 10** | FIRE enriquecido + Insights analítica | ~1d | 🟢 Alto |
| **Sprint 11** | Snooze pagos + Snapshot enriquecido | ~1d + deploy | 🟡 Alto |
| **Sprint 12** | Cuentas remuneradas + Alertas portafolio | ~1.5d + deploy | 🟡 Alto |
| **Sprint 13** | IA narrativa + Import/Export mejorado | ~1.5d + deploy | 🟢 Medio-Alto |
| **Total** | | **~17 días** | |

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

## Sprints 10–13 — Evolución post-v1.0
> Añadidos por auditoría estratégica 2026-06-08. Ver detalle completo en `docs/Audit-Estrategica-2026-06-08.md`.

### Sprint 10 — FIRE enriquecido + Insights adicionales (~1 día)
**Objetivo:** Completar la experiencia FIRE recién implementada y añadir 3 insights de alto impacto.  
**Dependencias:** Ninguna. **Riesgo:** Ninguno. **ROI:** Alto.

| # | Tarea | Archivo | Esfuerzo |
|---|---|---|---|
| 10.1 | FIRE: fecha estimada de independencia ("Alcanzarías en [Mes Año]") | `src/views/fire.js` | S |
| 10.2 | FIRE: ProgressBar de avance (patrimonio/objetivo %) | `src/views/fire.js` | S |
| 10.3 | FIRE: tooltips de conceptos (SWR, regla del 4%, CAGR) | `src/views/fire.js` | S |
| 10.4 | FIRE: variantes LeanFIRE / FatFIRE / BaristaFIRE (radio selector) | `src/views/fire.js` | S |
| 10.5 | FIRE: EmptyState explicativo si no hay datos financieros | `src/views/fire.js` | S |
| 10.6 | Analytics: `liquidityCoverageMonths(s)` + insight "X meses de cobertura" | `src/store/selectors.js` + `analytics.js` | S |
| 10.7 | Analytics: `savingsStreak(s)` + insight "N meses seguidos ahorrando" | `src/store/selectors.js` + `analytics.js` | S |
| 10.8 | Analytics: insight concentración gastos (categoría top como % del total) | `src/views/analytics.js` | S |

---

### Sprint 11 — Snooze de pagos + Snapshots enriquecidos (~1 día + deploy)
**Objetivo:** Eliminar ruido de recordatorios revisados y capturar desglose en snapshots desde ahora.  
**Dependencias:** Sprint 10. **Riesgo:** Bajo. **ROI:** Alto.

| # | Tarea | Archivo | Esfuerzo |
|---|---|---|---|
| 11.1 | `snoozeService.js`: `snooze(id, days)`, `isActive(id)`, `clearExpired()` — localStorage | `src/services/snoozeService.js` (nuevo) | S |
| 11.2 | Botón "Visto ✓" en filas de `upcomingPayments` (today.js + dashboard.js) | `src/views/today.js`, `dashboard.js` | S |
| 11.3 | Tests para `snoozeService` | `tests/` | S |
| 11.4 | Schema `NetWorthSnapshots`: 7 campos append-only (liquidity, investmentsValue, investmentsCost, accountsValue, otherAssets, ccDebt, liabilitiesDebt) | `backend/Config.gs` | S |
| 11.5 | `saveNetWorthSnapshot_`: capturar y guardar los 7 campos | `backend/NetWorth.gs` | S |
| 11.6 | Deploy `Config.gs` + `NetWorth.gs` + re-ejecutar `setupDatabase()` | backend | M |
| 11.7 | `networth.js`: mostrar desglose en detalle del snapshot | `src/views/networth.js` | S |

> Nota: El selector `upcomingPayments` NO se modifica. El filtro snooze se aplica en la vista (preserva pureza del selector).

---

### Sprint 12 — Cuentas remuneradas + Alertas de portafolio (~1.5 días + deploy)
**Objetivo:** Soportar Global66/RappiCuenta y añadir análisis automático del portafolio de inversiones.  
**Dependencias:** Sprint 11. **Riesgo:** Bajo. **ROI:** Alto.

| # | Tarea | Archivo | Esfuerzo |
|---|---|---|---|
| 12.1 | Schema `Accounts`: añadir `lastYieldDate` (append-only) | `backend/Config.gs` | S |
| 12.2 | `accounts.js`: badge "X% EA" en cuentas con `interestRate > 0` | `src/views/accounts.js` | S |
| 12.3 | `calcYield(account, today)`: interés compuesto diario | `src/views/accounts.js` | S |
| 12.4 | Modal "Registrar rendimiento": preview → confirmación → tx ingreso + update cuenta | `src/views/accounts.js` | M |
| 12.5 | Preset `RappiCuenta` (type:savings, interestRate:9, currency:COP) | `src/views/accounts.js` | S |
| 12.6 | Deploy `Config.gs` + `Accounts.gs` | backend | M |
| 12.7 | `selectors.portfolioAlerts(s)`: concentración >30%, CDT <30d, P&L <-20%, sin diversificación | `src/store/selectors.js` | M |
| 12.8 | Sección "Análisis" colapsable en `investments.js` con alertas | `src/views/investments.js` | M |
| 12.9 | Tests: `portfolioAlerts` (4 escenarios) | `tests/selectors.test.js` | S |

---

### Sprint 13 — IA narrativa de portafolio + Import/Export mejorado (~1.5 días + deploy)
**Objetivo:** Narrativa descriptiva del portafolio con Groq (opt-in) y mejoras de calidad al import/export.  
**Dependencias:** Sprint 12. **Riesgo:** Medio (IA) / Bajo (Import/Export). **ROI:** Medio-Alto.

| # | Tarea | Archivo | Esfuerzo |
|---|---|---|---|
| 13.1 | `backend/Analysis.gs` (nuevo): endpoint `analyzePortfolio` → Groq narrativa descriptiva | `backend/Analysis.gs` (nuevo) | M |
| 13.2 | `backend/Code.gs`: registrar acción `analyzePortfolio` | `backend/Code.gs` | S |
| 13.3 | Deploy `Analysis.gs` + `Code.gs` | backend | S |
| 13.4 | `investments.js`: botón "Analizar con IA" + narrativa + timestamp (opt-in, fallback graceful) | `src/views/investments.js` | S |
| 13.5 | Import: resumen de calidad (N/M sin categoría asignada) | `src/views/import.js` | S |
| 13.6 | Import: validar montos cero/negativos antes del preview | `src/services/importService.js` | S |
| 13.7 | Import: `dupKey` mejorado → `date|amount|descNorm` | `src/views/import.js` | S |
| 13.8 | Import: perfil `RappiCuenta` en `bankProfiles.js` | `src/services/parsers/bankProfiles.js` | S |
| 13.9 | Export: selector de período (fecha desde/hasta) | `src/views/exports.js` + `src/utils/export.js` | M |

> Nota regulatoria: prompt de `Analysis.gs` estrictamente descriptivo. Disclaimer "Esto no es asesoría financiera" visible en UI.

---

## Iniciativas evaluadas y descartadas (2026-06-08)

| Iniciativa | Decisión | Motivo |
|---|---|---|
| Autenticación Biométrica (WebAuthn/Passkeys) | No implementar | OAuth+FedCM es suficiente. Complejidad desproporcionada para 1 usuario. Violación del principio de simplicidad. |
| Multicuenta / Multiusuario | No implementar | Viola el concepto central del producto (app personal). Solución para familiares: clonar repo + instancia separada en GitHub Pages. |

---

*Sprints 1–9 generados por auditoría global 2026-06-02*  
*Sprints 10–13 generados por auditoría estratégica 2026-06-08*
