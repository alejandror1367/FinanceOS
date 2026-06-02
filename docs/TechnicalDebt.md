# Registro de Deuda Técnica — FinanceOS

**Fecha:** 2026-05-31
**Fuentes:** consolidación de `docs/Audit.md` (arquitectura), `docs/Audit-Financiero.md` (cálculos), `docs/Audit-Frontend.md` (Design System) y `docs/Audit-Backend.md` (Apps Script).
**Objetivo:** vista única priorizada de la deuda técnica con impacto, esfuerzo y recomendación. Documento de seguimiento; no modifica código.

> Hallazgos que aparecían en varias auditorías se han **fusionado** (se indica el origen). Contexto: app **personal, monousuario**; algunos riesgos de seguridad/escala están mitigados por ese contexto y se marcan como *aceptados* cuando aplica.

---

## Leyenda

**Prioridad**
- **P0 — Crítica:** afecta integridad de datos, correctitud de cifras maestras o una promesa central del producto. Atender primero.
- **P1 — Alta:** fiabilidad de sincronización, bugs activos, accesibilidad bloqueante.
- **P2 — Media:** mantenibilidad, escalabilidad, precisión, consistencia visual.
- **P3 — Baja / Futuro:** mejoras incrementales sin impacto inmediato.

**Esfuerzo** (estimación orientativa para un dev)
- **S** ≤ 0.5 día · **M** 0.5–2 días · **L** 2–5 días · **XL** > 5 días

---

## Resumen ejecutivo

| Prioridad | Nº ítems | Esfuerzo agregado aprox. |
|---|---|---|
| P0 — Crítica | 9 | ~10–16 días |
| P1 — Alta | 9 | ~6–9 días |
| P2 — Media | 14 | ~10–15 días |
| P3 — Baja/Futuro | 8 | incremental |
| **Total** | **40** | — |

La deuda se concentra en **tres temas de fondo**: (1) **modelo contable** (el ledger no mueve saldos; multi-moneda sin conversión), (2) **fiabilidad de sincronización** (cola, atomicidad, head-of-line), y (3) **promesas del DS no entregadas** (tipografía Inter, accesibilidad de gráficos/formularios). El backend es funcional pero **read-heavy** y escala mal con el histórico.

---

## P0 · Crítica

| ID | Problema | Origen | Impacto | Esfuerzo | Recomendación |
|----|----------|--------|---------|----------|---------------|
| TD-01 | **Ledger desconectado de los saldos** (transacciones no mueven `account.balance`; transferencias no mueven dinero) | F-1 | Patrimonio/liquidez y movimientos/ahorro **nunca reconcilian**; cifras maestras incoherentes | L | Decidir modelo: (a) saldos derivados del ledger `balance = inicial + Σtx`, o (b) declarar saldos manuales y separar visualmente del "ahorro del mes". Es la decisión que condiciona el resto. |
| TD-02 | **Multi-moneda sin conversión** (sumas mezclan divisas) | C-2 / F-3 | Patrimonio neto **incorrecto** en cuanto exista una 2ª divisa (latente) | S (bloqueo) / L (FX) | Corto plazo: **forzar divisa única** y bloquear alta de otra (S). Largo plazo: capa FX con tasas en `Settings`. |
| TD-03 | **Doble conteo de cuentas de inversión** en `totalAssets` (incluye `balance` de cuenta *investment* + posiciones) | F-2 | Patrimonio **inflado** sin error visible; incoherente con `totalLiquidity` | S | Excluir `type==='investment'` de `totalAssets` o documentar que su `balance` es solo cash. |
| TD-04 | **Sin pruebas automatizadas** de la lógica financiera (`selectors.js`) | C-3 | Regresiones de cifras **silenciosas** (no rompen la app) | M | Suite `node --test` (sin build) con 20–30 casos sobre net worth, presupuestos, ahorro, rentabilidad. |
| TD-05 | **`AuditLog` se relee entero en cada escritura** (`repoCreate_`→`repoGet_`) | GAS-C1 | Cada escritura se vuelve más lenta a medida que crece el histórico (coste cuasi-cuadrático) | S | `repoCreate_` devuelve el `record` ya construido en memoria, sin releer la hoja. |
| TD-06 | **La tipografía Inter nunca se carga** (sin `@font-face`/`<link>`) | DS-C1 | La identidad tipográfica premium del DS **no se entrega** (cae a `system-ui`) | S | Self-host Inter `.woff2` + `font-display: swap` + `preload` (coherente con offline-first, sin npm). |
| TD-07 | **Gráficos sin alternativa textual** (`role="img"` sin `aria-label`) | DS-C2 | Toda la analítica es **inaccesible** a lectores de pantalla (WCAG 1.1.1) | S–M | `aria-label` con resumen y/o tabla `sr-only` en `LineChart`/`Donut`/`BarChart`. |
| TD-08 | **Labels de formulario no asociados** (primitiva `field()` sin `for`/`id`) | I-5 / DS-C3 | **Todos** los formularios fallan WCAG 1.3.1/4.1.2 | S | `field()` genera `id` y enlaza `label[for]` (1 primitiva → toda la app conforme). |
| TD-09 | **Token de API público** en repo y JS servido | C-1 | Lectura/escritura completa del backend por terceros | S | **Aceptado** por decisión (uso personal). Mitigar: rate-limit en backend + rotar `FINANCEOS_API_TOKEN` ante abuso. |

