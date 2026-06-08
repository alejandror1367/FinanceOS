# Roadmap Revisado — Opus (segunda opinión independiente)

**Fecha:** 2026-06-08 (sesión noche)
**Reemplaza conceptualmente:** los Sprints 10–13 de `docs/Roadmap-Implementacion-2026-06-02.md` (generados por Sonnet).
**Base de evidencia:** `docs/Auditoria-Estrategica-Revisada-Opus.md` (hallazgos verificados contra código).
**Principio rector:** los datos financieros son sagrados (CLAUDE.md §3). Ninguna feature de cifras maestras se construye sobre un backend no verificado.

> Este roadmap **no** es un roadmap paralelo gratuito. Mantiene la numeración de Sonnet (Sprints 1–9 intactos) y reescribe del 10 en adelante con un **orden distinto, precondiciones duras y dos correcciones de cifras** que Sonnet omitió. Si encuentras conflicto, este documento manda sobre los Sprints 10–13 de Sonnet.

---

## 1. Qué cambia respecto al roadmap de Sonnet

| Aspecto | Sonnet (Sprints 10–13) | Este roadmap | Motivo |
|---------|------------------------|--------------|--------|
| **Punto de partida** | Sprint 10 = features (FIRE+insights) | **Sprint 0 = pre-flight de deploy + correcciones de cifras** | 5 `.gs` posiblemente sin desplegar; divergencia FE↔BE viva |
| **I9 snapshots** | Sprint 11, sin precondiciones | **Bloqueado tras Sprint 0; depende de TD-41 desplegado + fix FE↔BE** | Snapshots sobre backend viejo = histórico corrupto permanente |
| **I8 remuneradas** | Sprint 12, fórmula tal cual | **Rediseño de fórmula antes de implementar** | `calcYield` actual sobreestima hasta ~7× |
| **I7** | Sprint 12+13 como paquete | **Alertas determinísticas adelantadas; narrativa Groq al final y opcional** | Valor bimodal; IA añade 4 riesgos |
| **I2** | Snooze temporizado | **Dismiss hasta próxima ocurrencia** | El prompt pide ocultar lo ya revisado, no posponer |
| **I1 / I3** | Descartadas y olvidadas | **Endurecimientos P2 opcionales añadidos** | Gaps de control de acceso reales y baratos |

---

## 2. Top 10 prioridades reales (ordenadas por ROI / riesgo)

