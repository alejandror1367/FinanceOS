# NEXT_SESSION.md — prompt de continuación

> Generado tras la sesión del 2026-06-02 (tarde). HEAD `b870d6c` · SW v0.2.13 · tests 39/39.
> El mismo prompt vive en `PROJECT_HANDOFF.md` §19. **Antes de pegarlo: reinicia Claude Code**
> (cierra y reabre) para que cargue las tools del MCP de Playwright y poder hacer la
> verificación visual en vivo — en la sesión anterior conectaba pero sus tools no se cargaron
> (timing de arranque; el servidor está sano y expone 23 tools).

```text
Lee PROJECT_HANDOFF.md (sección §14d para lo último) y CLAUDE.md antes de cualquier cambio.

PROYECTO: FinanceOS — PWA financiera personal y privada de Alejo.
Repo: https://github.com/alejandror1367/FinanceOS (rama main). Prod: https://alejandror1367.github.io/FinanceOS/
HEAD: b870d6c · SW v0.2.13 · Tests 39/39 (node --test tests/selectors.test.js).

INVARIANTES (ver CLAUDE.md): JS ES Modules sin build step en lo servido · sin frameworks/
bundlers · cero deps npm en runtime · frontend abstraído tras src/services/ · Apps Script +
Google Sheets (13 hojas) + GitHub Pages + OAuth de Google · offline-first. Se PERMITE como
tooling de dev: Node/tests, Playwright, JSDoc + tsc --checkJs --noEmit.

HECHO Y DESPLEGADO: roadmap 0–12 · P0 completa · backend de saldos (TD-01) + getBootstrap
(TD-15) en producción · P1 cerrada salvo TD-18. Última sesión (b870d6c):
- TD-10 dead-letter en syncEngine (sin head-of-line; Ajustes → Reintentar/Descartar).
- TD-13/TD-14 (flush antes de pull + escritura atómica dato+cola).
- Deudas rediseñado: selectors debtList/debtStats/creditCardDebt; deuda total incluye
  tarjetas; cuota mínima = suma de pagos mínimos; tasa promedio toma tarjetas+créditos;
  abono = transferencia banco→tarjeta (debt settlement); plan Snowball/Avalanche unificado.

PENDIENTE — EMPEZAR POR AQUÍ:
1. VERIFICACIÓN VISUAL EN VIVO con Playwright (ya disponible tras el reinicio). Levanta
   `npx serve .` (:3000), inyecta el JWT de prueba + datos en IndexedDB (ver memoria
   reference-playwright-auth-test) y comprueba SIN login real:
   - DEUDAS: agrega/edita una tarjeta de crédito como CUENTA (saldo negativo) y confirma
     que "Deuda total", "Cuota mínima/mes" y "Tasa promedio" la incluyen; que el botón
     "Abonar" de la tarjeta abre una transferencia banco→tarjeta y que tras guardarla baja
     la deuda; que un crédito/hipoteca (Liability) aparece en el plan y su "Abonar" reduce
     el saldo. Plan Snowball/Avalanche reordena bien.
   - PRESUPUESTOS: período legible ("May 2026") y consumido > $0 con datos reales.
   - Limpia siempre el token de prueba y SOLO las filas de prueba al terminar.
   El happy-path autenticado REAL (con datos de producción) lo confirma Alejo tras login.
2. TD-18 (único P1): aumentar área/separación de .icon-btn en táctil (WCAG 2.5.8).
3. Pendiente menor: alinear src/core/config.js `version` ('0.2.6') con el SW (v0.2.13).
4. Bugs medios: BUG-M1 (auto-load precios), BUG-M2 (purgar snapshots de test en Sheets),
   BUG-M3 (FX rate), BUG-M4 (dashboard con snapshots reales).
5. P2 (docs/TechnicalDebt.md): TD-19 factorías CRUD, TD-21/22 precisión monetaria,
   TD-23 amortización real Snowball/Avalanche, TD-24/25/27/28 backend.

CAVEAT de datos: si una tarjeta se registra a la vez como cuenta credit_card Y como
Liability credit_card, se cuenta en ambas (consistente con BUG-A4). Llevarla solo como cuenta.

FORMA DE TRABAJO: fases pequeñas y verificables · explicar qué/por qué · correr tests ·
commits descriptivos (el pre-commit hook auto-bumpea el SW) · docs en commit docs(...) aparte.
Empieza con: git log --oneline -8, git status, node --test, claude mcp list.
```
