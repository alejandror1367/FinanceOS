# Bugs Críticos y Altos — FinanceOS
**Fecha de auditoría:** 2026-06-02  
**Auditor:** Claude Sonnet 4.6 (equipo completo de auditoría)  
**Validado con:** Playwright MCP (producción) + lectura exhaustiva del código fuente  
**Tests al cierre:** 45/45 ✅

---

## Resumen ejecutivo

| Severidad | Cantidad | Módulos afectados |
|---|---|---|
| **P0 — Crítico** | 2 | Import, Backend |
| **P1 — Alto** | 5 | Import, Analytics, Settings, Config |
| **P2 — Medio** | 4 | Networth, Analytics, Today, Inversiones |

---

## P0 — CRÍTICOS (corrección inmediata)

---

### BUG-P0-1: `dataService.mutate()` no existe — import completamente roto

**Descripción:**  
`src/views/import.js` llama a `dataService.mutate('transactions', 'create', data)` en la función `doImport()` (línea 428). El método `mutate()` no existe en `dataService.js`. La API correcta es `dataService.create(coll, data)`.

**Causa raíz:**  
La vista `import.js` fue escrita con una API hipotética `mutate(entity, action, data)` que nunca se implementó. El servicio real expone `create/update/remove` directamente.

**Impacto:**  
La funcionalidad de importación de extractos bancarios **falla completamente** en el momento de crear transacciones. El usuario puede subir el archivo, ver la vista previa, hacer click en "Importar" y... nada sucede (TypeError silencioso). Todos los 7 bancos soportados (Bancolombia, NuBank, Nequi, Global66, RappiPay, XTB, AQR Invest) quedan sin funcionar.

**Riesgo:** Pérdida de datos percibida por el usuario. Módulo estratégico completamente inoperativo.  
**Prioridad:** P0  
**Archivos afectados:** `src/views/import.js` (línea 428)  
**Complejidad:** S (< 0.5 día)  
**Solución propuesta:**
```js
// Reemplazar:
await dataService.mutate('transactions', 'create', { ... });

// Con:
await dataService.create('transactions', { ... });
```

---

### BUG-P0-2: Backend `computeNetWorth_()` no incluye tarjetas de crédito como pasivos

**Descripción:**  
`backend/Reports.gs` — `computeNetWorth_()` calcula `totalLiabilities` sumando solo la hoja `Liabilities`:
```js
var totalLiabilities = sum_(ctx.liabilities, function (l) { return l.balance; });
```
El frontend `selectors.totalLiabilities()` suma correctamente `Liabilities + creditCardAccounts`. Esta divergencia hace que el backend reporte un patrimonio neto **más alto** que el frontend cuando el usuario tiene deudas de tarjeta de crédito registradas como cuentas.

**Impacto medido en producción:**  
- Frontend: Patrimonio = $1.389.926 (correcto: activos $4.799.122 − pasivos $3.409.196)  
- Backend getDashboard: Patrimonio reportado = ~$4.799.122 (no incluye los $3.409.196 de la Amex)  
- **Diferencia: $3.409.196** — exactamente el saldo de la tarjeta de crédito

**Riesgo:** El usuario que use el endpoint `getDashboard` o `getNetWorth` ve una cifra de patrimonio inflada. Los snapshots guardados vía `saveNetWorthSnapshot` capturan el valor del backend → historial de patrimonio incorrecto para siempre.

**Prioridad:** P0  
**Archivos afectados:** `backend/Reports.gs` (función `computeNetWorth_` y `getDashboard_`)  
**Complejidad:** S  
**Solución propuesta:**
```js
// En computeNetWorth_():
var ccDebt = ctx.accounts.filter(function(a) {
  return a.type === 'credit_card' && !a.isArchived;
}).reduce(function(sum, a) { return sum + Math.abs(a.balance || 0); }, 0);
var totalLiabilities = sum_(ctx.liabilities, function (l) { return l.balance; }) + ccDebt;
```
Mismo fix aplicar en `getDashboard_()` donde usa `computeNetWorth_`.

---

## P1 — ALTOS

---

### BUG-P1-1: `Button` API incorrecta en todo `import.js`

**Descripción:**  
`import.js` llama a `Button({label, variant, onClick})` con un objeto como primer argumento. La firma real es `Button(label, {variant, onClick})`.  
Botones afectados: "Copiar prompt", "Cancelar", "Importar otro", "Ver transacciones", "← Volver".

**Impacto:**  
- Todos muestran `[object Object]` como texto  
- Ninguno tiene click handler funcional  
- "Cancelar" no cancela → usuario atrapado en la vista de previa  
- "Copiar prompt" no copia el prompt de Claude

