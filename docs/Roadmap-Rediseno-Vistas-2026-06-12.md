# Roadmap — Rediseño fintech de las vistas (fase 2 del dossier)

**Fecha:** 2026-06-12 · **Base:** rediseño del Dashboard (commits `d29912d`, `b433b10`, `a89a52c`)
**Fuentes:** `docs/DOSSIER_UI_UX_FINTECH.txt` + `docs/REDISEÑO_FINTECH_MASTER_PROMPT.txt`
**Alcance:** Hoy · Transacciones · Cuentas · Presupuestos · Recurrentes · Patrimonio · Inversiones · Metas · Deudas

## Principios del rediseño (heredados del Dashboard)

1. **Cada vista responde en <5 s:** ¿qué tengo? ¿qué debo? ¿qué cambió? ¿qué hago ahora?
2. **Patrón visual unificado:** bloque héroe con cifra dominante → bloques de soporte
   densos (minilist) → acción/insight. Sin tarjetas gigantes ni métricas repetidas.
3. **Mobile-first real:** una columna fluida, acciones primarias alcanzables con el
   pulgar (FAB), filtros sticky, sin iconos diminutos apretados.
4. **Solo tokens semánticos** (`themes.css`); cero valores hardcoded.
5. **Lógica nueva → `selectors.js` + tests.** Las vistas no calculan, componen.
6. **Compatibilidad:** ninguna funcionalidad existente se elimina; se reorganiza.

---

## Sprint R0 — Fundamento compartido (prerrequisito) · esfuerzo S

El Dashboard definió el lenguaje pero sus piezas viven en `dashboard.js`. Extraer a
componentes reutilizables ANTES de tocar las 9 vistas (si no, 9 copias divergentes).

| Tarea | Detalle | Archivos |
|---|---|---|
| R0.1 | Extraer `sparklineSvg`, `scoreRing` (gauge), `miniRow`/minilist, `detailsBlock` y `HeroCard({label, value, trend, split, spark, details})` de `dashboard.js` → `components/ui.js` | `ui.js`, `dashboard.js` |
| R0.2 | Generalizar CSS: `.dash-*` → clases neutras (`.v-hero`, `.gauge`, `.mini`, `.dist`, `.callout`) manteniendo alias `.dash-*` para no romper | `components.css` |
| R0.3 | **FAB móvil**: botón flotante "+" sobre la bottom-nav (crear movimiento/entidad según vista). ≤920px reemplaza el CTA del header | `layout.css`, `shell.js` o helper en `ui.js` |
| R0.4 | **Bottom sheet de acciones**: en móvil, fila → sheet con Editar/Duplicar/Eliminar (sustituye los 3 icon-btn apretados). Reusar `modal.js`/drawer existente | `modal.js`, `components.css` |
| R0.5 | Barra de filtros sticky reutilizable (chips + búsqueda) para Transacciones/Recurrentes/Cuentas | `ui.js`, `components.css` |

**Verificar:** Dashboard idéntico tras la extracción (screenshot diff) · `node --test` pasa.

---

## Sprint R1 — Uso diario: Hoy + Transacciones · esfuerzo M

### Hoy (`today.js`) — "copiloto del día"
- **Héroe:** saldo disponible + semáforo `dailyHealth` integrado (anillo/badge con
  razones), neto de hoy y ahorro del mes como split (formato HeroCard).
- **"Para hoy" accionable:** cada item con acción directa — pago urgente → botón
  "Registrar pago" (abre tx prellenada), presupuesto al límite → link al presupuesto,
  meta → "Aportar". Hoy son filas pasivas.
- **Timeline del día:** movimientos de hoy agrupados con hora relativa.
- **Móvil:** quick-add "Gasto | Ingreso" como par de botones grandes bajo el héroe
  (lo más usado en el día a día); FAB genérico.

