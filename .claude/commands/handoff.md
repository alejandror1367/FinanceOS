---
description: Cierra la sesión para continuar en otro equipo — sincroniza PROJECT_HANDOFF y NEXT_SESSION al estado real, corre tests, commitea docs y entrega el prompt de continuación. Garantiza portabilidad entre PCs.
argument-hint: "[out (default) | in]"
---

# /handoff — Continuidad entre equipos sin pérdida de contexto

Deja el repositorio y la documentación en un estado que permita **retomar el trabajo en
cualquier otro PC** (casa, trabajo, clon nuevo) sin que nadie tenga que re-explicar el proyecto.
`PROJECT_HANDOFF.md` es la **principal fuente de continuidad**; este comando la mantiene veraz.

Argumento `$ARGUMENTS`: `out` (default) = vas a salir de este equipo · `in` = acabas de llegar.

> Reutiliza el criterio de la skill **`handoff`** y de **`documentation-generator`** /
> agente **documentation-writer**. Solo toca git, docs y tests — **nunca** el runtime servido.

---

## Paso 0 — Bootstrap del contexto (autosuficiente en cualquier equipo)

Sin memoria previa. Lee `CLAUDE.md`, `PROJECT_HANDOFF.md` (incl. CONTEXTO MÍNIMO) y
`docs/NEXT_SESSION.md`. Verifica el estado vivo: `git branch --show-current`, `git status`,
`git log --oneline -8`, `version` en `src/core/config.js`, `VERSION` en `sw.js`. **Si la
documentación contradice el código/git, gana el código/git y se corrige la doc.**

---

## Modo SALIDA — `/handoff` o `/handoff out`

Objetivo: `origin/main` con todo el trabajo + documentación al día + prompt de continuación listo.

1. **Fotografía** (solo lectura): rama (debe ser `main`; si no, avisar), `git status --short`,
   `git diff --stat`, `git log --oneline -8`. Anota HEAD, SW version, conteo de tests.
2. **Puerta de calidad:** `node --test tests/selectors.test.js`. Si **falla**, DETENTE: reporta
   y no commitees nada roto.
3. **Commitear lo pendiente** (si hay): mensajes descriptivos reales, código y docs en commits
   separados; stagea solo archivos intencionales (no `git add -A` a ciegas). Deja actuar al hook
   pre-commit. Cierra con `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
4. **Sincronizar la documentación al estado real** (vía agente **documentation-writer**):
   - `PROJECT_HANDOFF.md`: actualizar **CONTEXTO MÍNIMO PARA /HANDOFF** (≤100 líneas,
     autosuficiente: estado, arquitectura, módulos, bugs abiertos, riesgos, decisiones, próximo
     sprint, archivos críticos), §2 estado/tests, §10/11/12 deuda/bugs, §15 git (HEAD/SW/commits).
   - `docs/NEXT_SESSION.md`: prompt de continuación con HEAD, SW, tests, qué se hizo, qué sigue,
     forma de trabajo y comandos de arranque — **debe funcionar tal cual en otro PC**.
   - `docs/TechnicalDebt.md`: marcar ✅ lo cerrado esta sesión.
   - `docs/SESSION_SUMMARY_<YYYY-MM-DD>.md`: resumen de la sesión.
   - Si tocaste `.gs` sin desplegar, déjalo anotado como **deploy pendiente** en el handoff.
5. **Checklist de portabilidad** (debe quedar ✅): el handoff reconstruye el contexto sin ayuda
   externa · versiones `config.js`↔`sw.js` y tests coinciden con git · auth=OAuth, 13 hojas,
   15 rutas, `.gs` listados · pasos `git clone && cd FinanceOS` → tests → `npx serve .`
   verificados · sin fechas relativas · sin deploys pendientes sin anotar.
6. **Push** (si el usuario lo pide o ya está acordado): `git push origin main`.
7. **Entregar el prompt** de continuación (el contenido de `NEXT_SESSION.md`) para pegar en el
   otro equipo.

## Modo ENTRADA — `/handoff in`

Objetivo: traer lo último y resumir el estado para retomar de inmediato en este equipo recién
abierto/clonado.

1. `git pull origin main` (avisar si hay cambios locales sin commitear).
2. Activar el git hook si es un clon nuevo (ver §16/§17 del handoff), p. ej.
   `git config core.hooksPath .githooks`.
3. **Puerta de calidad:** `node --test tests/selectors.test.js` → debe pasar.
4. Leer `PROJECT_HANDOFF.md` (CONTEXTO MÍNIMO) y `docs/NEXT_SESSION.md` y **resumir el estado**:
   HEAD, SW, tests, qué se hizo, qué sigue, deploys pendientes, bugs abiertos.
5. Confirmar entorno: Node disponible, `npx serve .` levanta en http://localhost:3000; recordar
   que el backend real requiere OAuth.
6. Cerrar con: **"Listo para continuar. Siguiente paso sugerido: `/audit` (estado fresco) o
   `/implement` (si hay roadmap con sprint pendiente)."**

---

> Este comando es la garantía de **portabilidad entre equipos**: tras `/handoff out`, cualquier
> PC que clone el repo y lea `PROJECT_HANDOFF.md` + `NEXT_SESSION.md` puede seguir sin contexto
> adicional. Nunca modifica el runtime servido; respeta todos los invariantes de `CLAUDE.md`.
