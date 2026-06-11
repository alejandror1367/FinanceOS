# Prompt de continuación — FinanceOS
**Generado:** 2026-06-11 (2ª parte: Global66 + Sprint L.1/L.2)
**HEAD:** `2ba3af6` · **SW:** `v0.2.111` · **Tests:** 251 (168 selectors + 13 recurring + 29 import + 31 emailCapture + 10 dismiss)

---

```text
Lee PROJECT_HANDOFF.md (CONTEXTO MÍNIMO primero, luego §18) y CLAUDE.md antes de cualquier cambio.

MCP: .mcp.json versionado con playwright y context7 (scope de proyecto).
Tras git pull deben APROBARSE y REINICIARSE Claude Code: las tools MCP se fijan al arrancar.

PROYECTO: FinanceOS — PWA financiera personal y privada de Alejo.
Repo: https://github.com/alejandror1367/FinanceOS (rama main).
Prod: https://alejandror1367.github.io/FinanceOS/
HEAD: 2ba3af6 · SW v0.2.111 · Tests 251

INVARIANTES (ver CLAUDE.md): JS ES Modules sin build step · sin frameworks/bundlers ·
cero deps npm en runtime · frontend abstraído tras src/services/ · Apps Script +
Google Sheets (13 hojas) + GitHub Pages + OAuth de Google · offline-first.

ROADMAP ACTIVO: docs/Roadmap-Maestro.md ← fuente única.
ESTADO: v1.0 16/16 ✅ · Sprints A–I, F, K ✅ · L 🟡 (L.1/L.2 ✅; faltan L.3–L.6) ·
J 🟡 (solo J.3 opcional). Backend AL DÍA (EmailCapture con Global66 desplegado).

HECHO EN SESIÓN 2026-06-11 (2ª parte, todo pusheado; backend desplegado por el dueño):
- Global66 Smart Card ✅ EN PRODUCCIÓN: ecParseGlobal66_ (débito; moneda del COMERCIO
  COP/USD/EUR), tx descuenta de la cuenta Global66 (cardmap 7292), sello FX en backend
  (getFxRates_ → amountBase/fxRateToBase/fxRateDate, contrato TD-54). Verificado en
  vivo: tx real ELECTRIFICADORA; códigos de verificación y avisos de cuenta ignorados.
- Regla Servicios += ELECTRIFICADORA|ENERGIA|UNE TELCO (docs/emailcapture-rules-cell.txt).
- Sprint L diseñado (docs/Import-PDF-Perfiles.md) tras analizar los 4 extractos REALES
  en tests/fixtures/import/private/ (GITIGNORED — jamás commitear; .extracted.txt al lado).
- L.1 ✅: parsePdf(buffer, password) + PdfPasswordError (falta vs incorrecta) + fase
  "password" en #/import (reintento; la contraseña solo vive en memoria).
- L.2 ✅: PDF_PROFILES/detectPdfBank (detección por TEXTO del PDF, no filename) +
  perfil RappiCuenta (formato US, toIsoEs) — cierra F.5. finishPdfResult normaliza
  al shape de applyProfile (preview/dedup intactos).
- DECISIONES DEL DUEÑO: D1 cuotas → valor TOTAL en fecha de compra · D2 pagos/abonos
  del extracto → SALTARLOS · los 4 PDFs comparten contraseña (la sabe el dueño;
  pedírsela en sesión — NO está escrita en el repo).

PENDIENTES EN ORDEN:

1. Sprint L restante (diseño listo en docs/Import-PDF-Perfiles.md):
   - L.3 Amex: probar primero el XLSX (Extracto_202605_Amex_Detallado_0808.xlsx) con
     excelParser; si no, perfil PDF: SOLO sección "Nuevos movimientos" (la sección
     "Movimientos antes de..." duplicaría cuotas viejas), negativos = abonos (saltar,
     D2), estado DOLARES aparte → tx en USD con sello FX.
   - L.4 Nu TC (PDF pág. 2): fecha partida en 2 líneas ("09 MAY"/"2026"), compras con
     "N de M" → valor total (D1), filas "Gracias por tu pago" y sub-filas "Intereses
     en mora" → saltar.
   - L.4b RappiCard TC (PDF Davivienda 00200001...CREDIT_CARD_STATEMENT.pdf): filas
     "Virtual/- · YYYY-MM-DD · comercio · $valor · n de m"; comercio puede partirse
     en 2 líneas (ej. "MERCADO"/"PAGO*MERCADOLI"); negativos = pagos (saltar).
   - L.5 (=K.7): verificar dedup contra tx gm_ de email al importar extracto.
   - L.6: verificación EN VIVO en #/import con los PDFs reales (password + preview).
   Para probar localmente sin deploy: npx serve . y subir los PDFs de private/.
2. J.3 — Narrativa Groq (OPCIONAL): sin script lock · % relativos · caché · disclaimer.
3. PENDIENTE DEL DUEÑO (recordárselo): pegar el bloque de permisos en
   .claude/settings.json (el clasificador impide que el agente lo auto-edite; el bloque
   exacto está en la conversación del 2026-06-11) y pegar cardmap+reglas actualizados
   en la hoja Settings (docs/emailcapture-rules-cell.txt + cardmap con "7292").

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
cada cambio (251 base) · commits atómicos · PowerShell: git commit con here-string @'...'@.
Empezar con: git log --oneline -5 · git status · node --test tests/import.test.js.
```
