# Auditoría Global — FinanceOS
**Fecha:** 2026-06-02  
**Versión auditada:** HEAD `dd68141` · SW v0.2.28 · Tests 45/45  
**URL producción:** https://alejandror1367.github.io/FinanceOS/  
**Equipo auditor:** Claude Sonnet 4.6 — Principal Financial Systems Architect · Quant Analyst · Sr. Product Manager · Sr. Product Designer · Sr. UX Researcher · Sr. Frontend Engineer · Sr. Backend Engineer · QA Lead · Accessibility Auditor · Data Integrity Auditor · Performance Engineer · PWA Specialist · Security Reviewer

---

## Herramientas utilizadas

| Herramienta | Función | Cómo fue usada | Hallazgos |
|---|---|---|---|
| **Playwright MCP** | Validación en producción | Navegación de 12/14 rutas en producción; screenshots de cada vista; inspección de red y consola | BUG-P0-2, BUG-P1-2, BUG-P1-5, BUG-P2-1, BUG-P2-4; getQuotes ERR_ABORTED |
| **node --test** | Suite de tests financieros | Ejecución completa 45/45 | Todos pasan ✅ |
| **Read (código fuente)** | Análisis estático | Lectura completa de selectors.js, syncEngine.js, dataService.js, import.js, investments.js, debts.js, networth.js, dashboard.js, analytics.js, Reports.gs, Utils.gs, Code.gs, Auth.gs, Investments.gs, dom.js, icons.js, ui.js | BUG-P0-1, BUG-P1-1 thru P1-4, BUG-P2-2 thru P2-3 |
| **Grep / Glob** | Búsqueda de patrones | Búsqueda de `dataService.mutate`, patrones de Button API | Confirma alcance de bugs |
| **documentation-generator skill** | Verificación de documentación | Disponible (no invocado; handoff ya actualizado) | N/A |
| **frontend-auditor skill** | Auditoría Design System | Disponible; análisis de CSS tokens integrado en análisis manual | Tokens bien aplicados |
| **GitHub MCP** | Issues/PRs | Disponible (no usado; repo personal sin workflow de issues) | N/A |
| **context7 MCP** | Docs de librerías | Disponible (no requerido; stack Vanilla sin deps externas) | N/A |

---

## Fase 1 — Auditoría Funcional Global

### Rutas visitadas con Playwright MCP

| Ruta | Estado | Bugs encontrados |
|---|---|---|
| `#/dashboard` | ✅ Funcional | Gráfico patrimonio con datos de prueba (P2) |
| `#/today` | ✅ Funcional | CC vencimiento no aparece en próximos pagos (P2) |
| `#/transactions` | ✅ Funcional | Filtro de mes visualmente truncado (cosmético) |
| `#/accounts` | ✅ Funcional | Ninguno |
| `#/budgets` | ✅ Funcional | Proyección lineal exagerada en día 2 (P3/TD-36) |
| `#/recurring` | No visitado — módulo CRUD estándar sin anomalías conocidas | — |
| `#/networth` | ✅ Funcional | Sin UI para eliminar snapshots de prueba (P2) |
| `#/investments` | ✅ Funcional | getQuotes ERR_ABORTED primer intento (P2) |
| `#/goals` | ✅ Funcional | Forecast usa datos de 2 días → proyección irreal (P3) |
| `#/debts` | ✅ Excelente | Ninguno |
| `#/analytics` | ✅ Funcional | Insight $57M irreal en día 2; budget filter sin normPeriodKey (P1) |
| `#/journal` | No visitado — CRUD estándar | — |
| `#/exports` | No visitado — descarga directa | — |
| `#/import` | 🔴 Roto (idle OK) | 4 bugs críticos (ver Fase 1 bugs) |
| `#/settings` | ✅ Funcional | config.version 0.2.23 vs SW 0.2.28 (P1) |

### Tabla de hallazgos funcionales

