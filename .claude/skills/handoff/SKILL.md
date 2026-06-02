---
name: handoff
description: Cambiar de equipo y seguir trabajando en FinanceOS con un solo comando. Modo SALIDA (default) — commitea el trabajo pendiente, sincroniza la documentación (PROJECT_HANDOFF, TechnicalDebt, NEXT_SESSION) al estado real, hace push y entrega el prompt de continuación para el otro PC. Modo ENTRADA (`in`) — al llegar al otro equipo: pull, hooks, tests, MCPs y resumen del estado para retomar. Usar cuando se diga "cambiar de pc", "me voy al trabajo/casa", "entrega", "guardar y seguir en otro equipo", "retomar aquí", o al cerrar/abrir una sesión de trabajo.
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
- El hook `pre-commit` auto-bumpea el SW al tocar `src/`/`index.html`/`manifest.json`/`assets/`
  — es esperado; deja que ocurra.
- Cierra los mensajes con:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

### 4. Sincronizar la documentación al estado real
Aplica el criterio de la skill **documentation-generator** (deriva del repo, no inventes):
- **`PROJECT_HANDOFF.md`**:
  - §2 (tabla de estado): conteo de tests, estado de deuda P0/P1/P2.
  - §15 (bloque de git): `HEAD`, `SW` version y los ~8 commits recientes reales.
  - Añade/actualiza una **sección fechada** (`## 14X. Cambios — sesión <fecha>`) con lo hecho,
    lo verificado y lo NO verificado.
  - §18/§19: refresca pendientes y el prompt (ver paso 5).
- **`docs/TechnicalDebt.md`**: marca ✅ HECHO los TD cerrados esta sesión (con su commit).
- **Cross-check** de coincidencias stale antes de cerrar:
```
git grep -nE "33/33|pendiente de subir|ACCIÓN MANUAL" -- PROJECT_HANDOFF.md README.md DEPLOY.md docs/ || true
```
  (Ajusta los patrones a lo que pudo quedar viejo; no reescribas auditorías fechadas, márcalas.)

### 5. Regenerar el prompt de continuación
Escribe en **`docs/NEXT_SESSION.md`** y replica en **`PROJECT_HANDOFF.md` §19** un bloque
` ```text ` con: HEAD/SW/tests actuales · invariantes (resumen) · lo HECHO y desplegado ·
**PENDIENTES en orden** (incluida cualquier verificación en vivo que quede) · caveats ·
forma de trabajo. Si en esta sesión un MCP (p. ej. Playwright/GitHub) conectaba pero sus
tools no se cargaron, **incluye el aviso de reiniciar Claude Code** al inicio del bloque.

### 6. Commit de docs + push
```
git add PROJECT_HANDOFF.md docs/TechnicalDebt.md docs/NEXT_SESSION.md   # + lo que tocaste
git commit -m "docs: handoff al estado actual + prompt de continuación"  # mensaje real
git push origin main
```
Si el push falla por **red transitoria** (`Failed to connect`, `RPC failed`), reintenta
`git push origin main` una vez. Luego **verifica**:
```
git fetch origin && git rev-list --left-right --count origin/main...main   # debe dar 0  0
```

### 7. Entregar al usuario
- Confirma: HEAD subido, SW version, tests N/N, push OK.
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
Luego **lee** `PROJECT_HANDOFF.md` (última sección fechada + §19) y `docs/NEXT_SESSION.md`,
**resume** el estado y los pendientes en orden, y **propón el primer paso**. Si las tools de
un MCP no aparecen aunque `claude mcp list` diga conectado, avisa que hay que **reiniciar
Claude Code** (la lista de tools se fija al arrancar).

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
- Confirma con el usuario solo si: hay untracked ambiguos, el árbol tiene cambios que no
  entiendes, o `git status` revela algo inesperado. En lo demás, ejecuta de corrido.
