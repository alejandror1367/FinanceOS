# Prompt de continuación — FinanceOS
**Generado:** 2026-06-10 (Deploy Sprint A confirmado)
**HEAD:** `2281376` · **SW:** `v0.2.91` · **Tests:** 136/136 (30 suites)

---

```text
Lee PROJECT_HANDOFF.md (CONTEXTO MÍNIMO primero, luego §18) y CLAUDE.md antes de cualquier cambio.

MCP: .mcp.json versionado con playwright y context7 (scope de proyecto).
Tras git pull deben APROBARSE y REINICIARSE Claude Code: las tools MCP se fijan al arrancar.

PROYECTO: FinanceOS — PWA financiera personal y privada de Alejo.
Repo: https://github.com/alejandror1367/FinanceOS (rama main).
Prod: https://alejandror1367.github.io/FinanceOS/
HEAD: 2281376 · SW v0.2.91 · Tests 136/136 (30 suites)

INVARIANTES (ver CLAUDE.md): JS ES Modules sin build step · sin frameworks/bundlers ·
cero deps npm en runtime · frontend abstraído tras src/services/ · Apps Script +
Google Sheets (13 hojas) + GitHub Pages + OAuth de Google · offline-first.

ROADMAP ACTIVO: docs/Roadmap-Maestro.md ← fuente única.
R0–R5 ✅ · Sprint A ✅ (2026-06-09, commits f7e1330 · 34383ff · d77e1f5).

HECHO EN SPRINT A (2026-06-09, 2ª parte):
- A.2 ✅: getFxRates_ en Quotes.gs (USD/EUR→COP, caché 1h) · ruta getFxRates en Code.gs ·
  computeNetWorth_ convierte o excluye divisas (fxExcludedCount) — NUNCA 1:1.
- A.3 ✅: convertToBase/sumInBase en selectors (liquidez, activos, pasivos, CC, deudas,
  XIRR, investmentsSummary) · selector fxGaps() · aviso de exclusión en vista Inversiones ·
  fix degradación offline (refresh no borra últimas tasas conocidas).
- A.7 ✅: 21 tests FX nuevos → 136/136.
- A.1/A.4/A.5/A.6 ya estaban hechas (TD-45/41/42/46) — verificado, no re-implementadas.
- TD-02 cerrado · TD-54 nuevo documentado.

✅ DEPLOY SPRINT A COMPLETADO (2026-06-10):
Quotes.gs · Code.gs · Reports.gs desplegados por el dueño. Backend ya convierte/excluye
divisas con getFxRates_ (caché 1h). FE y BE alineados — nunca suman 1:1.

PENDIENTES EN ORDEN:

1. Verificación en vivo FX (Playwright con login):
   - getFxRates responde {success:true, data:{USD,EUR}}.
   - Vista Inversiones muestra aviso "N posiciones excluidas por falta de tasa" si aplica.
   - Snapshots nuevo formato (valores priceService) — verificación pendiente de antes.

2. Quick win: Dashboard consume fxGaps() para aviso global de valor incompleto
   (Inversiones ya tiene aviso propio).

3. Sprint B residual (P1): B.4 roundMoney(v, currency) en acumulados de vista Inversiones
   (B.1–B.3 ya hechos vía TD-43/44). Ver Roadmap-Maestro.

4. Sprint C — Accesibilidad WCAG AA (P1, sin deploy): contraste --text-tertiary ·
   aria-label técnico en forms · esc() en charts · prefers-reduced-motion.

5. Sprint D — Cuentas remuneradas (P1, deploy): REDISEÑAR calcYield con saldo
   promedio/acumulación diaria — NO balance actual (sobreestima ~7×).

6. Sprint E–J: ver Roadmap-Maestro.md.

HALLAZGOS VIGENTES:
- TD-54: tx en divisa extranjera suman 1:1 en monthlyIncome/Expense, cashflow y
  presupuestos — convertir exige tasa histórica a fecha de tx (diseño propio pendiente).
- ensureHeaders_ NO es append-only idempotente: solo appendear al final.
- getBootstrap_ limita a 24m de transacciones (confirmar impacto histórico).

POLÍTICA FX (decisión Sprint A): convertir con tasa o excluir + flaggear
(fxGaps/fxExcludedCount) — nunca sumar 1:1. Tasas via getFxRates (caché 1h backend,
localStorage en FE, degradación offline a última conocida).

RIESGOS ABIERTOS:
- Backend producción suma 1:1 hasta deploy Sprint A.
- calcYield sobreestima patrimonio hasta ~7× → Sprint D obligatorio.
- Sesión de facto perpetua sin app-lock; 2º email con acceso total.

FORMA DE TRABAJO: fases pequeñas y verificables · explicar qué/por qué ·
correr node --test tests/selectors.test.js tras cada cambio de selector (136/136 base) ·
commits atómicos por feature · hook auto-bumpa SW + config.version al commitear src/.
Para mensajes de commit multilínea en PowerShell: git commit -F _commitmsg.txt (archivo temporal).
Empezar con: git log --oneline -5 · git status · node --test tests/selectors.test.js.
```
