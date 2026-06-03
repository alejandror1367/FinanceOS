# Bugs Críticos — FinanceOS

**Fecha:** 2026-06-03 · **HEAD:** `c778e25` · Solo **P0/P1** con reproducción y fix. Derivado de `Audit-Global-2026-06-03.md`.

> 5 P0 + 12 P1. Tema dominante: la matemática de Sprint 5 no se propagó al backend y la multi-moneda (TD-02) sigue silenciosa.

---

## 🔴 P0 — Crítica (integridad de cifras / datos)

### FIN-001 · Backend `computeNetWorth_` desincronizado de Sprint 5 — TD-41
- **Causa raíz:** `Reports.gs::computeNetWorth_` suma `quantity × currentPrice` de **toda** fila de Investments (incluye lotes con `soldDate`), sin sumar comisión al cost ni convertir divisa. El FE sí filtra vendidos, suma comisión y (intenta) convertir.
- **Repro:** 1 lote 10 u × $100k, comisión $50k, vendido (`soldDate` set, `currentPrice`=100k). **FE** `investmentsValue`=0 (lote fuera de posiciones activas). **BE** `10×100000`=**1.000.000** sumado a activos. → Dashboard/PDF/snapshot ≠ vista Inversiones.
- **Impacto:** patrimonio backend inflado; toda cifra que pase por `getDashboard`/`getNetWorth` (widgets, PDF patrimonial, NetWorthSnapshots) discrepa de la vista.
- **Fix:** en `computeNetWorth_` filtrar `!i.soldDate && !i.isDeleted`; sumar `commission` al cost; aplicar FX con tasas de `Settings`. A largo plazo, una sola fuente de verdad (F-17).
- **Archivos:** `backend/Reports.gs:24,77`. **Esfuerzo:** M. **Deploy backend:** sí.

### FIN-002 · Retención en fuente decorativa — TD-42
- **Causa raíz:** `withholdingRate` se captura, se muestra como Badge "Ret. X%" y como métrica, pero **ninguna fórmula la descuenta** (ausente en `selectors.js` y en `realizedPnL`).
- **Repro:** ganancia bruta $1.000.000, `withholdingRate`=4%. Esperado P&L neto = **960.000**. Obtenido = **1.000.000**.
- **Impacto:** el usuario cree ver P&L neto de impuestos; decisión de venta sesgada al alza ~4%.
- **Fix:** definir semántica (retención sobre ganancia realizada al vender) y restar `max(0, ganancia) × withholdingRate/100` en `realizedPnL`. Decidir si aplica también a dividendos.
- **Archivos:** `src/views/investments.js:79-86`, `:371`, `:410`. **Esfuerzo:** M.

### FIN-005 · FX silencioso 1:1 en selectores — TD-02
- **Causa raíz:** `priceService.fxRates` arranca `{}` y nunca se puebla (ver BE-003); `investmentsValue/Cost` cae a `acc + native` sin convertir.
- **Repro:** 100 u USD a $10 (US$1.000), base COP, `fxRates={}`. Esperado ≈ **4.000.000 COP**. Obtenido = **1.000** sumado al patrimonio.
- **Impacto:** patrimonio/portafolio subvaluado ×~4000 de forma silenciosa hasta pulsar "Actualizar precios".
- **Fix:** si falta `fx[cur]`, excluir de la suma y exponer flag "valor incompleto"; el selector no debe sumar nativo a base.
- **Archivos:** `src/store/selectors.js:54,68`. **Esfuerzo:** M.

