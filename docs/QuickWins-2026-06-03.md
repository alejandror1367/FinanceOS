# Quick Wins — FinanceOS

**Fecha:** 2026-06-03 · **HEAD:** `c778e25` · Esfuerzo **S** (≤0.5 día) y alto impacto. Derivado de `Audit-Global-2026-06-03.md`.

> Orden por ROI. Los marcados 🔴/🟠 corrigen integridad o a11y con muy poco código.

| # | ID | Sev | Quick win | Archivo:línea | Por qué es win | TD-ref |
|---|----|-----|-----------|---------------|----------------|--------|
| 1 | BE-001 | 🔴P0 | Guard `if (hit.isDeleted) return null` en `idempotentHit_` | `backend/Utils.gs:177-181` | 1 condición elimina resurrección de soft-deletes + saldo no aplicado | TD-45 |
| 2 | FE-002 | 🟠P1 | Subir luminancia de `--text-tertiary` (dark + light) | `src/styles/themes.css:37,91` | 1 token arregla el contraste WCAG en TODA la app (captions, th, ⌘K) | TD-40 |
| 3 | FE-003 | 🟠P1 | Quitar `'aria-label': name` de `textInput`/`select` | `src/components/forms.js:20,37` | Restaura nombres accesibles correctos en 14 vistas (revierte regresión TD-08) | TD-49 |
| 4 | FE-001 | 🟠P1 | Escapar `&<>"` en `<title>`/`aria-label` de charts (`esc()`) | `src/components/charts.js:52,70,76,77` | Previene render roto del Donut + markup almacenado | TD-48 |
| 5 | FIN-008 | 🟠P1 | Capitalizar CDT sobre capital y topar `days` a vencimiento | `src/views/investments.js:130-135` | Corrige valoración de renta fija; cálculo aislado | TD-44 |
| 6 | FIN-004 | 🟠P1 | Prorratear comisión de compra `× (qtyVendida/qtyLote)` en `realizedPnL` | `src/views/investments.js:79-83` | P&L realizado correcto (junto a FIN-003) | TD-43 |
| 7 | FIN-006 | 🟠P1 | Convertir balances a base antes de ponderar `avgRate` | `src/store/selectors.js:215-216` | Tasa promedio de deudas correcta multi-moneda | TD-02 |
| 8 | BE-004 | 🟠P1 | `{...existing, ...op.data}` para ops `update` en reconcile | `src/services/dataService.js:78-85` | Evita perder campos tras refresh con update pendiente | TD-47 |
| 9 | FE-004 | 🟡P2 | Bloque `@media (prefers-reduced-motion)` con `animation-duration:.001ms!important` | `src/styles/tokens.css:143-148` | Cumple reduced-motion real (shimmer/spin/pulse/modal) | TD-40 |
| 10 | FE-007 | 🟡P2 | `aria-valuemin/max` + `aria-label` en `ProgressBar` | `src/components/ui.js:92` | a11y de metas/presupuestos/CC; 1 componente | TD-40 |
| 11 | FE-006 | 🟡P2 | Fallback de foco en `confirmDialog` (botón submit / contenedor) | `src/components/modal.js:81-96` | Foco correcto en diálogos destructivos (WCAG 2.4.3) | nuevo |
| 12 | FE-009 | 🟡P2 | Reemplazar `10px/11px` literales por `var(--fs-micro)` | `src/styles/components.css:349,351,384,439,455` | Higiene DS + acompaña FE-002 | TD-40 |
| 13 | FE-010 | 🟡P2 | `.preset-chip:hover` → `var(--accent-contrast)` | `src/styles/components.css:497` | Quita hex crudo; 1 línea | TD-40 |
| 14 | BE-010 | 🟡P2 | Emparejar `flushBatch` por `entityId` en vez de índice | `src/services/syncEngine.js:71-84` | Evita reconciliación cruzada si el orden se rompe | TD-26 |
| 15 | BE-011 | 🟡P2 | Dead-letter directo si falta token local (no reintentar "No autorizado") | `src/services/syncEngine.js:43` | Evita reintentos inútiles + estado "pending" colgado | TD-10 |
| 16 | SEC-002 | 🟡P2 | Validar `iss` y `exp` explícito en `verifyGoogleToken_` | `backend/Auth.gs:39-64` | Defensa en profundidad estándar de GIS; pocas líneas | TD-51 |
| 17 | FIN-009 | 🟡P2 | `roundMoney(v, base)` en acumulados/totales de Inversiones | `src/views/investments.js:557-568` | "Las filas suman al total"; confianza | TD-21 |
| 18 | FIN-010 | 🟡P2 | Normalizar `ref` string con `slice(0,7)` en `sameMonth` | `src/store/selectors.js:17-18` | Cierra el borde de mes que dejó TD-12 | TD-12 |
| 19 | FIN-012 | 🟡P2 | `monthlySavingsAvg`: promediar solo meses con actividad | `src/store/selectors.js:118-122` | Forecast de metas realista para usuarios nuevos | TD-53 |
| 20 | BE-013 | 🟢P3 | `roundMoney(v, currency)` en `_shiftBalance`/`adjustBalance_` | `src/services/dataService.js:315` | Centavos correctos en cuentas USD/EUR | TD-22 |
| 21 | SEC-004 | 🟢P3 | Añadir `.env*`/`*.key`/`.clasp.json` a `.gitignore` | `.gitignore` | Previene fuga de secreto local futuro | nuevo |

**Lote recomendado para un primer PR de quick wins** (todos S, sin tocar backend deploy): #2, #3, #4, #9, #10, #11, #12, #13 (frontend a11y/DS) + #17, #18, #19, #20 (precisión financiera) — corre `node --test` tras tocar selectores.

**Quick wins que requieren deploy de backend** (agrupar en su propio PR): #1 (BE-001), #16 (SEC-002).
