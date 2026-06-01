# Auditoría de Arquitectura — FinanceOS

**Rol:** Staff Engineer / Arquitecto Principal
**Fecha:** 2026-05-31
**Alcance:** ~5.4k LOC (41 módulos JS + 16 archivos `.gs` de Apps Script)
**Método:** lectura de las capas núcleo (core / store / services), muestreo de vistas y componentes, backend Apps Script, y revisión de accesibilidad con el marco WCAG 2.2 AA.

> Documento de solo lectura. No modifica código. Para el contexto y las reglas, ver `CLAUDE.md`; para el estado, `docs/SessionState.md`.

---

## Veredicto ejecutivo

Arquitectura **sólida y madura** para las restricciones autoimpuestas (vanilla, sin build, Google Sheets + Apps Script). La separación de capas de `Architecture.md` **se respeta de verdad**: las vistas no tocan red ni IndexedDB, los selectores son puros, el backend tiene un repositorio genérico ejemplar. La deuda técnica es **acotada y mayormente táctica**, salvo tres puntos estructurales (multi-moneda, ausencia de tests, token público).

| Dimensión | Nota | Comentario |
|---|---|---|
| Estructura de carpetas | 🟢 9/10 | Coincide exactamente con la arquitectura documentada. |
| Separación de responsabilidades | 🟢 9/10 | UI / lógica / persistencia / sync bien aisladas. |
| Cohesión | 🟢 8/10 | Módulos enfocados; selectores muy cohesivos. |
| Acoplamiento | 🟡 6/10 | `store` y `dataService` son singletons globales importados en todas las vistas. |
| Modularidad | 🟢 8/10 | `ENTITIES` y repo genérico como fuentes únicas. |
| Mantenibilidad | 🟡 6/10 | Penalizada por duplicación del patrón CRUD y ausencia de tests. |
| Deuda técnica | 🟡 6/10 | Concentrada en sync, multi-moneda y tests. |
| Duplicación | 🟡 5/10 | ~11 vistas repiten el mismo andamiaje CRUD. |

---

## Fortalezas (lo que NO hay que tocar)

- **Repositorio genérico en `Utils.gs`** (`repoCreate_/Update_/SoftDelete_` guiados por `SCHEMAS`): cada entidad del backend son ~40 líneas declarativas. DRY ejemplar.
- **`ENTITIES` como contrato único** frontend ↔ backend ↔ IndexedDB.
- **Selectores puros** (`store/selectors.js`): valores derivados nunca persistidos, exactamente como manda `Database.md §5`.
- **Sync engine** con reconciliación por id canónico y reintentos con backoff bien encapsulado.
- **Base de accesibilidad real**: `lang=es`, skip-link, `:focus-visible`, `@media (prefers-reduced-motion)`, focus-trap en modal con restauración de foco, toasts en `aria-live=polite`.

---

## 🔴 CRÍTICO

### C-1 · Token de API en repositorio público (datos financieros expuestos)

`config.js` publica `baseUrl` + `token` y el backend (`assertAuthorized_`) usa **ese único token compartido** como toda la autorización. Cualquiera que lea el repo o el JS servido puede ejecutar **lectura y escritura completas** sobre los datos financieros reales (Apps Script no tiene rate-limiting, ni auth por registro, ni allow-list de origen). Fue una **decisión consciente** del propietario, pero como auditoría debe constar como el riesgo nº1.

**Mitigación:** asumir el riesgo + endurecer backend (límite de tasa por `CacheService`, validar origen, alertas), o aceptar que es un *gate* de oscuridad y **rotar `FINANCEOS_API_TOKEN`** ante cualquier anomalía. No hay solución cliente-only que oculte el token en una PWA pública.

### C-2 · Integridad de saldos multi-moneda (cálculo silenciosamente erróneo)

`selectors.totalAssets / totalLiquidity / netWorth / investmentsValue` **suman `balance`/`amount` ignorando `currency`**. El esquema ya permite `currency` por registro y `baseCurrency='COP'`. Hoy funciona porque todo está en COP, pero **en el momento que se agregue una cuenta en otra divisa, el patrimonio neto mostrado será incorrecto sin ningún error visible**. Para un "Financial OS" cuyo principio nº2 es *integridad de datos*, es una mina latente, no una "mejora futura".

**Mitigación:** capa de conversión FX en selectores (tabla de tasas en `Settings`), o **validar/forzar moneda única** y bloquear el alta de otra divisa hasta implementar FX.

### C-3 · Lógica financiera sin pruebas automatizadas

No hay `package.json`, ni runner, ni un solo test; la verificación es `node --check` (solo sintaxis). `selectors.js` concentra `netWorth`, `budgetStats`, `savingsRate`, `cashflow`, `topCategoryChange` — fórmulas cuya regresión **corrompe cifras sin romper la app**. Contradice directamente el principio de integridad de datos del PRD.

**Mitigación:** suite mínima de tests puros sobre `selectors.js` (no requiere DOM ni romper "sin build": `node --test` nativo). 20–30 casos cubren el núcleo financiero.

---

## 🟠 IMPORTANTE

### I-1 · Duplicación del andamiaje CRUD en ~11 vistas

Cada vista reimplementa el mismo patrón: `page-header` (15 inline), `openXModal`, construcción de formulario, `row` con `row__actions` (editar/duplicar/eliminar), `confirmDialog` (en 10 vistas) y `try/catch → toast('Error al guardar'/'Error al eliminar')` (8 archivos idénticos). Es el mayor lastre de mantenibilidad: un cambio de UX en filas o en manejo de error obliga a editar 11 archivos.

