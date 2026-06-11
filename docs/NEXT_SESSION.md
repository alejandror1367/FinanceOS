# Prompt de continuación — FinanceOS
**Generado:** 2026-06-11 (sesión: J.5 + QA en vivo I.1 + TD-55/56 + Sprint K completo)
**HEAD:** `b1c3b7e` · **SW:** `v0.2.110` · **Tests:** 240 (168 selectors + 13 recurring + 24 import + 25 emailCapture + 10 dismiss)

---

```text
Lee PROJECT_HANDOFF.md (CONTEXTO MÍNIMO primero, luego §18) y CLAUDE.md antes de cualquier cambio.

MCP: .mcp.json versionado con playwright y context7 (scope de proyecto).
Tras git pull deben APROBARSE y REINICIARSE Claude Code: las tools MCP se fijan al arrancar.

PROYECTO: FinanceOS — PWA financiera personal y privada de Alejo.
Repo: https://github.com/alejandror1367/FinanceOS (rama main).
Prod: https://alejandror1367.github.io/FinanceOS/
HEAD: b1c3b7e · SW v0.2.110 · Tests 240 (selectors+recurring+import+emailCapture+dismiss)

INVARIANTES (ver CLAUDE.md): JS ES Modules sin build step · sin frameworks/bundlers ·
cero deps npm en runtime · frontend abstraído tras src/services/ · Apps Script +
Google Sheets (13 hojas) + GitHub Pages + OAuth de Google · offline-first.

ROADMAP ACTIVO: docs/Roadmap-Maestro.md ← fuente única.
ESTADO: v1.0 criterios 16/16 ✅ · Sprints A–I ✅ · F ✅ · K ✅ (en producción) ·
J 🟡 (solo falta J.3 Groq, opcional). Backend AL DÍA (deploy 2026-06-11).

HECHO EN SESIÓN 2026-06-10/11 (todo pusheado y desplegado):
- J.5 ✅: 2º email = cuenta alternativa del dueño, documentado en Config.gs (1ca46c1).
- Verificaciones en vivo A–H ✅ + I.1 QA con sesión real ✅ (64 combinaciones, 0 errores).
- TD-55/56 ✅: overflow 375px (8655293) + fix precache SW cache:'reload' (14dd401 —
  Pages max-age=600 congelaba assets viejos en el SW nuevo).
- SPRINT K ✅ COMPLETO: captura automática de compras con tarjeta desde Gmail.
  backend/EmailCapture.gs: parsers RappiCard + Bancolombia (regex, sin IA), trigger
  processEmailCapture cada 15 min (ScriptLock compartido con doPost), idempotencia
  gm_{messageId} (no resucita borradas), etiquetas FinanceOS/procesado|revisar,
  solo compras T.Cred (notificaciones de cuenta/débito ignoradas), in:anywhere (spam),
  config editable en hoja Settings (cardmap 8967→RappiCard, 0808/3147→Amex · 21 reglas
  comercio→categoría · fallback Otros). Acción runEmailCapture (POST). K.8 verificado
  en vivo: tx real en cuenta RappiCard, categoría por regla, 2ª corrida idempotente.
- Utils.gs coerce_: fechas d/ts ahora en HORA LOCAL Bogotá (no UTC) — con toISOString
  una compra de las 19:46 caía al día siguiente al agrupar por date.slice(0,10).
- Setup del dueño: script en alejandrorr1367@gmail.com · RappiCard llega por filtro
  de reenvío · Bancolombia llega directo (cambió el email predeterminado en el banco).

PENDIENTES EN ORDEN:

1. PERFILES PDF DE EXTRACTOS (pedido del dueño, PRÓXIMA SESIÓN):
   Nu, RappiCard y Amex Bancolombia mandan extractos en PDF. Nu y RappiCard CON
   CONTRASEÑA (Amex por confirmar). Trabajo:
   a) pdfParser.js: soporte password — PDF.js getDocument({ data, password }) +
      reintento si PasswordException; campo de contraseña en #/import.
   b) El dueño sube PDFs reales a tests/fixtures/import/private/ (GITIGNORED —
      JAMÁS commitearlos: datos personales, repo público). Leerlos con la tool Read,
      aprender el layout y escribir perfil de texto por banco (determinista, sin Groq).
   c) Fixtures SINTÉTICOS commiteables + tests de regresión (patrón Sprint F).
   d) De paso cierra F.5 (perfil RappiCuenta) y K.7 (ver punto 2).

2. K.7 — al importar el primer extracto real: verificar que el dupKey
   (date|amount|descNorm) no duplique compras ya capturadas por email (la descripción
   del extracto puede diferir del comercio del correo → puede requerir matching extra).

3. J.3 — Narrativa Groq de portafolio (OPCIONAL): sin script lock · % relativos sin
   montos COP · anti prompt-injection · caché CacheService · disclaimer.

CAVEATS:
- Sprint K: si un banco cambia la plantilla del correo, las compras caen a la etiqueta
  FinanceOS/revisar con AuditLog — no se pierden; actualizar regex en EmailCapture.gs.
- tests/emailCapture.test.js evalúa el .gs directo en Node (new Function) — los parsers
  son puros; no romper esa pureza (nada de GmailApp fuera de las funciones de captura).
- Browser Playwright MCP: el perfil persistente CONSERVA la sesión Google del dueño y
  GIS renueva el id_token solo → QA autenticado posible SIN login manual (solo lectura
  estricta). Si el browser queda bloqueado por un agente muerto: matar procesos chrome
  con ms-playwright-mcp en el CommandLine.
- node --test tests/ (modo directorio) falla por quirk Node 24/Windows; correr archivos
  explícitos: node --test tests/selectors.test.js tests/recurring.test.js
  tests/import.test.js tests/emailCapture.test.js tests/dismissService.test.js.
- Fechas backend: TODAS las d/ts llegan en hora local Bogotá sin Z (coerce_).
- Cursor G.7: solo se activa con paginate=true|cursor; sin params, contrato array intacto.

FORMA DE TRABAJO: fases pequeñas y verificables · explicar qué/por qué · correr los
tests tras cada cambio (240 base) · commits atómicos · hook auto-bumpa SW +
config.version al commitear src/ (NO al tocar solo backend/ o sw.js — bump manual).
Para mensajes multilínea en PowerShell: git commit con here-string @'...'@.
Empezar con: git log --oneline -5 · git status · node --test tests/selectors.test.js.
```
