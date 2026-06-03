---
description: Implementa el siguiente sprint del roadmap — convierte tareas en cambios, ejecuta tests, verifica en vivo, actualiza docs y prepara commits atómicos. Respeta todos los invariantes.
argument-hint: "[nº de sprint opcional, p.ej. 1; vacío = siguiente pendiente]"
---

# /implement — Ejecutar el siguiente sprint

Toma el roadmap activo e implementa un sprint mediante el agente **implementation-engineer**,
por fases pequeñas y verificables, dejando tests verdes, documentación al día y commits listos.

Argumento `$ARGUMENTS`: nº de sprint a ejecutar; si está vacío, el siguiente pendiente según
`git log` y el estado del roadmap.

---

## Paso 0 — Bootstrap del contexto (autosuficiente en cualquier equipo)

Sin memoria previa. Lee, en orden:

1. `CLAUDE.md` (invariantes + "Forma de trabajo").
2. `PROJECT_HANDOFF.md` (estado real + CONTEXTO MÍNIMO + §16/§17 cómo levantar).
3. `docs/NEXT_SESSION.md` (prompt de continuación).
4. El roadmap más reciente `docs/Roadmap-Implementacion-*.md` → identifica el sprint a ejecutar
   y sus tareas (con IDs de hallazgo y archivos).
5. `docs/TechnicalDebt.md` (contexto de cada ítem).
6. Estado vivo — **puerta de calidad de entrada**:
   `git status` (árbol limpio o cambios entendidos), `git log --oneline -5`,
   `node --test tests/selectors.test.js` → **debe pasar antes de empezar**. Si falla, detente y
   reporta; no se construye sobre rojo.

**Si no hay roadmap, detente y sugiere `/roadmap`.** Si la memoria contradice el repo, gana el repo.

## Paso 1 — Plan del sprint

Lista las tareas del sprint en orden de prioridad (P0→P3, quick wins primero dentro de cada
nivel). Por cada una, recupera el **criterio de aceptación** del informe de origen
(caso numérico de `financial-analyst`, flujo de `playwright-reviewer`, etc.). Descarta las ya
resueltas (✅ en deuda / presentes en `git log`).

## Paso 2 — Implementar (vía implementation-engineer, fase por fase)

Lanza el agente **implementation-engineer** con el plan. Para cada tarea:
1. Lee el/los archivos completos antes de editar; escribe en el estilo circundante.
2. Aplica el cambio mínimo que cumpla el criterio (principio: simplicidad).
3. Ejecuta `node --test tests/selectors.test.js` tras cada cambio de lógica/selector; añade
   tests para fórmulas nuevas. La suite debe quedar **verde** (≥ base actual).
4. Si es UI/flujo, verifica en vivo con **playwright-reviewer** (o Playwright MCP) contra el
   criterio de aceptación.
5. Si la tarea toca `.gs`, **no despliegues** (deploy manual del dueño): déjalo listo y márcalo
   "⚠ requiere deploy".
6. **Bloqueo por invariante:** si una tarea exige build step / framework / dep npm de runtime /
   romper la abstracción de servicios, **NO la implementes** — repórtala como bloqueada y propón
   alternativa conforme.

## Paso 3 — Commits atómicos

Un commit por feature, mensaje descriptivo real (nunca "wip"). Separa **código** de **docs**.
Deja actuar al hook pre-commit (auto-bumpea SW + `config.version`). No uses `--no-verify` ni
`--force`. Cierra los mensajes con:
`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
**Push solo si el usuario lo pide.**

## Paso 4 — Actualizar documentación

Coordina con **documentation-writer** para reflejar el nuevo estado: marcar ítems cerrados en
`docs/TechnicalDebt.md`, actualizar `PROJECT_HANDOFF.md` (§2 estado, §8 módulos, §10/11/12,
§15 git, CONTEXTO MÍNIMO) y el roadmap (tareas hechas). Esto no toca el runtime servido.

## Paso 5 — Cierre

Resume por tarea: qué cambió, archivos, resultado de tests (N/N), verificación en vivo,
¿requiere deploy?, commit propuesto. Indica tareas hechas / pendientes del sprint y el siguiente
paso. Si quedaron `.gs` por desplegar, **lístalos claramente** para el dueño. Termina sugiriendo
**`/handoff`** para sincronizar docs y dejar el repo listo para otro equipo.

> Invariantes obligatorios: sin build step, sin frameworks/bundlers, cero deps npm en runtime,
> frontend abstraído tras `src/services/`, Apps Script + Sheets, offline-first, exportabilidad
> total, PWA intacta. Trabajo en fases pequeñas y verificables; nunca todo de una vez.