| Prioridad | Módulo | Hallazgo | Impacto | Solución |
|---|---|---|---|---|
| **CRÍTICO** | Import | `dataService.mutate()` no existe | Import completamente roto | Cambiar a `create()` |
| **CRÍTICO** | Backend | `computeNetWorth_()` omite CC como pasivos | Patrimonio backend $3.4M inflado | Sumar CC a totalLiabilities |
| **ALTO** | Import | Button API incorrecta (5 instancias) | Botones sin función ni texto correcto | Corregir signature |
| **ALTO** | Import | Iconos SVG como texto en drop zone | Visual break total | Usar `html:` attr |
| **ALTO** | Import | `appendChild(icon())` TypeError con duplicados | Crash en preview | Envolver en el() |
| **ALTO** | Analytics | `periodKey ===` sin normPeriodKey | Insight presupuesto siempre vacío | Usar normPeriodKey() |
| **ALTO** | Config | `config.version` desincronizado | Versión incorrecta en UI | Sincronizar con SW |
| **MEDIO** | Networth | Snapshots de prueba en DB | Gráfico patrimonio distorsionado | UI de gestión + purga |
| **MEDIO** | Inversiones | getQuotes falla primer intento | Sin precios hasta retry | Retry en apiClient |
| **MEDIO** | Analytics | `curMonthKey` en module load time | Stale al cruzar medianoche | Mover a función |
| **MEDIO** | Today | CC vencimientos no en próximos pagos | Alerta crítica no mostrada | Extender selector |
| **BAJO** | Presupuestos | Proyección lineal días 1–3 | Insight irreal ($3.75M) | TD-36 |
| **BAJO** | Metas | Forecast usa ahorro 2 días | $57M proyectado irreal | Promedio 3 meses |

---

## Fase 2 — Auditoría Frontend

### Arquitectura
✅ **Correcta.** Flujo `Services → Store → Views` respetado. Las vistas nunca acceden a red o IndexedDB directamente.

✅ **`crud.js` `guardedOp/guardedSave`** — implementado y usado en 10 vistas. Elimina duplicación masiva de try/catch.

✅ **`ENTITIES`** unificado — `WRITE` map eliminado correctamente.

### Código duplicado residual
- `analytics.js` duplica lógica de `curMonthKey` que ya existe en `selectors.js`
- `import.js` duplica el patrón `el('label', {for: ...})` de forms.js para selects
- `investments.js` y `debts.js` tienen su propio `toCOP()` — podría extraerse a `format.js`

### Anti-patrones encontrados
1. **Module-level side effects en analytics.js** — `const now = new Date()` en el módulo, no en la función
2. **import.js usa API de Button incorrecta** — inconsistencia con el resto de la app
3. **import.js mezcla HTML directamente** — `<p>` tags en strings en lugar de usar `el()`

### CSS / Design System
✅ Tokens correctos. `tokens.css` → `themes.css` → `components.css` bien estructurado.  
✅ `kpi--emerald` y `kpi--info` unificados como aliases.  
✅ `.icon-btn` unificado.  
⚠️ Algunos estilos en `import.js` son inline strings (ya documentado en TD-32, pero import.js no fue alcanzado).

---

## Fase 3 — Auditoría UX/UI

Ver documento completo: `docs/UX-Recommendations-2026-06-02.md`

**Puntuación global: 7.0/10** — Muy por encima de ERP/CRM genérico. Cerca de MVP de calidad. Para alcanzar el nivel de Copilot Money / Linear necesita principalmente: tooltips en gráficos, micro-animaciones, filtros temporales, validación inline.

---

## Fase 4 — Auditoría Financiera Global

### Patrimonio Neto
| Componente | Frontend (selectors.js) | Backend (Reports.gs) | Estado |
|---|---|---|---|
| Cuentas líquidas | Excluye investment + CC | Excluye investment (solo) | ⚠️ Diverge |
| Inversiones | priceService + FX | quantity × currentPrice (sin FX!) | ⚠️ Diverge si divisas mixtas |
| Otros activos | ✅ | ✅ | OK |
| Pasivos Liabilities | ✅ | ✅ | OK |
| Tarjetas CC | ✅ Incluidas | ❌ No incluidas | 🔴 **BUG-P0-2** |

**Riesgo P0:** El patrimonio neto en el backend puede diferir del frontend en `abs(sum(CC balances))`.

### Liquidez
✅ `totalLiquidity` excluye correctamente inversiones y CC. Valor producción: $4.485.000 = $4.250.000 (Bancolombia) + $35.000 (Global66) + $200.000 (Efectivo). ✅ Correcto.

### Inversiones (Valor)
✅ `investmentsValue` usa `priceService.priceFor(symbol)` con fallback a `currentPrice`.  
✅ FX via `priceService.fxRates` (USD→COP, EUR→COP).  
✅ `roundMoney()` aplicado para evitar float acumulado.  
⚠️ Si no hay tasa FX disponible (priceService vacío), la inversión en USD se suma sin conversión (como si fuera COP). Esto es comportamiento degradado documentado pero puede confundir.