**Prioridad:** P1  
**Archivos afectados:** `src/views/import.js`  
**Complejidad:** S  
**Solución:** Cambiar todas las llamadas a la API correcta:
```js
// Incorrecto:
Button({ label: 'Copiar prompt', variant: 'outline', onClick: fn })
// Correcto:
Button('Copiar prompt', { variant: 'outline', onClick: fn })
```

---

### BUG-P1-2: Iconos SVG renderizados como texto en `import.js`

**Descripción:**  
En `import.js`, `icon()` retorna un string SVG. Cuando se pasa como hijo al helper `el()`, este llama a `document.createTextNode(String(child))` (dom.js línea 19), produciendo texto plano visible en lugar del ícono.

**Afecta:**  
- Zona de arrastre (drop zone): muestra todo el markup SVG de `icon('importFile')`  
- Pantalla de análisis (`buildAnalyzing`): mismo problema  
- **Validado en producción** con Playwright — la drop zone muestra ~200 chars de SVG markup

**Prioridad:** P1  
**Archivos afectados:** `src/views/import.js` (líneas 117, 240)  
**Complejidad:** S  
**Solución:**
```js
// Incorrecto:
el('div', { class: 'drop-zone__icon' }, [icon('importFile')])
// Correcto:
el('div', { class: 'drop-zone__icon', html: icon('importFile') })
```

---

### BUG-P1-3: `appendChild(icon())` TypeError en vista previa de import

**Descripción:**  
En `import.js` `buildPreview()` líneas 278–289:
```js
warn.appendChild(icon('bell'));
warn.appendChild(icon('investments'));
```
`icon()` retorna string; `appendChild` requiere Node → `TypeError: Failed to execute 'appendChild' on 'Element'`.  
Se dispara cuando: (a) hay duplicados detectados o (b) el archivo es de broker (XTB/AQR).

**Impacto:** La vista de previa crashea con error silencioso; el usuario no puede revisar ni importar transacciones con duplicados.

**Prioridad:** P1  
**Archivos afectados:** `src/views/import.js`  
**Complejidad:** S  
**Solución:** Crear elemento contenedor y usar `html`:
```js
const iconEl = el('span', { html: icon('bell') });
warn.appendChild(iconEl);
```

---

### BUG-P1-4: `analytics.js` usa `periodKey ===` sin `normPeriodKey()` — regresión de TD-12

**Descripción:**  
`src/views/analytics.js` línea 54:
```js
const monthlyBudgets = (s.budgets || []).filter(
  (b) => b.period === 'monthly' && b.periodKey === curMonthKey
);
```
Cuando Google Sheets auto-convierte el `periodKey` de `'2026-06'` a un objeto `Date` (bug conocido documentado en TD-12), esta comparación devuelve `false` para todos los presupuestos. El insight de presupuesto en Analítica siempre muestra 0 presupuestos aunque existan.

La fix de TD-12 (`normPeriodKey`) fue aplicada en `selectors.js` pero **no en `analytics.js`**.

**Impacto:** El insight "Has consumido X% de tus presupuestos" nunca se muestra aunque el usuario tenga presupuestos activos.

**Prioridad:** P1  
**Archivos afectados:** `src/views/analytics.js` (línea 54)  
**Complejidad:** S  
**Solución:**
```js
import { normPeriodKey } from '../store/selectors.js'; // o reimplementar inline
const monthlyBudgets = (s.budgets || []).filter(
  (b) => b.period === 'monthly' && normPeriodKey(b.periodKey, 7) === curMonthKey
);
```
Nota: `normPeriodKey` no es exportada actualmente de `selectors.js`. Extraerla a `utils/format.js` o duplicar la función.

---

### BUG-P1-5: `config.version` desincronizado del SW — BUG-B1 activo

**Descripción:**  
`src/core/config.js` tiene `version: '0.2.23'`. El Service Worker actual es `v0.2.28`. En Ajustes → Acerca de se muestra "Versión 0.2.23", información incorrecta.

**Validado en producción** con Playwright (screenshot de Settings).

**Impacto:** Información de versión incorrecta en la UI. El pre-commit hook actualiza el SW pero no `config.version`.

**Prioridad:** P1  
**Archivos afectados:** `src/core/config.js`, `.githooks/pre-commit`  
**Complejidad:** S  
**Solución:** El hook pre-commit debe actualizar también `config.version`. O leer la versión directamente del SW en tiempo de ejecución.

---

## P2 — MEDIOS

---

