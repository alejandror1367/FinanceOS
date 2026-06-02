# NEXT_SESSION.md — prompt de continuación

> Pega el bloque siguiente al inicio de una nueva sesión de Claude Code.
> Generado tras la sesión del 2026-06-02 (HEAD `bccc956`).

```text
Proyecto: FinanceOS — PWA financiera personal y privada de Alejo.
Repo: https://github.com/alejandror1367/FinanceOS (rama main)
Producción: https://alejandror1367.github.io/FinanceOS/

LEE PRIMERO (en este orden):
- CLAUDE.md → reglas, principios e invariantes. NO son "prohibiciones de marca":
  son principios + invariantes. Frontend = Vanilla JS sin build step en el artefacto
  servido; se permite JSDoc + tsc --checkJs --noEmit, Node/Playwright/MCPs como tooling
  de dev. Apps Script + Sheets + GitHub Pages siguen siendo el stack recomendado.
- PROJECT_HANDOFF.md → estado real, arquitectura, pendientes (fuente de verdad del estado)
- docs/TechnicalDebt.md → deuda priorizada P1→P3

STACK (no romper invariantes): HTML+CSS+JS ES Modules sin build · Apps Script ·
Google Sheets (13 hojas) · GitHub Pages · OAuth de Google (no token) · PWA offline-first.
Tests: node --test tests/selectors.test.js (33/33, deben pasar). Local: npx serve . → :3000.

HECHO EN LA SESIÓN ANTERIOR (2026-06-02), HEAD = bccc956:
1. TD-13 + TD-14 (bccc956), P1 de fiabilidad de sync:
   - TD-14: create/update/remove en src/services/dataService.js escriben dato + op de
     cola en UNA transacción IndexedDB atómica (nuevo db.transact() en src/services/db.js;
     syncQueue.makeRecord() comparte la forma del registro). Sin más divergencia local↔cola.
   - TD-13: refresh() hace flush() de la cola antes de pullData() (no pisa creates locales).
2. Documentación sincronizada al estado real:
   - PROJECT_HANDOFF.md: §2/§5/§10/§11/§14b/§15/§19 actualizados (backend de saldos
     desplegado, P1 al día, SW v0.2.11, MCPs conectados, invariantes alineados a CLAUDE.md).
   - docs/TechnicalDebt.md: TD-13 y TD-14 marcados HECHO.
   - docs/NEXT_SESSION.md: este archivo, regenerado.

ESTADO DE DEUDA TÉCNICA:
- P0: toda resuelta (TD-01..TD-09).
- P1: ✅ TD-11, TD-12, TD-13, TD-14, TD-15, TD-16, TD-17.
       🔴 Pendiente: TD-10 (head-of-line / dead-letter, M) · TD-18 (touch targets, S).
- P2/P3: pendientes (ver docs/TechnicalDebt.md).

BACKEND: ✅ desplegado y verificado en producción — getBootstrap (TD-15, 1 sola petición)
y el modelo híbrido de saldos (Accounts/Transactions/Migration → TD-01). Auth.gs sin bypass.
Opcional: Ajustes → Recalcular saldos para recalcular desde 0 con el histórico completo.

ENTORNO DE DESARROLLO:
- MCPs (claude mcp list): github ✓, playwright ✓, context7 ✓ (los tres conectan).
- Plugins (.claude/settings.json): playwright, context7, code-simplifier.
- Skills propias (.claude/skills/): performance-auditor, frontend-auditor, documentation-generator.
- Node v24. Hook pre-commit activo (auto-bump del SW). git config core.hooksPath .githooks.

PENDIENTE / SIGUIENTE:
- VERIFICAR EN VIVO (requiere login OAuth) que Presupuestos muestra el período legible
  (p. ej. "May 2026") y consumido > $0. Se verificó el código servido, no con datos reales.
- TD-10: dead-letter para errores de negocio en syncEngine.flush() (no bloquear la cola).
- TD-18: aumentar área/separación de .icon-btn en táctil.
- Bugs medios: BUG-M1 (auto-load precios), BUG-M2 (purgar snapshots de test en Sheets),
  BUG-M3 (FX rate), BUG-M4 (dashboard con snapshots reales).

FORMA DE TRABAJO: fases pequeñas y verificables · explicar qué/por qué · correr tests ·
commits descriptivos (el pre-commit hook auto-bumpea el SW) · cada cambio de docs en su
propio commit docs(...). Confirmar antes de push.

Empieza confirmando el estado: git log --oneline -8, git status, node --test
tests/selectors.test.js. Luego dime por dónde seguimos.
```
