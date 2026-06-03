# Auditoría Global — FinanceOS

**Fecha:** 2026-06-03 · **HEAD:** `c778e25` · **Versión:** SW/config `v0.2.43` · **Tests:** 54/54
**Alcance:** 2ª pasada pre-1.0, posterior a Sprint 5 (inversiones avanzadas) y Sprint 6 (UX).
**Áreas cubiertas:** Frontend (DS/UX/a11y) · Backend (Apps Script/sync/perf) · Seguridad (OWASP/OAuth/PWA) · Financiera (cifras maestras).
**Pendiente:** QA en vivo con Playwright (cancelada por el usuario en esta sesión) — los hallazgos visuales/funcionales en vivo (responsive 375px, dark/light, solapamiento de ejes en charts) quedan **por verificar**.
**Método:** auditoría por código. No se implementó ningún cambio (regla final de `AUDITORIA_MASTER.md`).

---

## Resumen ejecutivo

| Severidad | Nº | Foco |
|---|---|---|
| 🔴 P0 — Crítica | 5 | Integridad de cifras maestras: divergencia FE↔BE de patrimonio, retención decorativa, FX silencioso 1:1, resurrección de registros soft-deleted, doble conteo de saldo |
| 🟠 P1 — Alta | 12 | Ventas parciales rotas, comisión mal prorrateada, valoración CDT, contraste WCAG, inyección en SVG, O(n) por escritura, sin paginación |
| 🟡 P2 — Media | 19 | a11y de charts/forms, reduced-motion, purga, batchWrite no atómico, id_token en URL, penny-rounding, forecast de metas |
| 🟢 P3 — Baja | 10 | Anualización, descubribilidad móvil, .gitignore, comentarios |
| **Total** | **46** | — |

**Tres temas de fondo (heredados y vivos):**
1. **El espejo backend quedó atrás de Sprint 5** — `Reports.gs::computeNetWorth_` ignora comisión, lotes vendidos y FX → patrimonio del backend ≠ vista de Inversiones (materializa el riesgo histórico F-17).
2. **Multi-moneda sigue silenciosa (TD-02)** — `priceService.fxRates` nunca se puebla desde el backend; selectores suman USD a COP 1:1 sin aviso.
3. **La matemática nueva de Sprint 5 tiene defectos reales** — retención decorativa, ventas parciales imposibles, prorrateo de comisión por cantidad comprada.

---

## Tabla maestra

