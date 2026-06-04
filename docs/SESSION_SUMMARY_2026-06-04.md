# Resumen de sesión — 2026-06-04
*(actualizado al cierre del día — incluye sesión de mañana y tarde)*

## Resumen ejecutivo

Sesión completa en dos bloques. La mañana fue de análisis estratégico (IA + Alpaca, sin código). La tarde fue de implementación pura: se corrigieron 2 bugs críticos en el auto-refresh de precios, se integró Alpaca Markets como fuente primaria para cotizaciones US (desplegado y verificado), y se añadieron secciones desplegables a Inversiones para mejor organización visual en desktop y mobile. SW v0.2.63 → v0.2.65.

---

## Sesión de mañana — análisis estratégico (sin código)

- Evaluación de Claude Artifacts / Live Artifacts para integración directa (conclusión: no viable por OAuth en iframes sandboxeados).
- Roadmap IA en 4 fases: FIRE + insights determinísticos → Groq mensual → chat IA → agente autónomo.
- Diagnóstico de 2 bugs en `backgroundRefreshPrices()` en `app.js`.
- Propuesta de Alpaca API como fuente primaria para acciones US.

---

## Sesión de tarde — implementación

### Cambios implementados

| Cambio | Commit | Impacto |
|--------|--------|---------|
| Fix `backgroundRefreshPrices` — guardia isStale | `700ba60` | Precios siempre refrescan al arrancar, no solo tras TTL de 15 min |
| Fix parser `{ quotes, fxRates }` en app.js | `700ba60` | Elimina escritura de precios corruptos en cada arranque |
| Alpaca API en `Quotes.gs` | `527492b` | Fuente fiable para US/ETFs/crypto; batch vs N requests; fallback Yahoo |
| Secciones desplegables en Inversiones | `843fed3` | Reducción sobrecarga visual; estado persistido en localStorage |
| `chevronDown` en `icons.js` | `843fed3` | Icono reutilizable para toggles |

### Archivos modificados
```
src/core/app.js               — backgroundRefreshPrices: guardia + parser
backend/Quotes.gs             — Alpaca: isUsEquity_, fetchAlpacaSnapshots_, snapshotToQuote_
src/views/investments.js      — secciones desplegables (_collapsed módulo-level)
src/utils/icons.js            — chevronDown
src/styles/components.css     — .inv-section-head--toggle / .inv-section-chevron
```

### Decisiones arquitectónicas
- **`_collapsed` módulo-level**: fuera de `renderInvestments()` para sobrevivir re-renders reactivos del store — única forma de persistir estado visual sin perderlo en cada actualización de precios.
- **Alpaca con fallback**: si Alpaca falla para un ticker, llama Yahoo para ese símbolo específico.
- **Claves en Script Properties**: `ALPACA_KEY_ID` / `ALPACA_SECRET_KEY` nunca en repo.

---

## Trabajo pendiente al cierre

| Tarea | Tipo | Deploy |
|-------|------|--------|
| Simulador FIRE (`#/fire`) | Feature | No |
| Reportes automáticos Groq (`Insights.gs`) | Feature | Sí |
| Verificar venta parcial/total UI Inversiones | QA en vivo | — |
| Verificar getBootstrap 24m con datos reales | QA en vivo | — |
| Analítica: tendencias + selector período | QA en vivo | — |

---

## Próximas 5 tareas prioritarias

1. **Simulador FIRE** — `views/fire.js` + `routes.js`: años hasta FIRE, patrimonio objetivo (25× gastos), tabla de sensibilidad. Sin deploy, alto ROI visual.
2. **Verificar venta parcial/total** en UI Inversiones con datos reales en producción.
3. **Verificar Analítica** — tabla tendencias y selector período funcionan en producción.
4. **Reportes Groq** — `backend/Insights.gs` time trigger día 1 + card Dashboard. Requiere deploy.
5. **Verificar getBootstrap 24m** — confirmar que la ventana no rompe historial más antiguo.
