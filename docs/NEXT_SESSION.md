# Prompt de continuación — FinanceOS
**Generado:** 2026-06-02 (fin de sesión bugs + Sprints 1–4)
**HEAD:** `495fe4d` · **SW:** `v0.2.37` · **Tests:** 52/52

---

```text
Lee PROJECT_HANDOFF.md (§18 para lo último) y CLAUDE.md antes de cualquier cambio.

PROYECTO: FinanceOS — PWA financiera personal y privada de Alejo.
Repo: https://github.com/alejandror1367/FinanceOS (rama main).
Prod: https://alejandror1367.github.io/FinanceOS/
HEAD: 495fe4d · SW v0.2.37 · config.version 0.2.37 · Tests 52/52

INVARIANTES (ver CLAUDE.md): JS ES Modules sin build step · sin frameworks/bundlers ·
cero deps npm en runtime · frontend abstraído tras src/services/ · Apps Script +
Google Sheets (13 hojas) + GitHub Pages + OAuth de Google · offline-first.

HECHO Y DESPLEGADO (sesión 2026-06-02):
- Todos los bugs P0/P1/P2 de la auditoría corregidos (import, analytics, config,
  backend patrimonio, upcomingPayments CC, apiClient retry).
- Sprint 3+4 completos: gestión snapshots (individual/masivo/outliers/"Ver todos"),
  BarChart con valores visibles + tooltips, LineChart tooltips, monthlySavingsAvg.
- Hook pre-commit actualiza config.version junto con SW.
- Backends desplegados: Reports.gs (CC en patrimonio), NetWorth.gs+Code.gs
  (deleteNetWorthSnapshot).
- Tests: 52/52 (11 suites, añadidos upcomingPayments y monthlySavingsAvg).

PENDIENTE — SPRINT 5 (empezar aquí):
Inversiones avanzadas en src/views/investments.js:
  5.1: Campo "Retención en fuente" (withholdingRate, %) en posición de inversión.
  5.2: Campo "Comisión por operación" al crear/registrar compra/venta.
  5.3: Indicador WITHHOLDING% en positionCard si withholdingRate > 0.
Luego Sprint 6 (UX: tooltips todos los charts, micro-anim, validación inline, shortcuts).

NO verificado en vivo (no hubo Playwright en esta sesión):
- Import: fixes aplicados pero flujo completo no confirmado visualmente.
- Vista Hoy / upcomingPayments CC: requiere cuenta con paymentDay configurado.
- BarChart bars__val: cambio visual no confirmado.
- Snapshot outlier detection: requiere ≥4 snapshots para activarse.

SIN DEPLOYS PENDIENTES en backend — todo fue frontend puro.

FORMA DE TRABAJO: fases pequeñas y verificables · explicar qué/por qué ·
correr `node --test tests/selectors.test.js` tras cada cambio de selector ·
commits atómicos por feature · el hook auto-bumpa SW + config.version al commitear src/.
Empezar con: git log --oneline -5 · git status · node --test tests/selectors.test.js.
```

---

## Contexto rápido de la sesión

### Lo que se hizo (en orden)

**Sprint 1 — Bugs críticos**

| Commit | Fix |
|--------|-----|
| `76dcf2c` | BUG-P0-1: `dataService.mutate()` → `create()` · BUG-P1-1/P1-2/P1-3: Button API, SVG icons, appendChild |
| `848292a` | BUG-P1-5: `config.version` sincronizado |
| `32ffa4b` | BUG-P1-4: `normPeriodKey` exportada + analytics.js + hook mejorado |
| `8e537f8` | BUG-P0-2: `computeNetWorth_` excluye CC de activos, los suma a pasivos — **deploy confirmado** |

**Sprint 2+3 — Integridad + snapshots**

| Commit | Fix |
|--------|-----|
| `3aeed11` | BUG-P2-4: `upcomingPayments()` incluye CC con paymentDay · 4 tests |
| `511bf70` | BUG-P2-2: `apiClient.get()` retry en TypeError (ERR_ABORTED) |
| `24ddd80` | FIX-10: `deleteNetWorthSnapshot_` + botón 🗑 por snapshot — **deploy confirmado** |

**Sprint 2.6 + restante Sprint 3 + Sprint 4**

| Commit | Feature |
|--------|---------|
| `5fdc008` | `monthlySavingsAvg(s, n=3)` + goals.js usa promedio 3M · 3 tests · 52/52 |
| `495fe4d` | multi-select snapshots · outlier Z-score · "Ver todos" toggle · BarChart `bars__val` + `valueFormat` · LineChart dot tooltips |

### Decisiones técnicas relevantes
- `normPeriodKey` ahora exportada de `selectors.js`
- `monthlySavingsAvg` usa `cashflow(s, n+1).slice(0, n)` — excluye el mes en curso (incompleto)
- Outlier detection: Z-score con umbral 2σ, mínimo 4 snapshots para activarse
- `apiClient.get()` solo reintenta en `TypeError` (network), NO en `AbortError` (timeout propio)
- Hook pre-commit: ahora actualiza `version: 'X.Y.Z'` en `config.js` además de `sw.js`

### Archivos clave modificados esta sesión
```
src/views/import.js          — 4 bugs corregidos (P0-1, P1-1, P1-2, P1-3)
src/views/analytics.js       — normPeriodKey + now/curMonthKey a render-time
src/views/goals.js           — monthlySavingsAvg en lugar de monthlySavings
src/views/networth.js        — multi-select · outliers · toggle · BarChart valueFormat
src/store/selectors.js       — export normPeriodKey · monthlySavingsAvg · upcomingPayments CC
src/services/apiClient.js    — retry en get()
src/services/entities.js     — remove: 'deleteNetWorthSnapshot' en netWorthSnapshots
src/components/ui.js         — BarChart + valueFormat + bars__val
src/components/charts.js     — LineChart dots con <title> tooltip
src/styles/components.css    — bars__val · bars height 160px · hover opacity
src/core/config.js           — version: '0.2.37' (gestionado por hook)
backend/Reports.gs           — computeNetWorth_ + getDashboard_ excluyen CC de activos
backend/NetWorth.gs          — deleteNetWorthSnapshot_()
backend/Code.gs              — ruta deleteNetWorthSnapshot
.githooks/pre-commit         — también bumpa config.version
tests/selectors.test.js      — monthlySavingsAvg · upcomingPayments (52/52)
```
