# NEXT_SESSION.md — prompt de continuación

> Pega el bloque siguiente al inicio de una nueva sesión de Claude Code.
> Generado tras la sesión del 2026-06-02 (HEAD `133d999`).

```text
Proyecto: FinanceOS — PWA financiera personal y privada de Alejo.
Repo: https://github.com/alejandror1367/FinanceOS (rama main)
Producción: https://alejandror1367.github.io/FinanceOS/

LEE PRIMERO (en este orden):
- CLAUDE.md → reglas, principios e invariantes (recién modernizado; NO son
  "prohibiciones de marca": son principios + invariantes. Frontend = Vanilla JS
  sin build step en el artefacto servido; se permite JSDoc + tsc --checkJs --noEmit,
  Node/Playwright/MCPs como tooling de dev. Apps Script + Sheets + GitHub Pages
  siguen siendo el stack recomendado.)
- PROJECT_HANDOFF.md → estado real, arquitectura, pendientes (fuente de verdad del estado)
- docs/TechnicalDebt.md → deuda priorizada P1→P3

STACK (no romper invariantes): HTML+CSS+JS ES Modules sin build · Apps Script ·
Google Sheets (13 hojas) · GitHub Pages · OAuth de Google (no token) · PWA offline-first.
Tests: node --test tests/selectors.test.js (deben pasar). Local: npx serve . → :3000.

HECHO EN LA SESIÓN ANTERIOR (2026-06-02), todo commiteado y pusheado, HEAD = 133d999:
1. Fixes de bugs (8d8d4d9), verificados en el código servido en producción:
   - BUG-C2: fecha cruda en Presupuestos → parsePeriodKey() en src/views/budgets.js
   - BUG-A1/TD-12: consumido $0 → normPeriodKey() + sameMonth() en src/store/selectors.js
     (causa raíz: Sheets auto-convierte 'YYYY-MM' a Date)
   - BUG-A3/TD-31: botón "Buscar" muerto eliminado de src/components/shell.js
   - BUG-B1: version '0.2.6' en src/core/config.js
   - TD-11 ya estaba corregido en el código. SW auto-bumpeado a v0.2.7.
2. Documentación alineada al modelo OAuth y estado real:
   - CLAUDE.md modernizado (3edb886)
   - README.md + DEPLOY.md a OAuth (ef9bf44)
   - backend/README.md a OAuth + 13 hojas + archivos/acciones reales; docs/SessionState.md
     marcado SUPERADO (0ecee9b)
   - docs/Architecture.md: regla de TypeScript alineada (929b62f)
3. Entorno de desarrollo:
   - MCPs: playwright ✓, context7 ✓ (ambos scope project). github MCP requiere
     GITHUB_PERSONAL_ACCESS_TOKEN: YA está definida con setx (variable de usuario);
     si github MCP sigue ✗ en `claude mcp list`, falta reiniciar Claude Code para que
     el proceso la lea.
   - 3 skills propias creadas y commiteadas en .claude/skills/ (133d999):
     performance-auditor, frontend-auditor, documentation-generator.

PENDIENTE (no abordado aún):
- VERIFICAR EN VIVO (requiere login OAuth) que Presupuestos ahora muestra "May 2026"
  y consumido > $0. Hoy solo se verificó el código servido, no con datos reales tras login.
- ✅ BACKEND desplegado (Nueva versión): Code.gs + Reports.gs (getBootstrap/TD-15,
  confirmado en vivo: 1 sola petición) y el modelo de saldos (Accounts/Transactions/
  Migration → TD-01). El código del repo está verificado y sincronizado con GitHub.
- ◻️ Opcional: Ajustes → Recalcular saldos si quieres que los saldos se recalculen
  desde 0 sumando las transacciones (solo con histórico completo).
- ✅ Auth.gs sin bypass de auth (verificado en el repo); confirmar que el editor de
  Apps Script tiene esta misma versión limpia.
- ✅ BUG-C1 (crítico) RESUELTO (`23009b0`+`98f8c19`): guard anti-signOut + warm-up + retry,
  y TD-15 (getBootstrap) cura la raíz. Happy-path CONFIRMADO en producción (1 getBootstrap).
- BUG-A4 (alto): Deudas — KPI "Tarjetas de crédito" en $0 (consolidar credit_card + Liabilities).
- ✅ TD-15 (getBootstrap, 12→1) HECHO (`98f8c19`); ✅ TD-16 (memoizar openById) y ✅ TD-17
  (foco accesible) ya estaban HECHOS (`47f91e1`), verificados y marcados. P1 restante:
  TD-13, TD-14, TD-10, TD-18.
- Bugs medios: BUG-M1 (auto-load precios), BUG-M2 (purgar snapshots de test en Sheets),
  BUG-M3 (FX rate), BUG-M4 (dashboard usa snapshots reales).

FORMA DE TRABAJO: fases pequeñas y verificables · explicar qué/por qué · correr tests ·
commits descriptivos (el pre-commit hook auto-bumpea el SW) · cada cambio de docs en su
propio commit docs(...). Confirmar antes de push.

Empieza confirmando el estado: git log --oneline -6, git status, y `claude mcp list`
(para ver si github MCP ya conecta tras el reinicio). Luego dime por dónde seguimos.
```