| ID | Sev | Área | Hallazgo | Archivo:línea | Impacto | Fix | Esf | TD-ref |
|----|-----|------|----------|---------------|---------|-----|-----|--------|
| FIN-001 | 🔴P0 | Financiera | Backend `computeNetWorth_` ignora comisión, lotes vendidos y FX → diverge del FE | `backend/Reports.gs:24,77` | Patrimonio/PDF/snapshots con cifra distinta a la vista | Filtrar `!soldDate && !isDeleted`, sumar comisión, aplicar FX | M | TD-41 (F-17/TD-02/03) |
| FIN-002 | 🔴P0 | Financiera | `withholdingRate` capturado y mostrado pero **nunca** aplicado a ningún P&L | `src/views/investments.js:79-86`; ausente en `selectors.js` | El usuario cree ver P&L neto de impuestos; es bruto | Restar retención sobre ganancia realizada al vender | M | TD-42 |
| FIN-005 | 🔴P0 | Financiera | FX silencioso 1:1 en `investmentsValue/Cost` si `fxRates={}` | `src/store/selectors.js:54,68` | Patrimonio subvaluado ×~4000 para activos USD sin aviso | Excluir/marcar posición sin tasa; no sumar nativo | M | TD-02 |
| BE-001 | 🔴P0 | Backend | `idempotentHit_` trata id soft-deleted como duplicado vivo → registro fantasma + saldo no aplicado | `backend/Utils.gs:177-181`; `Transactions.gs:45` | Corrupción de saldo + entidad "revive" muerta | Si `hit.isDeleted` → tratar como NO-hit (continuar al create) | S | TD-45 |
| BE-002 | 🔴P0 | Backend | Doble conteo de saldo en `update` de tx offline repetida antes del pull | `src/services/dataService.js:233-248`; `Transactions.gs:65-94` | Saldo local divergente entre ediciones | Ajuste local idempotente o forzar `pullData()` tras flush de updates | M | TD-46 (TD-01) |
| FIN-003 | 🟠P1 | Financiera | `soldQuantity` = cantidad comprada → venta parcial imposible; comisión prorrateada por qty comprada | `src/views/investments.js:118-124` | Ventas parciales rotas; P&L y posición remanente incorrectos | Pedir cantidad a vender; prorratear por `min(qtySolic, qtyLote)` | M | TD-43 |
| FIN-004 | 🟠P1 | Financiera | `realizedPnL` resta comisión de compra completa, no prorrateada a lo vendido | `src/views/investments.js:79-83` | P&L realizado subestimado en ventas parciales | Prorratear `commission × (qtyVendida/qtyLote)` | S | TD-43 |
| FIN-006 | 🟠P1 | Financiera | `avgRate` de deudas pondera saldos en distinta moneda sin convertir | `src/store/selectors.js:215-216`; `views/debts.js:50-62` | Tasa promedio e intereses engañosos multi-moneda | Convertir a base antes de ponderar | S | TD-02 (F-7) |
| FIN-007 | 🟠P1 | Financiera | `amortize()` trata `minPayment` como cuota fija; Snowball/Avalanche ordenan pero no encadenan | `src/views/debts.js:26-40,297-302` | Fecha "libre de deudas" optimista para tarjetas con cuota % | Soportar minPayment % del saldo; simular bola de nieve | M | TD-23 (regresión parcial) |
| FIN-008 | 🟠P1 | Financiera | `cdtCurrentValue` capitaliza sobre `totalCost` (incl. comisión) y sin tope a vencimiento | `src/views/investments.js:130-135` | CDT sobrevalorado; crece tras vencer | Capitalizar capital; topar `days` a vencimiento | S | TD-44 |
| FE-001 | 🟠P1 | Frontend | Markup de usuario (`label`/`name`) interpolado crudo en `<title>`/`aria-label` de SVG | `src/components/charts.js:52,70,76,77` | Categoría con `<>&"` rompe el Donut; inyección de markup almacenado | Escapar `&<>"` antes de interpolar (helper `esc()`) | S | TD-48 |
| FE-002 | 🟠P1 | Frontend | `--text-tertiary` falla contraste WCAG 1.4.3 (3.1–3.5:1 vs 4.5:1) | `src/styles/themes.css:37,91` | Captions, `th`, hints ⌘K, labels de inversión ilegibles | Subir luminancia del token en dark y light | S | TD-40 |
| FE-003 | 🟠P1 | Frontend | `aria-label: name` técnico sobrescribe el `<label>` visible (rompe TD-08) | `src/components/forms.js:20,37` | Lector anuncia "amount"/"categoryId"; falla WCAG 2.5.3/4.1.2 | Quitar `aria-label:name` cuando `field()` ya asocia label | S | TD-49 (TD-08) |
| BE-003 | 🟠P1 | Backend | FX rates nunca se pueblan desde el backend (`getQuotes_` no devuelve par FX) | `backend/Quotes.gs:11-54`; `priceService.js:11,33` | Misma raíz que FIN-005: patrimonio incorrecto con 2ª divisa | Acción `getFxRates` o incluir `USDCOP=X` en `getQuotes` | M | TD-02 |
| BE-004 | 🟠P1 | Backend | `reconcileAndHydrate` reaplica `update` con `op.data` (patch) → registro reducido al patch tras refresh | `src/services/dataService.js:78-85` | Pérdida temporal de campos en registros con update pendiente | Mezclar `{...existing, ...op.data}` para ops `update` | S | TD-47 (TD-13) |
| BE-005 | 🟠P1 | Backend | Toda mutación es O(n): `idempotentHit_` + `repoGet_('Categories')` + `repoGet_('Accounts')` + `logAudit_` | `backend/Transactions.gs:40-63`; `Accounts.gs:70-75` | Latencia de escritura crece con histórico; agrava cold-start | Lectura puntual `repoFindRowIndex_`+`getRange`; cachear `repoReadAll_` por request | M | TD-05/TD-24 |
| BE-006 | 🟠P1 | Backend | `listTransactions_` sin paginación real; `getBootstrap` carga histórico completo | `backend/Transactions.gs:10-16`; `Reports.gs:144` | Cold-start y payload crecen sin techo (>5000 tx) | Paginar por cursor; bootstrap solo N recientes | L | TD-25 |
| FE-004 | 🟡P2 | Frontend | `prefers-reduced-motion` solo anula `--dur-*`; keyframes con duración literal siguen animando | `src/styles/tokens.css:143-148`; `components.css:162,199,392` | Shimmer/spin/pulse/modal-pop no se detienen (vestibular) | Bloque `@media reduce` con `animation-duration:.001ms!important` | S | TD-40 |
| FE-005 | 🟡P2 | Frontend | Charts SVG con `height`/`font-size` fijos → labels de eje X se solapan en móvil | `src/components/charts.js:13,43,49,74-75` | Etiquetas montadas en Analítica/Patrimonio móvil | Rotar/decimar labels por `n`; `font-size` relativo al viewBox | M | TD-40 |
| FE-006 | 🟡P2 | Frontend | `confirmDialog` no mueve el foco al diálogo (solo busca inputs) | `src/components/modal.js:81-96` | Foco fuera del `role=dialog` en acción destructiva (WCAG 2.4.3) | Fallback: enfocar botón submit o contenedor `tabindex=-1` | S | nuevo |
| FE-007 | 🟡P2 | Frontend | `role=progressbar` sin `aria-valuemin/max` ni `aria-label` | `src/components/ui.js:92` | Metas/presupuestos/CC sin rango ni nombre (WCAG 4.1.2) | Añadir `aria-valuemin/max` + `aria-label` | S | TD-40 |
| FE-008 | 🟡P2 | Frontend | `select` con flecha custom puede solaparse con texto largo en móvil | `src/styles/components.css:233-236` | Inconsistencia DS menor; solape en pantallas estrechas | `padding-right` suficiente; unificar indicador con token | S | TD-40 |
| FE-009 | 🟡P2 | Frontend | `font-size:10px/11px` literales en métricas de inversión/CC (agrava FE-002) | `src/styles/components.css:349,351,384,439,455` | Texto crítico a 10px en bajo contraste | Reemplazar por `var(--fs-micro)` | S | TD-40 |
| FE-010 | 🟡P2 | Frontend | `color:#fff` hardcoded en `.preset-chip:hover` | `src/styles/components.css:497` | Higiene DS; riesgo si cambia `--accent` | Usar `var(--accent-contrast)` | S | TD-40 |
| BE-007 | 🟡P2 | Backend | `purgeDeleted_` usa `deleteRow` en bucle → O(filas) round-trips, riesgo de timeout | `backend/Utils.gs:189-214` | Purga lenta/puede exceder límite de ejecución | Reconstruir hoja: filtrar vivas + `setValues` en bloque | M | TD-28 |
| BE-008 | 🟡P2 | Backend | `AuditLog` crece sin techo (no entra a `purgeDeleted_`) | `backend/Audit.gs:7-21`; `Utils.gs:189` | Toda apertura encarece con el histórico de auditoría | Archivado/truncado por antigüedad (90 días) | M | TD-05/TD-28 |
| BE-009 | 🟡P2 | Backend | `batchWrite` no transaccional: error a media tanda deja lote parcial | `backend/Code.gs:106-124` | Estado parcial; mitigado por idempotencia de creates | Documentar best-effort por-op; verificar idempotencia update/delete | S | TD-26 |
| BE-010 | 🟡P2 | Backend | `flushBatch` asume `results[i]↔ops[i]` posicional; no verifica `entityId` | `src/services/syncEngine.js:71-84`; `Code.gs:113-121` | Reconciliación cruzada si el orden se rompe | Emparejar por `res.entityId===op.entityId` | S | TD-26 |
| BE-011 | 🟡P2 | Backend | `isTransient` reintenta `'No autorizado'` hasta MAX_ATTEMPTS | `src/services/syncEngine.js:43` | Reintentos inútiles + estado "pending" con auth inválida | Si falta token local → dead-letter directo | S | TD-10 |
| SEC-001 | 🟡P2 | Seguridad | `id_token` viaja como querystring en lecturas GET (logs/historial/proxy) | `src/services/apiClient.js:27`; `Code.gs:144` | Fuga de token de sesión (TTL 1h) por canales laterales | Mover lecturas sensibles a POST; no loguear token | M | TD-50 |
| SEC-002 | 🟡P2 | Seguridad | `verifyGoogleToken_` no valida `iss` ni `exp` explícito | `backend/Auth.gs:39-64` | Falta defensa en profundidad estándar de GIS | Validar `iss∈{accounts.google.com,...}` y `exp` | S | TD-51 |
| SEC-003 | 🟡P2 | Seguridad | Caché positivo de auth 25 min → revocación no inmediata | `backend/Auth.gs:17-25,62` | Latencia de revocación (irrelevante monousuario) | Aceptar (contexto) o bajar TTL | S | aceptado |
| FIN-009 | 🟡P2 | Financiera | Penny-rounding: vista suma nativos sin `roundMoney` → secciones no cuadran con total | `src/views/investments.js:557-568` | "Las filas no suman al total" (descuadre 1 COP) | Aplicar `roundMoney(v, base)` a acumulados y totales | S | TD-21 |
| FIN-010 | 🟡P2 | Financiera | `sameMonth(iso, ref)` con `ref` Date usa `getMonth()` local (borde de mes en TZ) | `src/store/selectors.js:17-18` | Discrepancia de borde de mes en callers que pasan `ref` ISO | Normalizar `ref` string con `slice(0,7)` | S | TD-12 |
| FIN-011 | 🟡P2 | Financiera | `goalForecast` usa `monthlySavingsAvg` global → cada meta reclama el 100% del ahorro | `src/views/goals.js:205,51-59` | Fechas de cumplimiento optimistas con varias metas | Repartir capacidad entre metas activas | M | TD-52 (F-12) |
| FIN-012 | 🟡P2 | Financiera | `monthlySavingsAvg` no excluye meses sin datos → diluye el promedio | `src/store/selectors.js:118-122` | Aporte/forecast subestimado para usuarios nuevos | Promediar solo meses con actividad | S | TD-53 |
| FE-011 | 🟢P3 | Frontend | `<title>` SVG solo en hover de ratón; sin equivalente por teclado | `src/components/charts.js:37,70` | Detalle por punto no alcanzable por teclado | Tabla `sr-only` con valores por serie | M | TD-07/TD-40 |
| FE-012 | 🟢P3 | Frontend | Bottom-nav fija a 5 rutas; Inversiones/Presupuestos solo vía menú/⌘K en móvil | `src/core/routes.js:48` | Descubribilidad móvil (no bloqueante) | Ítem "Más" o priorizar por uso | S | UX-Rec |
| FE-013 | 🟢P3 | Frontend | Label "Apariencia" truncado como "T..." en Ajustes | `src/views/settings.js` | Cosmético, una vista | Ya catalogado en handoff §11 | S | handoff §11 |
| FE-014 | 🟢P3 | Frontend | `numberInput` sin fallback de nombre fuera de `field()` (inverso de FE-003) | `src/components/forms.js:24-29` | Bajo: hoy siempre dentro de `field()` | Documentar contrato "todo control va en `field()`" | S | TD-08 |
| BE-012 | 🟢P3 | Backend | Comentario de `getDb_` sugiere persistencia cross-request (es intra-request) | `backend/Utils.gs:17-20` | Solo claridad; sin bug | Comentario aclaratorio | S | TD-16 |
| BE-013 | 🟢P3 | Backend | `_shiftBalance`/`adjustBalance_` usan `Math.round` (trunca centavos USD/EUR) | `src/services/dataService.js:315`; `Accounts.gs:74` | Pérdida de centavos en cuentas no-COP | Usar `roundMoney(v, currency)` | S | TD-22 |
| SEC-004 | 🟢P3 | Seguridad | `.gitignore` no blinda `.env`/`*.key`/`.clasp.json`/`settings.local.json` | `.gitignore:1-4` | Riesgo de commitear secreto local futuro | Añadir patrones preventivos | S | nuevo |
| SEC-005 | 🟢P3 | Seguridad | `parseStatement_` reenvía extracto completo a Groq sin límite de tamaño | `backend/Import.gs:51,71-80` | Privacidad: se envía más del mínimo a un tercero | Truncar `fileContent`; documentar en UI | S | nuevo |
| SEC-006 | 🟢P3 | Seguridad | Accesos no autorizados no se persisten en `AuditLog` (solo `Logger.log`) | `backend/Auth.gs:50,57` | Sin rastro de intentos denegados | Persistir intentos denegados con rate-limit | S | TD-09 |
| FIN-013 | 🟢P3 | Financiera | Rentabilidad sin anualización (TWR/XIRR/CAGR) | `src/store/selectors.js:73-77` | Comparabilidad limitada entre posiciones | Añadir XIRR/CAGR como métrica avanzada | L | TD-38/F-15 |

