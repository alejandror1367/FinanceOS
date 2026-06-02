# Auditoría de Producto — Dashboard · Hoy · Transacciones · Cuentas
**Fecha:** 2026-06-02 | **Auditor:** Claude Sonnet 4.6 (Playwright MCP)  
**Versión auditada:** v0.2.14 | **Commit base:** `5d73d5e`  
**Sprint 1 ya aplicado:** commit `0d74646` — v0.2.15

> Auditoría de 7 fases realizada como Staff Frontend + QA + Product Designer + Financial Systems Architect.
> Los fixes del Sprint 1 ya están en `main`. Los sprints 2–5 son la cola de trabajo.

---

## Estado de correcciones

| ID | Bug | Sprint | Estado |
|---|---|---|---|
| F-C1 | Liquidez inflada por deuda CC (`liquidAccounts`) | 1 | ✅ Resuelto `0d74646` |
| F-C2 | Trend patrimonio hardcodeado a +4.2% | 1 | ✅ Resuelto `0d74646` |
| F-C3 | "Mayo 2026" hardcodeado en KPI Ingresos | 1 | ✅ Resuelto `0d74646` |
| F-C4 | Inversiones muestra −100% cuando `value=0` | 1 | ✅ Resuelto `0d74646` |
| TX-1 | Agrupación por fecha + cabecera en Transacciones | 2 | ⏳ Pendiente |
| TX-2 | Filtro de mes en Transacciones | 2 | ⏳ Pendiente |
| TX-3 | Filtro de categoría en Transacciones | 2 | ⏳ Pendiente |
| TX-4 | Totales en resultado de filtro | 2 | ⏳ Pendiente |
| TX-5 | Cuenta destino visible en fila de transferencia | 2 | ⏳ Pendiente |
| TX-6 | `accountOpts` del filtro stale (capturado al mount) | 2 | ⏳ Pendiente |
| HOY-1 | Panel "Para hoy" con items accionables | 3 | ⏳ Pendiente |
| HOY-2 | Señal de salud financiera del día | 3 | ⏳ Pendiente |
| HOY-3 | Insight diario automático | 3 | ⏳ Pendiente |
| HOY-4 | Vista Hoy no reactiva (`store.subscribe`) | 3 | ⏳ Pendiente |
| CTA-1 | Agrupación de Cuentas por tipo | 4 | ⏳ Pendiente |
| CTA-2 | KPI summary en Cuentas | 4 | ⏳ Pendiente |
| CTA-3 | Quick presets bancos colombianos | 4 | ⏳ Pendiente |
| CTA-4 | Balance CC en rojo/negativo en Cuentas | 4 | ⏳ Pendiente |
| DB-1 | Dashboard no reactivo (`store.subscribe`) | 5 | ⏳ Pendiente |
| DB-2 | Score financiero mensual | 5 | ⏳ Pendiente |
| DB-3 | Alertas inline en KPIs | 5 | ⏳ Pendiente |

---

## FASE 1 — Tabla de bugs completa