### Transacciones (`transactions.js`)
- **Header de resumen vivo:** el summary textual del filtro actual → mini-bloque con
  barras ingresos/gastos/neto (mismo `flowBar` del Dashboard). Reacciona a filtros.
- **Filtros sticky** (R0.5): búsqueda + chips tipo/categoría/cuenta fijos al hacer scroll.
- **Filas:** densidad minilist; monto dominante, categoría+cuenta como sub.
- **Móvil:** acciones por fila → bottom sheet (R0.4); FAB crear; paginación
  "Cargar más" (50 en 50) para listas largas — hoy renderiza todo (perf).
- **Selector nuevo:** `filteredFlowSummary(s, filtered)` (puro, testeable) si el
  cálculo inline crece; si no, reusar lógica existente.

**Verificar:** crear/editar/duplicar/eliminar intactos · filtros + búsqueda · 390px:
FAB y sheet operables · tests pasan.

---

## Sprint R2 — Estructura: Cuentas + Presupuestos + Recurrentes · esfuerzo M

### Cuentas (`accounts.js`)
- **Héroe:** liquidez total + split (líquido / crédito disponible / deuda CC) +
  **barra de distribución** por tipo de cuenta (reuso `.dist` de Deudas).
- **Grupos colapsables** (ya ordenados por valor FX): restyle a minilist con total
  del grupo en el header; recordar colapso en localStorage (pref UI).
- **Tarjetas de crédito:** barra de uso de cupo (`|balance|/creditLimit`) con umbral
  warning >70% — dato ya existe, no se muestra como barra.
- **Móvil:** filas compactas (ya hay base del sprint M); acción rápida "Transferir"
  visible por fila en cuentas líquidas.

### Presupuestos (`budgets.js`)
- **Navegación de período:** header `← Junio 2026 →` para ver meses anteriores
  (hoy solo mes actual; los datos lo permiten — `periodKey`).
- **Héroe:** disponible total + gauge de % consumido global (reuso `scoreRing`).
- **Tarjetas → filas de progreso** con badge de **proyección** (`budgetStats.projected`):
  "Proyectado: $X (supera el límite)" — el dato existe, no se muestra.
- **Empty state inteligente:** sugerir presupuestos desde top 3 categorías de gasto
  del mes anterior (selector existente `categorySpend`).

### Recurrentes (`recurring.js`)
- **Héroe:** total comprometido del mes (suma de activos mensuales normalizados) +
  próximos 7 días destacados.
- **Timeline:** agrupar por "Esta semana / Próxima semana / Después" en vez de lista plana.
- **Toggle pausar/activar** visible en la fila (hoy requiere abrir modal de edición).
- **Selector nuevo:** `recurringMonthlyLoad(s)` — normaliza frecuencias a carga
  mensual (weekly×4.33, yearly/12…). Con tests.

**Verificar:** CRUD intacto en las 3 vistas · `recurringMonthlyLoad` testeado ·
navegación de período no rompe `normPeriodKey` (¡gotcha Sheets YYYY-MM!) · 390px.

---

## Sprint R3 — Patrimonio + Inversiones · esfuerzo M-L

### Patrimonio (`networth.js`)
- **Héroe:** reuso directo del HeroCard del Dashboard (patrimonio, variación mensual,
  vs snapshot, sparkline, split activos/pasivos/liquidez). Misma cifra, mismo formato.
- **Composición:** stacked bar única (cuentas/inversiones/otros activos vs deudas)
  en vez de card aparte con barras sueltas.
- **Snapshots:** lista compacta con **variación % entre snapshots consecutivos**
  (columna nueva derivada); selección múltiple existente intacta.
- **Activos/Pasivos:** minilists con valor compacto; CTA "Guardar snapshot" también
  en móvil (hoy queda lejos del pulgar).

### Inversiones (`investments.js` — 50 KB, tocar con cuidado, por secciones)
- **Héroe:** valor total + P&L + XIRR del portafolio (`portfolioXIRR` existe) +
  barra de distribución por tipo (`portfolioOverview.distribution` — ya testeado).
