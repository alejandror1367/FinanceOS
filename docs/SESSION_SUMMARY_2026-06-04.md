# Resumen de sesión — 2026-06-04

## Resumen ejecutivo

Sesión de análisis estratégico y planificación. No se escribió código. Se evaluaron integraciones de IA para FinanceOS, se diseñó un roadmap en 4 fases y se diagnosticaron dos bugs en el auto-refresh de precios que explican por qué los precios no se actualizan automáticamente al abrir la app.

## Análisis realizado

### Claude Artifacts / Live Artifacts
- Los Artifacts son iframes sandboxeados en claude.ai — no pueden hacer OAuth con Google.
- Uso práctico inmediato sin código: Export JSON → pegar en Claude chat → análisis ad-hoc.
- No son una integración arquitectónica directa con FinanceOS.

### Roadmap IA en 4 fases
| Fase | Contenido | Costo |
|---|---|---|
| 1 | Simulador FIRE + insights determinísticos | $0 |
| 2 | Reportes automáticos Groq (trigger AS mensual) | $0 |
| 3 | Chat IA con contexto financiero (proxy AS → Groq) | $0 |
| 4 | Agente autónomo de inversiones | $0–$2/mes |

### Agente de inversiones (detalle)
- 60% del valor es aritmética pura: alertas de concentración, CDTs próximos, comparación benchmark
- Solo la narrativa necesita IA (Groq, gratis)
- Solo sugiere, nunca ejecuta — siempre acción manual del usuario

## Bugs diagnosticados (pendientes de fix)

| Bug | Archivo | Impacto |
|---|---|---|
| **A**: guardia `!priceService.isStale` en `backgroundRefreshPrices()` | `src/core/app.js:112` | Al reabrir la app en <15 min, los precios no se actualizan automáticamente |
| **B**: parser usa formato viejo de respuesta | `src/core/app.js:121-124` | `prices.quotes = {...}` en lugar de `prices.AAPL = {...}` — el Dashboard puede ver valores incorrectos en arranque |

## Propuesta Alpaca API

**Por qué:** Yahoo Finance es scraping no oficial, falla ~10-15%. Alpaca es REST API oficial, free tier, más fiable.

**Arquitectura:**
- US symbols → `fetchAlpaca_()` en Quotes.gs (batch, un solo request para N tickers)
- BVC Colombia (.CL), FX (USDCOP=X) → `fetchYahoo_()` (igual que hoy)
- Crypto → Alpaca endpoint `v1beta3/crypto/snapshots`
- Claves en Script Properties: `ALPACA_KEY_ID` + `ALPACA_SECRET_KEY`
- Formato de salida del backend no cambia

## Archivos nuevos esta sesión
- `docs/Live-Artifacts-Prompt.md` — análisis completo (prompt de análisis + respuesta elaborada)
- `docs/SESSION_SUMMARY_2026-06-04.md` — este archivo

## Commits realizados
```
(docs): handoff 2026-06-04 — análisis IA + Alpaca + 2 bugs auto-refresh
```

## Próximas 5 tareas prioritarias (específicas y accionables)

1. **Fix `src/core/app.js:backgroundRefreshPrices()`** — eliminar `|| !priceService.isStale` en línea 112 + fix parser líneas 121-124 para manejar `{ quotes, fxRates }`. Sin deploy. Tests deben seguir en 97/97.

2. **Implementar `fetchAlpaca_()` en `backend/Quotes.gs`** — función que hace batch GET a `data.alpaca.markets/v2/stocks/snapshots`, detecta US symbols con `isUsSymbol_()` y rutea a Yahoo los demás. Requiere que el usuario tenga claves Alpaca en Script Properties y haga deploy.

3. **Nueva ruta `#/fire` — Simulador FIRE** — vista `views/fire.js` con: tasa de ahorro actual (usa selectores), input de tasa de retorno esperada, proyección de años hasta independence financiera (regla del 4%), gráfico de progresión. Sin IA, sin deploy.

4. **Fix QA-001** — Dashboard KPI "Inversiones" muestra $0 para FIC (fondos sin precio en Yahoo). `investmentsValue()` en selectors.js excluye posiciones sin precio; los FIC deben usar `currentValue` del record en lugar de `qty × price`. Solo frontend.

5. **`backend/Insights.gs` + trigger mensual** — nuevo archivo .gs con función que: lee datos de Sheets, construye prompt financiero, llama a Groq API (`GROQ_API_KEY` en Script Properties), escribe en hoja `Insights`. Frontend añade card en Dashboard. Requiere deploy.
