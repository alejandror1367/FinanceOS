# Auditoría Funcional — FinanceOS
**Fecha:** 2026-06-02 | **Herramienta:** Playwright MCP (Claude Sonnet 4.6)  
**URL auditada:** https://alejandror1367.github.io/FinanceOS/  
**Contexto:** Primera auditoría funcional completa post-fase-12. Backend con bypass OAuth temporal para la sesión.

---

## Resumen ejecutivo

15/15 rutas cargaron sin pantallas blancas ni errores JS fatales. La app es **funcionalmente estable**. Se detectaron **2 bugs críticos, 4 altos, 6 medios y 4 bajos**.

El hallazgo más impactante: **el cold start siempre falla auth** — todos los KPIs aparecen en $0 en cada primera carga hasta que el usuario hace click en "Actualizar" manualmente.

Se descubrió un **módulo nuevo no documentado**: `#/import` — importación de extractos bancarios con IA (Gemini). Soporta Bancolombia, Nu, Nequi, Global66, RappiPay, XTB, AQR Invest.

---

## Estado por módulo

| Módulo | Ruta | Estado |
|--------|------|--------|
| Dashboard | `#/dashboard` | ✅ OK (datos reales tras Actualizar) |
| Hoy | `#/today` | ✅ OK — saldo, recientes, próximos pagos, metas |
| Transacciones | `#/transactions` | ✅ OK — CRUD, filtros, búsqueda, modal |
| Cuentas | `#/accounts` | ✅ OK — 7 cuentas, $5.1M total |
| Presupuestos | `#/budgets` | ❌ Fecha cruda + consumido $0 |
| Recurrentes | `#/recurring` | ✅ OK — 2 items con fechas correctas |
| Patrimonio | `#/networth` | ✅ OK — $6.27M neto, activos/pasivos, snapshots |
| Inversiones | `#/investments` | ⚠️ OK pero precios no auto-cargan |
| Metas | `#/goals` | ✅ OK — 2 metas activas con aportes |
| Deudas | `#/debts` | ⚠️ Snowball/Avalanche OK, KPI tarjetas $0 |
| Analítica | `#/analytics` | ✅ OK — 4 gráficos + insights |
| Diario | `#/journal` | ⚠️ Sin entradas (vacío) |
| Exportaciones | `#/exports` | ✅ OK — CSV×10, JSON, PDF×2 |
| Ajustes | `#/settings` | ✅ OK — tema, sync, sesión, recalcular |
| **Importar** | `#/import` | ✅ Nuevo módulo — no estaba documentado |

---

## Bugs por prioridad

### 🔴 Crítico

**BUG-C1 — Cold start: todos los pulls fallan con "No autorizado"**
- **Síntoma:** En cada primera carga, los 12 pulls devuelven "No autorizado". Todos los KPIs muestran $0. Se resuelve con click en "Actualizar".
- **Causa probable:** Race condition en el bootstrap de `app.js` entre la inicialización del token OAuth y el `pullAll()`. El ciclo `auth.signOut() → location.reload()` deja el store vacío en la segunda carga.
- **Archivos:** `src/services/dataService.js`, `src/core/app.js`, `src/services/apiClient.js:53`
- **Reproducción:** Abrir la app en un tab nuevo o en modo incógnito.

**BUG-C2 — Presupuestos: fecha del período renderiza como `Date.toString()` crudo**
- **Síntoma:** Las fechas se muestran como `FRI MAY 01 2026 00:00:00 GMT` en lugar de `"Mayo 2026"`.
- **Archivo:** `src/views/budgets.js` — donde se renderiza `budget.startDate` (o similar).
- **Fix:** Envolver con `formatDate(budget.startDate)` o `new Intl.DateTimeFormat('es-CO', { month:'long', year:'numeric' }).format(new Date(budget.startDate))`.

### 🟠 Alto

