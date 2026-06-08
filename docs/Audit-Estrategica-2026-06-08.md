# Auditoría Estratégica FinanceOS — 2026-06-08
**Basada en:** `Audit-Propuestas-2026-06-08.md`  
**Estado de partida:** Fases 0–12 completadas · 97/97 tests · SW v0.2.76 · Sin bugs P0/P1/P2 abiertos  
**Sprints nuevos generados:** 10–13

---

## Estado real del sistema (contexto)

Sistema completamente funcional en producción. Módulos en producción:
Dashboard (KPIs desplegables), Hoy, Transacciones, Cuentas, Presupuestos, Recurrentes,
Patrimonio, Inversiones (XIRR/CAGR/Alpaca/Yahoo), Metas, Deudas (Snowball/Avalanche),
Analítica, Diario, Import (Groq), Exportaciones, Ajustes, **Simulador FIRE** (2026-06-08).

Deuda técnica restante: solo P3 (TD-33 a TD-40), todos incrementales.

---

## 1. AUDITORÍA DE VIABILIDAD

### Estado actual por iniciativa (Fase 1)

| # | Iniciativa | Estado |
|---|---|---|
| I1 | Autenticación Biométrica | No existe |
| I2 | Snooze/Dismiss próximos pagos | No existe |
| I3 | Multicuenta / Multiusuario | No existe |
| I4 | Analítica e Insights | Parcialmente existe |
| I5 | Experiencia FIRE | Existe (básico, recién implementado) |
| I6 | Importación y Exportación | Existe (mejoras identificadas) |
| I7 | Recomendaciones IA Inversiones | No existe (precios en vivo sí) |
| I8 | Cuentas Remuneradas | No existe como tipo diferenciado |
| I9 | Snapshots de Patrimonio Enriquecidos | Existe pero básico |

### Tabla de viabilidad (Fase 2)

| # | Iniciativa | Beneficio | Complejidad | Riesgo | ROI | Decisión |
|---|---|---|---|---|---|---|
| I1 | Autenticación Biométrica | Bajo — OAuth+FedCM ya es seguro y silencioso | Alta — WebAuthn, recuperación, iOS PWA parcial | Medio — lockout sin fallback | Muy bajo | **NO IMPLEMENTAR** |
| I2 | Snooze de pagos | Alto — elimina ruido cognitivo diario | Baja — solo localStorage | Ninguno | Alto | **IMPLEMENTAR** (Sprint 11) |
| I3 | Multicuenta / Multiusuario | Bajo para el propietario | Muy alta — segregación completa de datos | Alto — rompe concepto del producto | Negativo | **NO IMPLEMENTAR** |
| I4 | Analítica e Insights | Alto — datos disponibles para más | Media — selectores puros testeables | Bajo — insights son derivaciones | Alto | **IMPLEMENTAR** (Sprint 10) |
| I5 | Experiencia FIRE mejorada | Medio — simulador funciona, gap es UX | Baja — solo `fire.js`, tooltips, variantes | Ninguno | Medio | **IMPLEMENTAR** (Sprint 10) |
| I6 | Import/Export mejorado | Alto — módulo crítico de integridad | Media — mejoras incrementales | Bajo-Medio — regresión en parsers | Alto | **IMPLEMENTAR** (Sprint 13) |
| I7 | Análisis de portafolio (versión reducida, sin IA regulada) | Medio-Alto — alertas 100% determinísticas | Media — selectores + nueva sección UI | Alto regulatorio si prescriptivo | Medio | **IMPLEMENTAR versión reducida** (Sprint 12-13) |
| I8 | Cuentas Remuneradas | Medio — casos de uso reales (Global66, RappiCuenta) | Baja — campo `interestRate` ya existe en schema | Bajo — campo nuevo no destructivo | Medio | **IMPLEMENTAR** (Sprint 12) |
| I9 | Snapshots Enriquecidos | Alto — historial patrimonial es activo de largo plazo | Media — schema append-only, no destructivo | Bajo — snapshots históricos siguen válidos | Alto | **IMPLEMENTAR** (Sprint 11) |

### Decisiones críticas