### Cost Basis / DCA
✅ `weightedAvg = totalCost / totalQty` es correcto.  
✅ `investmentsCost` usa `avgCost || purchasePrice` — maneja ambos campos.  
⚠️ Si `avgCost` y `purchasePrice` difieren (inconsistencia de datos), se prioriza `avgCost` que puede no ser el precio de compra real de esa posición.

### Rentabilidad
✅ `investmentsReturnPct = (value - cost) / cost × 100` — correcto.  
⚠️ Sin anualización (TWR/IRR) — TD-38 — aceptable como P3.

### Presupuestos
✅ `budgetConsumed` usa `normPeriodKey` correctamente.  
✅ `budgetStats` calcula consumed, available, pct, projected.  
⚠️ Proyección lineal sobre-proyecta días 1–3 (TD-36).  
⚠️ Sin validación de solapamiento categoría+período (TD-37).

### Metas
✅ `goalForecast` implementado (Sprint 9). Usa ahorro real del mes.  
⚠️ Ahorro de 2 días de data produce forecast irreal. Fix: promedio 3 meses.

### Deudas
✅ `debtList` unifica Liabilities + cuentas credit_card correctamente.  
✅ `debtStats`: total, cuota mínima, tasa promedio ponderada.  
✅ `amortize()` con iteración mes a mes — matemáticamente correcto.  
✅ Verificado en producción: Amex $3.409.196 · 28.8% · $1.340.968/mes → 3 meses · $136.105 intereses.

### Flujo mensual (Ingresos/Gastos/Ahorro)
✅ Transferencias no cuentan como ingreso ni gasto.  
✅ `sameMonth()` con `slice(0,7)` — resistente a timezone (TD-12 resuelto).

---

## Fase 5 — Auditoría de Patrimonio

### Assets / Liabilities
✅ CRUD completo funcional.  
✅ Composición donut correcta (activos líquidos 93.5%, inversiones 6.5%).

### NetWorthSnapshots
🔴 **Snapshots de prueba en DB** — valores $44.3M y $29.7M distorsionan el gráfico de evolución. El patrimonio real es $1.389.926.

**Propuesta de gestión de snapshots (diseño detallado):**

**UX:**
1. En tarjeta "Evolución del patrimonio" → botón "Gestionar snapshots"
2. Modal con lista de todos los snapshots ordenados por fecha
3. Cada fila: ☐ Fecha | Valor | Variación vs anterior | ⚠️ badge si valor es outlier | 🗑 button
4. Footer: [Eliminar seleccionados] [Cancelar]
5. Confirmación: "¿Eliminar N snapshot(s)? Esta acción no se puede deshacer."

**Detección de outliers:** `valor > 3 × mediana` o `|Δ%| > 80%` entre snapshots consecutivos.

**Arquitectura:**
- Frontend: `dataService.remove('netWorthSnapshots', id)` — ya soportado por `syncEngine`
- Backend: nueva acción `deleteNetWorthSnapshot` en `backend/NetWorth.gs`
- Multi-select: enviar array a `batchWrite` (ya implementado en TD-26)
- Auditoría: `logAudit_('delete', 'NetWorthSnapshots', id)` — ya existe

**Validaciones:**
- No eliminar el último snapshot (guardar al menos 1)
- Confirmar si se eliminan más de 5 a la vez
- El gráfico de evolución se refresca automáticamente via store.subscribe

---

## Fase 6 — Auditoría de Inversiones

### Análisis de funcionalidades vs competidores

