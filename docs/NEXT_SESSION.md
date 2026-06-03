# Prompt de continuación — FinanceOS
**Generado:** 2026-06-03 (sesión tarde: Sprint 2 + Sprint 3 + FIN-014 + Sprint 4)
**HEAD:** `6b45621` · **SW:** `v0.2.52` · **Tests:** 75/75

---

```text
Lee PROJECT_HANDOFF.md (CONTEXTO MÍNIMO primero, luego §18) y CLAUDE.md antes de cualquier cambio.

MCP: .mcp.json versionado con playwright y context7 (scope de proyecto).
Tras git pull deben APROBARSE y REINICIARSE Claude Code: las tools MCP se fijan al arrancar.

PROYECTO: FinanceOS — PWA financiera personal y privada de Alejo.
Repo: https://github.com/alejandror1367/FinanceOS (rama main).
Prod: https://alejandror1367.github.io/FinanceOS/
HEAD: 6b45621 · SW v0.2.52 · config.version 0.2.52 · Tests 75/75

INVARIANTES (ver CLAUDE.md): JS ES Modules sin build step · sin frameworks/bundlers ·
cero deps npm en runtime · frontend abstraído tras src/services/ · Apps Script +
Google Sheets (13 hojas) + GitHub Pages + OAuth de Google · offline-first.

HECHO Y DESPLEGADO (sesión 2026-06-03, tarde):

SPRINT 2 — Inversiones: ventas parciales y valoración (f1f1bd0, a8dec52):
- Modal de venta pide qty; soporta parcial (lote remanente) y total
- lotRealizedPnL: comisión prorateada por fracción vendida (FIN-004/TD-43)
- cdtCurrentValue: capitaliza sobre capital, topa en maturityDate (FIN-008/TD-44)
- roundMoney en totales del portafolio (FIN-009)
- +9 tests → 74 total

SPRINT 3 — WCAG AA + Design System (7c38299, b78eff6):
- --text-tertiary ≥4.5:1 ambos temas; 10/11px → var(--fs-micro); tokens DS limpios
- esc() en charts SVG; aria-label redundante removido; ProgressBar ARIA; focus en dialogs
- 10/10 tareas completadas; sin deploy

FIN-014 — Doble conteo CC en Patrimonio (cd839e9):
- totalLiabilities filtra type=credit_card (no duplica con cuentas CC)
- CC mostradas como filas reales en sección Pasivos
- credit_card removido de "Nueva deuda"; +1 test → 75 total

SPRINT 4 — Backend perf + robustez sync (7a4c43e, 056a5ba, 6b45621) — DESPLEGADO:
- isTransient: "No autorizado" → dead-letter (TD-10/BE-011)
- flushBatch: empareja por entityId no por índice (TD-26/BE-010)
- reconcileAndHydrate: merge {...existing, ...op.data} en updates (TD-47/BE-004)
- repoReadAll_ caché per-request + repoCacheInvalidate_ tras writes (TD-05/BE-005)
- purgeDeleted_ en bloque: clearContent+setValues, de N→2 ops Sheets (TD-28/BE-007)
- truncateAuditLog_(): purga >90 días, acción admin (BE-008)
- getBootstrap_ ventanea transactions a 24m; listTransactions_ acepta since (TD-25/BE-006)

PENDIENTE DE VERIFICACIÓN EN VIVO (por el dueño):
1. Flujo venta parcial/total en UI Inversiones (nueva UI con campo qty)
2. getBootstrap con ventana 24m no rompe historial más antiguo
3. truncateAuditLog accesible desde Ajustes (si se expuso en UI)

PENDIENTES EN ORDEN:
1. Sprint 5 (seguridad) — requiere deploy:
   SEC-002/TD-51: validar iss+exp en verifyGoogleToken_ (Auth.gs)
   SEC-004: .gitignore += .env*, *.key, .clasp.json, settings.local.json
   SEC-001/TD-50: mover id_token a POST body (apiClient.js + Code.gs)
   SEC-005: truncar fileContent antes de enviar a Groq (Import.gs)
   SEC-006/TD-09: logAudit_ en accesos denegados (Auth.gs)
2. Sprint 6 (deudas/metas, solo frontend) — NO requiere deploy: /implement 6
3. Sprint 7 (charts responsive + a11y avanzada) — NO requiere deploy: /implement 7
4. QA en vivo Playwright (pendiente de la auditoría): /audit playwright
5. Sprint 8 (avanzado + P3) · Sprint 9 (QA + v1.0)

RIESGOS VIVOS:
- getBootstrap_ limita a 24m — historial más antiguo no disponible en bootstrap (intencional)
- TD-50/51 (seguridad): id_token en URL + validación iss/exp — Sprint 5

FORMA DE TRABAJO: fases pequeñas y verificables · explicar qué/por qué ·
correr node --test tests/selectors.test.js tras cada cambio de selector (75/75 base) ·
commits atómicos por feature · hook auto-bumpa SW + config.version al commitear src/.
Para mensajes de commit multilínea: archivo temporal _commitmsg.txt + git commit -F _commitmsg.txt
Empezar con: git log --oneline -5 · git status · node --test tests/selectors.test.js.
```
