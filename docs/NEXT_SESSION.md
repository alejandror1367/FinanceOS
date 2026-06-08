# Prompt de continuación — FinanceOS
**Generado:** 2026-06-08 (sesión noche — revisión arquitectónica Opus)
**HEAD:** `590cfd1` · **SW:** `v0.2.77` · **Tests:** 97/97 (20 suites)

---

```text
Lee PROJECT_HANDOFF.md (CONTEXTO MÍNIMO primero, luego §18) y CLAUDE.md antes de cualquier cambio.

MCP: .mcp.json versionado con playwright y context7 (scope de proyecto).
Tras git pull deben APROBARSE y REINICIARSE Claude Code: las tools MCP se fijan al arrancar.

PROYECTO: FinanceOS — PWA financiera personal y privada de Alejo.
Repo: https://github.com/alejandror1367/FinanceOS (rama main).
Prod: https://alejandror1367.github.io/FinanceOS/
HEAD: 590cfd1 · SW v0.2.77 · config.version 0.2.77 · Tests 97/97 (20 suites)

INVARIANTES (ver CLAUDE.md): JS ES Modules sin build step · sin frameworks/bundlers ·
cero deps npm en runtime · frontend abstraído tras src/services/ · Apps Script +
Google Sheets (13 hojas) + GitHub Pages + OAuth de Google · offline-first.

HECHO Y DESPLEGADO:
- Sprints 1–9 completados · QA Playwright 15/15 PASS · 97/97 tests
- Fix auto-refresh precios (700ba60) · Alpaca API (527492b) · KPIs desplegables (57f144e)
- Fix backend CC balance negativo (f0d8ff1) · Re-encolar dead-letter ✅
- Simulador FIRE #/fire (5da9b05+c385baf) · QA-001/QA-002/QA-003 cerrados

PLAN ACTIVO: revisión Opus R0–R8 (docs/Roadmap-Revisado-Opus.md).
Auditoría vigente: docs/Auditoria-Estrategica-Revisada-Opus.md.
Sprints 10–13 de Sonnet (docs/Audit-Estrategica-2026-06-08.md) → SUPERSEDED.
Hallazgos clave de la revisión (verificados contra código):
- Sonnet afirmó falsamente que portfolioCAGR/portfolioVsBenchmark "ya existen" (NO existen).
- calcYield (I8) de Sonnet es financieramente incorrecto (usa balance actual → sobreestima ~7×).
- Divergencia FE↔BE pasivos CC: Reports.gs:50 no replica filtro FIN-014 (selectors.js:131).
- 5 .gs marcados "⚠ pendiente deploy" en TechnicalDebt vs handoff "todo desplegado" → VERIFICAR.
- ensureHeaders_ NO es append-only idempotente (setValues ciego): solo appendear al final.

PENDIENTES EN ORDEN (plan R0–R8):

0. R0 — PRE-FLIGHT ← SIGUIENTE (BLOQUEANTE de R3/R5, requiere deploy):
   - Verificar versión real desplegada (getDashboard/getNetWorth vs FE) y desplegar pendientes
     (Reports.gs TD-41, Utils.gs TD-45, Code.gs TD-50, Auth.gs TD-51, Quotes.gs TD-02).
   - FIX FE↔BE pasivos CC: excluir type==='credit_card' en computeNetWorth_ (Reports.gs:50) + test paridad.
   - Exponer ccDebt y liabilitiesDebt en el return de computeNetWorth_ (prep R3).
   - Marcar TD-01 ✅ en TechnicalDebt; documentar invariante "schema solo append al final".

1. R1 — FIRE + insights (sin deploy): FIRE fecha/ProgressBar/tooltips/variantes/EmptyState ·
   liquidityCoverageMonths CON PROMEDIO (no mes actual) · savingsStreak EXCLUYENDO mes en curso ·
   concentración gastos. Archivos: fire.js · selectors.js · analytics.js. Test por selector.

2. R2 — Dismiss de pagos (sin deploy): dismissService.js semántica DISMISS hasta próxima
   ocurrencia (NO snooze que reaparece) · botón "Visto ✓" · filtro en VISTA (selector intacto).

3. R3 — Snapshots enriquecidos (requiere R0; deploy): 6 campos append (SIN liquidity ≡ accountsValue) ·
   saveNetWorthSnapshot_ captura desglose · networth.js muestra detalle sin duplicar liquidez.

4. R4 — Alertas portafolio I7a (sin deploy): construir positionValue/totalPortfolioValue (NO existen) ·
   portfolioAlerts (concentración>30%, CDT<30d, P&L<-20% con costBasis+comisión, sin diversif.) ·
   degradar con precios stale (etiquetar aproximada).

5. R5 — Cuentas remuneradas I8 (deploy): REDISEÑAR calcYield (saldo promedio o acumulación diaria,
   NO balance actual) · lastYieldDate · interestRate EA · idempotencia (accountId,periodo) · fuente única.

6. R6 — Import/Export (sin deploy): fixtures de regresión ANTES de dupKey → date|amount|descNorm ·
   resumen calidad · validación montos · perfil RappiCuenta · export por período.

7. R7 (OPCIONAL, deploy) — Narrativa Groq: analyzePortfolio SIN script lock (evita congelar sync) ·
   datos minimizados (agregados, no montos/símbolos) · anti prompt-injection (Investments.name) ·
   caché CacheService · disclaimer "no es asesoría financiera".

8. R8 (OPCIONAL) — Endurecimientos P2: app-lock local opcional (PIN+auto-lock; auth.js sesión perpetua) ·
   confirmar/documentar/eliminar 2º email de allowedEmails (aislamiento ya roto).

BUGS / HALLAZGOS ABIERTOS:
- 🔴 Drift de deploy: 5 .gs posiblemente sin desplegar (verificar en R0).
- 🔴 Divergencia FE↔BE pasivos CC (Reports.gs:50 sin filtro FIN-014).
- 🟡 TD-01 resuelto en código pero sin ✅ en TechnicalDebt.md:42.

RIESGOS ABIERTOS:
- R0 es precondición dura de R3/R5: snapshots/remuneradas sobre backend no verificado = corrupción permanente.
- calcYield de Sonnet infla patrimonio hasta ~7× → rediseño obligatorio antes de I8.
- analyzePortfolio tomaría LockService → head-of-line blocking del sync.
- Bootstrap limita a 24m de transacciones (intencional, confirmar impacto histórico).
- Sesión de facto perpetua sin app-lock; 2º email con acceso total a la BD.

VERIFICACIONES PENDIENTES EN VIVO:
- Flujo venta parcial/total en UI Inversiones.
- Estado real del backend desplegado (parte de R0).

FORMA DE TRABAJO: fases pequeñas y verificables · explicar qué/por qué ·
correr node --test tests/selectors.test.js tras cada cambio de selector (97/97 base) ·
commits atómicos por feature · hook auto-bumpa SW + config.version al commitear src/.
Para mensajes de commit multilínea: git commit -F _commitmsg.txt (archivo temporal).
Empezar con: git log --oneline -5 · git status · node --test tests/selectors.test.js.
```
