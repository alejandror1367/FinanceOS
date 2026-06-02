---
name: documentation-generator
description: Generar y mantener la documentación de FinanceOS sincronizada con el estado real del repo — PROJECT_HANDOFF, README, DEPLOY, CLAUDE.md, docs/ y backend/README. Usar al actualizar el handoff tras una sesión, regenerar el árbol de docs, detectar contradicciones entre documentos, documentar un módulo nuevo, o cuando se pida "actualizar la documentación" o "generar docs". Verifica consistencia, no inventa estado.
---

# Documentation Generator — FinanceOS

Genera y mantiene la documentación **derivándola del estado real del repo**, no de
suposiciones. La regla de oro: un doc que miente induce a error en cada sesión futura.

## Fuentes de verdad y jerarquía

- **`CLAUDE.md`** — reglas, principios e invariantes. Cambia poco.
- **`PROJECT_HANDOFF.md`** — estado real vivo (qué está hecho, pendientes, bugs, git).
  Es la fuente de verdad del *estado*; los `docs/SessionState.md`/`Audit*.md` son
  snapshots fechados que NO se actualizan retroactivamente.
- **`README.md`** — setup, estructura, índice de docs.
- **`DEPLOY.md`** / **`backend/README.md`** — despliegue front / back.
- **`docs/`** — PRD, Architecture, Database, Roadmap, TechnicalDebt, auditorías.

## Cómo trabajar

1. **Lee el estado real antes de escribir.** Verifica contra el código y git:
   - `git log --oneline -10`, `git status`, versión en `src/core/config.js` y `sw.js`.
   - Archivos `.gs` reales (`backend/*.gs`) y acciones del router (`backend/Code.gs` → `ROUTES`).
   - Hojas reales en `backend/Config.gs` (`SHEET_NAMES`) — actualmente **13**.
   - Rutas/vistas reales en `src/core/routes.js` y `src/views/`.
2. **Cross-check de consistencia** entre los docs vivos. Errores típicos ya corregidos
   que debes vigilar que no reaparezcan:
   - Auth = **OAuth** (no "token compartido"; `api.token` es `null`).
   - **13 hojas** (incluye `Journal`), no 12.
   - Módulos `#/import` (Gemini) y `priceService` (precios en vivo) documentados.
   - Lista de archivos backend completa (Auth, Migration, Journal, Import, NetWorth, Quotes).
3. **Distingue vivo de histórico.** No reescribas auditorías fechadas; márcalas SUPERADO
   si quedaron obsoletas (ver el aviso en `docs/SessionState.md` como patrón).
4. **Convierte fechas relativas a absolutas** y mantén el estilo conciso existente
   (tablas densas, no una línea por ítem).

## Tareas frecuentes

- **Actualizar PROJECT_HANDOFF tras una sesión**: añade una sección fechada con los
  cambios, actualiza estado de módulos/deuda, refresca el bloque de git y SW version.
- **Regenerar el árbol de docs** en README a partir de `git ls-files docs/`.
- **Auditar consistencia**: reporta contradicciones doc↔doc y doc↔código en tabla
  `Doc | Línea | Dice | Debería`.
- **Documentar un módulo nuevo**: añádelo a la tabla de módulos de CLAUDE.md y
  PROJECT_HANDOFF, y a la estructura del README.

## Reglas

- **No inventes estado.** Si no puedes verificar algo en el código/git, márcalo como
  "por confirmar", no lo afirmes.
- Respeta los invariantes de `CLAUDE.md` (no propongas build tools, frameworks, etc.).
- Commits de docs en su propio commit (`docs(...)`), separados de cambios de código.
- Muestra el diff y espera aprobación antes de escribir cambios grandes.