| Prioridad | Módulo | Problema | Impacto | Solución propuesta |
|---|---|---|---|---|
| **CRÍTICO** | Dashboard | Liquidez inflada — `liquidAccounts` incluye CC (+$3.4M) → muestra $7.894.196 en lugar de $4.485.196 | Número financiero incorrecto | `a.type !== 'credit_card'` en selector — **RESUELTO** |
| **CRÍTICO** | Dashboard | Trend patrimonio hardcodeado `Trend(4.2)` en `dashboard.js:31` | Dato falso en producción | Calcular desde snapshots — **RESUELTO** |
| **CRÍTICO** | Dashboard | Inversiones `−100.0%` cuando `value=0, cost>0` | KPI engañoso | Guard `invValue > 0` — **RESUELTO** |
| **ALTO** | Dashboard | `"Mayo 2026"` literal en footer de Ingresos del mes | Mes incorrecto desde junio | `Intl.DateTimeFormat` dinámico — **RESUELTO** |
| **ALTO** | Dashboard | Vista no reactiva — `renderDashboard(s)` sin `store.subscribe` | Datos stale tras sync | Convertir a `root + repaint()` |
| **ALTO** | Transacciones | `accountOpts` del filtro capturado al mount, nunca actualizado si cambian cuentas | Filtro desactualizado | Mover dentro de `paint()` |
| **ALTO** | Transacciones | Sin filtro de rango de fechas ni categoría | Inmanejable en producción real | `<input type="month">` + `<select>` categoría |
| **ALTO** | Cuentas | Sin agrupación por tipo — lista plana mezclando banco/efectivo/CC | Difícil lectura del ecosistema | Secciones: Bancos / Efectivo / Tarjetas / Inversión |
| **ALTO** | Cuentas | Sin KPI summary — solo "4 cuentas · $7.894.196" (con error de liquidez) | Falta foto financiera rápida | KPIs: Activos líquidos / Crédito disponible / Deuda CC |
| **MEDIO** | Dashboard | Gráfico patrimonio con pocas barras / badge "Demo" perpetuo | Confunde con datos reales | Empty state elegante con 0–1 snapshots |
| **MEDIO** | Transacciones | Sin paginación — DOM crece sin límite | Degradación de rendimiento | Agrupar por fecha + paginar cada 30 |
| **MEDIO** | Transacciones | Transferencias sin cuenta destino en la fila | No distingue dos transferencias | Agregar `→ [nombre cuenta]` en sub-label |
| **MEDIO** | Hoy | Sin insights ni alertas automáticas | No cumple promesa "copiloto diario" | Panel accionable (ver Fase 3) |
| **MEDIO** | Cuentas | CC muestra balance positivo igual que banco | Confunde activo con pasivo | Balance CC en rojo con símbolo negativo |
| **BAJO** | Dashboard | `recentTransactions` sin desempate por hora/id | Orden inestable mismo día | Añadir `createdAt` como tiebreaker |
| **BAJO** | Transacciones | `FILTER` global stale si cuentas cambian | Edge case de datos stale | Mismo fix que `accountOpts` |
| **BAJO** | Cuentas | Sin botón de archivar — solo eliminar (destructivo) | Cuentas inactivas = borrar o dejar | Icono archivo junto a editar/eliminar |
| **BAJO** | Hoy | Vista no reactiva (`store.subscribe`) | Datos stale tras acciones | `store.subscribe` o re-render al focus |

---

## FASE 2 — Dashboard: análisis profundo

### KPIs verificados en browser (post Sprint 1)

```
Patrimonio neto:   $12.894.196  │ trend calculado desde snapshots ✓
Inversiones:       $0           │ "sin posiciones activas" ✓
Gastos del mes:    $411.000     │ 10% de ingresos ✓
Ingresos del mes:  $4.236.000   │ "Junio de 2026" (dinámico) ✓
Ahorro del mes:    $3.825.000   │ +90.3% tasa de ahorro ✓
Liquidez:          $4.485.000   │ 3 cuentas (sin CC) ✓
```

### Bug de liquidez — detalle técnico

```javascript
// selectors.js ANTES (inflaba con deuda CC):
liquidAccounts(s) {
  return s.accounts.filter(a => !a.isArchived && a.type !== 'investment');
}
// → suma Bancolombia ($4.25M) + Efectivo ($0.2M) + Amex CC ($3.41M) + Global66 ($0.035M) = $7.89M

// selectors.js DESPUÉS (correcto):
liquidAccounts(s) {
  return s.accounts.filter(a => !a.isArchived 
    && a.type !== 'investment' 
    && a.type !== 'credit_card');
}
// → suma Bancolombia ($4.25M) + Efectivo ($0.2M) + Global66 ($0.035M) = $4.485M
```

### Mejoras de producto priorizadas (inspiradas en Monarch/Copilot/Linear)

| Mejora | Impacto | Esfuerzo |
|---|---|---|
| Score financiero mensual (0–100) | Alto | Medio |
| "Tendencia de gasto" — +23% vs mes anterior | Alto | Bajo |
| Cash flow proyectado al fin de mes (con recurrentes) | Alto | Medio |
| Alertas inline en KPIs (presupuesto al 80%, CC vence en 3 días) | Alto | Medio |
| Gráfico patrimonio como sparkline en el KPI héroe | Medio | Bajo |
| "Ratio de liquidez" — días de gastos cubiertos con efectivo | Medio | Bajo |

---

## FASE 3 — Hoy: análisis y propuesta copiloto

### Estado actual

