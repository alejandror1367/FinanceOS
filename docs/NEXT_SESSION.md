# NEXT_SESSION.md — prompt de continuación

> Generado tras la sesión del 2026-06-02 (autonomous P2). HEAD `dd68141` · SW v0.2.28 · tests 45/45.

```text
Lee PROJECT_HANDOFF.md (§18 para lo último) y CLAUDE.md antes de cualquier cambio.

PROYECTO: FinanceOS — PWA financiera personal y privada de Alejo.
Repo: https://github.com/alejandror1367/FinanceOS (rama main). Prod: https://alejandror1367.github.io/FinanceOS/
HEAD: dd68141 · SW v0.2.28 · Tests 45/45 (node --test tests/selectors.test.js).

INVARIANTES (ver CLAUDE.md): JS ES Modules sin build step en lo servido · sin frameworks/
bundlers · cero deps npm en runtime · frontend abstraído tras src/services/ · Apps Script +
Google Sheets (13 hojas) + GitHub Pages + OAuth de Google · offline-first.

HECHO Y DESPLEGADO: roadmap 0–12 · toda la deuda P0, P1 y P2 completada. Sesión 2026-06-02:
- P2 completa: TD-19 (crud.js guardedOp/guardedSave), TD-20 (ENTITIES+WRITE fusionados),
  TD-21 (CURRENCY_DECIMALS), TD-22 (roundMoney), TD-24/25 (backend reads explícitos),
  TD-26 (batchWrite), TD-27 (LockService), TD-28 (purgeDeleted), TD-29/30/31/32 (CSS/DS).
- Backend a desplegar: Code.gs (batchWrite, purgeDeleted, LockService), Utils.gs
  (repoUpdate_ rápido, repoReadAll_ con rango explícito, purgeDeleted_).

PENDIENTE — EMPEZAR POR AQUÍ:
1. DESPLEGAR BACKEND: abrir script.google.com → proyecto FinanceOS → subir
   backend/Code.gs y backend/Utils.gs → Implementar → Nueva versión.
2. VERIFICACIÓN en producción: login con patitosalmir@gmail.com, verificar que
   Ajustes → "Purgar eliminados" aparece y funciona; crear/editar/eliminar una
   cuenta y verificar que el backend confirma sin error.
3. P3 (opcional): TD-33–TD-40 son mejoras incrementales sin impacto en funcionalidad
   (ver docs/TechnicalDebt.md). Abordar solo si hay un caso concreto.

CAVEAT: backend Code.gs y Utils.gs tienen cambios no desplegados (batchWrite, LockService,
purgeDeleted_, repoUpdate_ optimizado). El frontend ya usa la nueva API — fallará
limpiamente si el backend es viejo (la acción batchWrite no existe → syncEngine hace
fallback a op-a-op automáticamente).

FORMA DE TRABAJO: fases pequeñas y verificables · explicar qué/por qué · correr tests ·
commits descriptivos (el pre-commit hook auto-bumpea el SW) · docs en commit docs(...) aparte.
Empieza con: git log --oneline -8, git status, node --test, claude mcp list.
```
