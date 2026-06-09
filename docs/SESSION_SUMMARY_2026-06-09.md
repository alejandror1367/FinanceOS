# Resumen de sesión — 2026-06-09

## Resumen ejecutivo

Sesión completa de implementación del plan Opus R0–R5 sobre FinanceOS. Se corrigieron bugs críticos de patrimonio (snapshot mostraba $314k en lugar de $12.9M real por precios stale en Apps Script), se completaron los 6 sprints del plan Opus, y se unificaron todos los roadmaps en `docs/Roadmap-Maestro.md`.

## Hallazgos principales

| Hallazgo | Severidad | Estado |
|---|---|---|
| Snapshot INV=$0 ($314k patrimonio): Apps Script no accede Yahoo Finance → precios stale | Crítico | ✅ Fix R3 |
| Snapshots duplicados: Sheets auto-convierte `Date` → ISO full → `===` siempre false | Crítico | ✅ Fix R3 |
| `computeNetWorth_` incluía CC en `totalLiabilities` duplicando el pasivo | Alto | ✅ Fix R0 |
| `logAccessDenied_` sin rate-limit → spam ilimitado en AuditLog | Medio | ✅ Fix R5 |
| 4 roadmaps activos en paralelo con contradicciones | Organización | ✅ Unificado |

## Cambios implementados

| Sprint | Cambio | Impacto |
|---|---|---|
| R0 | `computeNetWorth_`: excluye CC de `totalLiabilities` | Paridad FE↔BE patrimonio |
| R0 | Exponer `ccDebt`/`liabilitiesDebt` en Reports.gs | Desglose snapshot correcto |
| R0 | Deploy 5 `.gs` (Auth, Code, Utils, Quotes, Reports) | TD-01/41/45/50/51 cerrados |
| R1 | `liquidityCoverageMonths` + `savingsStreak` (selectores) | Insights financieros |
| R1 | fire.js: fecha estimada, ProgressBar, variantes FIRE | UX simulador |
| R1 | analytics.js: 3 insights nuevos | Analítica automática |
| R2 | `dismissService.js` + botón "Visto ✓" hoy/dashboard | UX pagos próximos |
| R3 | Snapshots 6 campos desglose + frontend values | Fix INV=$0 / $314k→$12.9M |
| R3 | Idempotencia por fecha (Sheets Date auto-conversión) | Fix duplicados |
| R4 | `portfolioAlerts` + `positionValue` + `cdtCurrentValue` | Alertas portafolio |
| R4 | Fix `investmentsSummary` en dashboard | Paridad dashboard↔inversiones |
| R5 | `logAccessDenied_` con rate-limit CacheService | Seguridad AuditLog |
| R5 | `importMaxChars` configurable en Config.gs | Seguridad import |
| Docs | `Roadmap-Maestro.md` (fuente única, ~400 líneas) | Organización |

## Archivos modificados

**Backend (deploy manual realizado por Alejo):**
- `backend/Auth.gs` — logAccessDenied_ con rate-limit
- `backend/Config.gs` — APP.importMaxChars, rate-limit params
- `backend/Import.gs` — usa APP.importMaxChars
- `backend/Code.gs` — docblock SEC-001
- `backend/NetWorth.gs` — 6 campos snapshot, frontend values, idempotencia fecha
- `backend/Reports.gs` — excluir CC de totalLiabilities, exponer ccDebt/liabilitiesDebt

**Frontend:**
- `src/services/apiClient.js` — comentario SEC-001
- `src/services/dataService.js` — saveSnapshot(frontendValues)
- `src/services/dismissService.js` — nuevo
- `src/store/selectors.js` — liquidityCoverageMonths, savingsStreak, positionValue, portfolioAlerts
- `src/views/fire.js` — fecha estimada, ProgressBar, variantes, EmptyState
- `src/views/analytics.js` — 3 insights nuevos
- `src/views/today.js` — botón "Visto ✓"
- `src/views/dashboard.js` — botón "Visto ✓", investmentsSummary fix
- `src/views/networth.js` — doSaveSnapshot con payload, desglose snapshot

**Tests:** `tests/selectors.test.js` — +11 tests → 115/115 (24 suites)

**Docs:**
- `docs/Roadmap-Maestro.md` — nuevo, fuente única
- `docs/NEXT_SESSION.md` — actualizado
- `docs/TechnicalDebt.md` — TD-01/41/45/50/51 marcados ✅
- `PROJECT_HANDOFF.md` — CONTEXTO MÍNIMO, §2, §15, §18, §19 actualizados

## Commits relevantes

```
06db320 docs: Roadmap-Maestro.md — fuente única de planificación unificada
b0ca32d fix(dashboard): investmentsSummary para paridad exacta con sección Inversiones
4a92a49 fix(selectors): investmentsValue y positionValue usan cdtCurrentValue para CDTs
bdf03f6 feat(selectors): portfolioAlerts + positionValue — alertas determinísticas (R4)
c9f63bf fix(dismiss): untilDate = max(nextRunDate, tomorrow) para pagos vencidos (R2)
ad76b96 feat(networth): mostrar desglose en filas de snapshot cuando disponible (R3)
ab655cb fix(networth): snapshot envia valores en vivo desde store+priceService (R3)
a3a5fe3 fix(backend): idempotencia snapshot por fecha (Sheets Date auto-conversión) (R3)
ac2f8f8 feat(networth): saveNetWorthSnapshot_ acepta valores del frontend (R3)
81e07cf feat(networth): 6 campos de desglose en NetWorthSnapshots (R3)
2164d52 feat(security): logAccessDenied_ con rate-limit en Auth.gs (R5)
60a8637 feat(security): importMaxChars y params rate-limit en Config.gs (R5)
```

## Trabajo pendiente y no verificado en vivo

- fire.js variantes / ProgressBar / fecha estimada — Playwright con auth real
- analytics.js 3 insights nuevos — Playwright
- Flujo venta parcial/total en UI Inversiones

## Próximas 5 tareas prioritarias

1. **Sprint A (P0)**: FX backend (Quotes.gs COP/USD/EUR, caché 1h) + soft-delete guard + withholdingRate — **requiere deploy**
2. **Sprint B (P0)**: Modal ventas parciales + prorrateo comisión + tope cdtCurrentValue
3. **Verificación Playwright**: R1 fire.js y analytics.js con auth real
4. **Sprint C (P1)**: Accesibilidad WCAG AA — contraste, aria, reduced-motion — sin deploy
5. **Sprint D (P1)**: Rediseño `calcYield` (saldo promedio, NO balance actual — sobreestima ~7×) — **requiere deploy**