3 KPIs + 3 cards (Movimientos recientes · Próximos pagos · Metas prioritarias).  
La vista es **pasiva**: muestra datos, no genera señales. No reactiva (`store.subscribe` ausente).

### ¿Qué haría esta pantalla imprescindible?

La pantalla debe responder en < 5 s: **"¿Estoy bien financieramente hoy?"**

#### 1. Semáforo de salud del día (nuevo componente)
```
🟢 Todo en orden  /  🟡 Atención  /  🔴 Acción requerida
```
Señal calculada desde: pagos vencidos, presupuestos superados, saldo bajo.

#### 2. Quick actions contextuales
```
[+ Gasto]  [+ Ingreso]  [↗ Presupuesto]
```

#### 3. Panel "Para hoy" con items accionables
```
⚠ Pago tarjeta Amex vence mañana — $1.340.968     [Abonar →]
📊 Restaurantes: 83% del presupuesto mensual        [Ver →]
🎯 Fondo emergencia: $200k para llegar al 50%      [Aportar →]
```

#### 4. Insight diario automático (usar `topCategoryChange` ya en selectors)
```
"Tus gastos en Restaurantes aumentaron 23% vs el mes pasado"
"A este ritmo de ahorro, llegas a tu meta en 8 meses"
```

#### 5. Micro-progreso del mes
```
[████████░░░░░░░░░░░░] Jun 2: 2/30 días · $411k gastados de $3.1M presupuestado
```

---

## FASE 4 — Transacciones: auditoría completa

### Flujo funcional verificado

| Acción | Estado | Notas |
|---|---|---|
| Crear gasto | ✅ | Categoría auto-seleccionada, monto validado |
| Crear ingreso | ✅ | Cambia categorías a tipo "income" |
| Crear transferencia | ✅ | Valida cuentas distintas |
| Editar | ✅ | Pre-rellena todos los campos |
| Duplicar | ✅ | Copia con fecha de hoy |
| Eliminar | ✅ | Confirmación previa |
| Buscar | ✅ | Filtra por descripción + categoría + cuenta |
| Filtro tipo | ✅ | |
| Filtro cuenta | ✅ | |
| Filtro fecha | ❌ | No existe |
| Filtro categoría | ❌ | No existe |
| Cuenta destino en fila | ❌ | Solo muestra "Transferencia · Bancolombia · fecha" |
| Totales de filtro | ❌ | No existe |
| Paginación | ❌ | Lista ilimitada |
| Bulk delete | ❌ | No existe |

### Código issue: `accountOpts` stale

```javascript
// transactions.js — construido una sola vez al montar la vista
const accountOpts = [{ value: 'all', label: 'Todas las cuentas' }]
  .concat(store.get().accounts  // ← snapshot en el momento del mount
    .filter(a => !a.isArchived)
    .map(a => ({ value: a.id, label: a.name })));
```
Si el usuario crea/edita una cuenta y vuelve a Transacciones sin navegar a otra ruta, el filtro queda desactualizado.

### Mejoras priorizadas

| Mejora | Impacto | Esfuerzo |
|---|---|---|
| Agrupación por fecha con cabecera (`Hoy · Ayer · 28 may`) + total del grupo | Alto | Bajo |
| Filtro de mes `<input type="month">` | Alto | Bajo |
| Filtro de categoría en toolbar | Alto | Bajo |
| Totales en resultado — "23 transacciones · −$1.234.000 neto" | Alto | Bajo |
| Cuenta destino en fila de transferencia `→ [nombre]` | Medio | Bajo |
| `accountOpts` reactivo dentro de `paint()` | Medio | Bajo |
| Selección múltiple + eliminar en lote | Medio | Medio |
| Reglas automáticas de categorización | Alto | Alto |

---

## FASE 5 — Cuentas: ecosistema financiero

### Estado actual
```
Cuentas (4) — lista plana:
  Bancolombia        BANCO           $4.250.000
  Efectivo           EFECTIVO          $200.000
  Amex Bancolombia   TARJETA DE CRÉDITO $3.409.196  ← positivo (confuso)
  Global66           BANCO              $35.000
```

### Estructura profesional propuesta
```
CUENTAS
├─ 🏦 BANCOS (líquido)
│   Bancolombia $4.250.000 · Global66 $35.000
│
├─ 💵 EFECTIVO
│   Efectivo $200.000
│
├─ 💳 TARJETAS DE CRÉDITO
│   Amex Bancolombia −$3.409.196  42% utilizado  ← rojo, negativo
│
└─ 📈 INVERSIONES
    (vacío)
```

