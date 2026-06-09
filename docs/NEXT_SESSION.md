# Prompt de continuación — FinanceOS
**Generado:** 2026-06-09 (sesión R0–R5 completados, Roadmap-Maestro.md)
**HEAD:** `06db320` · **SW:** `v0.2.90` · **Tests:** 115/115 (24 suites)

---

```text
Lee PROJECT_HANDOFF.md (CONTEXTO MÍNIMO primero, luego §18) y CLAUDE.md antes de cualquier cambio.

MCP: .mcp.json versionado con playwright y context7 (scope de proyecto).
Tras git pull deben APROBARSE y REINICIARSE Claude Code: las tools MCP se fijan al arrancar.

PROYECTO: FinanceOS — PWA financiera personal y privada de Alejo.
Repo: https://github.com/alejandror1367/FinanceOS (rama main).
Prod: https://alejandror1367.github.io/FinanceOS/
HEAD: 06db320 · SW v0.2.90 · Tests 115/115 (24 suites)

INVARIANTES (ver CLAUDE.md): JS ES Modules sin build step · sin frameworks/bundlers ·
cero deps npm en runtime · frontend abstraído tras src/services/ · Apps Script +
Google Sheets (13 hojas) + GitHub Pages + OAuth de Google · offline-first.

ROADMAP ACTIVO: docs/Roadmap-Maestro.md ← fuente única (reemplaza todos los anteriores).
Sprints R0–R5 (plan Opus) completados y desplegados en sesión 2026-06-09.

HECHO Y DESPLEGADO (sesión 2026-06-09):
- R0 ✅: fix FE↔BE pasivos CC · ccDebt/liabilitiesDebt expuestos · 5 .gs desplegados
- R1 ✅: liquidityCoverageMonths · savingsStreak · FIRE (variantes/ProgressBar/fecha) · 3 insights analytics
- R2 ✅: dismissService.js · botón "Visto ✓" hoy/dashboard · tests
- R3 ✅: snapshots 6 campos desglose · frontend values (fix INV=$0/snapshot $314k) · idempotencia fecha · deploy
- R4 ✅: portfolioAlerts · positionValue · cdtCurrentValue · fix dashboard investmentsSummary
- R5 ✅: logAccessDenied_ rate-limit · iss/exp · importMaxChars 50K · deploy
- Roadmap-Maestro.md como fuente única de planificación

HALLAZGOS VIGENTES:
- calcYield (Sprint D) DEBE usar saldo promedio/acumulación diaria, NO balance actual (sobreestima ~7×).
- ensureHeaders_ NO es append-only idempotente: solo appendear al final.
- getBootstrap_ limita a 24m de transacciones (confirmar impacto histórico).

PENDIENTES EN ORDEN (Roadmap-Maestro Sprints A–J):

1. Sprint A — Integridad cifras P0 ← SIGUIENTE (deploy):
   - FX backend en Quotes.gs (COP/USD/EUR, caché 1h).
   - soft-delete guard en Utils.gs (rechazar update/delete en isDeleted=true).
   - withholdingRate en selectors.js (rentabilidad neta de retención).

2. Sprint B — Ventas parciales P0 (sin deploy):
   - Modal "Vender" con campo cantidad parcial o total.
   - Prorrateo proporcional de comisiones al costo base.
   - cdtCurrentValue: no exceder valor nominal.

3. Sprint C — Accesibilidad WCAG AA P1 (sin deploy, todo JS):
   - Contraste · aria-label · aria-live · reduced-motion.

4. Sprint D — Cuentas remuneradas P1 (deploy):
   - REDISEÑAR calcYield: saldo promedio o acumulación diaria — NO balance actual.
   - lastYieldDate · interestRate EA · idempotencia (accountId, periodo).

5. Sprint E–J: Deudas/Metas · Import/Export · Backend perf · Charts · QA · Avanzado.
   Ver Roadmap-Maestro.md para detalle.

BUGS / VERIFICACIONES PENDIENTES:
- 🟡 Verificación en vivo R1 (fire.js variantes + analytics insights) — Playwright.
- 🟡 Flujo venta parcial/total en UI Inversiones — por confirmar en vivo.

RIESGOS ABIERTOS:
- calcYield sobreestima patrimonio hasta ~7× → Sprint D obligatorio.
- Sesión de facto perpetua sin app-lock; 2º email con acceso total.
- getBootstrap_ limita a 24m de transacciones.

FORMA DE TRABAJO: fases pequeñas y verificables · explicar qué/por qué ·
correr node --test tests/selectors.test.js tras cada cambio de selector (115/115 base) ·
commits atómicos por feature · hook auto-bumpa SW + config.version al commitear src/.
Para mensajes de commit multilínea en PowerShell: git commit -F _commitmsg.txt (archivo temporal).
Empezar con: git log --oneline -5 · git status · node --test tests/selectors.test.js.
```