### BE-001 · `idempotentHit_` resucita registros soft-deleted — TD-45
- **Causa raíz:** `repoFindRowIndex_` mira solo la columna `id` (incluye filas `isDeleted=true`) y `repoGet_` lee con `includeDeleted=true`. Un create con id de una entidad borrada devuelve el registro **muerto** y omite `applyTxBalanceDelta_`.
- **Repro:** borrar una tx offline → recrear/reintentar create con el mismo id. El create "acierta" el registro borrado, no aplica el delta de saldo → entidad fantasma + saldo nunca aplicado.
- **Impacto:** corrupción silenciosa de saldo; recuperación requiere `recalculateBalances`.
- **Fix:** en `idempotentHit_`, si `hit.isDeleted===true` tratar como NO-hit (continuar al create real) o reactivar explícitamente. Documentar la elección.
- **Archivos:** `backend/Utils.gs:177-181`, `Transactions.gs:45`. **Esfuerzo:** S. **Deploy backend:** sí.

### BE-002 · Doble conteo de saldo en `update` de tx offline — TD-46 (TD-01)
- **Causa raíz:** `dataService.update` hace `_adjustAccountBalances(current,-1)` + `(record,+1)` localmente y encola `updateTransaction`, que el backend **vuelve** a hacer. El `op.data` encolado es solo el patch (sin `amount` viejo), así que el optimismo local no es idempotente ante reintentos/multi-edición.
- **Repro:** editar la misma tx offline 2 veces antes del flush → el delta local se acumula hasta el siguiente pull completo.
- **Impacto:** saldo local divergente entre ediciones y pull.
- **Fix:** recalcular el saldo afectado desde las tx locales tras cada mutación, o no ajustar localmente en `update`; como mínimo forzar `pullData()` tras flush de updates de tx.
- **Archivos:** `src/services/dataService.js:233-248`, `Transactions.gs:65-94`. **Esfuerzo:** M.

---

## 🟠 P1 — Alta

### FIN-003 · Ventas parciales imposibles + comisión mal prorrateada — TD-43
- **Repro:** lote 10 u; vender 4 u, comisión total $20k. Obtenido: `soldQuantity`=10 (liquida el lote entero) y `qty/qtyTotal`=1 (toda la comisión al lote). La venta parcial no existe.
- **Fix:** pedir cantidad a vender en el modal; `soldQuantity = min(qtySolic, qtyLote)`; prorratear comisión por la cantidad vendida; ajustar/derivar lote remanente. **Archivos:** `src/views/investments.js:118-124`. **Esf:** M.

### FIN-004 · `realizedPnL` no prorratea comisión de compra — TD-43
- **Repro:** lote 10 u @ $100k, `commission`=$50k. Venta parcial 5 u @ $120k, `soldCommission`=$10k. Esperado = 600k−500k−(50k×5/10)−10k = **65.000**. Obtenido = 600k−500k−**50k**−10k = **40.000**.
- **Fix:** prorratear `commission × (qtyVendida/qtyLote)`. **Archivos:** `src/views/investments.js:79-83`. **Esf:** S.

### FIN-006 · `avgRate` de deudas mezcla divisas — TD-02
- **Repro:** Deuda A 1.000 USD @20%, Deuda B 4.000.000 COP @30% → ponderado ≈ **29.99%** (el saldo USD pesa ~0). **Fix:** convertir a base antes de ponderar. **Archivos:** `src/store/selectors.js:215-216`. **Esf:** S.

### FIN-007 · `amortize()` trata `minPayment` como cuota fija — TD-23 (regresión parcial)
- **Repro:** tarjeta $3.000.000 @30% E.A., minPayment $300k → `amortize` da ~11 meses; con cuota = 5% del saldo decreciente nunca se liquida en ese plazo. Snowball/Avalanche ordenan pero no encadenan la cuota liberada.
- **Fix:** soportar `minPayment` tipo "% del saldo"; simular bola de nieve encadenada. **Archivos:** `src/views/debts.js:26-40,297-302`. **Esf:** M.

### FIN-008 · `cdtCurrentValue` sobrevalora CDT — TD-44
- **Repro:** CDT $10M + comisión $50k, 12.5% E.A., 800 días → `10.050.000 × 1.125^(800/365)` ≈ **13.2M**, creciendo tras vencer y capitalizando la comisión.
- **Fix:** capitalizar sobre capital (excluir comisión); topar `days` a `min(hoy−compra, vencimiento−compra)`. **Archivos:** `src/views/investments.js:130-135`. **Esf:** S.