**BUG-A1 — Presupuestos: consumido siempre $0 (TD-12 confirmado)**
- **Síntoma:** Todos los presupuestos muestran "Consumido: $0" aunque hay transacciones en esas categorías en mayo (Arriendo $2.1M, Restaurantes $304k, etc.).
- **Causa:** `sameMonth()` en `selectors.js` compara fechas con objetos `Date` locales → drift de UTC-5 (Colombia). Las transacciones del fin de mayo caen en "el mes anterior".
- **Fix (1 línea):** `src/store/selectors.js` — `sameMonth()`:
  ```javascript
  // Antes:
  const sameMonth = (a, b) => new Date(a).getMonth() === new Date(b).getMonth() && ...
  // Después:
  const sameMonth = (a, b) => String(a).slice(0, 7) === String(b).slice(0, 7);
  ```

**BUG-A2 — Dashboard: KPI "Ingresos del mes" muestra "Mayo 2026" en junio**
- **Síntoma:** La etiqueta sub del KPI "Ingresos del mes" dice "Mayo 2026" cuando la fecha actual es junio 2026.
- **Archivo:** `src/views/dashboard.js` — renderización del período del KPI.

**BUG-A3 — Botón "Buscar" en topbar no hace nada (TD-31 confirmado)**
- **Síntoma:** Click en la lupa del topbar no abre ningún overlay, modal ni command palette.
- **Archivo:** `src/components/shell.js` — handler del botón Buscar.
- **Fix recomendado:** Eliminar el botón hasta tener la implementación.

**BUG-A4 — Deudas: KPI "Tarjetas de crédito" muestra $0**
- **Síntoma:** El KPI muestra $0 aunque hay $3.83M en deudas de tarjeta. Las deudas reales aparecen en "Otras deudas" en lugar de "Tarjetas de crédito".
- **Causa:** La vista no consolida correctamente las cuentas `type='credit_card'` con las `Liabilities`.
- **Archivo:** `src/views/debts.js`

### 🟡 Medio

**BUG-M1 — Inversiones: precios no auto-cargan en sesión nueva**
- **Síntoma:** Al entrar a Inversiones sin historial en localStorage, los precios aparecen como "— sin precio —". Requiere click manual en "Actualizar precios".
- **Causa:** `priceService.isStale()` devuelve true correctamente, pero el auto-refresh no se dispara en la primera visita si no hay caché previa.
- **Archivo:** `src/views/investments.js`

**BUG-M2 — Snapshots de patrimonio con valores de test ($44.3M)**
- **Síntoma:** El gráfico de Analítica muestra snapshots de $44.3M y $29.7M, muy por encima del patrimonio real de $6.27M.
- **Causa:** Snapshots guardados con datos de prueba en sesiones anteriores.
- **Fix:** Borrar los snapshots viejos desde Google Sheets (hoja `NetWorthSnapshots`).

**BUG-M3 — FX rate posiblemente desactualizado**
- **Síntoma:** 1 USD = $3.559 COP. La tasa real en junio 2026 es ~$4.100-4.200 COP.
- **Archivo:** `src/services/priceService.js` — fuente de tasas FX.

**BUG-M4 — Dashboard "Evolución del patrimonio" muestra badge "DEMO"**
- **Síntoma:** El gráfico de evolución en el Dashboard muestra datos mock con badge "Demo" en lugar de los snapshots reales.
- **Causa:** El selector de evolución usa datos demo cuando hay pocos snapshots reales.

### 🟢 Bajo

**BUG-B1 — Versión en Ajustes: "0.1.0" (debería ser 0.2.x)**
- **Fix:** `src/core/config.js` — `version: '0.2.6'`

**BUG-B2 — "mAZDA" capitalización inconsistente**
- En Patrimonio, el vehículo "mAZDA" tiene la M en minúscula. Es dato del usuario, no del código.

**BUG-B3 — Módulo #/import no documentado en handoff**
- Nuevo módulo no registrado en `PROJECT_HANDOFF.md` ni `docs/SessionState.md`.

**BUG-B4 — Cuenta "Efectivo" con saldo negativo sin alerta**
- Saldo −$52.000 en una cuenta de efectivo. Sin indicación visual de estado anormal.

---

## Datos reales encontrados

