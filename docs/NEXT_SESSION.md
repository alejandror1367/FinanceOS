# Prompt de continuación — FinanceOS
**Generado:** 2026-06-09 (sesión R0+R1 completados)
**HEAD:** `ac570e8` (+ docs-handoff) · **SW:** `v0.2.80` · **Tests:** 104/104 (22 suites)

---

```text
Lee PROJECT_HANDOFF.md (CONTEXTO MÍNIMO primero, luego §18) y CLAUDE.md antes de cualquier cambio.

MCP: .mcp.json versionado con playwright y context7 (scope de proyecto).
Tras git pull deben APROBARSE y REINICIARSE Claude Code: las tools MCP se fijan al arrancar.

PROYECTO: FinanceOS — PWA financiera personal y privada de Alejo.
Repo: https://github.com/alejandror1367/FinanceOS (rama main).
Prod: https://alejandror1367.github.io/FinanceOS/
HEAD: ac570e8 (+ docs-handoff) · SW v0.2.80 · config.version 0.2.80 · Tests 104/104 (22 suites)

INVARIANTES (ver CLAUDE.md): JS ES Modules sin build step · sin frameworks/bundlers ·
cero deps npm en runtime · frontend abstraído tras src/services/ · Apps Script +
Google Sheets (13 hojas) + GitHub Pages + OAuth de Google · offline-first.

HECHO Y DESPLEGADO:
- Sprints 1–9 completados · QA Playwright 15/15 PASS · backend al día (5 .gs desplegados 2026-06-09)
- R0 ✅: fix FE↔BE pasivos CC (FIN-014 en Reports.gs) · ccDebt/liabilitiesDebt expuestos ·
  TD-01 marcado · Auth/Code/Utils/Quotes/Reports desplegados
- R1 ✅: liquidityCoverageMonths + savingsStreak (selectores promedio 3m) · 104/104 tests ·
  fire.js: fecha estimada, ProgressBar, variantes Lean/Fat/Barista, EmptyState ·
  analytics.js: insights cobertura liquidez, racha ahorro, concentración gastos

PLAN ACTIVO: docs/Roadmap-Revisado-Opus.md (R0+R1 ✅, siguiente R2)
Hallazgos vigentes:
- portfolioCAGR/portfolioVsBenchmark NO existen (necesario para R4).
- calcYield (R5) debe usar saldo promedio, NO balance actual (sobreestima ~7×).
- ensureHeaders_ NO es append-only idempotente: solo appendear al final del schema.

PENDIENTES EN ORDEN (plan R0–R8):

1. R2 — Dismiss de pagos ← SIGUIENTE (sin deploy):
   - dismissService.js: dismiss(id, untilDate), isDismissed(id), clearStale() — localStorage.
   - Semántica DISMISS hasta próxima ocurrencia (NO snooze de N días que reaparece).
   - Recurrentes → dismissedUntil = nextRunDate; CC → fin del ciclo actual.
   - Botón "Visto ✓" en filas upcomingPayments; filtro en VISTA (selector intacto — pureza).
   - Tests: dismiss, expiry por ocurrencia, clear.
   - Archivos: src/services/dismissService.js (nuevo) · src/views/today.js · dashboard.js · tests/

2. R3 — Snapshots enriquecidos (deploy): 6 campos append en NetWorthSnapshots
   (investmentsValue, investmentsCost, accountsValue, otherAssets, ccDebt, liabilitiesDebt).
   SIN liquidity (≡ accountsValue). saveNetWorthSnapshot_ captura desglose.
   networth.js muestra detalle. Archivos: backend/Config.gs · backend/NetWorth.gs · src/views/networth.js

3. R4 — Alertas portafolio I7a (sin deploy): construir positionValue/totalPortfolioValue (NO existen) ·
   portfolioAlerts (concentración>30%, CDT<30d, P&L<-20%, sin diversificación) · precios stale.

4. R5 — Cuentas remuneradas I8 (deploy): REDISEÑAR calcYield (saldo promedio o acumulación diaria,
   NO balance actual) · lastYieldDate · interestRate EA · idempotencia (accountId, periodo).

5. R6 — Import/Export (sin deploy): fixtures antes de dupKey · export por período.

6. R7 (OPCIONAL, deploy) — Narrativa Groq: SIN script lock · datos minimizados ·
   anti prompt-injection · caché CacheService.

7. R8 (OPCIONAL) — App-lock local (PIN+auto-lock) · limpiar allowedEmails.

BUGS / HALLAZGOS ABIERTOS:
- 🟡 Verificación en vivo R1 pendiente con Playwright (fire.js + analytics.js).
- 🟡 Flujo venta parcial/total en UI Inversiones — por confirmar en vivo.

RIESGOS ABIERTOS:
- calcYield sobreestima patrimonio hasta ~7× → rediseño obligatorio antes de R5.
- analyzePortfolio (R7) tomaría LockService → head-of-line blocking del sync.
- Sesión de facto perpetua sin app-lock; 2º email con acceso total a la BD.
- getBootstrap_ limita a 24m de transacciones (confirmar impacto histórico).

FORMA DE TRABAJO: fases pequeñas y verificables · explicar qué/por qué ·
correr node --test tests/selectors.test.js tras cada cambio de selector (104/104 base) ·
commits atómicos por feature · hook auto-bumpa SW + config.version al commitear src/.
Para mensajes de commit multilínea: git commit -F _commitmsg.txt (archivo temporal).
Empezar con: git log --oneline -5 · git status · node --test tests/selectors.test.js.
```