---

## P1 · Alta

| ID | Problema | Origen | Impacto | Esfuerzo | Recomendación |
|----|----------|--------|---------|----------|---------------|
| TD-10 | **Head-of-line blocking + operación atascada** en `syncEngine.flush` (error de negocio bloquea la cola para siempre) | I-2 / F-10 | Sincronización puede **congelarse** indefinidamente; cliente/servidor divergen | M | Distinguir error de red (reintentar) de error de negocio (mover a *dead-letter*); exponer fallidas en Ajustes. |
| TD-11 | **Bug: estado de sync siempre `'idle'`** (`pending>0 ? 'idle' : 'idle'`) | I-3 | La píldora nunca muestra "pendiente" | S | Corregir ternario a `'pending'`/`'error'`. **Quick win (1 línea).** |
| TD-12 | **Dos métodos de *bucketing* de meses** (`sameMonth` por `Date` local vs `slice` string) | F-4 | `monthlyExpense` discrepa de `budgetConsumed` y del backend en bordes de mes | S | Reescribir `sameMonth` con comparación `YYYY-MM` string. **Quick win (1 línea).** |
| TD-13 | **`pullAll` (clear+replace) vs cola pendiente** | F-8 | `refresh()` manual borra creates pendientes / reaparecen deletes | S–M | `flush()` antes de `pullAll` en `refresh()`; reconciliar en vez de `clear`. |
| TD-14 | **No-atomicidad entre escritura local y encolado** (`db.put` + `enqueue` separados) | F-9 | Si el proceso muere entre ambas, dato local **sin** sync → divergencia permanente | M | Transacción IndexedDB conjunta (store de datos + cola) o *outbox* atómico. |
| TD-15 ✅ | **Carga de app = 12 requests** (sin `getBootstrap`) | GAS-C2 | Latencia alta y ×12 invocaciones por carga/refresh | M | **HECHO** (`98f8c19`): acción `getBootstrap` (`Reports.gs`) lee las 12 hojas en una ejecución; frontend `pullData()` la usa con fallback a `pullAll`. ✅ Desplegado y confirmado en producción (1 sola petición). |
| TD-16 ✅ | **`SpreadsheetApp.openById` sin cachear** (5–8/req) | GAS-I1 | Aperturas repetidas caras por request | S | **HECHO** (`47f91e1`): `getDb_()` en `Utils.gs` memoiza el handle en `var _db`; todo acceso pasa por `getSheet_→getDb_()` → 1 `openById` por ejecución. (`Setup.gs` abre directo pero es setup manual, no per-request.) |
| TD-17 | **Foco de input tenue** (`outline:none` + box-shadow `--accent-bg`) | I-6 / DS-I4 | Posible <3:1; foco poco visible (WCAG 2.4.11) | S | Usar `--focus-ring`/`--accent` sólido. |
| TD-18 | **Touch targets densos** (`.icon-btn` 32px, gap 2px, 3 acciones/fila) | DS-I3 | Riesgo de *mis-tap* en móvil sobre acciones destructivas (WCAG 2.5.8) | S | Aumentar área/separación en táctil. |

---

## P2 · Media