| # | Prioridad | Iniciativa | Esfuerzo | Riesgo evitado / valor | Deploy |
|---|-----------|-----------|----------|------------------------|--------|
| 1 | 🔴 **P0** | Pre-flight: verificar y desplegar backend pendiente (TD-41, TD-45, TD-50, TD-51, TD-02) | S | Corrupción de datos (soft-deletes resucitados; patrimonio inflado) | **Sí** |
| 2 | 🔴 **P1** | Corregir divergencia FE↔BE de pasivos CC (`Reports.gs:50` ← filtro FIN-014) + test de paridad | S | Cifra maestra incoherente FE↔BE | **Sí** |
| 3 | 🟢 **Alto** | FIRE enriquecido (fecha, ProgressBar, tooltips, variantes, EmptyState) | S–M | Satisfacción percibida, cero riesgo | No |
| 4 | 🟢 **Alto** | Insights corregidos (cobertura con promedio, streak sin mes en curso, concentración) | S | Insights útiles y estables | No |
| 5 | 🟡 **Alto** | I2 — Dismiss de pagos revisados (semántica correcta, filtro en vista) | S | Ruido cognitivo diario | No |
| 6 | 🟡 **Alto** | I9 — Snapshots enriquecidos (tras precond. #1 y #2; sin `liquidity` redundante) | S–M | Historial patrimonial granular | **Sí** |
| 7 | 🟡 **Alto** | I7a — Alertas determinísticas de portafolio (concentración, CDT, P&L, diversificación) | M | Visibilidad de riesgo real, sin IA | No |
| 8 | 🟡 **Medio** | I8 — Cuentas remuneradas (**tras rediseño de fórmula** + idempotencia) | M | Caso real Global66/RappiCuenta | **Sí** |
| 9 | 🟢 **Medio** | I6 — Import/Export (dupKey con tests de regresión, export por período) | M | Integridad y exportabilidad | No |
| 10 | 🟢 **Bajo-Medio** | I7b — Narrativa Groq (opcional, sin lock, caché, datos minimizados) | M | Enriquecimiento; bajo valor marginal | **Sí** |

**Fuera del Top 10 (endurecimientos P2 opcionales):** app-lock local (I1), limpieza de `allowedEmails` (I3). Quick wins de bajo costo; no compiten con lo anterior pero conviene agendarlos.

---

## 3. Quick wins (verificados, <½ día, ROI alto)

### < 30 minutos
| Tarea | Archivo | Nota |
|-------|---------|------|
| FIRE: fecha estimada de independencia | `src/views/fire.js` | `years` ya calculado |
| FIRE: ProgressBar de avance (patrimonio/objetivo) | `src/views/fire.js` | Componente DS existente |
| FIRE: tooltips `title=""` (SWR, regla 4%, CAGR) | `src/views/fire.js` | UX sin código nuevo |
| Insight concentración de gastos (categoría top / total) | `src/views/analytics.js` | `categorySpend` **confirmado existente** (`selectors.js:335`) |
| Marcar TD-01 ✅ + reconciliar handoff↔TechnicalDebt | docs | Cierra drift documental |

### < 2 horas
| Tarea | Archivo | Nota |
|-------|---------|------|
| Dismiss de pagos (servicio + botón "Visto ✓", filtro en vista) | nuevo `src/services/dismissService.js` + `today.js` + `dashboard.js` | Semántica *dismiss*, no snooze |
| FIRE: variantes Lean/Fat/Barista (radio, ajusta SWR) | `src/views/fire.js` | — |
| FIRE: EmptyState explicativo | `src/views/fire.js` | Onboarding |
| `liquidityCoverageMonths(s)` con **promedio** + test | `src/store/selectors.js` | Usar `monthlySavingsAvg`-style, no mes actual |
| `savingsStreak(s)` **excluyendo mes en curso** + test | `src/store/selectors.js` | Evita falso negativo |

### < ½ día
| Tarea | Archivo | Nota |
|-------|---------|------|
| Alertas determinísticas de portafolio (4 reglas) | `src/store/selectors.js` + `src/views/investments.js` | **Construir `positionValue`/`totalPortfolioValue` (NO existen)** |
| Export por rango de fechas | `src/views/exports.js` + `src/utils/export.js` | — |
| App-lock local opcional (PIN + auto-lock) | `src/core/auth.js` o nuevo `src/core/applock.js` | ~40 líneas, opcional |

---

## 4. Sprints revisados

### Sprint 0 — Pre-flight y correcciones de cifras (BLOQUEANTE) 🔴
**Objetivo:** garantizar que el backend en producción coincide con el repo y que las cifras maestras reconcilian FE↔BE, antes de tocar patrimonio.
**Dependencias:** ninguna. **Riesgo:** alto si se omite. **ROI:** máximo. **Requiere deploy:** sí.

| # | Tarea | Archivo | Esf |
|---|-------|---------|-----|
| 0.1 | Verificar versión real desplegada (ejecutar `getDashboard`/`getNetWorth` de prueba, comparar contra FE) | backend | S |
| 0.2 | Desplegar pendientes confirmados: `Reports.gs` (TD-41), `Utils.gs` (TD-45), `Code.gs` (TD-50), `Auth.gs` (TD-51), `Quotes.gs` (TD-02) | backend | M |
| 0.3 | **Corregir `computeNetWorth_:50`**: excluir `type==='credit_card'` de `sum_(liabilities)` para replicar FIN-014 (N1) | `backend/Reports.gs` | S |
| 0.4 | Test de paridad FE↔BE: `totalLiabilities`/`netWorth` con dataset incl. CC duplicada (cuenta + liability) | `tests/` | S |
| 0.5 | Exponer `ccDebt` y `liabilitiesDebt` en el return de `computeNetWorth_` (preparación I9) | `backend/Reports.gs` | S |
| 0.6 | Documentar invariante "schema = solo append al final" como regla dura (C8); `ensureHeaders_` no protege contra inserción en medio | `backend/Config.gs` + docs | S |
| 0.7 | Reconciliar docs: marcar TD-01 ✅; alinear handoff↔TechnicalDebt sobre deploys | docs | S |

> **Sin completar 0.2 + 0.3, NO avanzar a Sprint 3 (snapshots).**

---

### Sprint 1 — FIRE enriquecido + insights corregidos 🟢
**Objetivo:** máxima satisfacción percibida con cero riesgo de datos.
**Dependencias:** ninguna (puede solaparse con Sprint 0). **Riesgo:** ninguno. **ROI:** alto. **Deploy:** no.

| # | Tarea | Archivo | Esf |
|---|-------|---------|-----|
| 1.1 | FIRE: fecha estimada, ProgressBar, tooltips, variantes Lean/Fat/Barista, EmptyState | `src/views/fire.js` | M |
| 1.2 | `liquidityCoverageMonths(s)` = `totalLiquidity / promedioGastoMensual` (NO mes actual) + test | `src/store/selectors.js` | S |
| 1.3 | `savingsStreak(s)` excluyendo el mes en curso + test | `src/store/selectors.js` | S |
| 1.4 | Insight concentración de gastos (categoría top / total) | `src/views/analytics.js` | S |
| 1.5 | Cablear los 3 insights en `buildInsights()` con guardas de división por cero | `src/views/analytics.js` | S |

---

### Sprint 2 — Dismiss de pagos revisados 🟡
**Objetivo:** ocultar **permanentemente** (hasta próxima ocurrencia) los recordatorios ya revisados, sin tocar saldo/tx/deuda.
**Dependencias:** ninguna. **Riesgo:** ninguno. **ROI:** alto. **Deploy:** no.

| # | Tarea | Archivo | Esf |
|---|-------|---------|-----|
| 2.1 | `dismissService.js`: `dismiss(id, untilDate)`, `isDismissed(id)`, `clearStale()` — localStorage | `src/services/dismissService.js` (nuevo) | S |
| 2.2 | Recurrentes → `dismissedUntil = nextRunDate`; CC → fin del ciclo actual | `src/services/dismissService.js` | S |
| 2.3 | Botón "Visto ✓" en filas de `upcomingPayments`; **filtro en la vista** (selector intacto) | `src/views/today.js`, `dashboard.js` | S |
| 2.4 | Tests del servicio (dismiss, expiry por ocurrencia, clear) | `tests/` | S |

> **Δ vs Sonnet:** semántica *dismiss hasta próxima ocurrencia*, no *snooze de N días que reaparece*. Resuelve el problema declarado en el prompt.

---

### Sprint 3 — Snapshots de patrimonio enriquecidos 🟡
**Objetivo:** capturar el desglose patrimonial desde ahora, **sobre un backend ya verificado**.
**Dependencias:** **Sprint 0 (0.2, 0.3, 0.5) completado.** **Riesgo:** P0 si se omite la precondición. **ROI:** alto. **Deploy:** sí.

| # | Tarea | Archivo | Esf |
|---|-------|---------|-----|
| 3.1 | Schema `NetWorthSnapshots`: append al final de **6** campos (investmentsValue, investmentsCost, accountsValue, otherAssets, ccDebt, liabilitiesDebt) — **sin `liquidity`** (≡ accountsValue) | `backend/Config.gs` | S |
| 3.2 | `saveNetWorthSnapshot_`: capturar los 6 campos desde `computeNetWorth_` (ya expone ccDebt/liabilitiesDebt tras 0.5) | `backend/NetWorth.gs` | S |
| 3.3 | Deploy `Config.gs` + `NetWorth.gs` + ejecutar `setupDatabase()` (verificar append al final) | backend | M |
| 3.4 | `networth.js`: mostrar desglose en el detalle del snapshot; series históricas sin duplicar liquidez | `src/views/networth.js` | S |

> **Δ vs Sonnet:** 6 campos, no 7 (se elimina la redundancia `liquidity`); precondición de deploy + fix FE↔BE obligatoria.

---

### Sprint 4 — Alertas determinísticas de portafolio (I7a) 🟡
**Objetivo:** visibilidad automática del riesgo del portafolio, **sin IA ni backend**.
**Dependencias:** ninguna. **Riesgo:** bajo. **ROI:** alto. **Deploy:** no.

| # | Tarea | Archivo | Esf |
|---|-------|---------|-----|
| 4.1 | Construir helpers `positionValue`/`totalPortfolioValue` con FX (NO existen; reutilizar lógica de `investmentsValue:65-76`) | `src/store/selectors.js` | M |
| 4.2 | `portfolioAlerts(s)`: concentración >30%, CDT <30d, P&L <−20% (mismo costBasis con comisión que `investmentsCost`), sin diversificación | `src/store/selectors.js` | M |
| 4.3 | Degradar con elegancia si hay posiciones sin precio vivo (etiquetar alerta como aproximada; mostrar timestamp) | `src/store/selectors.js` + `investments.js` | S |
| 4.4 | Sección "Análisis" colapsable en `investments.js` con las alertas | `src/views/investments.js` | M |
| 4.5 | Tests: 4 escenarios + caso de posición sin precio (denominador heterogéneo) | `tests/selectors.test.js` | S |

> **Δ vs Sonnet:** reconoce que los agregados de portafolio **no existen** (no son "ya implementados"); el esfuerzo es M real, no S.

---

### Sprint 5 — Cuentas remuneradas (I8) 🟡
**Objetivo:** soportar Global66/RappiCuenta con un cálculo de rendimiento **correcto**.
**Dependencias:** ninguna. **Riesgo:** P1 sin el rediseño. **ROI:** medio. **Deploy:** sí.

| # | Tarea | Archivo | Esf |
|---|-------|---------|-----|
| 5.1 | **Rediseñar `calcYield`**: NO usar balance actual. Opción A — saldo promedio del período; Opción B — acumulación diaria del interés sobre el saldo histórico derivado del ledger | `src/views/accounts.js` / `selectors.js` | M |
| 5.2 | Schema `Accounts`: `lastYieldDate` (append) + **anotar `interestRate` como EA** | `backend/Config.gs` | S |
| 5.3 | Badge "X% EA" si `interestRate > 0` | `src/views/accounts.js` | S |
| 5.4 | Modal "Registrar rendimiento": preview → confirmación → tx ingreso + update `lastYieldDate`. **Idempotencia por `(accountId, periodo)`**; disable durante operación | `src/views/accounts.js` | M |
| 5.5 | Decidir **fuente única** del rendimiento (la cuenta `savings` ya cuenta como liquidez; evitar doble conteo con la tx income) | `src/views/accounts.js` | S |
| 5.6 | Preset `RappiCuenta` (type:savings, interestRate:9 EA, currency:COP) | `src/views/accounts.js` | S |
| 5.7 | Deploy `Config.gs` + `Accounts.gs`; tests de `calcYield` con depósito intra-período | backend + `tests/` | M |

> **Δ vs Sonnet:** la implementación NO arranca hasta tener una fórmula financieramente correcta. Test obligatorio del caso "saldo cambió durante el período".

---

### Sprint 6 — Import/Export mejorado (I6) 🟢
**Objetivo:** robustez del módulo crítico de integridad.
**Dependencias:** ninguna. **Riesgo:** medio (regresión). **ROI:** alto. **Deploy:** no.

| # | Tarea | Archivo | Esf |
|---|-------|---------|-----|
| 6.1 | **Fixtures de regresión** con extractos reales (Bancolombia/Nu/Nequi/...) ANTES de tocar dedup | `tests/` | M |
| 6.2 | `dupKey` → `date|amount|descNorm` (reduce falsos positivos) | `src/views/import.js` | S |
| 6.3 | Resumen de calidad (N/M sin categoría; alerta si >30% sin clasificar) | `src/views/import.js` | S |
| 6.4 | Validar montos cero/negativos antes del preview | `src/services/importService.js` | S |
| 6.5 | Perfil `RappiCuenta` en `bankProfiles.js` | `src/services/parsers/bankProfiles.js` | S |
| 6.6 | Export: selector de período (desde/hasta) + indicador de volumen | `src/views/exports.js` + `src/utils/export.js` | M |

---

### Sprint 7 — Narrativa Groq de portafolio (I7b) — OPCIONAL 🟢
**Objetivo:** narrativa descriptiva del portafolio, **solo si aporta valor real** tras las alertas determinísticas.
**Dependencias:** Sprint 4 (alertas). **Riesgo:** medio (IA, privacidad, regulatorio). **ROI:** bajo-medio. **Deploy:** sí.

| # | Tarea | Archivo | Esf |
|---|-------|---------|-----|
| 7.1 | `backend/Analysis.gs`: `analyzePortfolio` → Groq, **datos minimizados** (agregados/%; sin montos COP absolutos ni símbolos identificables) | `backend/Analysis.gs` (nuevo) | M |
| 7.2 | **No tomar el script lock** (acción de solo lectura) → evitar head-of-line blocking de la cola de sync (N3) | `backend/Code.gs` | M |
| 7.3 | **Anti prompt-injection**: delimitar el input del usuario; sanear `Investments.name` antes de enviar (N4) | `backend/Analysis.gs` | S |
| 7.4 | Caché de la narrativa (CacheService, patrón `Quotes.gs`) — no llamar a Groq en cada render | `backend/Analysis.gs` | S |
| 7.5 | Reutilizar `GROQ_API_KEY` de `PropertiesService` (patrón `Import.gs:63`); registrar acción en `Code.gs` | `backend/Code.gs` | S |
| 7.6 | UI: botón "Analizar con IA" opt-in + disclaimer "Esto no es asesoría financiera" + fallback graceful | `src/views/investments.js` | S |
| 7.7 | Deploy `Analysis.gs` + `Code.gs` | backend | S |

> **Δ vs Sonnet:** capa separada, última y opcional. Si el valor percibido es bajo (un usuario ya ve sus cifras), **se puede descartar** sin perder nada del roadmap.

---

### Sprint 8 — Endurecimientos P2 opcionales 🟢
**Objetivo:** cerrar gaps de control de acceso que Sonnet descartó de más.
**Dependencias:** ninguna. **Riesgo:** ninguno. **ROI:** medio. **Deploy:** no (excepto 8.3).

| # | Tarea | Archivo | Esf |
|---|-------|---------|-----|
| 8.1 | App-lock local opcional: PIN 4-6 dígitos (hash en localStorage) + auto-lock por inactividad + fallback re-login OAuth (I1, N5) | `src/core/applock.js` (nuevo) | M |
| 8.2 | Confirmar identidad del 2º email de `allowedEmails`; documentar o eliminar (I3, N6) | `backend/Config.gs` + docs | S |
| 8.3 | Si se elimina: deploy `Config.gs` | backend | S |

---

## 5. Iniciativas descartadas

| Iniciativa | Decisión | Motivo |
|-----------|----------|--------|
| **WebAuthn/Passkeys como reemplazo de OAuth (I1)** | Descartar | Gestión de credenciales + recuperación + iOS PWA parcial. Viola simplicidad. (App-lock local **sí** se conserva como opción — Sprint 8.) |
| **Multiusuario / segregación de datos (I3)** | Descartar | Ningún schema tiene owner; rediseño completo de la capa de datos. App explícitamente monousuario. (La limpieza de `allowedEmails` **sí** se conserva — Sprint 8.) |

---

## 6. Iniciativas / tareas añadidas (no estaban en el roadmap de Sonnet)

1. **Sprint 0 completo** — pre-flight de deploy + corrección FE↔BE + reconciliación documental.
2. **Test de paridad FE↔BE** (0.4) — convierte N1 en garantía permanente.
3. **Rediseño de `calcYield`** (5.1) — bloquea I8 hasta tener fórmula correcta.
4. **Construcción explícita de agregados de portafolio** (4.1) — `portfolioCAGR`/`positionValue`/`totalPortfolioValue` no existen.
5. **App-lock local opcional** (8.1) — defensa contra acceso físico al dispositivo desbloqueado.
6. **Limpieza de `allowedEmails`** (8.2) — cierra exposición a un segundo principal no documentado.
7. **Minimización de datos + anti-inyección en Groq** (7.1, 7.3) — privacidad y barrera regulatoria.

---

## 7. Dependencias y orden de ejecución

```
Sprint 0 (pre-flight + FE↔BE)  ──► obligatorio antes de Sprint 3 y Sprint 5
   │
   ├─ Sprint 1 (FIRE + insights)      ── independiente, puede ir en paralelo
   ├─ Sprint 2 (dismiss pagos)        ── independiente
   ├─ Sprint 3 (snapshots)            ── depende de 0.2 + 0.3 + 0.5
   ├─ Sprint 4 (alertas portafolio)   ── independiente
   ├─ Sprint 5 (remuneradas)          ── depende de rediseño 5.1
   ├─ Sprint 6 (import/export)        ── depende de fixtures 6.1
   ├─ Sprint 7 (Groq narrativa)       ── depende de Sprint 4; OPCIONAL
   └─ Sprint 8 (endurecimientos P2)   ── independiente, opcional
```

**Camino crítico de valor con seguridad:** Sprint 0 → (1 ∥ 2 ∥ 4) → 3 → 5 → 6 → (7 opcional, 8 opcional).

---

## 8. Resumen ejecutivo

| Sprint | Objetivo | Esfuerzo | Riesgo | Deploy | ROI |
|--------|----------|----------|--------|--------|-----|
| **0** | Pre-flight + FE↔BE + docs | ~0.5–1 día | Alto si se omite | Sí | 🔴 Máximo |
| **1** | FIRE + insights corregidos | ~1 día | Ninguno | No | 🟢 Alto |
| **2** | Dismiss de pagos | ~0.5 día | Ninguno | No | 🟡 Alto |
| **3** | Snapshots enriquecidos | ~1 día | P0 si sin Sprint 0 | Sí | 🟡 Alto |
| **4** | Alertas portafolio (I7a) | ~1 día | Bajo | No | 🟡 Alto |
| **5** | Cuentas remuneradas (I8) | ~1.5 días | P1 sin rediseño | Sí | 🟡 Medio |
| **6** | Import/Export | ~1.5 días | Medio | No | 🟢 Alto |
| **7** | Narrativa Groq (I7b) | ~1.5 días | Medio | Sí | 🟢 Bajo-Medio (opcional) |
| **8** | Endurecimientos P2 | ~1 día | Ninguno | Parcial | 🟢 Medio (opcional) |
| **Total** | | **~9–10 días + 4 deploys** | | | 9 de 9 iniciativas tratadas |

**Diferencia de fondo con Sonnet:** mismo destino, distinto camino. Sonnet propone ~5 días directos a features sobre un backend asumido como sano. Este roadmap invierte ~0.5–1 día en un pre-flight que **garantiza** que las cifras maestras son correctas y reconcilian, separa las features de UI (riesgo cero) de las de cifras maestras (requieren precondiciones y tests), y rescata endurecimientos de bajo costo. El costo extra es marginal; el riesgo evitado es la corrupción permanente del histórico patrimonial.

---

*Roadmap revisado independiente — Opus, 2026-06-08. Reemplaza conceptualmente los Sprints 10–13 de Sonnet. No se modificó código.*
