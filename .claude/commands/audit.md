---
description: Auditoría global de FinanceOS — lanza en paralelo frontend/backend/security/financial/playwright, consolida, deduplica y genera AUDITORIA_MASTER + entregables fechados.
argument-hint: "[módulo opcional: frontend|backend|security|financial|playwright|all]"
---

# /audit — Auditoría global de FinanceOS

Orquesta una auditoría profesional pre-1.0 lanzando los agentes especializados, consolidando
sus hallazgos sin duplicados y produciendo los entregables. **Esta fase NO implementa cambios**
(regla final de `docs/AUDITORIA_MASTER.md`): solo audita, documenta y prioriza.

Argumento `$ARGUMENTS`: si está vacío o es `all`, corre los 5 agentes. Si nombra uno
(`frontend`/`backend`/`security`/`financial`/`playwright`), corre solo ese.

---

## Paso 0 — Bootstrap del contexto (autosuficiente en cualquier equipo)

No asumas memoria de sesiones previas ni de otro PC. Lee primero, en este orden, y resume en 5
líneas el estado de partida:

1. `CLAUDE.md` (invariantes y principios)
2. `PROJECT_HANDOFF.md` (estado real + CONTEXTO MÍNIMO PARA /HANDOFF)
3. `docs/NEXT_SESSION.md` (prompt de continuación)
4. `docs/TechnicalDebt.md` (deuda y su estado ✅/abierto)
5. `docs/AUDITORIA_MASTER.md` (plantilla/guion de la auditoría — **no** es un resultado)
6. Roadmaps y auditorías previas en `docs/` (`Roadmap-*.md`, `Audit-*.md`, `QuickWins-*.md`,
   `UX-Recommendations-*.md`)
7. Estado vivo: `git log --oneline -5`, `git status`, `version` en `src/core/config.js`,
   `VERSION` en `sw.js`, conteo de tests (`node --test tests/selectors.test.js`).

**Si la memoria contradice el repo, gana el repo.** Si falta un archivo, dilo y continúa.

## Paso 1 — Lanzar agentes en paralelo

Lanza con el tool **Agent** (en un solo mensaje, llamadas en paralelo) los subagentes que
correspondan al argumento. A cada uno pásale: el resumen del estado de partida del Paso 0, la
instrucción de **solo auditar (no modificar código)**, y su ámbito:

- **frontend-auditor** → UX/UI, Design System, responsive, WCAG, charts, formularios, navegación.
- **backend-reviewer** → Apps Script, arquitectura, API, IndexedDB, sync engine, performance,
  complejidad O().
- **security-reviewer** → OWASP, OAuth, PWA/Service Worker, Apps Script, gestión de secretos.
- **financial-analyst** → patrimonio, liquidez, cashflow, presupuestos, inversiones, deudas,
  metas, forecasts, indicadores (con caso numérico por hallazgo).
- **playwright-reviewer** → recorrido en vivo de las 15 rutas, errores JS/red, responsive,
  regresiones, evidencia reproducible.

Cada agente reconstruye su propio contexto vía su "Bootstrap del contexto" y devuelve su tabla
de hallazgos con IDs de su prefijo (`FE-`/`BE-`/`SEC-`/`FIN-`/`QA-`).

## Paso 2 — Consolidar y deduplicar

Reúne todas las tablas y:
1. **Deduplica** hallazgos equivalentes entre agentes (un mismo síntoma visto por dos ángulos
   se funde, citando ambos IDs). Cruza también con `docs/TechnicalDebt.md`: si ya existe un
   `TD-xx`, **no** lo dupliques — referéncialo; solo inclúyelo si es una **regresión** verificada.
2. **Normaliza severidad** a P0/P1/P2/P3 (🔴/🟠/🟡/🟢) con la leyenda de `TechnicalDebt.md`.
3. **Prioriza** por impacto × frecuencia × inverso del esfuerzo; integridad de datos y seguridad
   primero.
4. Asigna **IDs `TD-xx` correlativos** a los hallazgos nuevos que merezcan entrar al registro de
   deuda (siguiente número libre tras el último TD).

## Paso 3 — Generar entregables (fechados con la fecha real del entorno)

Escribe/actualiza:
- `docs/Audit-Global-<YYYY-MM-DD>.md` — informe consolidado, una sección por área + tabla maestra
  `ID | Severidad | Área | Hallazgo | Archivo | Impacto | Fix | Esfuerzo | TD-ref`.
- `docs/Bugs-Criticos-<YYYY-MM-DD>.md` — solo P0/P1 con repro y fix.
- `docs/QuickWins-<YYYY-MM-DD>.md` — hallazgos de esfuerzo S y alto impacto.
- `docs/UX-Recommendations-<YYYY-MM-DD>.md` — recomendaciones de `frontend-auditor`/UX.
- `docs/AUDITORIA_MASTER.md` — actualiza el **resumen ejecutivo consolidado** al inicio
  (preservando el guion-plantilla debajo, claramente separado por un encabezado
  `## Resultado consolidado <fecha>`), con: total de hallazgos por severidad, top 10 por ROI,
  y enlaces a los entregables del día.

Mantén el estilo conciso existente (tablas densas). Convierte fechas relativas a absolutas.

## Paso 4 — Cierre

Resume: nº de hallazgos por severidad, top 5 por ROI, regresiones detectadas, y la frase exacta:
**"Auditoría completa. No se implementó nada (regla final de AUDITORIA_MASTER). Siguiente paso:
`/roadmap` para priorizar por sprints."** No commitees salvo que se pida; si lo haces, usa un
commit `docs(audit): ...` separado.

> Invariantes: ningún hallazgo puede proponer build step, framework, bundler ni dep npm de
> runtime, ni romper Apps Script + Sheets, offline-first, exportabilidad total o la PWA.
