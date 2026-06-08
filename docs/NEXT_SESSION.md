# Prompt de continuación — FinanceOS
**Generado:** 2026-06-08 (sesión tarde — auditoría estratégica 9 iniciativas)
**HEAD:** `d2be879` · **SW:** `v0.2.77` · **Tests:** 97/97 (20 suites)

---

```text
Lee PROJECT_HANDOFF.md (CONTEXTO MÍNIMO primero, luego §18) y CLAUDE.md antes de cualquier cambio.

MCP: .mcp.json versionado con playwright y context7 (scope de proyecto).
Tras git pull deben APROBARSE y REINICIARSE Claude Code: las tools MCP se fijan al arrancar.

PROYECTO: FinanceOS — PWA financiera personal y privada de Alejo.
Repo: https://github.com/alejandror1367/FinanceOS (rama main).
Prod: https://alejandror1367.github.io/FinanceOS/
HEAD: d2be879 · SW v0.2.77 · config.version 0.2.77 · Tests 97/97 (20 suites)

INVARIANTES (ver CLAUDE.md): JS ES Modules sin build step · sin frameworks/bundlers ·
cero deps npm en runtime · frontend abstraído tras src/services/ · Apps Script +
Google Sheets (13 hojas) + GitHub Pages + OAuth de Google · offline-first.

HECHO Y DESPLEGADO:
- Sprints 1–9 completados · QA Playwright 15/15 PASS · 97/97 tests
- Fix auto-refresh precios (700ba60) · Alpaca API (527492b) · KPIs desplegables (57f144e)
- Fix backend CC balance negativo (f0d8ff1) · Re-encolar dead-letter ✅
- Simulador FIRE #/fire (5da9b05+c385baf) · QA-001/QA-002/QA-003 cerrados

AUDITORÍA ESTRATÉGICA 2026-06-08 (solo análisis, nada implementado):
- docs/Audit-Estrategica-2026-06-08.md: 9 iniciativas evaluadas
- Roadmap-Implementacion-2026-06-02.md: Sprints 10-13 añadidos
- I1 (biométrica) e I3 (multiusuario) descartados definitivamente
- I7 (IA inversiones): solo versión reducida — alertas determinísticas + narrativa Groq descriptiva opt-in

PENDIENTES EN ORDEN:

1. SPRINT 10 ← SIGUIENTE (sin deploy, ~1 día):
   Archivos: src/views/fire.js · src/store/selectors.js · src/views/analytics.js
   - FIRE: fecha estimada ("Alcanzarías en [Mes Año]") · ProgressBar avance · tooltips conceptos
   - FIRE: variantes LeanFIRE/FatFIRE/BaristaFIRE (radio selector, ajusta SWR)
   - FIRE: EmptyState explicativo si no hay datos
   - Analytics: liquidityCoverageMonths(s) + insight "X meses de cobertura"
   - Analytics: savingsStreak(s) + insight "N meses seguidos ahorrando"
   - Analytics: insight concentración gastos (categoría top como % del total)

2. SPRINT 11 (~1 día + deploy Config.gs+NetWorth.gs):
   - snoozeService.js (nuevo): snooze(id,days), isActive(id), clearExpired() — localStorage
   - Botón "Visto ✓" en upcomingPayments de today.js + dashboard.js (filtro en VISTA, no en selector)
   - Schema NetWorthSnapshots: 7 campos append-only (liquidity, investmentsValue, etc.)
   - saveNetWorthSnapshot_: capturar 7 campos enriquecidos

3. SPRINT 12 (~1.5 días + deploy Config.gs+Accounts.gs):
   - Cuentas remuneradas: badge EA%, calcYield(), modal "Registrar rendimiento"
   - selectors.portfolioAlerts(s): 4 alertas determinísticas (concentración, CDT, PnL, diversif.)
   - Sección "Análisis" colapsable en investments.js

4. SPRINT 13 (~1.5 días + deploy Analysis.gs+Code.gs):
   - backend/Analysis.gs: endpoint analyzePortfolio → Groq narrativa DESCRIPTIVA (no prescriptiva)
   - Import: calidad del parsing + validación montos + dupKey mejorado + perfil RappiCuenta
   - Export: selector de período

BUGS ABIERTOS: ninguno conocido.

RIESGOS ABIERTOS:
- Bootstrap limita a 24m de transacciones (intencional, confirmar impacto en datos históricos)
- Sprint 13 narrativa IA: prompt debe ser estrictamente descriptivo (riesgo AMV)

VERIFICACIONES PENDIENTES EN VIVO:
- Flujo venta parcial/total en UI Inversiones

FORMA DE TRABAJO: fases pequeñas y verificables · explicar qué/por qué ·
correr node --test tests/selectors.test.js tras cada cambio de selector (97/97 base) ·
commits atómicos por feature · hook auto-bumpa SW + config.version al commitear src/.
Para mensajes de commit multilínea: git commit -F _commitmsg.txt (archivo temporal).
```
