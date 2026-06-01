# Auditoría Financiera — FinanceOS

**Rol:** Senior Fintech Architect
**Fecha:** 2026-05-31
**Foco:** cálculos financieros · patrimonio neto · presupuestos · inversiones · sincronización
**Buscando:** errores matemáticos · inconsistencias · edge cases · problemas de precisión
**Método:** revisión del ledger (`backend/Transactions.gs`), selectores derivados (`src/store/selectors.js`), cómputo de patrimonio (`backend/Reports.gs`, `backend/NetWorth.gs`), presupuestos, inversiones, deudas, metas, formato monetario (`src/utils/format.js`) y motor de sincronización (`src/services/syncEngine.js`, `dataService.js`).

> Documento de solo lectura. No modifica código. Complementa `docs/Audit.md` (auditoría de arquitectura) con foco contable. Reglas y contexto: `CLAUDE.md`.

---

## Veredicto

La lógica derivada (presupuestos, rentabilidad, metas) es **correcta en sus fórmulas puntuales**, pero hay **tres fallas estructurales de modelo contable** que comprometen la integridad de las cifras maestras (patrimonio y saldos), más problemas de **precisión float** y **ventanas de inconsistencia en sincronización**. Para un sistema cuyo principio nº2 es *integridad de datos*, F-1 a F-3 son bloqueantes conceptuales.

---

## 🔴 CRÍTICO

### F-1 · El ledger de transacciones está desconectado de los saldos (no hay partida doble)

`createTransaction_` (`backend/Transactions.gs:40`) y `dataService.create` solo **insertan una fila**; **nunca modifican `account.balance`**. El saldo de cuenta es un valor **declarado estático**. Pero `computeNetWorth_` / `selectors.totalAssets` calculan activos a partir de `account.balance`.

**Consecuencia:** registrar un gasto de $500.000 **no baja ningún saldo ni el patrimonio neto**. Los KPIs "gastos/ahorro del mes" (derivados del ledger) y "liquidez/patrimonio" (derivados de saldos declarados) **viven en universos paralelos que nunca se reconcilian**. Una *transferencia* tampoco mueve dinero entre las dos cuentas. Rompe la identidad contable básica y contradice el modelo de Copilot/Monarch (donde la transacción ajusta el saldo).

**Decisión requerida:** o (a) saldos derivados del ledger (`balance = saldoInicial + Σtransacciones`), o (b) declarar explícitamente que los saldos son manuales y desacoplados — pero entonces el "ahorro del mes" no debería presentarse junto al patrimonio como si fueran coherentes.

### F-2 · Doble conteo de cuentas de inversión en el patrimonio

`selectors.totalAssets` (`src/store/selectors.js:44`) = `Σ accounts.balance` (**incluye `type==='investment'`**) `+ Σ investmentsValue` (`quantity×currentPrice`) `+ otherAssets`. Si una cuenta de inversión tiene `balance` y además se registran sus posiciones, **el valor se cuenta dos veces**. No hay guard ni definición de si el `balance` de una cuenta *investment* es solo el efectivo o el total de la cartera.

**Agravante — inconsistencia interna:** `totalLiquidity` (`selectors.js:26`) **sí** excluye `type==='investment'`, pero `totalAssets` **no**. El mismo tipo de cuenta se trata distinto en dos cálculos maestros → patrimonio potencialmente inflado, sin error visible. El backend (`Reports.gs:65`) replica el mismo criterio divergente.

### F-3 · Multi-moneda: sumas mezclando divisas sin conversión

`totalAssets`, `totalLiabilities`, `investmentsValue`, `monthlyIncome/Expense`, `budgetConsumed`, `avgRate` suman `amount`/`balance`/`price` **ignorando `currency`**. Una posición en USD a 500 se suma como 500 COP. Hoy es latente (todo en COP), pero el esquema **ya permite `currency` por registro**: en cuanto exista un segundo activo en otra divisa, el patrimonio neto será incorrecto silenciosamente. (Coincide con C-2 de `docs/Audit.md`; aquí confirmado en cada fórmula afectada.)

