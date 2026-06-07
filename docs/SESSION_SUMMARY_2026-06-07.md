# Session Summary — 2026-06-07

## Resumen ejecutivo
Dos sesiones. Mañana: diagnóstico dead-letter queue — `toAmount_` rechazaba saldos CC negativos; fix commiteado en backend (pendiente deploy). Tarde: feature de desplegables de detalle en todos los KPIs del dashboard — cada card muestra ahora los ítems que justifican su valor.

## Hallazgos

### Sesión mañana — Dead-letter queue
- 7+ ops `updateAccount` fallaban con `"El monto no puede ser negativo en balance"`
- Causa: `toAmount_()` en Utils.gs rechaza `n<0`, pero desde `1b0e979` las CCs almacenan balance negativo
- 3 ops adicionales con `"No autorizado."` (token expirado durante sync)
- El saldo de cuentas tipo `investment` (ARQ, XTB, Tyba) es puramente informativo — excluido de todo cálculo de patrimonio
- Dead-letter queue tiene infraestructura completa pero sin UI en settings.js

### Sesión tarde — KPI Dashboard
- Matemática de todos los KPIs verificada y correcta
- Ahorro = 4.236.000 − 5.064.458 = −828.458 ✓ · tasa = −19.6% ✓ · score 35/100 ✓

## Cambios implementados

| Cambio | Archivo | Impacto |
|--------|---------|---------|
| `toSignedAmount_()` | `backend/Utils.gs` | Saldos CC negativos aceptados por backend |
| `createAccount_`/`updateAccount_` usan `toSignedAmount_` para `balance` | `backend/Accounts.gs` | CC updateAccount ya no genera dead-letter |
| `KpiCard` acepta `details?: {label,value}[]` | `src/components/ui.js` | KPIs expandibles |
| CSS `.kpi__details` y clases derivadas | `src/styles/components.css` | Estilos del panel |
| `financialScoreBreakdown(s)` | `src/store/selectors.js` | 4 factores del score aislados |
| Computa y pasa `details` a cada `KpiCard` + importa `isExpenseLike` | `src/views/dashboard.js` | Cada KPI muestra su desglose |

## Archivos modificados
- `backend/Utils.gs` · `backend/Accounts.gs`
- `src/components/ui.js` · `src/styles/components.css`
- `src/store/selectors.js` · `src/views/dashboard.js`

## Commits realizados
- `f0d8ff1` fix(backend): permitir balance negativo en cuentas CC (toSignedAmount_)
- `57f144e` feat(dashboard): desplegable de detalle en cada KPI card
- `0839335` docs: handoff 2026-06-07 (mañana)

## Trabajo pendiente y no verificado en vivo
- Deploy `Accounts.gs` + `Utils.gs` a Apps Script (manual)
- Re-encolar ops dead-letter tras deploy (snippet en NEXT_SESSION.md)
- KPI desplegables: no verificados visualmente (sin auth en Playwright)

## Próximas 5 tareas prioritarias
1. Abrir Apps Script → pegar `Utils.gs` + `Accounts.gs` → republicar → confirmar CC sync
2. Re-encolar dead-letter en browser → Ajustes → forzar sync → confirmar verde
3. Verificar visualmente KPI desplegables en producción autenticado
4. Crear `src/views/fire.js` (Simulador FIRE) + ruta `#/fire` en `routes.js`
5. `backend/Insights.gs` con time trigger mensual + Groq para reportes automáticos
