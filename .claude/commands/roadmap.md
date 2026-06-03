---
description: Genera un roadmap por sprints a partir de las auditorías — estima esfuerzo, prioriza por ROI y produce docs/Roadmap-Implementacion-<fecha>.md listo para /implement.
argument-hint: "[fecha de auditoría opcional: YYYY-MM-DD]"
---

# /roadmap — Roadmap por sprints (priorizado por ROI)

Convierte los hallazgos de la última auditoría en un plan de ejecución por sprints, con
esfuerzo estimado y orden por retorno de inversión. **No implementa**: planifica.

Argumento `$ARGUMENTS`: fecha de la auditoría a usar (`YYYY-MM-DD`); si está vacío, usa la más
reciente en `docs/`.

---

## Paso 0 — Bootstrap del contexto (autosuficiente en cualquier equipo)

Sin memoria previa. Lee, en orden:

1. `CLAUDE.md` (invariantes — ninguna tarea puede violarlos).
2. `PROJECT_HANDOFF.md` (estado real + CONTEXTO MÍNIMO).
3. La auditoría consolidada más reciente: `docs/Audit-Global-<fecha>.md` y sus entregables
   (`Bugs-Criticos-*`, `QuickWins-*`, `UX-Recommendations-*`); más `docs/AUDITORIA_MASTER.md`
   (resultado consolidado).
4. `docs/TechnicalDebt.md` (deuda abierta y su esfuerzo).
5. El roadmap anterior `docs/Roadmap-Implementacion-*.md` (para no repetir sprints ya hechos —
   cruzar con `git log` y los ✅ de la deuda).
6. Estado vivo: `git log --oneline -5`, versión en `config.js`/`sw.js`, conteo de tests.

**Si no existe ninguna auditoría reciente, detente y sugiere ejecutar `/audit` primero.** Si la
memoria contradice el repo, gana el repo.

## Paso 1 — Inventario de trabajo pendiente

Reúne todos los hallazgos **abiertos** (P0–P3) de las auditorías + deuda P3 restante + gaps de
funcionalidad clasificados (Imprescindible/Recomendado/Avanzado por `financial-analyst`).
Descarta lo marcado ✅/resuelto en `git log` o `TechnicalDebt.md`.

## Paso 2 — Estimar y priorizar

Por cada ítem fija: **esfuerzo** (S ≤0.5d · M 0.5–2d · L 2–5d · XL >5d), **impacto**,
**riesgo** y un **score ROI** = impacto / esfuerzo, con boost para P0/P1 (integridad de datos y
seguridad van primero aunque cuesten más). Marca cuáles requieren **deploy de backend** (`.gs`).

## Paso 3 — Agrupar en sprints

Organiza por sprints temáticos y coherentes (estilo del roadmap existente), p. ej.:
1. Bugs críticos (P0) · 2. Integridad financiera · 3. Sync y datos · 4. Patrimonio ·
5. Inversiones · 6. UX/UI · 7. Performance · 8. Analítica avanzada · 9. Pulido + P3.
Ajusta los temas a lo que realmente arrojó la auditoría. Quick wins primero dentro de cada
sprint. Agrupa cambios del mismo archivo y los que comparten deploy.

## Paso 4 — Generar el documento

Escribe `docs/Roadmap-Implementacion-<YYYY-MM-DD>.md` con:
- Encabezado: fecha, "Basado en: Audit-Global-<fecha>", estado de partida (HEAD, SW, tests).
- Por **sprint**: Objetivo · Alcance · tabla `# | Tarea | ID hallazgo | Archivo | Esfuerzo |
  ¿Deploy? |` · Archivos afectados · Riesgo · Impacto esperado · Esfuerzo total.
- **Resumen ejecutivo por sprint** (tabla Sprint | Objetivo | Esfuerzo | Impacto).
- **Criterios de "listo para v1.0"** (checklist).

Cada tarea conserva el **ID del hallazgo de origen** (`FE-/BE-/SEC-/FIN-/QA-/TD-`) para que
`/implement` sepa a qué informe volver por el criterio de aceptación.

## Paso 5 — Cierre

Resume: nº de sprints, esfuerzo total, top 3 por ROI, y tareas que requieren deploy manual.
Termina con: **"Roadmap listo. Siguiente paso: `/implement` para ejecutar el Sprint 1."**
Si commiteas, usa `docs(roadmap): ...` separado.

> Ninguna tarea del roadmap puede proponer build step, framework, bundler, dep npm de runtime,
> ni romper Apps Script + Sheets, offline-first, exportabilidad total o la PWA.