---

## 🟠 IMPORTANTE

### F-4 · Dos métodos de *bucketing* de meses → discrepancia en bordes de mes (timezone)

`selectors.sameMonth(iso)` (`selectors.js:4`) hace `new Date(iso).getMonth()` en hora **local**, pero JS parsea fechas ISO *date-only* como **UTC medianoche**. En Colombia (UTC−5), `new Date('2026-05-01')` = **30-abr 19:00 local** → `getMonth()` = abril. **Las transacciones del día 1 caen en el mes anterior.**

En cambio `budgetConsumed`, `cashflow`, `categorySpend` usan `String(t.date).slice(0,7)` (string, *timezone-safe*). Resultado: `monthlyExpense` (usa `sameMonth`) y `budgetConsumed` (usa slice) **pueden discrepar para el mismo mes**, y el **frontend discrepa del backend** (`Reports.monthKey_` usa slice seguro). Dos fuentes de verdad para "qué mes es esta transacción".

**Fix sugerido:** reescribir `sameMonth` con comparación de string `YYYY-MM` (1 línea; elimina el drift FE/BE).

### F-5 · Precisión: aritmética float para dinero sin redondeo controlado

Todo es `number` (float64). Para COP entero el rango es seguro, pero:
- `quantity × currentPrice` / `quantity × avgCost` con **cripto fraccionaria** (ej. `0.1+0.2 ≈ 0.30000000000000004`) acumula error real;
- sumas largas de transacciones acumulan epsilon;
- comparaciones de umbral sin redondeo previo: `st.pct >= 100` marca "excedido" y `next >= targetAmount` marca meta "completada" sobre floats.

No hay capa de *enteros-en-centavos* ni redondeo *half-even*. Deuda de precisión propia de fintech.

### F-6 · `formatMoney` fuerza `maximumFractionDigits: 0` para TODAS las divisas

`src/utils/format.js:12`. Correcto para COP (sin centavos), pero **oculta centavos universalmente**: USD 1234.56 → "$1.235", cripto 12.34 → "12". Además los **redondeos por línea no suman al total redondeado** (*penny rounding mismatch*): una lista de posiciones puede mostrar líneas que no cuadran con el total. Para divisas con decimales es pérdida de precisión de presentación.

### F-7 · Snowball/Avalanche: solo ordenan, sin matemática de amortización

`src/views/debts.js:orderBy` reordena por saldo/tasa, pero **no calcula meses-a-liquidar, intereses totales ni el efecto "bola de nieve"** (redirigir la cuota liberada a la siguiente deuda). La "tasa promedio" (`debts.js:85`) es una ponderación por saldo correcta, pero mezcla divisas (F-3) y no distingue nominal vs efectiva anual. Las estrategias son informativas, no accionables.

### F-8 · Sync: ventana de reaparición/pérdida por `pullAll` (clear + replace)

`dataService.pullAll` hace `db.clear()` + `bulkPut(backend)` por colección. Con operaciones optimistas en cola sin sincronizar:
- un **create pendiente desaparece** de la UI tras un `refresh()` manual (que llama `pullAll` **sin `flush` previo**) hasta vaciar la cola;
- un **delete pendiente reaparece** porque el backend aún devuelve el registro (el soft-delete se aplica al sincronizar, no antes).

En `init()` se mitiga (flush→pull), pero `refresh()` (botón "Actualizar") no. Ventana de inconsistencia visible sobre datos financieros.

### F-9 · No-atomicidad entre escritura local y encolado

En `create/update/remove`, `db.put(store)` y `syncQueue.enqueue()` son **operaciones IndexedDB separadas** (sin transacción conjunta). Si el proceso muere entre ambas, el dato queda local **sin** operación de sync → divergencia silenciosa permanente con el backend. Para un ledger, es pérdida de durabilidad.