### BUG-P2-1: Snapshots de patrimonio con datos de prueba distorsionan gráficos

**Descripción:**  
Existen en la DB snapshots con valores de prueba (44.3M y 29.7M COP) que no corresponden al patrimonio real ($1.389.926). El gráfico "Evolución del patrimonio" en Dashboard y Patrimonio muestra estos valores ficticios junto a los reales, distorsionando completamente la curva histórica.

**Validado en producción** (screenshot de Analytics: eje Y del gráfico patrimonio muestra 44.3M → 29.7M).

**Impacto:** Historia patrimonial incorrecta. El usuario no puede confiar en el gráfico de evolución.  
**Prioridad:** P2  
**Solución:** Eliminar los snapshots de prueba desde la UI de Patrimonio, o implementar la gestión de snapshots (ver Fase 5 del audit). Mientras tanto, el usuario puede eliminarlos manualmente desde Google Sheets.

---

### BUG-P2-2: `getQuotes` falla en primer intento (ERR_ABORTED)

**Descripción:**  
Observado en red con Playwright: `getQuotes?tickers=MU,USDCOP=X,EURCOP=X` retorna `net::ERR_ABORTED` en el primer intento, luego en el segundo intento (retry) retorna 302 y funciona.

**Causa probable:** El cold start de Apps Script cancela la primera conexión antes de responder. El 302 posterior es el redirect normal de Apps Script.

**Impacto:** Al entrar a Inversiones, los precios pueden no cargarse en el primer intento. El auto-refresh (`if (priceService.isStale) refreshPrices()`) reintenta, pero hay una ventana donde el usuario ve "sin precio".

**Prioridad:** P2  
**Solución:** Agregar retry automático en `apiClient.get()` para respuestas abortadas, similar a cómo `pullAll` hace warm-up secuencial.

---

### BUG-P2-3: `analytics.js` — `curMonthKey` calculado en load time

**Descripción:**  
`const now = new Date()` y `const curMonthKey = ...` se calculan cuando el módulo ES se importa (una sola vez). Si la app está abierta en el cambio de mes (ej. 31→1), la analítica mostrará datos del mes anterior.

**Prioridad:** P2  
**Solución:** Mover el cálculo de `curMonthKey` dentro de `buildInsights()` y de cada función que lo use.

---

### BUG-P2-4: Vista Hoy no muestra pagos urgentes de tarjeta de crédito

**Descripción:**  
La sección "Próximos pagos" en `#/today` usa `selectors.upcomingPayments()` que solo lee `s.recurring`. Los vencimientos de tarjetas de crédito (configurados en `account.paymentDay`) no se incluyen.

**Validado en producción:** La Amex vence el 3 de junio (mañana) pero "Próximos pagos" muestra "Nada próximo".

**Impacto:** El usuario puede perder el vencimiento de su tarjeta aunque la app lo sabe (el módulo Deudas sí lo muestra con badge urgente).

**Prioridad:** P2  
**Solución:** Extender `selectors.upcomingPayments()` para incluir vencimientos de CC, o crear un selector separado `upcomingCCPayments()`.

---

## Verificación de bugs documentados previamente (Fase 13)

| ID | Descripción | Estado |
|---|---|---|
| BUG-C1 | Cold start auth loop | ✅ **RESUELTO** — warm-up + retry en dataService.js |
| BUG-C2 | (TD-12) Timezone bucketing | ✅ **RESUELTO** en selectors.js |
| BUG-A1 | (TD-12) periodKey como Date | ⚠️ **PARCIALMENTE** — resuelto en selectors.js pero regresión en analytics.js |
| BUG-A3 | (TD-31) Botón buscar muerto | ✅ **RESUELTO** — botón no existe en código |
| BUG-A4 | (Fix fe961a8) | ✅ **RESUELTO** |
| TD-10 | Head-of-line blocking | ✅ **RESUELTO** — dead-letter implementado |
| TD-11 | Sync state siempre idle | ✅ **RESUELTO** |
| TD-12 | Timezone bucketing | ✅ **RESUELTO** en selectors (ver BUG-A1 para analytics) |
| TD-13 | flush antes de pull | ✅ **RESUELTO** |
| TD-15 | 12 requests en carga | ✅ **RESUELTO** — getBootstrap verificado en producción (1 request) |
| TD-16 | openById sin cachear | ✅ **RESUELTO** |
| TD-17 | Foco de input tenue | ✅ **RESUELTO** |
| TD-18 | Touch targets densos | ✅ **RESUELTO** (Sprint 10a) |

---

*Generado por auditoría global 2026-06-02 · Validado con Playwright MCP en producción*