### Quick presets — bancos y servicios colombianos

```javascript
// accounts.js — PRESETS para "Nueva cuenta"
const PRESETS = [
  // Bancos COP
  { label: 'Bancolombia',  type: 'bank',           institution: 'Bancolombia', currency: 'COP' },
  { label: 'NuBank',       type: 'bank',           institution: 'NuBank',      currency: 'COP' },
  { label: 'Nequi',        type: 'digital_wallet', institution: 'Nequi',       currency: 'COP' },
  { label: 'RappiPay',     type: 'digital_wallet', institution: 'RappiPay',    currency: 'COP' },
  { label: 'Finandina',    type: 'bank',           institution: 'Finandina',   currency: 'COP' },
  // Exchange / remesas
  { label: 'Global66',     type: 'bank',           institution: 'Global66',    currency: 'USD' },
  // Efectivo
  { label: 'Caja menor',   type: 'cash',           institution: '',            currency: 'COP' },
  // Tarjetas
  { label: 'Visa Bancolombia', type: 'credit_card', institution: 'Bancolombia', currency: 'COP' },
  { label: 'Mastercard NuBank', type: 'credit_card', institution: 'NuBank',    currency: 'COP' },
  { label: 'RappiCard',    type: 'credit_card',    institution: 'Rappi',       currency: 'COP' },
  // Inversiones
  { label: 'XTB',          type: 'investment',     institution: 'XTB',         currency: 'USD' },
  { label: 'Tyba',         type: 'investment',     institution: 'Tyba',        currency: 'COP' },
  { label: 'Trii',         type: 'investment',     institution: 'Trii',        currency: 'USD' },
  { label: 'AQR Invest',   type: 'investment',     institution: 'AQR',         currency: 'COP' },
];
```

### Modelo de datos — campos faltantes

| Campo | Actual | Propuesto | Razón |
|---|---|---|---|
| `liquidityTier` | ❌ | `instant / t1 / t2 / locked` | Liquidez real vs nominal |
| `includeInNetWorth` | ❌ | `boolean` | Excluir cuentas de propósito especial |
| `includeInCashFlow` | ❌ | `boolean` | Excluir cuentas inversión/ahorro del flujo |
| `color` | ❌ | `string (hex)` | Identificación visual rápida |
| `lastSyncedAt` | ❌ | `ISO date` | Mostrar "sincronizado hace X días" |

---

## FASE 6 — Robustez

| P | Archivo | Problema | Riesgo |
|---|---|---|---|
| **P0** | `selectors.js` | CC incluida en liquidez → dato incorrecto | **RESUELTO** `0d74646` |
| **P0** | `dashboard.js` | Trend patrimonio hardcodeado → dato falso | **RESUELTO** `0d74646` |
| **P1** | `dashboard.js` | Mes hardcodeado "Mayo 2026" | **RESUELTO** `0d74646` |
| **P1** | `dashboard.js`, `today.js` | No reactivos a `store.subscribe` | Datos stale tras sync |
| **P1** | `transactions.js:185` | `accountOpts` capturado al mount | Filtro desactualizado |
| **P2** | `selectors.js` | `investmentsReturnPct` sin guard para `value=0` | **RESUELTO** `0d74646` |
| **P2** | `transactions.js` | Sin paginación — DOM ilimitado | Performance en uso real |
| **P2** | `accounts.js` | `renderAccounts` no reactivo | Datos stale |
| **P3** | `dashboard.js` | `recentTransactions` sin tiebreaker por hora/id | Orden inestable mismo día |

---

## FASE 7 — Roadmap de implementación

### Sprint 1 — Correcciones financieras ✅ COMPLETADO (`0d74646`)

- ✅ Bug liquidez: `liquidAccounts` excluye `credit_card`
- ✅ Trend patrimonio: calculado desde snapshots reales
- ✅ Mes ingresos: `Intl.DateTimeFormat` dinámico
- ✅ Guard inversiones −100%: muestra "sin posiciones activas"
- ✅ Test añadido: "excluye tarjetas de crédito" en `totalLiquidity` (40/40)

---

### Sprint 2 — Transacciones completas

