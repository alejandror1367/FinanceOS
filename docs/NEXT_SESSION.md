# Prompt de continuación — FinanceOS
**Generado:** 2026-06-07 (sesión — fix backend CC balance negativo)
**HEAD:** `f0d8ff1` · **SW:** `v0.2.75` · **Tests:** 97/97 (20 suites)

---

```text
Lee PROJECT_HANDOFF.md (CONTEXTO MÍNIMO primero, luego §18) y CLAUDE.md antes de cualquier cambio.

MCP: .mcp.json versionado con playwright y context7 (scope de proyecto).
Tras git pull deben APROBARSE y REINICIARSE Claude Code: las tools MCP se fijan al arrancar.

PROYECTO: FinanceOS — PWA financiera personal y privada de Alejo.
Repo: https://github.com/alejandror1367/FinanceOS (rama main).
Prod: https://alejandror1367.github.io/FinanceOS/
HEAD: f0d8ff1 · SW v0.2.75 · config.version 0.2.75 · Tests 97/97 (20 suites)

INVARIANTES (ver CLAUDE.md): JS ES Modules sin build step · sin frameworks/bundlers ·
cero deps npm en runtime · frontend abstraído tras src/services/ · Apps Script +
Google Sheets (13 hojas) + GitHub Pages + OAuth de Google · offline-first.

HECHO Y DESPLEGADO (sesiones anteriores):
- Sprints 1–9 · QA Playwright 15/15 PASS · mobile fixes · QA-001 fix
- Fix auto-refresh precios (700ba60): guardia isStale + parser BE-003 corregidos
- Alpaca API (527492b): Quotes.gs desplegado y verificado en producción
- Secciones desplegables en Inversiones (843fed3): estado en localStorage

HECHO EN SESIÓN 2026-06-07 (commiteado, PENDIENTE DE DEPLOY):
- fix(backend) f0d8ff1: toSignedAmount_() en Utils.gs + Accounts.gs usa para balance
  Permite saldos negativos en CC — antes toAmount_() los rechazaba (dead-letter queue)

PENDIENTES EN ORDEN:

1. DEPLOY BACKEND — ACCIÓN MANUAL INMEDIATA:
   - Abrir editor Apps Script del proyecto FinanceOS
   - Reemplazar backend/Utils.gs y backend/Accounts.gs con versiones del repo (f0d8ff1)
   - Republicar el deployment (nueva versión)

2. RE-ENCOLAR OPS FALLIDAS (hacer tras deploy):
   Pegar en consola del browser (producción autenticado):
   indexedDB.open('financeos').onsuccess = function(e) {
     var tx = e.target.result.transaction('syncQueue','readwrite');
     tx.objectStore('syncQueue').getAll().onsuccess = function(e) {
       e.target.result
         .filter(function(o) { return o.dead && o.lastError !== 'No autorizado.'; })
         .forEach(function(o) {
           tx.objectStore('syncQueue').put(
             Object.assign({}, o, {dead:false, attempts:0, lastError:''})
           );
         });
       console.log('ops re-encoladas — ir a Ajustes y forzar sync');
     };
   };

3. SIMULADOR FIRE (nueva ruta #/fire — sin deploy):
   - Pura aritmética, sin IA · nueva vista views/fire.js + ruta en routes.js
   - Inputs: tasa de ahorro actual (calculada), patrimonio actual, gastos anuales
   - Usa selectores existentes: monthlySavings, investmentsValue, monthlyExpense
   - Output: años hasta FIRE, patrimonio objetivo (25× gastos), tabla de sensibilidad

4. REPORTES AUTOMÁTICOS GROQ (nuevo backend/Insights.gs — requiere deploy):
   - Apps Script time trigger día 1 de cada mes
   - Lee aggregados de Sheets → llama Groq (llama-3.1-8b-instant, ya en Import.gs)
   - Escribe resumen en nueva hoja Insights
   - Frontend: card "Resumen del mes" en Dashboard/Analítica

BUGS ABIERTOS (no bloquean — tras deploy del fix CC ya resuelto el P1):
- QA-003 (P2): FedCM warning en GIS — migrar cuando Google lo fuerce
- QA-002 (P3): precios stale primera carga — expected behavior

VERIFICACIONES PENDIENTES EN VIVO:
- Flujo venta parcial/total en UI Inversiones
- getBootstrap ventana 24m no rompe historial más antiguo
- Analítica: tabla tendencias y selector de período en producción
- Confirmar que CC updateAccount ya no genera dead-letter tras deploy

FORMA DE TRABAJO: fases pequeñas y verificables · explicar qué/por qué ·
correr node --test tests/selectors.test.js tras cada cambio de selector (97/97 base) ·
commits atómicos por feature · hook auto-bumpa SW + config.version al commitear src/.
Para mensajes de commit multilínea: git commit -F _commitmsg.txt (archivo temporal).
Empezar con: git log --oneline -5 · git status · node --test tests/selectors.test.js.
```
