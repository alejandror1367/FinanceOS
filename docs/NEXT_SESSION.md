# Prompt de continuación — FinanceOS
**Generado:** 2026-06-03 (sub-sesión tarde: infraestructura de agentes; tras Sprint 5 + 6 + 7 fixes de sync)
**HEAD:** `e6b3c77` · **SW:** `v0.2.43` · **Tests:** 54/54

---

```text
Lee PROJECT_HANDOFF.md (CONTEXTO MÍNIMO primero, luego §18) y CLAUDE.md antes de cualquier cambio.

PROYECTO: FinanceOS — PWA financiera personal y privada de Alejo.
Repo: https://github.com/alejandror1367/FinanceOS (rama main).
Prod: https://alejandror1367.github.io/FinanceOS/
HEAD: e6b3c77 · SW v0.2.43 · config.version 0.2.43 · Tests 54/54

INVARIANTES (ver CLAUDE.md): JS ES Modules sin build step · sin frameworks/bundlers ·
cero deps npm en runtime · frontend abstraído tras src/services/ · Apps Script +
Google Sheets (13 hojas) + GitHub Pages + OAuth de Google · offline-first.

INFRAESTRUCTURA DE AGENTES (NUEVO, e6b3c77): .claude/agents/ (7) + .claude/commands/ (4:
/audit, /roadmap, /implement, /handoff). Cada agente reconstruye su contexto desde el repo
(portable entre equipos). implementation-engineer es el ÚNICO que modifica código.
Recomendado: estrenar con /audit → /roadmap antes de implementar el siguiente sprint.

HECHO Y DESPLEGADO (sesión 2026-06-03):
- SPRINT 5 (inversiones avanzadas): comisión de compra/venta + retención en fuente
  (withholdingRate) con Badge en positionCard + soporte multicuenta (un ticker, varias cuentas).
- SPRINT 6 (UX): tooltips Donut/ProgressBar · validación inline en TODOS los formularios
  (setFieldError/focusFieldError) · Command Palette (⌘K/Ctrl K · '/' · '?' · botón lupa).
- 7 FIXES DE SYNC, todos redeployados por el dueño:
  BRK.B (Yahoo punto→guion) · snapshots soft-delete (+ columna isDeleted) · loop batchWrite
  acotado · compras multicuenta (name vacío) · preservar id cliente en cuentas/categorías ·
  idempotencia + preservación de id en los 10 create* del backend (helper idempotentHit_).
- Verificado en vivo (Playwright): 14 rutas sin errores JS; Sprint 5/6 confirmados.
- Tests: 54/54 (11 suites).

PENDIENTE (sin sprint asignado — elegir con el dueño):
- Sprint 7 (Performance): paginación listTransactions_ (>5000 tx), content-visibility,
  lazy load de vistas pesadas, cold-start backend.
- Sprint 8 (Analítica avanzada) · Sprint 9 (pulido + WCAG + fix truncamiento "Apariencia" Ajustes, v1.0).
- Bugs P3 abiertos: TD-36 (proyección presupuesto días 1–3) · TD-37 (solapamiento presupuestos).

PENDIENTE DE VERIFICAR POR EL DUEÑO (happy-path autenticado con datos):
- Borrado masivo de snapshots (sin "sincronizando" en bucle) · broker inline bien vinculado ·
  compras multicuenta · BRK.B trae precio.

SIN DEPLOYS PENDIENTES — el dueño ya redeployó todos los .gs de backend tocados.

FORMA DE TRABAJO: fases pequeñas y verificables · explicar qué/por qué ·
correr `node --test tests/selectors.test.js` tras cada cambio de selector ·
commits atómicos por feature · el hook auto-bumpa SW + config.version al commitear src/.
Empezar con: git log --oneline -5 · git status · node --test tests/selectors.test.js.
```

---

## Sub-sesión (2026-06-03, tarde) — Infraestructura de agentes

