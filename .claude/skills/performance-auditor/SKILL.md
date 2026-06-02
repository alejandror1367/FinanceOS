---
name: performance-auditor
description: Auditar el rendimiento de FinanceOS — PWA Vanilla JS offline-first sobre GitHub Pages + Apps Script. Usar al revisar tiempos de carga, número de requests al backend, render de charts SVG, tamaño/estrategia del Service Worker, uso de IndexedDB, jank al navegar, o cuando se pida un "performance audit", medir Lighthouse, o investigar lentitud/cold-start. Cubre el gap de "Performance Auditor" sin frameworks ni build tools.
---

# Performance Auditor — FinanceOS

Audita el rendimiento respetando las restricciones del proyecto (ver `CLAUDE.md`):
Vanilla JS sin build, Apps Script como backend, GitHub Pages, offline-first. No
introduzcas dependencias de runtime ni herramientas de build; el tooling de medición
(Playwright, Lighthouse) es dev-only.

## Cómo trabajar

1. **Levanta la app local**: `npx serve .` → `http://localhost:3000`. Para medir el
   backend real, recuerda que requiere OAuth (ver `PROJECT_HANDOFF.md`).
2. **Mide con Playwright MCP** (ya instalado): navega, captura `browser_network_requests`
   y `browser_console_messages`, evalúa métricas con `browser_evaluate`.
3. Reporta hallazgos priorizados (impacto × esfuerzo) y enlázalos a `docs/TechnicalDebt.md`
   cuando apliquen. **No** corrijas código salvo que se pida explícitamente.

## Qué revisar (checklist específico de FinanceOS)

### Red / backend (Apps Script)
- **Número de requests en carga inicial.** Bug conocido: `dataService.pullAll()` hace
  **12 round-trips** (TD-15). Verifica si sigue así y si existe `getBootstrap` (1 request).
- **Cold start (BUG-C1).** En tab nuevo/incógnito los pulls fallan con "No autorizado" y
  los KPIs quedan en $0 hasta "Actualizar". Mide si hay reintento automático.
- Latencia de `UrlFetchApp` para verificación OAuth (~200ms/req; cacheado 25 min).
- Tamaño de payloads: ¿se traen colecciones completas sin paginar? (TD-24/25).

### Service Worker / caché
- Estrategia **network-first** para JS/CSS (`sw.js`): correcto online, pero mide el
  fallback offline. Verifica que el auto-bump del hook pre-commit actualizó `VERSION`.
- Qué se precachea en `install` y el peso total del shell.
- Fuentes Inter cross-origin: ¿cacheadas tras el primer load?

### Render / UI
- **Charts SVG** (`components/charts.js`): coste de re-render de LineChart/Donut/BarChart,
  especialmente en Dashboard y Analítica. Busca renders redundantes.
- **Fugas de suscripción al store**: patrón ya corregido en `investments.js` con guard
  `bodyMount.isConnected`. Verifica que otras vistas no acumulen suscripciones al navegar.
- Reflows por `replaceChildren` masivos en listas largas (transacciones).

### Local / datos
- IndexedDB: tamaño de colecciones, coste de `db.getAll` en cada reconciliación de sync.
- `priceService`: TTL de 15 min en localStorage; verifica que no refresque en exceso.
- `localStorage`: que solo guarde prefs/UI, no datos pesados.

### Lighthouse (opcional, vía Playwright/CLI)
Mide Performance, Best Practices y PWA. Objetivos razonables para esta app:
FCP < 2s, TTI < 3.5s en mobile mid-range. Reporta, no sobre-optimices.

## Formato del informe

Tabla: `Hallazgo | Archivo | Impacto (Alto/Medio/Bajo) | Esfuerzo (S/M/L) | TD-ref`.
Cierra con las 3 mejoras de mayor ROI. Si encuentras algo nuevo, propón un ID `TD-xx`
para `docs/TechnicalDebt.md` (no lo escribas sin aprobación).