| Característica | FinanceOS | Snowball | Sharesight | Kubera | Empower | Clasificación |
|---|---|---|---|---|---|---|
| Acciones / ETFs | ✅ | ✅ | ✅ | ✅ | ✅ | Imprescindible ✅ |
| CDT / Renta fija | ✅ | ❌ | ❌ | ✅ | ❌ | Imprescindible ✅ |
| Cripto | ✅ | ✅ | ✅ | ✅ | ✅ | Imprescindible ✅ |
| Fondos FIC | ✅ | ❌ | ❌ | ❌ | ❌ | Imprescindible ✅ |
| DCA / Cost basis | ✅ | ✅ | ✅ | ✅ | ✅ | Imprescindible ✅ |
| Precios en vivo | ✅ Yahoo | ✅ | ✅ | ✅ | ✅ | Imprescindible ✅ |
| FX multi-divisa | ✅ USD/EUR | ✅ | ✅ | ✅ | ✅ | Imprescindible ✅ |
| P&L Realizado | ✅ | ✅ | ✅ | ✅ | ✅ | Imprescindible ✅ |
| Dividendos | ✅ (ingreso) | ✅ | ✅ | ✅ | ✅ | Imprescindible ✅ |
| Ventas / Posiciones cerradas | ✅ | ✅ | ✅ | ✅ | ✅ | Imprescindible ✅ |
| XIRR / TIR | ❌ | ✅ | ✅ | ❌ | ✅ | Recomendado |
| CAGR | ❌ | ✅ | ✅ | ❌ | ✅ | Recomendado |
| Comisiones | ❌ | ✅ | ✅ | ❌ | ✅ | Recomendado |
| Retenciones | ❌ | ✅ | ✅ | ❌ | ❌ | Recomendado |
| Splits | ❌ | ✅ | ✅ | ❌ | ✅ | Recomendado |
| Reinversión DRIP | ❌ | ✅ | ✅ | ❌ | ❌ | Avanzado |
| Sharpe / Volatilidad | ❌ | ✅ | ✅ | ❌ | ✅ | Avanzado |
| Drawdown | ❌ | ✅ | ❌ | ❌ | ❌ | Avanzado |
| Cash de broker | ❌ | ✅ | ❌ | ✅ | ✅ | Avanzado |
| REITs / Metales | ❌ como "Otros" | ✅ | ✅ | ✅ | ✅ | P3 |

**Riesgos de cálculo identificados:**
1. Si `priceService` no tiene FX rates, inversiones en USD se suman sin conversión → patrimonio incorrecto silencioso
2. Si un ticker tiene 0 precio y 0 currentPrice, la posición se excluye del valor → subestima el portafolio
3. `avgCost` vs `purchasePrice` discrepancia no detectada → cost basis incorrecto en posiciones antiguas

---

## Fase 7 — Auditoría de Metas

✅ `goalForecast()` implementado. Muestra fecha estimada y ahorro mensual requerido.  
⚠️ Forecast irreal en días 1–3 del mes (ver BUG-P2).  
⚠️ Sin simulación de escenarios (¿qué si ahorro $200k extra/mes?).  
⚠️ Sin gráfico de evolución histórica del progreso de cada meta.  
⚠️ Sin categorías de meta (fondo emergencia, retiro, viaje no tienen tratamiento diferenciado).

---

## Fase 8 — Auditoría de Deudas

✅ **Implementación excelente.** Panel de CC rico, Snowball/Avalanche, amortización real, proyección completa.  
✅ `amortize()` verificado en producción: correcto.  
✅ Badge WCAG 1.3.3 para urgencia ("2 DÍAS").  
⚠️ Sin comparación lado a lado Snowball vs Avalanche.  
⚠️ Sin simulador "¿qué pasa si pago X extra este mes?".  
⚠️ Hipotecas a largo plazo (>10 años): el limite de 600 meses en `amortize()` es suficiente.

---

## Fase 9 — Auditoría Backend

### Rendimiento
✅ `repoReadAll_` usa rango explícito (TD-25) — correcto.  
✅ `repoUpdate_` lee fila directamente (TD-24) — 1 op Sheets.  
✅ `getBootstrap` carga 12 colecciones en 1 ejecución (TD-15) — verificado en producción.  
✅ `openById` memoizado en `_db` (TD-16) — 1 apertura por ejecución.  
✅ `LockService.getScriptLock()` en `doPost` (TD-27) — exclusión mutua.  
✅ `batchWrite` implementado (TD-26).  
✅ `purgeDeleted_()` implementado (TD-28).

### Seguridad
✅ Auth por Google ID Token con CacheService (25 min). Solo 2 emails autorizados.  
✅ `assertAuthorized_` en toda acción excepto `ping`.  
✅ `requireFields_`, `sanitizeString_`, `requireEnum_`, `toAmount_` — validación básica.  
✅ `LockService` previene race conditions multi-dispositivo.

### Bugs / Riesgos
🔴 **BUG-P0-2:** `computeNetWorth_()` no incluye CC como pasivos.  
⚠️ `getDashboard_()` también usa `computeNetWorth_` → mismo error.  
⚠️ `listTransactions_` retorna TODOS los registros sin paginación real — a escala (>5000 tx) será lento.  
⚠️ `repoFindRowIndex_` hace O(n) en la columna id — para entidades con muchos registros puede ser lento.

---

## Fase 10 — Auditoría de Sincronización

