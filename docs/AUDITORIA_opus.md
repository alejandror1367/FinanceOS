He completado una auditoría estratégica y una propuesta de roadmap utilizando Sonnet.

Lee:
Audit-Estrategica-2026-06-08.md
Roadmap-Implementacion-2026-06-02.md

Tu trabajo NO es validar automáticamente sus conclusiones.

Actúa como Principal Architect independiente y realiza una revisión crítica exhaustiva.

Lee obligatoriamente:

* CLAUDE.md
* PROJECT_HANDOFF.md
* docs/TechnicalDebt.md
* docs/Roadmap-Implementacion-2026-06-02.md
* La auditoría generada por Sonnet
* El roadmap generado por Sonnet

---

# OBJETIVO

Determinar si las conclusiones de Sonnet son correctas.

Debes asumir que parte de la auditoría puede estar equivocada, incompleta o contener sobreingeniería.

Quiero una segunda opinión arquitectónica independiente.

---

# ANÁLISIS CRÍTICO

Evalúa:

## Auditoría

* Hallazgos correctos
* Hallazgos incorrectos
* Hallazgos incompletos
* Riesgos omitidos
* Suposiciones débiles
* Inconsistencias con CLAUDE.md
* Inconsistencias con PROJECT_HANDOFF.md
* Iniciativas con ROI sobreestimado
* Iniciativas con ROI subestimado

## Roadmap

Analiza:

* Orden de prioridades
* Dependencias
* Complejidad real
* Riesgo real
* Valor para FinanceOS

Identifica:

* Funcionalidades que deberían adelantarse
* Funcionalidades que deberían retrasarse
* Funcionalidades que deberían eliminarse
* Funcionalidades nuevas que deberían añadirse

---

# REVISIÓN ESPECÍFICA DE LAS 9 INICIATIVAS

Analiza críticamente:

1. Autenticación biométrica
2. Dashboard: marcar deuda como pagada
3. Multicuenta / multiusuario
4. Analítica e insights
5. FIRE
6. Importación / exportación
7. Recomendaciones de inversión con IA
8. Cuentas remuneradas
9. Snapshots de patrimonio

Para cada una:

* Beneficio real
* Complejidad real
* Riesgo
* ROI
* Prioridad recomendada
* Implementar / Posponer / Descartar

---

# ARQUITECTURA

Evalúa si las propuestas:

* Respetan los principios de CLAUDE.md
* Mantienen simplicidad
* Mantienen offline-first
* Mantienen exportabilidad
* Mantienen costo mínimo

Identifica cualquier caso de sobreingeniería.

---

# ENTREGABLES OBLIGATORIOS

Genera y guarda DOS NUEVOS ARCHIVOS.

## Archivo 1

docs/Auditoria-Estrategica-Revisada-Opus.md

Debe contener:

* Resumen ejecutivo
* Hallazgos corregidos
* Hallazgos nuevos
* Riesgos ocultos
* Oportunidades detectadas
* Evaluación de las 9 iniciativas
* Recomendación arquitectónica final

Debe ser una auditoría completamente nueva, no un resumen.

---

## Archivo 2

docs/Roadmap-Revisado-Opus.md

Debe contener:

* Roadmap optimizado
* Prioridades revisadas
* Quick wins
* Iniciativas descartadas
* Iniciativas añadidas
* Sprints revisados
* Top 10 prioridades reales

Debe reemplazar conceptualmente el roadmap generado por Sonnet si encuentras una mejor alternativa.

---

# FORMATO DE TRABAJO

No implementes código.

No modifiques funcionalidades.

No cambies archivos productivos.

Solo:

1. Analiza.
2. Cuestiona.
3. Propón mejoras.
4. Genera los dos documentos nuevos.

Al finalizar, incluye una sección:

# Diferencias principales respecto a la auditoría de Sonnet

Explicando exactamente qué cambiaste y por qué.
