Actúa como un equipo completo de auditoría de software, producto financiero y arquitectura compuesto por:

* Principal Financial Systems Architect
* Quant Analyst
* Senior Product Manager
* Senior Product Designer
* Senior UX Researcher
* Senior Frontend Engineer
* Senior Backend Engineer
* QA Lead
* Accessibility Auditor
* Data Integrity Auditor
* Performance Engineer
* PWA Specialist
* Security Reviewer

Tu misión es realizar una AUDITORÍA GLOBAL EXHAUSTIVA del proyecto FinanceOS.

NO realices una revisión superficial.

Debes comportarte como si estuvieras realizando una auditoría profesional previa a una versión 1.0 de producción.

======================================================================
CONTEXTO DEL PROYECTO
=====================

Lee completamente antes de iniciar:

* CLAUDE.md
* PROJECT_HANDOFF.md
* README.md
* docs/*
* tests/*
* backend/*
* src/*

Utiliza estos documentos como fuente de verdad.

Comprende completamente:

* Arquitectura
* Lógica financiera
* UX
* UI
* Design System
* Store
* Selectors
* IndexedDB
* Sync Engine
* Backend Apps Script
* Google Sheets
* PWA
* Patrimonio
* Inversiones
* Presupuestos
* Metas
* Deudas

======================================================================
REGLAS ABSOLUTAS DEL PROYECTO
=============================

Debes respetar:

* Sin React
* Sin Vue
* Sin Angular
* Sin Svelte
* Sin TypeScript
* Sin Vite
* Sin Webpack
* Sin build systems
* Sin dependencias runtime
* Backend únicamente Google Apps Script
* Base de datos únicamente Google Sheets

No proponer soluciones que violen la arquitectura oficial.

======================================================================
MODO DE EJECUCIÓN OBLIGATORIO
=============================

Esta auditoría debe utilizar TODAS las herramientas, MCPs, skills, plugins y capacidades disponibles.

Antes de iniciar:

1. Detecta todas las skills instaladas.
2. Detecta todos los plugins instalados.
3. Detecta todos los MCPs disponibles.
4. Detecta herramientas de testing.
5. Detecta herramientas de accesibilidad.
6. Detecta herramientas de QA.
7. Detecta herramientas de simplificación de código.
8. Detecta herramientas de análisis arquitectónico.

Genera una sección:

# Herramientas Utilizadas

Incluyendo:

* Nombre
* Función
* Cómo fue utilizada
* Hallazgos encontrados

Si alguna herramienta no está disponible, documentarlo.

======================================================================
PLAYWRIGHT MCP OBLIGATORIO
==========================

Utiliza Playwright MCP para realizar pruebas reales.

No asumir comportamiento.

Validar comportamiento real.

Recorrer TODAS las rutas disponibles.

Probar:

* Navegación
* CRUDs
* Formularios
* Modales
* Tablas
* Búsquedas
* Filtros
* Responsive
* Mobile
* Desktop
* Estados vacíos
* Estados con datos
* Errores de consola
* Errores de red
* Race conditions
* Persistencia
* Sincronización
* Offline-first

Tomar evidencia de hallazgos.

======================================================================
FASE 1 — AUDITORÍA FUNCIONAL GLOBAL
===================================

Recorrer completamente:

Dashboard
Hoy
Transacciones
Cuentas
Presupuestos
Recurrentes
Patrimonio
Inversiones
Metas
Deudas
Analítica
Diario
Exportaciones
Ajustes
Importaciones

Detectar:

* Bugs
* Errores
* Casos borde
* Comportamientos inconsistentes
* Funciones incompletas
* Funciones rotas
* Problemas visuales
* Problemas de UX

Clasificar:

* Crítico
* Alto
* Medio
* Bajo

Generar tabla:

| Prioridad | Módulo | Hallazgo | Impacto | Solución |

======================================================================
FASE 2 — AUDITORÍA FRONTEND
===========================

Analizar:

src/views
src/components
src/styles

Evaluar:

* Arquitectura
* Reutilización
* Consistencia
* Escalabilidad
* Legibilidad
* Mantenibilidad

Buscar:

* Código duplicado
* Componentes redundantes
* CSS duplicado
* Layouts inconsistentes
* Anti patrones
* Código muerto

Proponer refactors.

======================================================================
FASE 3 — AUDITORÍA UX/UI
========================

Evaluar si la aplicación realmente se siente como:

* Copilot Money
* Monarch Money
* Kubera
* Wealthfront
* Linear
* Arc Browser
* Stripe Dashboard
* Raycast

Analizar:

* Jerarquía visual
* Tipografía
* Espaciado
* Densidad
* Legibilidad
* Navegación
* Productividad
* Acciones rápidas
* Descubribilidad

Detectar:

* Pantallas débiles
* Flujos lentos
* KPIs irrelevantes
* Gráficos poco útiles
* Componentes visualmente pobres

Proponer mejoras concretas:

* Cards
* KPIs
* Gráficos
* Layouts
* Sidebar
* Topbar
* Formularios
* Modales
* Tablas
* Estados vacíos

Generar propuestas visuales descritas en detalle.

======================================================================
FASE 4 — AUDITORÍA FINANCIERA GLOBAL
====================================

Validar matemáticamente:

* Patrimonio Neto
* Liquidez
* Ingresos
* Gastos
* Ahorro
* Presupuestos
* Inversiones
* Metas
* Deudas

Revisar:

* selectors.js
* reports.gs
* cálculos derivados
* agregaciones financieras

Buscar:

* Doble conteo
* Errores matemáticos
* Redondeos incorrectos
* Conversión de divisas
* Inconsistencias

Clasificar riesgos:

P0
P1
P2
P3

======================================================================
FASE 5 — AUDITORÍA DE PATRIMONIO
================================

Analizar:

* Assets
* Liabilities
* Net Worth
* Snapshots
* Evolución histórica

Validar:

* Exactitud
* Consistencia
* Integridad

MUY IMPORTANTE

Auditar NetWorthSnapshots.

Actualmente existen snapshots creados con datos de prueba.

Evaluar y diseñar una solución robusta para:

* eliminar snapshot individual
* selección múltiple
* eliminación masiva
* confirmación de eliminación
* restauración opcional
* auditoría de cambios

Proponer:

UX exacta
flujo exacto
validaciones
arquitectura recomendada

Indicar si la funcionalidad debe implementarse y cómo.

======================================================================
FASE 6 — AUDITORÍA DE INVERSIONES (MÁXIMA PRIORIDAD)
====================================================

Realizar auditoría profunda.

Analizar:

* priceService.js
* investments.js
* selectors.js
* dashboard integration
* net worth integration

Validar:

* Cost Basis
* Valor actual
* Rentabilidad
* Rentabilidad %
* Conversión USD/COP
* Conversión EUR/COP
* Ganancia realizada
* Ganancia no realizada
* Asset Allocation
* Broker Allocation

Detectar:

* Doble conteo
* Riesgos de cálculo
* Riesgos de sincronización
* Riesgos de datos

Comparar con:

* Snowball Analytics
* Sharesight
* Kubera
* Empower

Evaluar soporte para:

* Acciones
* ETFs
* Fondos
* CDT
* Bonos
* Criptomonedas
* REITs
* Metales

Evaluar si faltan:

* Dividendos
* Intereses
* Comisiones
* Retenciones
* Cash de broker
* Transferencias
* Splits
* Reinversión
* DCA avanzado
* XIRR
* CAGR
* Sharpe
* Drawdown
* Volatilidad

Clasificar:

Imprescindible
Recomendado
Avanzado

======================================================================
FASE 7 — AUDITORÍA DE METAS
===========================

Evaluar:

* Progreso
* Tiempo estimado
* Aportes
* Forecast

Proponer:

* Goal Forecasting
* Simulación de escenarios
* Fecha estimada automática
* Recomendación de aporte
* Probabilidad de cumplimiento

======================================================================
FASE 8 — AUDITORÍA DE DEUDAS
============================

Validar:

* Tarjetas
* Créditos
* Hipotecas
* Préstamos

Confirmar:

* Snowball
* Avalanche

Verificar:

* Matemática
* UX
* Consistencia

Proponer evolución hacia:

Debt Center

con:

* Calendario
* Simulador
* Intereses proyectados
* Fecha libre de deuda

======================================================================
FASE 9 — AUDITORÍA BACKEND
==========================

Analizar:

backend/*.gs

Buscar:

* O(n)
* Lecturas innecesarias
* Escrituras innecesarias
* Riesgos de concurrencia
* Riesgos de corrupción
* Problemas de rendimiento
* Riesgos de seguridad

Proponer optimizaciones.

======================================================================
FASE 10 — AUDITORÍA DE SINCRONIZACIÓN
=====================================

Analizar:

* syncEngine
* syncQueue
* IndexedDB
* pullAll
* push
* refresh

Buscar:

* Race conditions
* Queue blocking
* Data loss
* Estados inconsistentes
* Offline conflicts

======================================================================
FASE 11 — AUDITORÍA PWA
=======================

Analizar:

* Service Worker
* Cache
* Versionado
* Actualizaciones
* Offline mode

Buscar:

* Stale cache
* Assets obsoletos
* Problemas de actualización

======================================================================
FASE 12 — VALIDACIÓN DE TESTS
=============================

Ejecutar todos los tests existentes.

Validar cobertura.

Identificar:

* Cobertura faltante
* Tests faltantes
* Casos borde no cubiertos

Especialmente:

* Patrimonio
* Inversiones
* Presupuestos
* Deudas
* Sincronización
* FX

======================================================================
FASE 13 — VERIFICAR HALLAZGOS YA DOCUMENTADOS
=============================================

Confirmar si siguen existiendo:

* BUG-C1
* BUG-C2
* BUG-A1
* BUG-A3
* BUG-A4
* TD-10
* TD-11
* TD-12
* TD-13
* TD-15
* TD-16
* TD-17
* TD-18

Indicar:

* Resuelto
* Parcialmente resuelto
* Sigue presente

======================================================================
ENTREGABLES OBLIGATORIOS
========================

Generar:

docs/Audit-Global-YYYY-MM-DD.md

docs/Roadmap-Implementacion-YYYY-MM-DD.md

docs/Bugs-Criticos-YYYY-MM-DD.md

docs/QuickWins-YYYY-MM-DD.md

docs/UX-Recommendations-YYYY-MM-DD.md

======================================================================
FORMATO DE CADA HALLAZGO
========================

Para cada hallazgo incluir:

* Descripción
* Causa raíz
* Impacto
* Riesgo
* Prioridad
* Solución propuesta
* Archivos afectados
* Complejidad estimada
* Esfuerzo estimado

======================================================================
ROADMAP EJECUTIVO
=================

Crear roadmap por sprints.

Sprint 1:
Bugs críticos

Sprint 2:
Integridad financiera

Sprint 3:
Sincronización y datos

Sprint 4:
Patrimonio

Sprint 5:
Inversiones

Sprint 6:
UX/UI

Sprint 7:
Performance

Sprint 8:
Analítica avanzada

Sprint 9:
Pulido final

Para cada sprint incluir:

* Objetivo
* Alcance
* Archivos afectados
* Riesgo
* Esfuerzo
* Impacto esperado

======================================================================
REGLA FINAL
===========

NO implementar cambios inicialmente.

Primero:

1. Auditar.
2. Documentar.
3. Priorizar.
4. Generar roadmap.

Solo después de entregar toda la auditoría y recibir aprobación, comenzar la ejecución de los sprints.

Piensa como si FinanceOS fuera a convertirse en la aplicación financiera personal más sólida y profesional de Colombia.