- **Cuentas (7):** Prueba FinanceOS $100k, Bancolombia $2.394M, Nu $1.158M, Efectivo −$52k, Ahorro Meta $1.5M, Trii Inversiones $0, Amex Bancolombia $0
- **Transacciones recientes:** Salud $161k (1 jun), Almuerzo equipo $86k (31 may), Salario mayo $6.2M (28 may), Arriendo $2.1M (28 may), Proyecto landing $1.8M (26 may)
- **Inversiones:** MU (Micron) 0.082664 shares, cost basis US$397, precio actual US$86, retorno +161%
- **Metas:** Fondo emergencia 49% ($8.9M/$18M), Viaje Japón 35% ($4.2M/$12M)
- **Deudas:** Tarjeta credito $3.4M (28.5%), American $430k (28%)
- **Próximos pagos:** Arriendo (en 2 días), Pago tarjeta (9 jun)

---

## Errores de consola (cold start)

```
[WARNING] [dataService] pull "accounts"          falló: No autorizado.
[WARNING] [dataService] pull "transactions"      falló: No autorizado.
[WARNING] [dataService] pull "categories"        falló: No autorizado.
[WARNING] [dataService] pull "budgets"           falló: No autorizado.
[WARNING] [dataService] pull "goals"             falló: No autorizado.
[WARNING] [dataService] pull "investments"       falló: No autorizado.
[WARNING] [dataService] pull "assets"            falló: No autorizado.
[WARNING] [dataService] pull "liabilities"       falló: No autorizado.
[WARNING] [dataService] pull "recurring"         falló: No autorizado.
[WARNING] [dataService] pull "netWorthSnapshots" falló: No autorizado.
[WARNING] [dataService] pull "journal"           falló: No autorizado.
[WARNING] [dataService] pull "settings"          falló: No autorizado.
[WARNING] [GSI_LOGGER]: FedCM migration warning
```
*(0 errores en navegación entre rutas una vez datos cargados)*

---

## Capturas guardadas

Todas en la raíz del proyecto (generadas por Playwright MCP):
- `audit-07-dashboard-datos-reales.png` — Dashboard con datos reales
- `audit-08-hoy.png` — Vista Hoy completa
- `audit-09-transacciones.png` — Lista transacciones con filtros
- `audit-10-modal-nueva-tx.png` — Modal Nueva transacción
- `audit-12-presupuestos.png` — **Bug: fecha cruda y consumido $0**
- `audit-15-inversiones.png` — Inversiones sin precio (estado inicial)
- `audit-16-inversiones-precios.png` — Inversiones con precios en vivo
- `audit-19-analitica.png` — 4 gráficos + insights
- `audit-23-import.png` — Módulo nuevo #/import
- `audit-24-tema-claro.png` — Tema claro activo
- `audit-25-mobile-dashboard.png` — Responsive 375×812

---

## Priorización de correcciones

| Prioridad | ID | Fix | Esfuerzo |
|-----------|----|-----|----------|
| 🔴 Crítico | BUG-C1 | Cold start auth — retry automático en pullAll | M |
| 🔴 Crítico | BUG-C2 | Fecha presupuestos — formatDate() | S (1 línea) |
| 🟠 Alto | BUG-A1 | sameMonth() con slice(0,7) — TD-12 | S (1 línea) |
| 🟠 Alto | BUG-A2 | Label mes KPI Ingresos | S |
| 🟠 Alto | BUG-A3 | Quitar botón Buscar muerto — TD-31 | S (1 línea) |
| 🟠 Alto | BUG-A4 | Deudas: KPI tarjetas consolidar | M |
| 🟡 Medio | BUG-M1 | Inversiones: auto-load precios | S |
| 🟡 Medio | BUG-M2 | Purgar snapshots de test en Sheets | Manual |
| 🟡 Medio | BUG-M3 | Verificar FX rate | S |
| 🟡 Medio | BUG-M4 | Dashboard evolución: usar snapshots reales | S |
| 🟢 Bajo | BUG-B1 | Versión config.js → 0.2.6 | S (1 línea) |
| 🟢 Bajo | BUG-B3 | Documentar módulo #/import | S |
