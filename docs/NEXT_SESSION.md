# Prompt de continuación — FinanceOS
**Generado:** 2026-06-03 (sesión completa: /handoff in → /audit → /roadmap → /implement Sprint 1 → /handoff out)
**HEAD:** `b23a4f6` · **SW:** `v0.2.46` · **Tests:** 65/65

---

```text
Lee PROJECT_HANDOFF.md (CONTEXTO MÍNIMO primero, luego §18) y CLAUDE.md antes de cualquier cambio.

MCP: .mcp.json versionado con playwright y context7 (scope de proyecto).
Tras git pull deben APROBARSE y REINICIARSE Claude Code: las tools MCP se fijan al arrancar.

PROYECTO: FinanceOS — PWA financiera personal y privada de Alejo.
Repo: https://github.com/alejandror1367/FinanceOS (rama main).
Prod: https://alejandror1367.github.io/FinanceOS/
HEAD: b23a4f6 · SW v0.2.46 · config.version 0.2.46 · Tests 65/65

INVARIANTES (ver CLAUDE.md): JS ES Modules sin build step · sin frameworks/bundlers ·
cero deps npm en runtime · frontend abstraído tras src/services/ · Apps Script +
Google Sheets (13 hojas) + GitHub Pages + OAuth de Google · offline-first.

HECHO Y COMMITEADO (sesión 2026-06-03, tarde):

AUDITORÍA GLOBAL (/audit, 4/5 áreas):
- 46 hallazgos: P0:5 / P1:12 / P2:19 / P3:10. IDs nuevos TD-41…TD-53.
- Entregables: Audit-Global / Bugs-Criticos / QuickWins / UX-Recommendations del 2026-06-03.

ROADMAP (/roadmap):
- docs/Roadmap-Implementacion-2026-06-03.md: 9 sprints, ~14-17 días, basado en auditoría.

SPRINT 1 — Integridad de cifras maestras (/implement):
- BE-001/TD-45 (45b47ec): guard isDeleted en idempotentHit_ → no resucita soft-deletes
- BE-003/TD-02 (bc4f1fe): getQuotes devuelve fxRates{USD,EUR}; selectores excluyen 1:1
- FIN-001/TD-41 (8751f9a): computeNetWorth_ filtra vendidos+isDeleted, suma comisión
- FIN-002/TD-42 (4073ddf): applyWithholding() descuenta retención del P&L realizado
- BE-002/TD-46 (b23a4f6): _recalcAccountBalance (idempotente) reemplaza ajuste delta
- +11 tests nuevos (65/65, 13 suites)

⚠ DEPLOY MANUAL PENDIENTE (3 archivos .gs — dueño debe desplegar en Apps Script):
  backend/Utils.gs    ← commit 45b47ec (guard isDeleted)
  backend/Quotes.gs   ← commit bc4f1fe (fxRates en getQuotes)
  backend/Reports.gs  ← commit 8751f9a (computeNetWorth_ paridad FE)

PENDIENTES EN ORDEN:
1. INMEDIATO: despliega los 3 .gs en Apps Script → recarga prod → verifica en vivo:
   - getQuotes devuelve {quotes, fxRates} con tasas USDCOP/EURCOP
   - Patrimonio dashboard coincide con vista Inversiones (sin lotes vendidos inflados)
   - P&L neto de retención visible en inversiones
   - Crear tx offline, editarla 2 veces offline, flush → saldo correcto sin doble conteo
2. Sprint 2 (ventas parciales + valoración CDT) — NO requiere deploy: /implement 2
3. Sprint 3 (accesibilidad/DS WCAG AA) — NO requiere deploy, ideal primer PR limpio: /implement 3
4. QA en vivo Playwright (pendiente de la auditoría): /audit playwright
5. TD-43 (ventas parciales): pedir cantidad a vender en el modal (Sprint 2)

BUGS P1 ABIERTOS:
- TD-43: ventas parciales rotas (soldQuantity = qty comprada) — Sprint 2
- TD-44: CDT sobrevaluado (capitaliza sobre totalCost+comisión, sin tope en vencimiento) — Sprint 2

RIESGOS VIVOS:
- TD-02 🟡 parcial: FX frontend ok; backend Quotes.gs ⚠ pendiente deploy
- listTransactions_ sin paginación >5000 tx — Sprint 4
- TD-47: reconcileAndHydrate reduce update a su patch — Sprint 4

FORMA DE TRABAJO: fases pequeñas y verificables · explicar qué/por qué ·
correr node --test tests/selectors.test.js tras cada cambio de selector (65/65 base) ·
commits atómicos por feature · hook auto-bumpa SW + config.version al commitear src/.
Para mensajes de commit multilínea: archivo temporal _commitmsg.txt + git commit -F _commitmsg.txt
Empezar con: git log --oneline -5 · git status · node --test tests/selectors.test.js.
```
