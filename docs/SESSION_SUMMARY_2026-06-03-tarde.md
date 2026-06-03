# Session Summary — 2026-06-03 (tarde)

## Resumen ejecutivo
Sesión productiva de implementación: 4 sprints completados (Sprints 2, 3, 4 del roadmap 2026-06-03 + fix FIN-014). Se cerró toda la deuda P1 de inversiones, se llevó la app a conformidad WCAG 2.2 AA, se eliminó un bug de doble conteo en Patrimonio y se optimizó el backend con caché per-request y operaciones Sheets en bloque. Tests: 65→75 (+10). SW: v0.2.46→v0.2.52.

## Tabla de cambios

| Cambio | Impacto |
|--------|---------|
| Modal de venta con qty + ventas parciales | P&L realizado correcto; liquidación parcial real |
| lotRealizedPnL: comisión prorateada | Costo base exacto en ventas fraccionadas |
| cdtCurrentValue: capital puro + tope vencimiento | CDT ya no sobrevalora ni crece tras vencer |
| WCAG AA: contraste, ARIA, reduced-motion, DS tokens | Conformidad a11y; DS sin hex crudos |
| FIN-014: totalLiabilities sin doble conteo CC | Patrimonio correcto si se añade liability CC |
| CC como filas reales en Pasivos | KPI explicado visualmente |
| isTransient: "No autorizado" → dead-letter | Cola sync ya no se atasca en 401/403 |
| flushBatch por entityId | Emparejamiento correcto si servidor reordena resultados |
| reconcileAndHydrate merge en updates | Campos no modificados sobreviven al refresh |
| repoReadAll_ caché per-request | Lecturas O(1) en 2ª+ llamada del mismo request |
| purgeDeleted_ en bloque | De N→2 ops Sheets; sin timeout con hojas grandes |
| truncateAuditLog_ 90 días | AuditLog acotado; cold-start más rápido a largo plazo |
| getBootstrap_ ventana 24m | Payload reducido; cold-start más rápido con historial grande |

## Archivos modificados
- `src/store/selectors.js` — lotRealizedPnL, cdtCurrentValue, totalLiabilities guard
- `src/services/syncEngine.js` — isTransient, flushBatch
- `src/services/dataService.js` — reconcileAndHydrate merge
- `src/views/investments.js` — modal venta parcial
- `src/views/networth.js` — CC filas, credit_card removido de LIABILITY_TYPES
- `src/styles/themes.css`, `components.css` — contraste, tokens DS
- `src/utils/dom.js` — esc()
- `src/components/charts.js`, `forms.js`, `modal.js`, `ui.js` — ARIA fixes
- `backend/Utils.gs` — repoReadAll_ caché, purgeDeleted_ en bloque
- `backend/Accounts.gs` — ajuste comentario adjustBalance_
- `backend/Audit.gs` — truncateAuditLog_
- `backend/Code.gs` — acción truncateAuditLog
- `backend/Reports.gs` — getBootstrap_ ventana 24m
- `backend/Transactions.gs` — listTransactions_ param since
- `tests/selectors.test.js` — +10 tests

## Commits
```
6b45621 perf(backend): Sprint 4 Grupo B-2 — AuditLog archivado y ventana 24m en bootstrap
056a5ba perf(backend): Sprint 4 Grupo B-1 — caché per-request y purgeDeleted en bloque
7a4c43e fix(sync): Sprint 4 Grupo A — robustez del motor de sincronización frontend
cd839e9 fix(networth): FIN-014 evitar doble conteo CC en totalLiabilities y mejorar UI de Pasivos
b78eff6 fix(a11y): Sprint 3 — accesibilidad JS (3.2, 3.3, 3.5, 3.6)
7c38299 fix(a11y/ds): Sprint 3 — contraste, tokens y DS (3.1, 3.7, 3.8, 3.9, 3.10)
a8dec52 feat(selectors): FIN-004/008/009 selectores puros de lotes CDT y penny-rounding
f1f1bd0 feat(investments): FIN-003 modal de venta con campo qty y ventas parciales
```

## Trabajo pendiente y no verificado en vivo
- Flujo de venta parcial/total en UI (requiere Playwright o prueba manual)
- Historial >24m en getBootstrap no disponible en primer load (comportamiento intencional, sin confirmar impacto)
- truncateAuditLog acción admin: funcional en backend pero sin botón en UI Ajustes

## Próximas 5 tareas prioritarias
1. **Sprint 5 — Seguridad**: validar iss+exp en Auth.gs, id_token en POST, .gitignore secretos, truncar fileContent IA
2. **Sprint 6 — Deudas/Metas**: avgRate con FX, amortización % del saldo, goalForecast repartido, monthlySavingsAvg parcial
3. **Sprint 7 — Charts responsive**: labels eje X rotados, tabla sr-only, bottom-nav móvil
4. **QA Playwright**: recorrer 15 rutas, responsive 375px, dark/light — `/audit playwright`
5. **Verificación manual**: flujo venta parcial en Inversiones (nueva UI con campo qty)
