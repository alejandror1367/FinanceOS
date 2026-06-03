---
name: handoff
description: Cambiar de equipo y seguir trabajando en FinanceOS con un solo comando. Modo SALIDA (default) — commitea el trabajo pendiente, sincroniza la documentación (PROJECT_HANDOFF, TechnicalDebt, NEXT_SESSION, SESSION_SUMMARY) al estado real, hace push y entrega el prompt de continuación para el otro PC. Modo ENTRADA (`in`) — al llegar al otro equipo: pull, hooks, tests, MCPs y resumen del estado para retomar. Usar cuando se diga "cambiar de pc", "me voy al trabajo/casa", "entrega", "guardar y seguir en otro equipo", "retomar aquí", o al cerrar/abrir una sesión de trabajo.
---

# Handoff — FinanceOS (cambiar de PC sin perder contexto)

Un solo comando para mover el trabajo entre el PC de casa y el del trabajo. Dos modos:

- **`/handoff`** o **`/handoff out`** → estás por **salir** de este equipo: guarda, documenta,
  sube y entrega el prompt de continuación.
- **`/handoff in`** → acabas de **llegar** al otro equipo: trae lo último y resume el estado
  para retomar de inmediato.

Respeta siempre los invariantes de `CLAUDE.md` (no build tools, sin frameworks, etc.).
Esta skill **solo** hace git, docs y tests — nunca toca el runtime servido.

---

## Modo SALIDA — `/handoff` (default) o `/handoff out`

Objetivo: dejar `origin/main` con todo el trabajo + la documentación al día + el prompt listo.

### 1. Fotografía del estado (solo lectura)
```
git branch --show-current          # debe ser main (si no, avisar antes de seguir)
git status --short
git diff --stat
git log --oneline -8
```
Lee la versión real: `version` en `src/core/config.js` y `VERSION` en `sw.js`.
Anota: HEAD, SW version, conteo de tests actual.

### 2. Tests — puerta de calidad
```
node --test tests/selectors.test.js
```
Si **falla**, DETENTE: reporta el fallo y no commitees nada roto. El handoff exige verde.

### 3. Commitear el trabajo pendiente (si hay cambios)
- Mira `git diff` para entender qué cambió y **redacta un mensaje descriptivo real**
  (nunca "wip"/"cambios"). Separa **código** de **docs** en commits distintos.
- Stagea archivos **intencionales** (código en `src/`, `tests/`, `backend/`; docs en `docs/`,
  raíz). No hagas `git add -A` a ciegas: si hay untracked dudosos (temporales, `_*.mjs`,
  `*.output`), exclúyelos o pregúntalo.
- El hook `pre-commit` auto-bumpea el SW **y** `config.version` al tocar `src/`/`index.html`/
  `manifest.json`/`assets/` — es esperado; deja que ocurra.
- Cierra los mensajes con:
  `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`

### 4. Sincronizar la documentación al estado real
Aplica el criterio de la skill **documentation-generator** (deriva del repo, no inventes):

**`PROJECT_HANDOFF.md`** — debe ser la fuente de verdad completa. Actualizar:
- `## CONTEXTO MÍNIMO PARA /HANDOFF`: tabla de estado, arquitectura, funcionalidades,
  bugs abiertos, riesgos, decisiones, próximo sprint, archivos críticos. Máximo 100 líneas.
  Si no existe la sección, créala antes de `## 19. Prompt de nueva sesión`.
- `## 2. Estado actual real`: conteo de tests, estado de módulos, qué deploys hay pendientes.
- `## 10/11/12. Trabajo pendiente / Bugs / Deuda`: actualizar ítems cerrados esta sesión.
- `## 15. Estado de Git`: `HEAD`, `SW` version y los ~8 commits recientes reales.
- `## 17. Checklist`: actualizar si cambió el estado del backend o los pasos de bootstrap.
- `## 18. Próximos pasos`: refrescar sprint pendiente + lo NO verificado en vivo.
- Añadir **`## Cambios realizados en sesión YYYY-MM-DD`** con subsecciones:
  Auditorías realizadas · Bugs corregidos · Bugs pendientes · Refactors · Mejoras UX/UI ·
  Mejoras financieras · Mejoras backend · Mejoras sync · Decisiones arquitectónicas ·
  Riesgos mitigados · Riesgos pendientes · Archivos modificados · Commits relevantes.
- Añadir **`## Estado posterior a la auditoría`** con: Completado ✅ · Parcialmente 🟡 · Pendiente 🔴.
- `## 19. Prompt de nueva sesión`: ver paso 5.

**`docs/TechnicalDebt.md`**: marca ✅ HECHO los TD cerrados esta sesión (con su commit).