✅ `syncEngine.flush()` con dead-letter (TD-10) — implementado y funcional.  
✅ Escritura atómica dato+cola en IndexedDB (TD-14).  
✅ `flush()` antes de `pull()` (TD-13).  
✅ `batchWrite` agrupa ≥2 ops (TD-26) con fallback op-a-op.  
✅ Estado de sync correcto: idle/pending/syncing/error.  
✅ Dead-letter visible en Ajustes con Reintentar/Descartar.

**Riesgos residuales:**
⚠️ `reconcileAndHydrate` re-aplica la cola FIFO sobre el patch del backend — si el mismo registro tiene update + delete en cola, el resultado puede ser incorrecto (corner case).  
⚠️ Si el backend asigna un ID diferente al ID optimista (raro con ULID), `reconcile()` limpia el temporal correctamente. Pero si hay 2 ops en cola para el mismo ID optimista, la segunda puede fallar.

---

## Fase 11 — Auditoría PWA

✅ Service Worker v0.2.28 con network-first para JS/CSS.  
✅ `SKIP_WAITING` via message desde `app.js` — actualizaciones sin Ctrl+Shift+R.  
✅ Inter cacheada con estrategia cross-origin en SW.  
✅ `manifest.json` con iconos maskable.  
⚠️ `config.version` desincronizado (0.2.23 vs SW 0.2.28) — BUG-P1-5.  
⚠️ Sin estrategia explícita de cache para las llamadas al backend (Apps Script) — se usan con network-first implícito.

---

## Fase 12 — Validación de Tests

```
Tests ejecutados: 45/45 ✅
Tiempo: 382ms
```

### Cobertura actual
| Módulo | Tests | Cobertura |
|---|---|---|
| totalAssets | 7 | ✅ Buena |
| totalLiabilities | 4 | ✅ Buena |
| netWorth | 6 | ✅ Buena |
| totalLiquidity | 3 | ✅ Buena |
| Inversiones | 5 | 🟡 Falta FX, fallback sin precio |
| Flujo mensual | 6 | ✅ Buena |
| Presupuestos | 6 | ✅ Buena |
| Deudas | 4 | 🟡 Falta Snowball/Avalanche ordering |
| hasMixedCurrencies | 4 | ✅ Buena |

### Tests faltantes (prioritarios)
1. `investmentsValue` cuando `priceService` tiene FX rates (conversión USD→COP)
2. `investmentsValue` cuando ticker sin precio ni currentPrice → debe excluir, no sumar 0
3. `goalForecast` con savings promedio 3 meses
4. `upcomingPayments` con CC que tienen `paymentDay`
5. `amortize()` con pago que no cubre intereses (∞)
6. `amortize()` con tasa 0 (crédito sin intereses)
7. `cashflow()` agrupación correcta por mes (edge: primer/último día)
8. `debtList` con liability de tipo `credit_card` + cuenta `credit_card` — sin doble conteo
9. `financialScore()` con diferentes escenarios de liquidez/ahorro/presupuesto

---

## Resumen ejecutivo de la auditoría

### Estado del proyecto
FinanceOS está en excelente estado para ser el sistema financiero personal más completo de Colombia. La arquitectura es sólida, toda la deuda P0/P1/P2 fue resuelta, y el stack Vanilla JS offline-first es correcto para los principios del proyecto.

### Hallazgos críticos nuevos (no documentados previamente)
1. **Módulo `#/import` completamente roto** — 4 bugs independientes que impiden cualquier importación
2. **Backend `computeNetWorth_()` diverge del frontend** — diferencia de $3.4M en el caso de producción real

### Fortalezas del proyecto
- Deudas: implementación de clase mundial (panel CC + Snowball/Avalanche + amortización real)
- Inversiones: DCA, multi-divisa, precios en vivo, dividendos, posiciones cerradas
- Sincronización: offline-first con dead-letter, atomicidad IndexedDB, batchWrite
- Tests: 45 tests financieros sólidos, sin dependencias externas
- Seguridad: OAuth + validación backend + LockService

### Deuda técnica P3 restante
TD-33 (reactividad granular), TD-34 (merge inmutable), TD-35 (aporte a meta), TD-36 (proyección), TD-37 (solapamiento), TD-38 (XIRR), TD-39 (recurrentes auto), TD-40 (theming). Todos son mejoras incrementales sin impacto en funcionalidad core.

---

*Auditoría completada el 2026-06-02 · Metodología: análisis estático + Playwright MCP en producción + suite de tests*