**Mitigación:** factorías `entityRow({icon,title,sub,amount,onEdit,onDelete})`, `crudModal()` y un helper `withErrorToast(fn)`. Reduciría varios cientos de líneas sin tocar las reglas absolutas.

### I-2 · Head-of-line blocking en `syncEngine.flush()`

El `break` ante el primer fallo detiene **toda** la cola. Una operación que falle por causa **no-de-red** (validación/negocio) se reintenta 6× por ciclo bloqueando a las posteriores, y al llegar a `MAX_ATTEMPTS` queda **atascada para siempre** en la cola (se marca `state:'error'` pero nunca se descarta ni se aparta). No hay *dead-letter*. En offline-first esto puede congelar la sincronización indefinidamente.

**Mitigación:** distinguir error de red (reintentar, `break`) de error de negocio (mover a cola "fallidos"/`continue`), y exponer las fallidas en Ajustes.

### I-3 · Bug lógico: estado de sync siempre `'idle'`

`syncEngine.js:84` → `setStatus({ state: pending > 0 ? 'idle' : 'idle' })`. Ambas ramas devuelven `'idle'`: la píldora **nunca refleja "pendiente"**. Probable intención: `'pending'`/`'error'`.

### I-4 · Dos mapas paralelos `ENTITIES` (lectura) y `WRITE` (escritura)

`dataService.js` mantiene `WRITE` con `create/update/remove` por colección, separado de `ENTITIES`. Hay que sincronizarlos a mano → riesgo de *drift* al añadir una entidad.

**Mitigación:** fusionar las acciones de escritura dentro de `ENTITIES` (fuente única ya existente).

### I-5 · Etiquetas de formulario no asociadas (a11y · WCAG 1.3.1 / 4.1.2)

`forms.field()` pinta `<label>` con texto pero **sin `for`/`id`**; el control es hermano. Los inputs caen en `aria-label = name`, así que el lector de pantalla anuncia el **nombre máquina** ("accountId", "amount") en vez de la etiqueta en español.

**Mitigación:** generar `id` y enlazar `label[for]`, o envolver el control dentro del `<label>`.

### I-6 · Indicador de foco en inputs potencialmente insuficiente (a11y · WCAG 2.4.11)

`components.css:228` → `.input:focus { outline: none; box-shadow: 0 0 0 3px var(--accent-bg) }`. Quita el `outline` y lo sustituye por un *halo* con color de **fondo tenue** (`--accent-bg`), que probablemente no alcanza 3:1 contra el fondo del campo. Conviene verificar contraste o usar `--accent` sólido.

---

## 🟢 MEJORA FUTURA

- **MF-1 · Reactividad de grano grueso:** `onStoreChange` re-renderiza la vista activa completa ante cualquier cambio del store (con guardas de typing/modal). Funciona, pero pierde estado DOM transitorio y no escala; considerar suscripción por sección.
- **MF-2 · `store.set` frágil:** muta el `patch` del llamador (`delete patch.ui`) y hace *shallow-merge*; cualquier objeto anidado distinto de `ui` se reemplaza entero. Documentarlo o hacer merge inmutable.
- **MF-3 · Estado mutable a nivel de módulo en vistas** (`FILTER` en `transactions.js`): aceptable para un solo usuario, pero impide reuso/testeo aislado.
- **MF-4 · Duplicación menor en backend:** `doPost` y `dispatch_` repiten *lookup*+ejecución de `ROUTES`; unificar.
- **MF-5 · Invariante XSS de `el(html:)`:** `innerHTML` hoy solo recibe SVG de `icon()` (confiable). Mantener la regla "nunca pasar datos de usuario a `html:`"; idealmente documentarla/lint.
- **MF-6 · `netWorthSeries` mock siempre presente** en el estado aunque el dashboard ya prefiere snapshots reales con *badge* "Demo" honesto: limpiar cuando snapshots sean fuente única.
- **MF-7 · Iconos PNG 192/512** para PWA (hoy SVG) — ya anotado en `SessionState.md`.
- **MF-8 · Selectores O(n) repetidos** (`expenseByCategory` vs `categorySpend` casi idénticos; recálculo total en cada render): memoización si el volumen crece.

---

## Plan de remediación sugerido (por ROI)

| Orden | Acción | Coste | Riesgo que elimina |
|---|---|---|---|
| 1 | **C-3** Tests puros de `selectors.js` (`node --test`) | Bajo | Regresiones financieras silenciosas |
| 2 | **I-3** Fix `state` de sync (1 línea) | Trivial | UX engañosa de sincronización |
| 3 | **I-2** Dead-letter en sync engine | Medio | Cola atascada permanentemente |
| 4 | **C-2** Decidir FX vs. moneda única forzada | Medio | Patrimonio neto incorrecto |
| 5 | **I-1** Factorías `entityRow`/`crudModal`/`withErrorToast` | Medio | Deuda de mantenibilidad |
| 6 | **I-5/I-6** Asociar labels + foco visible | Bajo | Conformidad WCAG AA |
| 7 | **I-4** Unificar `WRITE` en `ENTITIES` | Bajo | Drift al añadir entidades |
| 8 | **C-1** Endurecer backend / política de rotación | Medio | Exposición de datos |

---

## Documentos relacionados

- `CLAUDE.md` — fuente de verdad del proyecto.
- `docs/Architecture.md` — capas y contratos.
- `docs/Database.md` — esquema y reglas de integridad.
- `docs/SessionState.md` — estado operativo actual.
