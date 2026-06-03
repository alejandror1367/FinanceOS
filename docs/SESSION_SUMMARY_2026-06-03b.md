# Resumen de sesión — 2026-06-03 (tarde/noche: auditoría + roadmap + Sprint 1)

## Resumen ejecutivo
Segunda sesión del día. Se ejecutó la auditoría global pre-1.0 (46 hallazgos, 4/5 áreas), se generó un roadmap de 9 sprints priorizados por ROI y se completó el Sprint 1 de integridad de cifras maestras: los 5 P0 están corregidos en código. Los tests subieron de 54 a 65. Quedan 3 archivos `.gs` pendientes de deploy manual.

## Hallazgos principales de auditoría (docs/Audit-Global-2026-06-03.md)

| Área | P0 | P1 | P2 | P3 | Top hallazgo |
|---|---|---|---|---|---|
| Financiera | 3 | 5 | 5 | 1 | FX silencioso 1:1 + retención decorativa + backend desincronizado |
| Backend | 2 | 4 | 5 | 2 | idempotentHit_ resucita soft-deletes; O(n) por escritura |
| Frontend | 0 | 3 | 7 | 4 | Contraste WCAG 3.1:1; aria-label técnico sobrescribe label visible |
| Seguridad | 0 | 0 | 3 | 3 | id_token en URL; sin validar iss/exp |
| QA (Playwright) | — | — | — | — | **Pendiente** (cancelada por el usuario en esta sesión) |

## Cambios implementados (Sprint 1 del ciclo 2026-06-03)

| Cambio | Commit | Impacto | Deploy |
|---|---|---|---|
| Guard `isDeleted` en `idempotentHit_` | `45b47ec` | Elimina corrupción por soft-delete fantasma | ⚠ Utils.gs |
| FX rates en `getQuotes` + selectores excluyen 1:1 | `bc4f1fe` | Patrimonio USD correcto (no 1:1 silencioso) | ⚠ Quotes.gs |
| `computeNetWorth_` paridad con FE | `8751f9a` | Backend = FE: filtra vendidos, suma comisión | ⚠ Reports.gs |
| `applyWithholding()` descuenta retención del P&L | `4073ddf` | P&L neto de impuesto real | — |
| `_recalcAccountBalance` idempotente en update tx | `b23a4f6` | Sin doble conteo de saldo offline | — |
| +11 tests (FX, withholding, idempotencia) | varios | 65/65 tests, 13 suites | — |
| Roadmap 9 sprints (docs) | `741708c` | Plan completo hasta v1.0 | — |
| Auditoría global (4 entregables docs) | `933283a` | TD-41…TD-53 registrados | — |

## Archivos modificados
**Código:** `backend/Utils.gs` · `backend/Quotes.gs` · `backend/Reports.gs` · `src/store/selectors.js` · `src/services/dataService.js` · `src/services/priceService.js` · `src/views/investments.js` · `tests/selectors.test.js`
**Docs:** `docs/Audit-Global-2026-06-03.md` · `docs/Bugs-Criticos-2026-06-03.md` · `docs/QuickWins-2026-06-03.md` · `docs/UX-Recommendations-2026-06-03.md` · `docs/AUDITORIA_MASTER.md` · `docs/Roadmap-Implementacion-2026-06-03.md` · `docs/TechnicalDebt.md` · `PROJECT_HANDOFF.md` · `docs/NEXT_SESSION.md`

## Commits de esta sesión
```
(handoff docs) — este commit
741708c docs(roadmap): roadmap de implementación 2026-06-03 (9 sprints)
b23a4f6 fix(sync): BE-002 idempotent local balance on transaction update
4073ddf fix(investments): FIN-002 apply withholdingRate to realized P&L
8751f9a fix(backend): FIN-001 sync computeNetWorth_ with frontend Sprint-5 logic
bc4f1fe fix(fx): BE-003+FIN-005 populate FX rates and exclude positions without rate
45b47ec fix(backend): BE-001 guard soft-deleted records in idempotentHit_
933283a docs(audit): auditoría global 2026-06-03 — 46 hallazgos (4/5 áreas)
```

## Trabajo pendiente / no verificado en vivo
- ⚠ **Deploy de 3 .gs** en Apps Script (Utils, Quotes, Reports)
- QA en vivo Playwright — 15 rutas, responsive, dark/light (pendiente)
- Sprint 2: ventas parciales (TD-43) + CDT correcto (TD-44) — no requiere deploy
- Sprint 3: accesibilidad WCAG AA — todo esfuerzo S, sin deploy
- Integrar aviso "valor incompleto" en UI cuando posiciones FX falten (TD-02 UI)

## Próximas 5 tareas prioritarias
1. **Desplegar los 3 .gs** → verificar en prod: fxRates en getQuotes, patrimonio sin lotes vendidos inflados, P&L con retención.
2. **`/implement 2`** — Sprint 2: ventas parciales (pedir cantidad en modal) + CDT sin capitalizar comisión. No requiere deploy.
3. **`/implement 3`** — Sprint 3: accesibilidad DS (contraste `--text-tertiary`, aria-label, reduced-motion, progressbar). Todo S, un PR sin deploy.
4. **`/audit playwright`** — completar la 5ª área de la auditoría con QA en vivo de las 15 rutas.
5. **`/implement 4`** — Sprint 4: backend performance (O(n) → lectura puntual, paginación listTransactions_). Requiere deploy.
