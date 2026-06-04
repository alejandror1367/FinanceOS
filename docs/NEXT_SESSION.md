# Prompt de continuación — FinanceOS
**Generado:** 2026-06-03 (sesión post-Sprint 5: seguridad OAuth)
**HEAD:** `7242f95` · **SW:** `v0.2.54` · **Tests:** 75/75

---

```text
Lee PROJECT_HANDOFF.md (CONTEXTO MÍNIMO primero, luego §18) y CLAUDE.md antes de cualquier cambio.

MCP: .mcp.json versionado con playwright y context7 (scope de proyecto).
Tras git pull deben APROBARSE y REINICIARSE Claude Code: las tools MCP se fijan al arrancar.

PROYECTO: FinanceOS — PWA financiera personal y privada de Alejo.
Repo: https://github.com/alejandror1367/FinanceOS (rama main).
Prod: https://alejandror1367.github.io/FinanceOS/
HEAD: c4e680d · SW v0.2.56 · config.version 0.2.56 · Tests 88/88

INVARIANTES (ver CLAUDE.md): JS ES Modules sin build step · sin frameworks/bundlers ·
cero deps npm en runtime · frontend abstraído tras src/services/ · Apps Script +
Google Sheets (13 hojas) + GitHub Pages + OAuth de Google · offline-first.

HECHO Y DESPLEGADO (sesiones 2026-06-03):

SPRINTS 1–4 (tarde):
- Sprint 1: 5 bugs P0 (TD-41…46), +10 tests
- Sprint 2: ventas parciales/totales, CDT capitalizado, penny-rounding
- Sprint 3: WCAG AA — contraste, tokens, ARIA, focus
- FIN-014: doble conteo CC en totalLiabilities eliminado
- Sprint 4: backend perf + robustez sync (caché, purgeDeleted, bootstrap 24m, AuditLog)

SESIÓN NOCHE (06d2c4c):
- Analítica reestructurada: flujo de caja 3 series + selector 3/6/12m · tabla tendencias top5 categorías × 6m · insights históricos · eliminados 3 bloques que duplicaban Dashboard
- PDF patrimonial corregido: "Sin deudas" → muestra CC + liabilities; accountsValue excluye investment y CC
- Nuevo selector: categoryTrends(s, n, topN)

SPRINT 5 — COMPLETO Y DESPLEGADO (7242f95):
SPRINT 6 — COMPLETO (0fcb1ab, sin deploy):
SPRINT 7 — COMPLETO (c4e680d, sin deploy):
- SEC-002/TD-51 ✅: Auth.gs valida iss ∈ {accounts.google.com, https://…} y exp > now
- SEC-006/TD-09 ✅: logAudit_('AUTH_DENIED', 'Auth', null, email) en accesos denegados
- SEC-001/TD-50 ✅: apiClient.js usa siempre POST — idToken en body, nunca en URL
- SEC-004 ✅: .gitignore += .env*, *.key, .clasp.json, settings.local.json
- SEC-005 ✅: Import.gs trunca fileContent a 40k chars antes de enviar a Groq

PENDIENTES EN ORDEN:
1. Sprint 8 (avanzado + limpieza P3) — 1 deploy ligero (Accounts.gs roundMoney):
   XIRR/CAGR (FIN-013) · roundMoney en adjustBalance_ · comentario getDb_ · fix docs Groq
2. QA en vivo Playwright (pendiente post-Sprints)
3. Sprint 9 (QA en vivo + pulido v1.0)

VERIFICACIONES PENDIENTES EN VIVO (happy path autenticado con datos reales):
- Flujo venta parcial/total en UI Inversiones
- getBootstrap con ventana 24m no rompe historial más antiguo
- Analítica: tabla tendencias y selector de período funcionan en producción
- Sprint 5: tras deploy, verificar que login sigue funcionando con POST (no hay regresión)

RIESGOS ABIERTOS:
- Bootstrap limita a 24m de transacciones (intencional, verificar impacto)

FORMA DE TRABAJO: fases pequeñas y verificables · explicar qué/por qué ·
correr node --test tests/selectors.test.js tras cada cambio de selector (75/75 base) ·
commits atómicos por feature · hook auto-bumpa SW + config.version al commitear src/.
Para mensajes de commit multilínea: git commit -F _commitmsg.txt (archivo temporal)
Empezar con: git log --oneline -5 · git status · node --test tests/selectors.test.js.
```