### F-10 · Operación atascada bloquea el ledger (head-of-line + integridad)

Tras `MAX_ATTEMPTS`, una op con error de negocio (ej. `categoryId` borrado en backend) queda **para siempre** en cola y bloquea las siguientes (`break` en `syncEngine.js:80`). Esa transacción **nunca llega al servidor** pero sí se muestra local → cliente y servidor divergen indefinidamente sin alerta accionable. (Relacionado con I-2 de `docs/Audit.md`.)

---

## 🟢 MEJORA FUTURA

- **F-11 ·** `goals.monthsUntil`: una meta con `targetDate` vencida y sin completar da `months=0`/`recommended=null` ("define fecha"); no avisa "vencida". Edge UX.
- **F-12 ·** Aporte a meta (`openContributeModal`) suma a `currentAmount` pero **no genera transacción ni toca `linkedAccountId`**: el ahorro de metas no se refleja en cuentas (coherente con F-1, refuerza el desacople).
- **F-13 ·** Proyección de presupuesto lineal (`consumed/day × daysInMonth`) **sobre-proyecta** en días 1–3; sin suavizado; solo mensual.
- **F-14 ·** Presupuestos no validan **solapamiento** (dos para misma categoría+periodo) ni divisa del presupuesto vs divisa de las transacciones consumidas.
- **F-15 ·** Rentabilidad de inversiones es **retorno simple sobre costo**, sin anualización (TWR/IRR) ni efecto del tiempo.
- **F-16 ·** Recurrentes: no hay **ejecución automática** (generar la transacción al vencer y avanzar `nextRunDate`); son recordatorios (ya anotado en `SessionState.md`).
- **F-17 ·** Doble implementación de la misma matemática (frontend `selectors.js` vs backend `Reports.gs`): cómoda para render offline, pero **propensa a drift** — F-4 ya demuestra una divergencia real entre ambas.

---

## Tabla resumen

| ID | Área | Tipo | Severidad |
|----|------|------|-----------|
| F-1 | Ledger ↔ saldos (sin partida doble) | Inconsistencia estructural | 🔴 |
| F-2 | Doble conteo cuentas de inversión | Error de modelo | 🔴 |
| F-3 | Multi-moneda sin conversión | Error matemático latente | 🔴 |
| F-4 | Bucketing de meses (timezone) | Inconsistencia / edge case | 🟠 |
| F-5 | Float para dinero | Precisión | 🟠 |
| F-6 | `formatMoney` 0 decimales global | Precisión presentación | 🟠 |
| F-7 | Snowball/Avalanche sin amortización | Cálculo incompleto | 🟠 |
| F-8 | `pullAll` clear+replace vs cola | Inconsistencia sync | 🟠 |
| F-9 | No-atomicidad local/cola | Durabilidad | 🟠 |
| F-10 | Op atascada bloquea ledger | Integridad sync | 🟠 |
| F-11–F-17 | Metas / Presup. / Inv. / Recurrentes | Varios | 🟢 |

---

## Recomendación de orden (por impacto en integridad)

1. **F-1** decidir modelo de saldos (derivado vs declarado) — define todo lo demás.
2. **F-2** excluir cuentas *investment* de `totalAssets` o documentar `balance` = solo cash.
3. **F-4** unificar bucketing a `slice(0,7)` en `sameMonth` (1 línea, elimina drift FE/BE).
4. **F-3** capa FX o bloqueo de divisa única.
5. **F-8 / F-9 / F-10** `flush` antes de `pullAll` en `refresh()`, transacción IndexedDB conjunta y *dead-letter* para la cola.
6. **F-5 / F-6** política de redondeo + decimales por divisa.

---

## Documentos relacionados

- `docs/Audit.md` — auditoría de arquitectura (estructura, acoplamiento, deuda técnica).
- `docs/Database.md` — esquema y reglas de integridad.
- `docs/Architecture.md` — modelo de sincronización offline-first.
- `CLAUDE.md` — fuente de verdad del proyecto.