| ID | Problema | Origen | Impacto | Esfuerzo | Recomendación |
|----|----------|--------|---------|----------|---------------|
| TD-19 | **Duplicación del andamiaje CRUD** en ~11 vistas | I-1 | Un cambio de UX obliga a editar 11 archivos | L | Factorías `entityRow`/`crudModal`/`withErrorToast`. |
| TD-20 | **Mapas paralelos `ENTITIES` y `WRITE`** | I-4 | Drift al añadir entidades | S | Fusionar acciones de escritura dentro de `ENTITIES`. |
| TD-21 | **`formatMoney` fuerza 0 decimales** para todas las divisas | F-6 | Oculta centavos en USD/cripto; *penny rounding mismatch* | S | Decimales por divisa (0 COP, 2 USD, etc.). |
| TD-22 | **Aritmética float para dinero** sin redondeo controlado | F-5 | Error acumulado en cripto/fracciones; umbrales sobre floats | M–L | Política de redondeo (centavos enteros / *half-even*) en la capa de cálculo. |
| TD-23 | **Snowball/Avalanche solo ordenan** (sin amortización) | F-7 | "Estrategias" no accionables (sin meses/intereses) | M | Calcular cronograma de pago e intereses ahorrados. |
| TD-24 | **`repoUpdate_` hace 2 escaneos** (findRowIndex + repoGet) | GAS-I2 | Doble O(n) por update | S | Leer la fila puntual con `getRange(rowIndex,...)`. |
| TD-25 | **`getDataRange().getValues()` carga todo** + sin paginación real | GAS-I5 | Lecturas O(n) crecientes; `getTransactions` lee todo y hace slice | M | Lecturas por rango + paginación real. |
| TD-26 | **Sin `batchWrite`** para la cola de sync | GAS-I6 | N invocaciones para N cambios offline | M | Acción `batchWrite` (array de ops en una ejecución). |
| TD-27 | **Sin `LockService`** en escrituras | GAS-I3 | Carreras en multi-dispositivo / reintentos | S | `LockService.getScriptLock()` en mutaciones. |
| TD-28 | **Soft-deletes nunca purgados** | GAS-I4 | Hojas crecen sin límite; lecturas más lentas | M | Compactación/archivado periódico. |
| TD-29 | **Dos sistemas de icon-button** (`.icon-btn` 32 vs `.btn--icon` 38) | DS-I1 | Inconsistencia de tamaño/estado | S | Consolidar en uno con variantes. |
| TD-30 | **Variantes KPI duplicadas** (`--emerald`≡`--positive`, `--accent`≡`--info`) | DS-I2 | CSS redundante | S | Eliminar duplicados. |
| TD-31 | **Componentes del DS faltantes + botón "Buscar" muerto** | DS-I5 | Promesa de DS incompleta; control sin función | S (retirar botón) / L (implementar) | Retirar el botón muerto ya; planificar Search/Command Palette. |
| TD-32 | **CSS hardcoded en `exports.js`** (PDF) | DS-I6 | Estilos fuera de tokens; sin dark mode | S | Documentar como *print stylesheet* intencional; derivar de tokens si crece. |

---

## P3 · Baja / Futuro

| ID | Problema | Origen | Recomendación |
|----|----------|--------|---------------|
| TD-33 | Reactividad de grano grueso (re-render total de la vista) | MF-1 / DS-MF6 | Suscripción por sección / `content-visibility` si escala. |
| TD-34 | `store.set` muta el patch y hace shallow-merge | MF-2 | Merge inmutable o documentar invariante. |
| TD-35 | Aporte a meta no genera transacción ni toca cuenta vinculada | F-12 | Integrar con el ledger cuando se resuelva TD-01. |
| TD-36 | Proyección de presupuesto lineal sobre-proyecta días 1–3 | F-13 | Suavizado; sin proyección los primeros días. |
| TD-37 | Sin validación de solapamiento de presupuestos | F-14 | Validar categoría+periodo únicos. |
| TD-38 | Rentabilidad sin anualización (TWR/IRR) | F-15 | Métrica temporal si se requiere. |
| TD-39 | Recurrentes sin ejecución automática | F-16 / SessionState | Trigger que genere la tx al vencer y avance `nextRunDate`. |
| TD-40 | Theming con hex crudos; sin tokens de densidad; charts no responsive en altura; `font-size` SVG fijo; doble implementación FE/BE de la misma matemática | DS-MF1–7 / MF-3 / F-17 / GAS-MF1–6 | Higiene incremental del DS y del backend (caché, lotes, lecturas dirigidas). |

---

## Roadmap sugerido (por ROI)

**Sprint 0 — Quick wins (≈1–2 días, riesgo casi nulo)**
- TD-11 fix estado de sync (1 línea) · TD-12 unificar bucketing de meses (1 línea) · TD-05 `repoCreate_` sin relectura · TD-16 cachear `openById` · TD-06 self-host Inter · TD-03 excluir cuentas de inversión del patrimonio · TD-30 desduplicar KPI · TD-31 retirar botón "Buscar" muerto.

**Sprint 1 — Integridad de datos (P0 de fondo)**
- TD-01 decisión y refactor del modelo de saldos · TD-02 bloqueo de divisa única · TD-04 tests de selectores · TD-08 labels accesibles · TD-07 charts accesibles.

**Sprint 2 — Fiabilidad de sincronización**
- TD-10 dead-letter · TD-13 flush antes de pull · TD-14 atomicidad outbox · TD-15 `getBootstrap` · TD-26 `batchWrite`.

**Sprint 3 — Mantenibilidad y escala**
- TD-19 factorías CRUD · TD-20 unificar ENTITIES/WRITE · TD-22/TD-21 precisión monetaria · TD-24/TD-25/TD-27/TD-28 backend (rangos, lock, purga).

**Continuo**
- TD-09 vigilancia del token · P3 según necesidad.

---

## Documentos relacionados

- `docs/Audit.md` · `docs/Audit-Financiero.md` · `docs/Audit-Frontend.md` · `docs/Audit-Backend.md`
- `docs/SessionState.md` — estado operativo · `CLAUDE.md` — fuente de verdad.