**I1 — Biométrica: rechazada.**
OAuth + FedCM + One Tap + refresh silencioso cada 45 min cubre todos los casos de uso de una app personal. Si el dispositivo está desbloqueado, la app ya es accesible; si está bloqueado, el OS provee biometría al desbloquear. WebAuthn añade gestión de credentials, recuperación ante pérdida de dispositivo, y compatibilidad parcial PWA iOS. Violación directa del principio de simplicidad.

**I3 — Multiusuario: rechazada.**
La aplicación es explícitamente monousuario. Introducir perfiles requeriría rediseñar la capa de datos completa. Si un familiar quiere usar FinanceOS, la solución correcta es clonar el repo y desplegar una instancia separada en GitHub Pages.

**I7 — Versión reducida sin IA regulada.**
Las alertas de concentración, CDTs próximos, diversificación y rendimiento son 100% determinísticas. No requieren IA. Solo la narrativa textual del estado del portafolio requiere IA (Groq, descriptiva, no prescriptiva). Riesgo regulatorio AMV: se eliminan recomendaciones prescriptivas ("compra X", "vende Y").

---

## 2. GAP ANALYSIS

### I1 — Autenticación Biométrica
**Gap:** `src/core/auth.js` implementa OAuth/GIS completo con FedCM y refresh silencioso.
**Decisión:** No hay gap real que justifique biometría. Sistema actual es suficiente para caso de uso.

### I2 — Snooze de Próximos Pagos
**Gap crítico.** `selectors.upcomingPayments(s, n)` en `selectors.js:190` genera lista combinando `recurring` activos y `credit_card` con `paymentDay`. No existe campo `snoozedUntil`, ni servicio de snooze, ni botón "Visto" en `today.js:140` ni `dashboard.js:273`. El problema es real y documentado.

### I3 — Multiusuario
**Gap intencional.** `backend/Config.gs` tiene `allowedEmails` con 2 emails pero comparten BD. Decisión de producto: no resolver.

### I4 — Analítica e Insights
**Gap parcial.** Insights existentes: proyección gastos, tasa ahorro vs 3m, estado presupuesto, variación categoría top (Hoy), forecast meta. Ausentes con datos ya disponibles:
- Cobertura de liquidez en meses (`totalLiquidity / avgMonthlyExpense`) — datos en store
- Concentración de gastos (categoría top como % del total) — `categorySpend` ya existe
- Streak de ahorro positivo — requiere recorrer `cashflow` hacia atrás
- Variación mes vs mismo mes año anterior — requiere `cashflow` n=14
- Alertas de CDT próximo a vencer — `upcomingPayments` ya tiene los datos
- Comparación portafolio vs benchmark (VUG ya en Alpaca) — `portfolioCAGR` implementado

### I5 — Experiencia FIRE
**Gap de UX.** `src/views/fire.js` tiene simulador funcional con `yearsToFire()`, tabla de sensibilidad 3×3, KPIs pre-llenados desde selectors. Falta:
- Tooltips de conceptos (SWR, regla del 4%)
- ProgressBar de avance hacia el objetivo
- Fecha estimada de independencia ("Alcanzarías en [Mes Año]")
- Variantes FIRE (LeanFIRE SWR 5%, FatFIRE SWR 3%, BaristaFIRE)
- EmptyState explicativo para usuario sin datos o sin conocimiento del concepto

