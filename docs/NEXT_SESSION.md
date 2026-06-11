# Prompt de continuación — FinanceOS
**Generado:** 2026-06-11 (3ª parte: Sprint L.4/L.4b — perfiles PDF de TC)
**HEAD:** `9acc93b` · **SW:** `v0.2.113` · **Tests:** 260 (168 selectors + 13 recurring + 38 import + 31 emailCapture + 10 dismiss)

---

```text
Lee PROJECT_HANDOFF.md (CONTEXTO MÍNIMO primero, luego §18) y CLAUDE.md antes de cualquier cambio.

MCP: .mcp.json versionado con playwright y context7 (scope de proyecto).
Tras git pull deben APROBARSE y REINICIARSE Claude Code: las tools MCP se fijan al arrancar.

PROYECTO: FinanceOS — PWA financiera personal y privada de Alejo.
Repo: https://github.com/alejandror1367/FinanceOS (rama main).
Prod: https://alejandror1367.github.io/FinanceOS/
HEAD: 9acc93b · SW v0.2.113 · Tests 260

INVARIANTES (ver CLAUDE.md): JS ES Modules sin build step · sin frameworks/bundlers ·
cero deps npm en runtime · frontend abstraído tras src/services/ · Apps Script +
Google Sheets (13 hojas) + GitHub Pages + OAuth de Google · offline-first.

ROADMAP ACTIVO: docs/Roadmap-Maestro.md ← fuente única.
ESTADO: v1.0 16/16 ✅ · Sprints A–I, F, K ✅ · L 🟡 (L.1/L.2/L.4/L.4b ✅; faltan
L.3, L.5, L.6) · J 🟡 (solo J.3 opcional). Backend AL DÍA (EmailCapture+Global66 desplegado).

HECHO EN SESIÓN 2026-06-11 (3ª parte, todo pusheado):
- L.4 ✅ perfil PDF Nu (93e510d): id `nu` en PDF_PROFILES. detect por TEXTO (Nu
  Financiera / NIT 901.658.107-2). Cada fila de movimiento = compra → expense; monto =
  1ª col "Valor" (compra completa, D1). El AÑO viaja en la línea siguiente a la fila
  ("29 ABR"/"2026") → lookahead, fallback al año del periodo. Salta pagos/abonos
  ("Gracias por tu pago", D2); sub-filas "Intereses en mora" (sin fecha) no entran.
- L.4b ✅ perfil PDF RappiCard/Davivienda (8f02642): id `rappicard`. detect por TEXTO
  (RappiCard / "Producto emitido por Davivienda"). Fecha ISO en la fila; monto = 1ª col
  "Valor facturado" (compra completa). Monto≤0 (PAGOS POR PSE, abonos, saldo a favor)
  se salta (D2). Descripción envuelta (fila MercadoPago sin texto entre fecha y $) se
  reconstruye con las líneas adyacentes. GASTOS DE COBRANZA (positivo) se conserva.
- Ambos perfiles con TEST REAL LOCAL en import.test.js contra los PDFs verdaderos del
  dueño (.extracted.txt en private/, gitignored → se salta en otros PCs). import 29→38.
- settings.json del dueño commiteado (9acc93b): permisos PowerShell+git que viajan entre PCs.
- DECISIONES DEL DUEÑO (vigentes): D1 cuotas → valor TOTAL en fecha de compra · D2
  pagos/abonos del extracto → SALTARLOS · los 4 PDFs comparten contraseña (la sabe el
  dueño; pedírsela en sesión — NO está en el repo).

PENDIENTES EN ORDEN:

1. L.3 Amex (XLSX) — INVESTIGADO, NO implementado. RUTA DISTINTA: el XLSX va por
   excelParser (esm.sh/xlsx) → headers+rows → detectBank(headers, filename) →
   BANK_PROFILES (NO PDF_PROFILES). Falta crear perfil `amex` en BANK_PROFILES con
   matchFilename /amex/i + matchHeaders + mapRow. PRIMER PASO: sacar los headers reales
   del XLSX (npm i xlsx --no-save en un script temporal y dump de la 1ª hoja; node_modules
   gitignored). Estructura del extracto (del PDF Extracto_202605_Amex_Detallado_0808):
   - 2 secciones por moneda: "ESTADO DE CUENTA EN: DOLARES" y "EN: PESOS" (esta tarjeta
     trae casi todo en PESOS; la de DÓLARES vino en $0). La de USD → tx con sello FX.
   - Tabla movimientos: "Número de autorización · Fecha(DD/MM/YYYY) · Movimientos ·
     Valor movimiento · cuotas(n/m) · Valor Couta/Abono · %mensual · %anual · Saldo pendiente".
   - USAR SOLO la sección "Nuevos movimientos entre <corte>"; la sección "Movimientos
     antes de 15 abr" son cuotas viejas → DUPLICARÍAN (no importar).
   - Monto = "Valor movimiento" (1ª col $, compra completa, D1). Negativos (ABONO
     SUCURSAL VIRTUAL, MERCADO PAGO -$, Pagos/abonos) → saltar (D2).
   - OJO doble fila MercadoPago: una -$480.000 (reverso/abono, saltar) y otra +$480.000
     1/6 (compra real, importar) — el signo decide.
   - Cargos tipo INTERESES CORRIENTES / CUOTA DE MANEJO / IVA POR REEXPEDICION / COBRO
     TAR.REEX (positivos) = cargos reales → expense.
2. L.5 (=K.7): verificar dedup contra tx gm_ de email al importar extracto.
3. L.6: verificación EN VIVO en #/import con los PDFs reales (password + preview).
   Para probar localmente sin deploy: npx serve . y subir los PDFs de private/.
4. J.3 — Narrativa Groq (OPCIONAL): sin script lock · % relativos · caché · disclaimer.

CAVEATS:
- Los PDFs reales y sus .extracted.txt viven en tests/fixtures/import/private/
  (gitignored). El test "REAL (local)" de import.test.js se salta si no existen.
- Para re-extraer texto de un PDF nuevo: node tests/fixtures/import/private/_extract.mjs
  <archivo.pdf> <contraseña> (usa pdfjs-dist instalado con --no-save; node_modules
  está gitignored).
- detectPdfBank detecta por TEXTO, no filename (el PDF de RappiCuenta se llama
  "...RAPPICARD.pdf" — engañoso).
- EmailCapture: parsers puros testeados en Node evaluando el .gs (new Function) —
  no meter llamadas a GmailApp fuera de las funciones de captura.
- Browser Playwright MCP: perfil con sesión Google del dueño; token renueva vía
  auth.prompt() + 5-8s si refreshSilent falla. Solo lectura estricta en datos reales.
- node --test en modo directorio falla (Node 24/Windows): correr archivos explícitos.
- Fechas backend: hora local Bogotá sin Z (coerce_). Hook pre-commit bumpea SW+config
  al tocar src/; backend-only NO bumpea (manual).

FORMA DE TRABAJO: fases pequeñas y verificables · explicar qué/por qué · tests tras
cada cambio (260 base) · commits atómicos · PowerShell: git commit con here-string @'...'@.
Empezar con: git log --oneline -5 · git status · node --test tests/import.test.js.
```

---

*Actualizado el 2026-06-11 (3ª parte) por Claude (handoff): Sprint L.4/L.4b — perfiles PDF de TC (Nu + RappiCard/Davivienda) con test real local; settings.json del dueño versionado. HEAD 9acc93b · v0.2.113 · 260 tests.*
