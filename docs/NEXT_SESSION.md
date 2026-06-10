# Prompt de continuación — FinanceOS
**Generado:** 2026-06-10 (sesión maratónica: Sprints B–I + TD-39 + app-lock)
**HEAD:** `4d0387e` · **SW:** `v0.2.105` · **Tests:** 155/155 selectors (35 suites) + 13/13 recurring

---

```text
Lee PROJECT_HANDOFF.md (CONTEXTO MÍNIMO primero, luego §18) y CLAUDE.md antes de cualquier cambio.

MCP: .mcp.json versionado con playwright y context7 (scope de proyecto).
Tras git pull deben APROBARSE y REINICIARSE Claude Code: las tools MCP se fijan al arrancar.

PROYECTO: FinanceOS — PWA financiera personal y privada de Alejo.
Repo: https://github.com/alejandror1367/FinanceOS (rama main).
Prod: https://alejandror1367.github.io/FinanceOS/
HEAD: 4d0387e · SW v0.2.105 · Tests 155/155 selectors + 13/13 recurring

INVARIANTES (ver CLAUDE.md): JS ES Modules sin build step · sin frameworks/bundlers ·
cero deps npm en runtime · frontend abstraído tras src/services/ · Apps Script +
Google Sheets (13 hojas) + GitHub Pages + OAuth de Google · offline-first.

ROADMAP ACTIVO: docs/Roadmap-Maestro.md ← fuente única.
Sprints A–E, G, H ✅ · I 🟡 (falta I.1) · F 🔴 sin empezar · J 🟡 (faltan J.3/J.5).
Backend AL DÍA: Sprint A (FX) + D (lastYieldDate) + G (cursor) desplegados.

HECHO EN SESIÓN 2026-06-10 (todo pusheado y desplegado):
- Sprint A deploy confirmado · banner fxGaps en Dashboard (1223eee).
- B.4 roundMoney por sección en Inversiones (14bb7dc).
- C.4 reduced-motion universal + C.10 label Tema (c8be635, 66f7b5a).
- Sprint D completo: calcYield sobre SALDO PROMEDIO ponderado por tiempo (4ec3836),
  lastYieldDate en schema (9cc4fd6, setupDatabase ejecutado), badge %EA + preset
  RappiCuenta (28ebde0), modal Registrar rendimiento — 1 tx income, idempotente
  por lastYieldDate (1f05f94). YIELD_TYPES ampliado a digital_wallet+investment (461c156).
- E.3 goalSavingsSplit selector + tests sameMonth (ee27d5b).
- G.7 cursor opt-in en getTransactions {items,nextCursor}, retrocompatible (bdde64a).
- H.3 bottom-nav final: dashboard·today·transactions·investments·settings (5ba0151).
- I.2-I.5: housekeeping TD (TD-11 ✅) + checklist v1.0 15/16 (b422c86).
- TD-39: recurringService — materializa recurrentes vencidos al cargar, ids
  deterministas rec_{id}_{fecha} idempotentes, catch-up con tope (d37a938, 13 tests).
- J.4 app-lock PIN (PBKDF2 150k iter, overlay, auto-lock 5min, 5 intentos→signOut)
  + J.4b huella/Face ID via WebAuthn con PIN de respaldo (53083b3, 57ac36c).

PENDIENTES EN ORDEN:

1. Sprint F — Import/Export (P2, sin deploy, SIN EMPEZAR):
   ⚠ F.1 fixtures de regresión OBLIGATORIO antes de F.2 (dedup).
   Decisión abierta del dueño: fixtures sintéticos vs extractos reales anonimizados.
   F.2 dupKey date|amount|descNorm · F.3 resumen calidad post-import (>30% sin
   categoría = alerta) · F.4 validar montos cero/negativos antes del preview ·
   F.5 perfil RappiCuenta en bankProfiles.js · F.6 export por período desde/hasta.

2. I.1 — QA Playwright en vivo (requiere LOGIN del dueño en el browser Playwright):
   15 rutas · 375px · dark/light · 0 errores JS/red. Único criterio v1.0 sin marcar.

3. Verificaciones en vivo acumuladas (mismo login): snapshots formato nuevo · avisos
   FX en Inversiones · modal Registrar rendimiento · app-lock PIN/huella · recurrentes
   automáticos · bottom-nav 375px.

4. J.5 — 2º email en allowedEmails (alejandrorr1367@gmail.com): confirmar identidad
   con el dueño, documentar o eliminar (backend/Config.gs, requiere deploy si cambia).

5. J.3 — Narrativa Groq de portafolio (OPCIONAL): sin script lock · % relativos sin
   montos COP · anti prompt-injection · caché CacheService · disclaimer.

6. TD-54 — implementado en worktree: tx en divisa extranjera usa `amountBase` o
   `fxRateToBase` histórico; sin tasa se excluye y `fxGaps()` lo reporta. Pendiente
   deploy backend (`Config.gs`/`Transactions.gs`/`Reports.gs`) + `setupDatabase()`.

CAVEATS:
- Patrón de esta sesión: MUCHAS tareas del roadmap ya estaban hechas de sesiones
  previas — SIEMPRE verificar código real antes de re-implementar.
- node --test tests/ (modo directorio) falla por quirk de Node 24/Windows; correr
  archivos explícitos: node --test tests/selectors.test.js tests/recurring.test.js.
- accountYield es type-agnostic; YIELD_TYPES vive en accounts.js (no en selectors).
- El saldo de cuentas investment NO cuenta en patrimonio (solo posiciones) — el modal
  de rendimiento lo avisa.
- Cursor G.7: solo se activa con paginate=true|cursor; sin params, contrato array intacto.

FORMA DE TRABAJO: fases pequeñas y verificables · explicar qué/por qué · correr
node --test tests/selectors.test.js tras cada cambio de selector (155/155 base) ·
commits atómicos · hook auto-bumpa SW + config.version al commitear src/.
Para mensajes multilínea en PowerShell: git commit -F archivo temporal.
Empezar con: git log --oneline -5 · git status · node --test tests/selectors.test.js.
```