### I6 — Import/Export
**Gaps en calidad:**
- Import: sin resumen de calidad (N/M sin categoría), sin validación de montos cero/negativos, `dupKey` solo usa `date|amount` (alta tasa de falsos positivos/negativos), sin perfil RappiCuenta
- Export: PDF usa hex hardcodeados (#111, #ddd) en lugar de tokens del DS, sin selector de período (fecha desde/hasta), sin indicador de volumen previo a descarga

### I7 — Análisis de Portafolio
**Gap total.** `src/views/investments.js` muestra precios, XIRR, CAGR, P&L, retención. No existe análisis de portafolio: concentración, diversificación, alertas de riesgo, narrativa. Los datos necesarios ya están en el store y en selectors.

### I8 — Cuentas Remuneradas
**Gap funcional.** `backend/Config.gs` schema `Accounts` tiene `interestRate` pero no se usa para cálculo de rendimiento. Global66 existe como `type: 'bank', currency: 'USD'`. No hay `lastYieldDate`, no hay cálculo de interés compuesto, no hay acción "Registrar rendimiento", no hay badge EA%.

### I9 — Snapshots de Patrimonio
**Gap de cobertura.** `backend/Config.gs:148-159` schema `NetWorthSnapshots` solo guarda `{totalAssets, totalLiabilities, netWorth, currency}`. `computeNetWorth_` en `Reports.gs` ya calcula `{accountsValue, investmentsValue, investmentsCost, otherAssets}` pero no los persiste en el snapshot. Faltan: `liquidity`, `ccDebt`, `liabilitiesDebt`.

---

## 3. ARQUITECTURA PROPUESTA

### I2 — Snooze de Próximos Pagos

**Principio:** localStorage puro. Los selectores no se tocan (son puros). El filtrado es responsabilidad de la vista.

```
localStorage['financeOS:snoozed'] = {
  [paymentId]: { until: 'YYYY-MM-DD' }
}

src/services/snoozeService.js (<40 líneas):
  snooze(id, days=1)    → guarda until = today + days
  snooze7(id)           → until = fin del mes actual
  isActive(id)          → until >= today
  clearExpired()        → elimina entries con until < today

today.js / dashboard.js:
  upcomingPayments().filter(p => !snoozeService.isActive(p.id))
  → botón "Visto ✓" por fila → snoozeService.snooze(id)
```

**Flujo UX (mobile):** Swipe-to-dismiss como patrón alternativo al botón.
**Flujo UX (desktop):** Botón "Visto ✓" al final de cada fila.
**Persistencia:** localStorage (UI state, no datos financieros). Al vaciar caché los recordatorios reaparecen — comportamiento conservador correcto.

**Impacto:** `src/services/snoozeService.js` (nuevo, ~40 líneas) + 2 vistas. Cero cambios en store, selectors, IndexedDB, backend, sync.

### I4 — Insights Analítica

**Principio:** Nuevos selectores puros en `selectors.js` + nuevas filas en `buildInsights()` de `analytics.js`.

Selectores nuevos a añadir:
```
liquidityCoverageMonths(s)
  → selectors.totalLiquidity(s) / selectors.monthlyExpense(s)
  → "Tienes X meses de cobertura de gastos"

savingsStreak(s)
  → recorre cashflow hacia atrás mientras savings > 0
  → "Llevas N meses consecutivos ahorrando"

portfolioVsBenchmark(s)
  → portfolioCAGR(s) ya existe
  → VUG ya disponible en priceService (Alpaca)
  → "Tu portafolio tuvo CAGR X% vs VUG Y%"
```

Insights adicionales sin selector nuevo:
- Concentración gastos: usa `categorySpend(s, monthKey)` ya existente
- Alerta CC vencimiento: usa `upcomingPayments(s)` ya existente
- Variación anual: cashflow con n=14 meses

**Impacto:** `src/store/selectors.js` (2-3 selectores puros + tests), `src/views/analytics.js` (nuevas filas en `buildInsights()`). Sin cambio de backend, IndexedDB, sync.

### I5 — Experiencia FIRE Mejorada

**Principio:** Todo en `src/views/fire.js`. Cero cambios de arquitectura.

Mejoras UI:
```javascript
// Fecha estimada: years ya calculado en fire.js
const targetDate = new Date(Date.now() + years * 365.25 * 24 * 3600 * 1000);
const dateStr = new Intl.DateTimeFormat('es-CO', {month:'long', year:'numeric'}).format(targetDate);
// → "Alcanzarías la independencia en marzo 2041"

// ProgressBar
const progress = Math.min((currentWorth / targetWorth) * 100, 100);
// → ProgressBar component existente del DS

// Variantes FIRE (radio selector):
// LeanFIRE → SWR 5%
// FIRE estándar → SWR 4% (default)
// FatFIRE → SWR 3%
// BaristaFIRE → SWR 4% + ingreso parcial configurado

// Tooltips: atributo title="" en cada campo label
// EmptyState: if (netWorth === 0 && monthlyExpense === 0) → explainer card
```

**Impacto:** Solo `src/views/fire.js`. ~80 líneas adicionales.

### I7 — Análisis de Portafolio (sin IA regulada)

**Dos capas independientes:**

**Capa 1 — Alertas determinísticas** (sin IA, sin backend):
```
selectors.portfolioAlerts(s) → Array<Alert>
  { type: 'concentration', severity: 'warning',
    msg: 'MU representa el 42% de tu portafolio' }
  { type: 'cdt_expiry', severity: 'info',
    msg: 'Tu CDT vence el 2026-07-15. Monto: $5M' }
  { type: 'pnl_negative', severity: 'warning',
    msg: 'MU tiene pérdida del 24%' }
  { type: 'no_diversification', severity: 'info',
    msg: 'Todo tu portafolio está en acciones US' }
```

Reglas determinísticas:
- Concentración: `positionValue / totalPortfolioValue > 0.30`
- CDT próximo: `expiryDate - today < 30 días` (tipo 'cdt' en Investments)
- P&L negativo severo: `(currentValue - costBasis) / costBasis < -0.20`
- Sin diversificación: todos los activos del mismo `assetType`

**Capa 2 — Narrativa Groq** (opt-in, solo si GROQ_API_KEY configurada):
```
backend/Analysis.gs:
  analyzePortfolio(portfolioData) → string (párrafo descriptivo)
  Prompt: "Describe en 3 oraciones el estado de este portafolio.
           NO uses 'recomendamos', 'deberías comprar/vender'.
           Solo usa 'tu portafolio muestra', 'el retorno es', 'el activo de mayor peso es'."

src/views/investments.js:
  → Sección "Análisis" colapsable al final
  → Alertas determinísticas siempre visibles
  → Botón "Generar narrativa" solo si backend responde (feature flag implícito)
  → Caché local de la narrativa con timestamp
```

**Riesgo regulatorio AMV:** Las alertas son hechos matemáticos sobre los datos del usuario (sin recomendación). La narrativa es descriptiva. Ninguna acción prescriptiva ("compra X", "vende Y", "aumenta exposición a Z"). Esto está fuera del alcance de la regulación AMV para asesoría de inversión.

**Impacto:** `src/store/selectors.js` (nuevo selector `portfolioAlerts`), `src/views/investments.js` (nueva sección), `backend/Analysis.gs` (nuevo, ~60 líneas), `backend/Code.gs` (registrar acción).

### I8 — Cuentas Remuneradas

**Principio:** Reutilizar `interestRate` ya existente en schema de `Accounts`. No crear nuevo tipo de cuenta.

```
Modelo: type='savings' con interestRate > 0 = cuenta remunerada

Adición al schema Accounts (append-only):
  { key: 'lastYieldDate', type: 'd' }

src/views/accounts.js:
  calcYield(account, today):
    const days = daysBetween(account.lastYieldDate || account.createdAt, today)
    return account.balance * ((1 + account.interestRate/100) ** (days/365) - 1)

  Badge "X% EA" visible si interestRate > 0
  Botón "Registrar rendimiento" → abre modal:
    → muestra: calcYield(account, today) formateado
    → confirmación → dataService.create('transactions', {
        type: 'income', amount: yieldAmount,
        categoryId: 'rendimientos-financieros',
        accountId: account.id, date: today
      })
    → dataService.update('accounts', { ...account, lastYieldDate: today })
```

**Presets nuevos:** `RappiCuenta` como `{type:'savings', interestRate:9, currency:'COP'}`.

**Impacto en patrimonio:** El rendimiento se registra como tx de ingreso → saldo de la cuenta crece → `totalLiquidity` y `netWorth` reflejan el cambio automáticamente. Sin cambio en selectores ni en `Reports.gs`.

**Impacto:** `backend/Config.gs` (1 campo append), `backend/Accounts.gs` (validación), `src/views/accounts.js` (UI + modal + calcYield). ~120 líneas.

### I9 — Snapshots de Patrimonio Enriquecidos

**Principio:** Schema append-only compatible con snapshots históricos existentes.

```
Schema NetWorthSnapshots — campos nuevos (append al final):
  { key: 'liquidity',          type: 'n' }  // totalLiquidity
  { key: 'investmentsValue',   type: 'n' }  // valor de mercado del portafolio
  { key: 'investmentsCost',    type: 'n' }  // costo base del portafolio
  { key: 'accountsValue',      type: 'n' }  // suma de cuentas líquidas
  { key: 'otherAssets',        type: 'n' }  // activos no financieros
  { key: 'ccDebt',             type: 'n' }  // deuda total en tarjetas
  { key: 'liabilitiesDebt',    type: 'n' }  // deuda en pasivos no CC

saveNetWorthSnapshot_():
  const nw = computeNetWorth_(ctx)
  // computeNetWorth_ ya devuelve accountsValue, investmentsValue, investmentsCost, otherAssets
  // añadir: liquidity = totalLiquidity(ctx), ccDebt, liabilitiesDebt
  // guardar todos los campos en el registro
```

**Compatibilidad:** Snapshots históricos tendrán `undefined` en campos nuevos → vistas usan `s.liquidity || 0`. Sin migración. Snapshots nuevos capturan el desglose completo desde el momento del deploy.

**Impacto en Google Sheets:** Añadir columnas al final de hoja `NetWorthSnapshots`. `ensureHeaders_` en `Setup.gs` es idempotente — re-ejecutar `setupDatabase()` añade columnas sin borrar datos.

**Impacto en `networth.js`:** Mostrar desglose del snapshot (liquidez, inversiones, otros activos) en tooltip/modal de gestión. LineChart puede mostrar múltiples series históricas.

**Impacto en IndexedDB:** IndexedDB almacena objetos — campos nuevos aparecen en registros nuevos sin afectar los antiguos. Sin migración.

---

## 4. RIESGOS

### Riesgos por iniciativa

| # | Iniciativa | Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|---|---|
| I2 | Snooze pagos | localStorage se vacía → reaparece recordatorio | Baja | Mínimo (falso positivo conservador) | Comportamiento intencional: es el correct default |
| I4 | Insights analítica | Insight incorrecto (división por cero en cobertura si `monthlyExpense = 0`) | Media | Bajo (molestia, no catástrofe) | Guardia `if (monthlyExpense > 0)` antes de mostrar |
| I5 | FIRE UX | SWR del 4% puede no aplicar en Colombia (mercado emergente) | Alta | Bajo | Tooltip que explica el concepto y su limitación geográfica |
| I6 | Import mejoras | Regresión en deduplicación al cambiar `dupKey` | Media | Medio (importaciones duplicadas) | Test regression con fixtures bancarios reales |
| I7 | Alertas portafolio | `portfolioAlerts` usa precio de mercado — si precio es stale, alerta puede ser incorrecta | Baja | Bajo | Mostrar timestamp del último precio en la sección |
| I7 | Narrativa Groq | Groq genera texto prescriptivo pese al prompt | Baja | Alto (riesgo regulatorio) | Revisar prompt + mostrar disclaimer "Esto no es asesoría financiera" |
| I8 | Cuentas remuneradas | `calcYield` aplicado dos veces si usuario presiona "Registrar" dos veces | Media | Alto (duplica ingreso en cuentas) | Botón con loading + disable durante la operación; validar que `lastYieldDate ≠ today` |
| I9 | Snapshot enriquecido | `computeNetWorth_` falla si no tiene precios actuales → campos en `undefined` | Baja | Bajo (snapshot guarda null en campos nuevos) | Usar `|| 0` en todos los campos opcionales |

### Riesgos arquitectónicos transversales

**Schema append-only (I8, I9):** Política de no modificar columnas existentes, solo añadir al final. Se cumple en ambas iniciativas. Bajo riesgo.

**Pureza de selectores (I2, I4, I7):** Los nuevos selectores deben ser puros y testeables. El filtro de snooze NO entra en `selectors.js` (lee localStorage, que es I/O implícito). Bajo riesgo si se respeta la arquitectura.

**Regulatorio I7:** El único riesgo real del sistema. Mitigación: ningún texto prescriptivo, disclaimer visible, Groq opt-in.

---

## 5. QUICK WINS

### Menos de 30 minutos

| Tarea | Archivo | Impacto |
|---|---|---|
| FIRE: tooltip `title=""` en campos SWR, CAGR, tasa esperada | `src/views/fire.js` | UX inmediata sin código |
| FIRE: fecha estimada ("Alcanzarías en [Mes Año]") | `src/views/fire.js` | Hace el simulador tangible |
| FIRE: ProgressBar de avance (patrimonio/objetivo %) | `src/views/fire.js` | Impacto psicológico alto |
| Accounts: badge "X% EA" en cuentas con `interestRate > 0` | `src/views/accounts.js` | 5 líneas, visibilidad inmediata |
| Analytics: insight concentración gastos (categoría top / total) | `src/views/analytics.js` | Usa `categorySpend` ya existente |
| Analytics: insight cobertura liquidez en meses | `src/store/selectors.js` + `analytics.js` | 1 selector + 1 insight row |

### Menos de 2 horas

| Tarea | Archivo | Impacto |
|---|---|---|
| Snooze de próximos pagos (snoozeService + botón en today.js + dashboard.js) | Nuevo `src/services/snoozeService.js` + vistas | Alto: elimina ruido diario real |
| FIRE: variantes LeanFIRE / FatFIRE / BaristaFIRE (radio selector) | `src/views/fire.js` | Enriquece sin complejidad |
| FIRE: EmptyState explicativo si no hay datos | `src/views/fire.js` | Onboarding para usuario nuevo |
| Import: resumen de calidad (N/M sin categoría asignada) | `src/views/import.js` | Mejora inmediata de confianza del usuario |
| Alertas determinísticas de portafolio: concentración >30% y CDT próximo | `src/store/selectors.js` + `investments.js` | Alta visibilidad de riesgo real |
| Snapshot enriquecido: añadir 7 campos al schema (solo Config.gs + NetWorth.gs) | `backend/Config.gs` + `backend/NetWorth.gs` | Captura historial valioso desde ya |

### Menos de medio día

| Tarea | Archivo | Impacto |
|---|---|---|
| Cuentas remuneradas: calcYield + modal + badge EA% | `src/views/accounts.js` | Caso de uso real Global66/RappiCuenta |
| Analytics: 3 insights adicionales (streak ahorro, variación anual, alerta CC) | `src/store/selectors.js` + `analytics.js` | Enriquece analítica significativamente |
| Análisis completo de portafolio: las 4 alertas determinísticas | `src/store/selectors.js` + `investments.js` | Alto valor sin riesgo regulatorio |
| Export por rango de fechas (selector período en exports.js) | `src/views/exports.js` + `src/utils/export.js` | Mejora exportabilidad concreta |

---

## 6. ROADMAP ACTUALIZADO

### Sprints 1–9: completados

El roadmap original documentado en `Roadmap-Implementacion-2026-06-02.md` (Sprints 1–9) está completamente ejecutado. Los sprints nuevos continúan la numeración.

---

### Sprint 10 — FIRE enriquecido + Insights adicionales

**Objetivo:** Completar la experiencia del simulador FIRE recién implementado y añadir 3 insights de alto impacto en Analítica.  
**Dependencias:** Ninguna. Sprints 1–9 completados.  
**Estimación:** ~1 día | **Riesgo:** Ninguno | **ROI:** Alto

| # | Tarea | Archivo | Esfuerzo |
|---|---|---|---|
| 10.1 | FIRE: fecha estimada de independencia ("Alcanzarías en [Mes Año]") | `src/views/fire.js` | S |
| 10.2 | FIRE: ProgressBar de avance (patrimonio/objetivo %) | `src/views/fire.js` | S |
| 10.3 | FIRE: tooltips de conceptos (SWR, regla del 4%, CAGR) via `title=""` | `src/views/fire.js` | S |
| 10.4 | FIRE: variantes LeanFIRE / FatFIRE / BaristaFIRE (radio selector, ajusta SWR) | `src/views/fire.js` | S |
| 10.5 | FIRE: EmptyState explicativo si no hay datos financieros | `src/views/fire.js` | S |
| 10.6 | Analytics: `liquidityCoverageMonths(s)` + insight "X meses de cobertura" | `src/store/selectors.js` + `analytics.js` | S |
| 10.7 | Analytics: `savingsStreak(s)` + insight "N meses seguidos ahorrando" | `src/store/selectors.js` + `analytics.js` | S |
| 10.8 | Analytics: insight concentración gastos (categoría top como % del total) | `src/views/analytics.js` | S |

**Archivos:** `src/views/fire.js`, `src/store/selectors.js`, `src/views/analytics.js`

---

### Sprint 11 — Snooze de pagos + Snapshots enriquecidos

**Objetivo:** Eliminar ruido de recordatorios ya revisados y capturar desglose en snapshots desde ahora.  
**Dependencias:** Sprint 10 completado.  
**Estimación:** ~1 día + deploy backend | **Riesgo:** Bajo | **ROI:** Alto

| # | Tarea | Archivo | Esfuerzo |
|---|---|---|---|
| 11.1 | `snoozeService.js`: `snooze(id, days=1)`, `isActive(id)`, `clearExpired()` — localStorage | `src/services/snoozeService.js` (nuevo) | S |
| 11.2 | Botón "Visto ✓" en filas de `upcomingPayments` (today.js + dashboard.js) | `src/views/today.js`, `dashboard.js` | S |
| 11.3 | Tests para `snoozeService` (isActive, expire, clear) | `tests/` | S |
| 11.4 | Schema `NetWorthSnapshots`: añadir 7 campos append-only (liquidity, investmentsValue, investmentsCost, accountsValue, otherAssets, ccDebt, liabilitiesDebt) | `backend/Config.gs` | S |
| 11.5 | `saveNetWorthSnapshot_`: capturar y guardar los 7 campos desde `computeNetWorth_` | `backend/NetWorth.gs` | S |
| 11.6 | Deploy `Config.gs` + `NetWorth.gs` + ejecutar `setupDatabase()` | backend | M |
| 11.7 | `networth.js`: mostrar desglose en detalle del snapshot (liquidez, inversiones, otros) | `src/views/networth.js` | S |

**Nota crítica:** El selector `upcomingPayments` NO se modifica. El filtro de snooze se aplica en la vista al renderizar (preserva pureza del selector).

**Archivos:** `src/services/snoozeService.js` (nuevo), `src/views/today.js`, `src/views/dashboard.js`, `backend/Config.gs`, `backend/NetWorth.gs`, `src/views/networth.js`

---

### Sprint 12 — Cuentas remuneradas + Alertas de portafolio

**Objetivo:** Soportar Global66/RappiCuenta como cuentas de rendimiento y añadir análisis automático del portafolio.  
**Dependencias:** Sprint 11 completado.  
**Estimación:** ~1.5 días + deploy backend | **Riesgo:** Bajo | **ROI:** Alto

| # | Tarea | Archivo | Esfuerzo |
|---|---|---|---|
| 12.1 | Schema `Accounts`: añadir `lastYieldDate` (campo append-only) | `backend/Config.gs` | S |
| 12.2 | `accounts.js`: badge "X% EA" en cuentas con `interestRate > 0` | `src/views/accounts.js` | S |
| 12.3 | `calcYield(account, today)`: interés compuesto diario | `src/views/accounts.js` | S |
| 12.4 | Modal "Registrar rendimiento": preview monto → confirmación → tx ingreso + update cuenta | `src/views/accounts.js` | M |
| 12.5 | Preset `RappiCuenta` (type:savings, interestRate:9, currency:COP) | `src/views/accounts.js` | S |
| 12.6 | Deploy `Config.gs` + `Accounts.gs` | backend | M |
| 12.7 | `selectors.portfolioAlerts(s)`: 4 alertas determinísticas (concentración >30%, CDT <30d, P&L <-20%, sin diversificación) | `src/store/selectors.js` | M |
| 12.8 | Sección "Análisis" colapsable en `investments.js` con las alertas | `src/views/investments.js` | M |
| 12.9 | Tests: `portfolioAlerts` con 4 escenarios | `tests/selectors.test.js` | S |

**Archivos:** `src/views/accounts.js`, `src/store/selectors.js`, `src/views/investments.js`, `backend/Config.gs`, `backend/Accounts.gs`

---

### Sprint 13 — IA narrativa de portafolio + Import/Export mejorado

**Objetivo:** Narrativa descriptiva del portafolio con Groq (opt-in) y mejoras de calidad al módulo de importación/exportación.  
**Dependencias:** Sprint 12 completado (alertas determinísticas antes de la narrativa).  
**Estimación:** ~1.5 días + deploy backend | **Riesgo:** Medio (IA) / Bajo (Import/Export) | **ROI:** Medio-Alto

| # | Tarea | Archivo | Esfuerzo |
|---|---|---|---|
| 13.1 | `backend/Analysis.gs` (nuevo, ~60 líneas): endpoint `analyzePortfolio` → Groq narrativa descriptiva (NO prescriptiva) | `backend/Analysis.gs` (nuevo) | M |
| 13.2 | `backend/Code.gs`: registrar acción `analyzePortfolio` (POST) | `backend/Code.gs` | S |
| 13.3 | Deploy `Analysis.gs` + `Code.gs` | backend | S |
| 13.4 | `investments.js`: botón "Analizar con IA" + narrativa generada con timestamp (solo si backend responde) | `src/views/investments.js` | S |
| 13.5 | Import: resumen de calidad (N/M sin categoría, alert si >30% sin clasificar) | `src/views/import.js` | S |
| 13.6 | Import: validar montos cero/negativos antes del preview | `src/services/importService.js` | S |
| 13.7 | Import: `dupKey` mejorado: `date|amount|descNorm` (reduce falsos positivos) | `src/views/import.js` | S |
| 13.8 | Import: perfil `RappiCuenta` en `bankProfiles.js` | `src/services/parsers/bankProfiles.js` | S |
| 13.9 | Export: selector de período (fecha desde/hasta) en UI | `src/views/exports.js` + `src/utils/export.js` | M |

**Nota crítica (I7 regulatorio):** El prompt de `Analysis.gs` debe ser estrictamente descriptivo. Frases prohibidas: "recomendamos", "deberías comprar/vender", "considera aumentar". Frases permitidas: "tu portafolio muestra", "el retorno anualizado es", "el activo de mayor peso es". Disclaimer visible en UI: "Esto no es asesoría financiera."

**Archivos:** `backend/Analysis.gs` (nuevo), `backend/Code.gs`, `src/views/investments.js`, `src/views/import.js`, `src/services/importService.js`, `src/services/parsers/bankProfiles.js`, `src/views/exports.js`, `src/utils/export.js`

---

## Resumen ejecutivo — Sprints 10–13

| Sprint | Objetivo | Esfuerzo | Iniciativas | ROI |
|---|---|---|---|---|
| **Sprint 10** | FIRE enriquecido + Insights analítica | ~1 día | I5, I4 | Alto |
| **Sprint 11** | Snooze pagos + Snapshot enriquecido | ~1 día + deploy | I2, I9 | Alto |
| **Sprint 12** | Cuentas remuneradas + Alertas portafolio | ~1.5 días + deploy | I8, I7 | Alto |
| **Sprint 13** | IA narrativa + Import/Export | ~1.5 días + deploy | I7, I6 | Medio-Alto |
| **Total** | | **~5 días + 3 deploys** | 7 de 9 iniciativas | |

## Iniciativas NO planificadas

| # | Iniciativa | Decisión | Motivo |
|---|---|---|---|
| I1 | Autenticación Biométrica | No implementar | OAuth+FedCM suficiente. Complejidad desproporcionada. Violación del principio de simplicidad. |
| I3 | Multicuenta / Multiusuario | No implementar | Viola el concepto central del producto. Solución para familiares: clonar el repo + instancia separada. |

---

*Generado por auditoría estratégica 2026-06-08. Siguiente acción: ejecutar Sprint 10.*