### FE-001 · Inyección de markup en SVG de charts — TD-48
- **Repro:** categoría llamada `Ocio & Cía` → `<title>`/`aria-label` del Donut con `&` sin escapar rompe el render / corrompe nombre accesible. Vector de markup almacenado.
- **Fix:** escapar `&<>"` antes de interpolar en `charts.js` (helper `esc()`). **Archivos:** `src/components/charts.js:52,70,76,77`. **Esf:** S. *(Coordinar con seguridad: dato de usuario.)*

### FE-002 · `--text-tertiary` falla contraste WCAG 1.4.3 — TD-40
- **Repro:** dark `#6B7686` sobre `#222A35` = **3.14:1** (mín. 4.5:1); light `#8A93A3` sobre blanco = **3.1:1**. Afecta captions, `th`, hints ⌘K, labels de inversión (10–13px).
- **Fix:** subir luminancia del token en dark y light, verificando sobre las 4 superficies. **Archivos:** `src/styles/themes.css:37,91`. **Esf:** S.

### FE-003 · `aria-label` técnico sobrescribe label visible — TD-49 (TD-08)
- **Repro:** input "Monto" anuncia "amount"; control por voz no encuentra el campo por su etiqueta visible (WCAG 2.5.3/4.1.2).
- **Fix:** quitar `'aria-label': name` de `textInput`/`select` cuando `field()` ya asocia `<label for>`. **Archivos:** `src/components/forms.js:20,37`. **Esf:** S.

### BE-003 · FX rates nunca poblados desde el backend — TD-02
- **Repro:** `getQuotes_`/`fetchYahoo_` devuelven `currency` pero ningún par FX. `priceService.fxRates` queda `{}` → raíz de FIN-005.
- **Fix:** acción `getFxRates` o incluir `USDCOP=X`/`EURCOP=X` como tickers Yahoo en `getQuotes`; poblar `fxRates` en el refresh de Inversiones. **Archivos:** `backend/Quotes.gs:11-54`, `priceService.js:11,33`. **Esf:** M. **Deploy:** sí.

### BE-004 · `reconcileAndHydrate` reduce update a su patch — TD-47 (TD-13)
- **Repro:** registro con `update` pendiente → tras `refresh()`, `db.put(store, op.data)` lo reemplaza por el patch parcial (pierde campos) hasta el siguiente flush.
- **Fix:** para ops `update`, mezclar `{...existing, ...op.data}`. **Archivos:** `src/services/dataService.js:78-85`. **Esf:** S.

### BE-005 · O(n) por escritura en hot paths — TD-05/TD-24
- **Causa:** `createTransaction_` dispara `idempotentHit_` + `repoGet_('Categories')` + `repoGet_('Accounts')` + `logAudit_`, cada `repoGet_` relee toda la hoja (3-4 escaneos O(n)/create).
- **Fix:** lectura puntual `repoFindRowIndex_`+`getRange` en `adjustBalance_` y validación de categoría; cachear `repoReadAll_` por ejecución. **Archivos:** `backend/Transactions.gs:40-63`, `Accounts.gs:70-75`. **Esf:** M. **Deploy:** sí.

### BE-006 · `listTransactions_` sin paginación — TD-25
- **Causa:** `getBootstrap` llama `listTransactions_(p)` sin límite → carga el histórico completo en cada arranque. Con >5000 tx el payload y el parse crecen sin techo.
- **Fix:** paginar por cursor (date/id); bootstrap trae solo N recientes + resto bajo demanda o ventana 12-24 meses. **Archivos:** `backend/Transactions.gs:10-16`, `Reports.gs:144`. **Esf:** L. **Deploy:** sí.
