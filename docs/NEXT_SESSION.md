# Prompt de continuación — FinanceOS
**Generado:** 2026-06-04 (sesión análisis IA + planificación Alpaca)
**HEAD:** `912c7ba` · **SW:** `v0.2.63` · **Tests:** 97/97 (20 suites)

---

```text
Lee PROJECT_HANDOFF.md (CONTEXTO MÍNIMO primero, luego §18) y CLAUDE.md antes de cualquier cambio.

MCP: .mcp.json versionado con playwright y context7 (scope de proyecto).
Tras git pull deben APROBARSE y REINICIARSE Claude Code: las tools MCP se fijan al arrancar.

PROYECTO: FinanceOS — PWA financiera personal y privada de Alejo.
Repo: https://github.com/alejandror1367/FinanceOS (rama main).
Prod: https://alejandror1367.github.io/FinanceOS/
HEAD: 912c7ba · SW v0.2.63 · config.version 0.2.63 · Tests 97/97 (20 suites)

INVARIANTES (ver CLAUDE.md): JS ES Modules sin build step · sin frameworks/bundlers ·
cero deps npm en runtime · frontend abstraído tras src/services/ · Apps Script +
Google Sheets (13 hojas) + GitHub Pages + OAuth de Google · offline-first.

HECHO Y DESPLEGADO (todos los sprints 1–9 + mobile fixes):
- Roadmap 9/9 sprints completos · QA Playwright 15/15 PASS
- Fix mobile layout (912c7ba) · QA-001 fix Dashboard KPI FIC (012d019)
- Sprints 1–9: ver PROJECT_HANDOFF.md §"Cambios 2026-06-03" para detalle completo.

SESIÓN 2026-06-04 (solo análisis, sin código):
- Análisis completo de integraciones IA (Claude Artifacts, Groq, Alpaca)
- Matriz comparativa 8 opciones + roadmap 4 fases
- Diagnóstico de 2 bugs en backgroundRefreshPrices() en app.js
- Propuesta de integración Alpaca API como fuente primaria para acciones US
- Todo documentado en docs/Live-Artifacts-Prompt.md

PENDIENTES EN ORDEN:

1. FIX AUTO-REFRESH PRECIOS (src/core/app.js — sin deploy):
   Bug A (app.js:112): eliminar guardia !priceService.isStale en backgroundRefreshPrices()
     → precios siempre refrescan al arrancar la app, no solo si han pasado >15 min
   Bug B (app.js:121-124): fix parser para formato { quotes, fxRates } del backend
     → const resp = await apiClient.get(...); rawQuotes = resp?.quotes ?? resp;
     → investments.js ya maneja correctamente (referencia: lines 563-580)

2. INTEGRACIÓN ALPACA API (backend/Quotes.gs — requiere deploy):
   - Alpaca free tier: acciones US/ETFs/crypto (sin tarjeta)
   - fetchAlpaca_() usa GET data.alpaca.markets/v2/stocks/snapshots?symbols=...
   - Headers: APCA-API-KEY-ID + APCA-API-SECRET-KEY (en Script Properties, no en repo)
   - isUsSymbol_(): sin punto ni =X → Alpaca; con .CL o =X → Yahoo (igual que hoy)
   - Crypto: data.alpaca.markets/v1beta3/crypto/snapshots?symbols=BTC/USD
   - Formato salida no cambia: { quotes, fxRates }
   - El usuario debe crear cuenta en alpaca.markets (gratis) y configurar las claves

3. SIMULADOR FIRE (nueva ruta #/fire — sin deploy):
   - Pura aritmética, sin IA
   - Usa selectores existentes: ingresos, gastos, investmentsValue, goalForecast
   - Nueva vista views/fire.js + ruta en routes.js
   - Responde: tasa de ahorro actual, años hasta independencia financiera, sensibilidad

4. REPORTES AUTOMÁTICOS GROQ (nuevo backend/Insights.gs — requiere deploy):
   - Apps Script time trigger día 1 de cada mes
   - Lee aggregados de Sheets → llama Groq (llama-3.1-8b-instant, ya en Import.gs)
   - Escribe resumen en nueva hoja Insights
   - Frontend: card "Resumen del mes" en Dashboard/Analítica

BUGS ABIERTOS (no bloquean):
- QA-003 (P2): FedCM warning en GIS — migrar cuando Google lo fuerce
- QA-002 (P3): precios stale en primera carga — expected behavior

VERIFICACIONES PENDIENTES EN VIVO (happy path autenticado con datos reales):
- Flujo venta parcial/total en UI Inversiones
- getBootstrap con ventana 24m no rompe historial más antiguo
- Analítica: tabla tendencias y selector de período funcionan en producción

RIESGOS ABIERTOS:
- backgroundRefreshPrices() escribe precios corruptos en priceService (Bug B arriba)
  → el Dashboard puede mostrar valores de inversiones incorrectos en arranque
- Bootstrap limita a 24m de transacciones (intencional, confirmar impacto)

FORMA DE TRABAJO: fases pequeñas y verificables · explicar qué/por qué ·
correr node --test tests/selectors.test.js tras cada cambio de selector (97/97 base) ·
commits atómicos por feature · hook auto-bumpa SW + config.version al commitear src/.
Para mensajes de commit multilínea: git commit -F _commitmsg.txt (archivo temporal).
Empezar con: git log --oneline -5 · git status · node --test tests/selectors.test.js.
```