**Cross-check de referencias stale** antes de cerrar (ajusta los números al estado real):
```
git grep -nE "[0-9]{2}/[0-9]{2} tests|v0\.[0-9]+\.[0-9]+ \(SW\)|pendiente de subir|ACCIÓN MANUAL|Sin desplegar" \
  -- PROJECT_HANDOFF.md docs/NEXT_SESSION.md || true
```
Busca específicamente el conteo de tests anterior (p. ej. si ahora son 52, busca `45/45`, `39/39`)
y la versión SW anterior. Las menciones en secciones fechadas históricas son correctas — solo
corrige las del "estado actual". No reescribas auditorías fechadas; márcalas como históricas.

### 5. Regenerar el prompt de continuación
Escribe en **`docs/NEXT_SESSION.md`** y replica en **`PROJECT_HANDOFF.md` §19** un bloque
` ```text ` con: HEAD/SW/tests actuales · invariantes (resumen) · lo HECHO y desplegado ·
**PENDIENTES en orden** (incluida cualquier verificación en vivo que quede) · caveats ·
forma de trabajo. Si en esta sesión un MCP (p. ej. Playwright/GitHub) conectaba pero sus
tools no se cargaron, **incluye el aviso de reiniciar Claude Code** al inicio del bloque.

### 6. Crear el resumen de sesión
Crea **`docs/SESSION_SUMMARY_YYYY-MM-DD.md`** con:
- Resumen ejecutivo (2–3 oraciones)
- Hallazgos principales de auditoría (si la hubo)
- Tabla de cambios implementados (cambio → impacto)
- Archivos modificados
- Commits realizados
- Trabajo pendiente y no verificado en vivo
- **Próximas 5 tareas prioritarias** (específicas y accionables)

### 7. Commit de docs + push
```
git add PROJECT_HANDOFF.md docs/TechnicalDebt.md docs/NEXT_SESSION.md \
        docs/SESSION_SUMMARY_YYYY-MM-DD.md   # + cualquier otro doc tocado
git commit -m "docs: handoff YYYY-MM-DD — <resumen de lo que se hizo>"
git push origin main
```
Si el push falla por **red transitoria** (`Failed to connect`, `RPC failed`), reintenta
`git push origin main` una vez. Luego **verifica**:
```
git fetch origin && git rev-list --left-right --count origin/main...main   # debe dar 0  0
```

### 8. Entregar al usuario
- Confirma: HEAD subido, SW version, tests N/N, push `0 0`.
- **Imprime el prompt** de `docs/NEXT_SESSION.md` para copiar/pegar en el otro PC.
- Recuerda el bootstrap del otro equipo (ver "Primera vez en un equipo").

---

## Modo ENTRADA — `/handoff in`

Objetivo: en el equipo nuevo, traer lo último y retomar con contexto.

```
git fetch origin
git status --short            # si hay cambios locales sin subir, AVISA antes de pull
git pull --ff-only origin main
git config core.hooksPath .githooks    # idempotente (necesario 1 vez por clon)
node --test tests/selectors.test.js     # debe pasar
claude mcp list                          # github/playwright/context7 deben conectar
```
Luego **lee** `PROJECT_HANDOFF.md` (sección `## CONTEXTO MÍNIMO PARA /HANDOFF` primero,
luego §18/§19) y `docs/NEXT_SESSION.md`, **resume** el estado y los pendientes en orden,
y **propón el primer paso**. Si las tools de un MCP no aparecen aunque `claude mcp list`
diga conectado, avisa que hay que **reiniciar Claude Code** (la lista de tools se fija al arrancar).

---

## Primera vez en un equipo (bootstrap, una sola vez)
```
git clone https://github.com/alejandror1367/FinanceOS.git
cd FinanceOS
git config core.hooksPath .githooks
node --test tests/selectors.test.js     # 1) que pase
npx serve .                              # 2) http://localhost:3000
```
Después, en cada cambio de equipo basta `/handoff` (al salir) y `/handoff in` (al llegar).

---

## Reglas
- **Nunca** subas con tests en rojo ni con un mensaje de commit vago.
- **No inventes estado** en los docs: deriva de git/código; lo no verificable va como "por confirmar".
- Docs siempre en commit `docs(...)` aparte del código.
- Trabaja solo en `main` salvo que el usuario pida una rama.
- El hook pre-commit actualiza **tanto `sw.js` como `src/core/config.js`** — ambos deben coincidir al cerrar.
- Confirma con el usuario solo si: hay untracked ambiguos, el árbol tiene cambios que no
  entiendes, o `git status` revela algo inesperado. En lo demás, ejecuta de corrido.
- La sección `## CONTEXTO MÍNIMO PARA /HANDOFF` en PROJECT_HANDOFF.md es la primera que
  debe leer una nueva sesión — mantenla siempre actualizada y ≤100 líneas.