---

## Verificaciones positivas (sin hallazgo)

- **Sin secretos de pago en el repo** — IA (Groq) y Yahoo se acceden vía proxy Apps Script; claves en `Script Properties` (confirmado en git history).
- **`assertAuthorized_` cubre toda acción** salvo `ping`, en `doGet` y `doPost`; `batchWrite` rechaza acciones de lectura/desconocidas. Sin handler de escritura sin guardia.
- **Service Worker no cachea datos financieros** — solo precachea app shell same-origin; backend cross-origin pasa de largo. Sin cache poisoning.
- **Sin inyección en Sheets** — entradas saneadas, enums validados, rangos por índice numérico (no se construyen fórmulas con input).
- **TD verificados HECHOS** (no se duplican): TD-06, TD-07, TD-08, TD-11, TD-17, TD-18 (FE); TD-10, TD-13, TD-14, TD-15, TD-16, TD-24, TD-25 (parcial), TD-26, TD-27, TD-28 (BE).

## Regresiones detectadas

- **FE-003 / TD-49** — el `aria-label: name` técnico de `forms.js` debilita el fix de **TD-08** (Label in Name).
- **FIN-007** — `amortize()` trata `minPayment` como cuota fija → regresión parcial de **TD-23** para tarjetas con cuota proporcional.
- **FIN-001 / TD-41** — Sprint 5 actualizó la matemática del FE pero **no el espejo `Reports.gs`** → rompe la paridad FE↔BE (materializa F-17).

## Notas de documentación

- `CLAUDE.md` y el handoff dicen "Gemini" para `#/import`, pero el código usa **Groq** (`llama-3.1-8b-instant`). Corregir el handoff.
- Título de **TD-09** ("Token de API público") quedó *stale* tras migrar a OAuth; el residual real es solo URL+clientId (ya aceptado).

---

## Documentos del día
- `docs/Bugs-Criticos-2026-06-03.md` — P0/P1 con repro y fix.
- `docs/QuickWins-2026-06-03.md` — esfuerzo S de alto impacto.
- `docs/UX-Recommendations-2026-06-03.md` — recomendaciones de frontend/UX.
- `docs/AUDITORIA_MASTER.md` — resumen consolidado al inicio.
- **Pendiente:** QA en vivo con Playwright (15 rutas, responsive, dark/light) — re-lanzar en próxima sesión.