Se creó el sistema permanente de auditoría/planificación/implementación/documentación
(commit `e6b3c77`, solo tooling de desarrollo — no toca el runtime servido ni el SW):

- **`.claude/agents/` (7):** `frontend-auditor`, `backend-reviewer`, `security-reviewer`,
  `financial-analyst`, `documentation-writer`, `playwright-reviewer`, `implementation-engineer`.
  Cada uno define objetivo, alcance, responsabilidades, archivos prioritarios, qué NO hacer,
  formato de salida, severidad P0–P3, priorización, anti-duplicación, interacción entre agentes
  y una sección **"Bootstrap del contexto"** (qué leer y en qué orden) para ser **portable entre
  equipos** sin depender de memoria de sesión. `implementation-engineer` es el ÚNICO que edita código.
- **`.claude/commands/` (4):** `/audit` (lanza los 5 auditores en paralelo, consolida y deduplica),
  `/roadmap` (prioriza por ROI en sprints), `/implement` (ejecuta el siguiente sprint con tests y
  verificación en vivo), `/handoff` (continuidad entre equipos).
- **Flujo:** `/audit → /roadmap → /implement → /handoff`. Recomendado estrenar con `/audit`.

---

## Contexto rápido de la sesión (Sprint 5 + 6 + fixes de sync)

### Lo que se hizo (en orden)

**Sprint 5 — Inversiones avanzadas**

| Commit | Feature |
|--------|---------|
| (Sprint 5) | `commission`/`soldCommission`/`withholdingRate` en inversiones · Badge `Ret. X%` · cost basis y P&L netos de comisiones · `investmentsCost` suma comisión · +2 tests |

**Cadena de 7 fixes de integridad de sync** (todos redeployados)

| Commit | Fix |
|--------|-----|
| `9a6fc31` | Quotes: símbolos de clase `BRK.B` → reintento punto→guion en Yahoo |
| `95bcd51` | Snapshots: columna `isDeleted` + soft delete (rápido) en vez de hard delete |
| `2fdbc40` | syncEngine: ruta batchWrite acota reintentos (no bucle "sincronizando") |
| `ef740f8` | Inversiones: "+ Compra" prellena nombre/moneda + fallback a símbolo (name vacío) |
| `5e46331` | `createAccount_` preserva id del cliente (broker inline) + idempotente |
| `8c12920` | `createCategory_` igual (categoría offline referenciada) |
| `12e103d` | Idempotencia + preservación de id en los 10 `create*` (`idempotentHit_`) |

**Sprint 6 — UX**

| Commit | Feature |
|--------|---------|
| `00ac288` | Tooltips Donut por segmento + ProgressBar % · validación inline (infra + inversiones) |
| `8e2861b` | Validación inline en transacciones, presupuestos, metas, patrimonio, cuentas, diario, recurrentes, deudas |
| `f3e8699` | Command Palette ⌘K + atajos globales + botón lupa en topbar |

### Decisiones técnicas relevantes
- Todos los `create*` del backend preservan el id (ULID) del cliente y son idempotentes
  (`idempotentHit_` en Utils.gs) → sin referencias colgadas ni duplicados en reintentos.
- Snapshots: soft delete (necesita columna `isDeleted`). Hard delete era lento → causaba timeout/loop.
- `initShortcuts()` se registra ANTES de `dataService.init()` (los atajos no esperan a la red).
- Quotes: intenta el símbolo tal cual; si no hay datos y tiene punto, reintenta punto→guion.

### Verificación en vivo (Playwright + Chromium)
- 14/14 rutas sin errores JS. Sprint 5 (campos comisión/retención) y validación inline confirmados.
- Command Palette: abre con ⌘K/'/'/botón, filtra, navega ("patri" + ↵ → #/networth), cierra.
- Detectó y corrigió: los atajos quedaban inactivos esperando `dataService.init()` (movidos antes).