**Objetivo:** que Transacciones sea útil para 12+ meses de historia financiera.

**Cambios en `src/views/transactions.js`:**

1. **Agrupación por fecha** — cabecera con label relativo (`Hoy · Ayer · 28 may`) y suma del grupo
2. **Filtro de mes** — `<input type="month">` en la toolbar (valor por defecto: mes actual)
3. **Filtro de categoría** — `<select>` filtro dinámico por categorías de gasto/ingreso
4. **Totales en resultado** — texto "N transacciones · $X neto" debajo de los filtros
5. **Cuenta destino en transferencias** — sub-label: `Transferencia · Bancolombia → Efectivo · fecha`
6. **`accountOpts` reactivo** — mover la construcción de opciones dentro de `paint()`

**Archivos:** `src/views/transactions.js`  
**Tests afectados:** ninguno (lógica de filtros en vista, no en selectors)  
**Estimación:** 1.5–2 horas

---

### Sprint 3 — Hoy como copiloto

**Objetivo:** que abrir "Hoy" dé una respuesta inmediata sobre el estado financiero del día.

**Cambios en `src/views/today.js`:**

1. **`store.subscribe`** — convertir a patrón `root + repaint()`
2. **Panel "Para hoy"** — items accionables con botones inline:
   - Pagos que vencen hoy/mañana con CTA "Abonar"
   - Presupuestos >= 80% con CTA "Ver"
   - Metas con próximo aporte recomendado con CTA "Aportar"
3. **Semáforo de salud** (🟢/🟡/🔴) — calculado automáticamente
4. **Insight diario** — 1 mensaje por día usando `topCategoryChange` de selectors
5. **Micro-progreso del mes** — barra y texto "Jun 2: 2/30 días · $411k / $3.1M"

**Archivos:** `src/views/today.js`, posiblemente `src/store/selectors.js` (nuevo selector `dailyHealthScore`)  
**Estimación:** 2–2.5 horas

---

### Sprint 4 — Cuentas como ecosistema

**Objetivo:** que Cuentas refleje el ecosistema financiero real de Alejo.

**Cambios en `src/views/accounts.js`:**

1. **Agrupación por tipo** — secciones colapsables: Bancos / Efectivo / Tarjetas / Billeteras / Inversiones
2. **KPI summary** — 3 KPIs: Activos líquidos · Crédito disponible · Deuda total CC
3. **Balance CC en negativo/rojo** — mostrar `−$3.409.196` con clase `text-negative`
4. **Quick presets** — chips de bancos colombianos en el modal "Nueva cuenta" (pre-rellenan nombre + institución + tipo)
5. **Botón archivar** — junto a editar/eliminar, usa `isArchived: true`
6. **`renderAccounts` reactivo** — `store.subscribe`

**Archivos:** `src/views/accounts.js`  
**Estimación:** 1.5–2 horas

---

### Sprint 5 — Dashboard premium

**Objetivo:** que el Dashboard sea el centro de comando financiero real.

**Cambios en `src/views/dashboard.js`:**

1. **`store.subscribe`** — convertir a patrón `root + repaint()`
2. **Score financiero mensual** — KPI extra: número 0–100 que resume salud (ahorro rate, presupuestos, metas)
3. **Alertas inline en KPIs** — badge/dot cuando presupuesto > 80%, pago próximo, meta al 90%
4. **Gráfico patrimonio mejorado** — sparkline en el KPI héroe en lugar de card separada cuando hay pocos snapshots
5. **Empty state elegante para el gráfico** — cuando hay 0–1 snapshots mostrar CTA "Tomar primer snapshot"

**Archivos:** `src/views/dashboard.js`, posiblemente `src/store/selectors.js`  
**Estimación:** 1.5–2 horas

---

## Para retomar en nueva sesión

Lee este documento y `PROJECT_HANDOFF.md`. El siguiente trabajo es el **Sprint 2** (Transacciones).

Contexto clave para la nueva sesión:
- Sprint 1 ya aplicado en `main` (commit `0d74646`, v0.2.15)
- 40/40 tests pasan
- Los 4 bugs financieros críticos del Dashboard están resueltos
- La siguiente prioridad es Sprint 2: `src/views/transactions.js` únicamente
- No hay deuda técnica P0 abierta en este módulo
- El servidor local se levanta con `npx serve . -p 3000` desde la raíz del repo
