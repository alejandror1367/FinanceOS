# Quick Wins — FinanceOS
**Fecha:** 2026-06-02  
**Criterio:** Cambios de alto impacto con esfuerzo ≤ 0.5 día (tamaño S)

---

## Tier 1 — Impacto crítico, cambio trivial (hacer HOY)

### QW-01: Corregir `dataService.mutate()` → `dataService.create()` en import.js
**Impacto:** Desbloquea la importación completa de extractos bancarios  
**Archivo:** `src/views/import.js` línea 428  
**Cambio:** `await dataService.mutate('transactions', 'create', {...})` → `await dataService.create('transactions', {...})`  
**Esfuerzo:** 5 minutos

---

### QW-02: Corregir API de `Button()` en import.js (5 llamadas)
**Impacto:** Desbloquea "Cancelar", "Copiar prompt", "Importar otro", "Ver transacciones", "← Volver"  
**Archivo:** `src/views/import.js`  
**Cambio:** `Button({label, variant, onClick})` → `Button(label, {variant, onClick})` en 5 instancias  
**Esfuerzo:** 10 minutos

---

### QW-03: Corregir íconos SVG en drop zone e import analyzing
**Impacto:** Elimina el SVG raw visible en la pantalla de importación  
**Archivo:** `src/views/import.js` líneas 117, 240  
**Cambio:** `[icon('importFile')]` (children) → `html: icon('importFile')` (atributo)  
**Esfuerzo:** 5 minutos

---

### QW-04: Corregir `appendChild(icon())` → elemento contenedor en buildPreview
**Impacto:** Previene TypeError cuando hay duplicados o archivos de broker  
**Archivo:** `src/views/import.js` líneas 278, 289  
**Cambio:** `warn.appendChild(icon('bell'))` → `warn.appendChild(el('span', { html: icon('bell') }))`  
**Esfuerzo:** 5 minutos

---

### QW-05: Añadir tarjetas de crédito a `computeNetWorth_()` en backend
**Impacto:** Elimina divergencia de $3.4M entre frontend y backend en patrimonio neto  
**Archivo:** `backend/Reports.gs`  
**Cambio:** Sumar `Math.abs(account.balance)` de cuentas `credit_card` en `totalLiabilities`  
**Esfuerzo:** 15 minutos + deploy

---

### QW-06: Sincronizar `config.version` con SW version
**Impacto:** "Versión 0.2.23" → "Versión 0.2.28" en Ajustes  
**Archivo:** `src/core/config.js` + `.githooks/pre-commit`  
**Cambio:** Actualizar version a '0.2.28'; ajustar hook para que también bumpee config.js  
**Esfuerzo:** 10 minutos

---

## Tier 2 — Impacto alto, 1–2 horas

### QW-07: Aplicar `normPeriodKey()` en analytics.js para el filtro de presupuestos
**Impacto:** El insight de presupuestos en Analítica funciona correctamente con datos de Sheets  
**Archivo:** `src/views/analytics.js` línea 54  
**Cambio:** `b.periodKey === curMonthKey` → `normPeriodKey(b.periodKey, 7) === curMonthKey`  
**Nota:** Requiere exportar `normPeriodKey` desde selectors.js o moverla a utils  
**Esfuerzo:** 30 minutos

---

### QW-08: Mover `curMonthKey` de module-level a función en analytics.js
**Impacto:** Analítica respeta cambio de mes sin recargar la app  
**Archivo:** `src/views/analytics.js` líneas 13–14  
**Cambio:** Mover `const now = new Date()` y `const curMonthKey` dentro de las funciones que los usan  
**Esfuerzo:** 15 minutos

---

### QW-09: Eliminar snapshots de patrimonio con datos de prueba
**Impacto:** Gráfico de evolución patrimonial muestra datos reales, no valores de $44M y $29M ficticios  
**Acción:** Implementar UI de eliminación de snapshot individual en `views/networth.js` + acción backend  
**Esfuerzo:** 2 horas (incluye backend + deploy)

---

### QW-10: Añadir pagos urgentes de CC a `selectors.upcomingPayments()`
**Impacto:** La vista "Hoy" alerta sobre vencimientos de tarjeta inminentes  
**Archivo:** `src/store/selectors.js`  
**Cambio:** Extender selector para incluir CCs con `paymentDay` configurado  
**Esfuerzo:** 1 hora + tests

---

## Tier 3 — Mejoras de calidad, < 30 min c/u

| ID | Descripción | Archivo | Impacto |
|---|---|---|---|
| QW-11 | Retry automático en `apiClient.get()` para ERR_ABORTED | `src/services/apiClient.js` | getQuotes falla en primer intento |
| QW-12 | Truncamiento "T..." en Apariencia de Ajustes | `src/views/settings.js` | Label del tema se corta en viewport chico |
| QW-13 | Añadir `exportar `normPeriodKey` desde selectors.js | `src/store/selectors.js` | Habilita reutilización en otros módulos |

---

## Orden recomendado de ejecución

```
Sesión 1 (< 1h): QW-01 + QW-02 + QW-03 + QW-04 → import completamente funcional
Sesión 1 cont.:  QW-05 (backend) + QW-06 (config) → patrimonio correcto + versión
Sesión 2 (2h):   QW-07 + QW-08 + QW-09 + QW-10 → analítica e insights confiables
Sesión 3:        QW-11 + QW-12 + QW-13 → pulido
```

**Impacto total estimado de QW-01 al QW-06:** Desbloquea el módulo de importación completo + corrige el patrimonio neto + sincroniza versión. **~45 minutos de desarrollo**.

---

*Generado por auditoría global 2026-06-02*