- **Posiciones:** restyle de tarjetas de grupo a formato minilist denso (compacta)
  conservando el toggle "Ver compras" (expandida — CAMBIO 5 ya existe).
- **Análisis:** sección de alertas usa `portfolioAlerts` dedupeado + insights de
  `portfolioOverview` (ganador/perdedor/concentración) — quitar métricas repetidas
  entre secciones (dossier: EVITAR redundancia).
- **Móvil:** secciones colapsables ya existen; sticky del selector de sección;
  tabla de compras mantiene scroll horizontal.
- **NO tocar:** lógica de cost basis/ventas/FX (auditada). Solo presentación + reuso
  de selectors existentes.

**Verificar:** cifras idénticas pre/post (snapshot de valores en ambas vistas) ·
tests pasan · 390px · dark/light.

---

## Sprint R4 — Metas + Deudas + QA global · esfuerzo M

### Metas (`goals.js`)
- **Héroe:** total ahorrado vs total objetivo + gauge % global + ahorro mensual
  disponible para metas (`goalSavingsSplit`).
- **Tarjetas → filas ricas:** progreso + probabilidad (ya añadida) + proyección +
  aporte requerido en una línea; "Aportar" como acción primaria visible.
- **Orden:** por probabilidad ascendente opcional (las que peligran primero) con
  segmented control [Avance | Riesgo].

### Deudas (`debts.js`)
- **Héroe:** deuda total + barra de distribución (reuso `.dist`) + tasa promedio.
- **Tarjetas de crédito:** barra de cupo usado (igual que Cuentas R2).
- **Plan de pago:** timeline visual del orden de liquidación (estrategia elegida)
  con fecha por deuda (`chainedPayoff` por pasos — extender selector para devolver
  `perDebt: [{id, months}]` con tests) y **ahorro de intereses Avalanche vs Snowball**
  destacado (ambos ya calculables, falta el comparativo).
- **Móvil:** segmented Avalanche/Snowball sticky; abonar desde la fila.

### QA global (cierre)
- Recorrido Playwright de las 9 rutas: consola limpia, dark/light, 390/768/1366px,
  con datos de prueba inyectados (protocolo de memoria) + limpieza.
- `node --test` completo · actualizar `PROJECT_HANDOFF.md` y `docs/TechnicalDebt.md`.
- Commits atómicos por vista (el hook bumpea SW solo).

---

## Orden y dependencias

```
R0 (componentes) ──► R1 (Hoy, Transacciones)
                 ──► R2 (Cuentas, Presupuestos, Recurrentes)
                 ──► R3 (Patrimonio, Inversiones)
                 ──► R4 (Metas, Deudas, QA)
```

R1–R4 son independientes entre sí tras R0; el orden propuesto prioriza frecuencia
de uso (diario → semanal → mensual). Cada sprint = 1 sesión de `/implement`,
commits por vista, validación del dueño entre sprints.

## Selectors nuevos (todos con tests)

| Selector | Sprint | Qué devuelve |
|---|---|---|
| `recurringMonthlyLoad(s)` | R2 | carga mensual normalizada de recurrentes activos |
| `chainedPayoff` extendido | R4 | `{ months, totalInterest, perDebt: [{id, months}] }` |
| `snapshotDeltas(s)` | R3 | variación % entre snapshots consecutivos |

## Riesgos

- **`investments.js` (50 KB):** mayor superficie de regresión — solo presentación,
  por secciones, verificando cifras idénticas antes/después.
- **Período en Presupuestos:** cuidado con `normPeriodKey` (Sheets auto-convierte
  `YYYY-MM` a Date).
- **`chainedPayoff` extendido:** mantener firma retrocompatible (debts.js ya lo usa).
- **FAB vs bottom-nav:** no tapar la píldora flotante; FAB arriba-derecha de la nav
  con `safe-area-inset`.
