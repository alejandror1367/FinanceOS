# FINANCEOS — AUDITORÍA ESTRATÉGICA + ROADMAP DE EVOLUCIÓN

Actúa como Principal Staff Engineer, Product Architect, UX Lead y Financial Systems Designer de FinanceOS.

Tu misión NO es implementar código.

Tu misión es realizar una auditoría completa del estado actual del proyecto, evaluar la viabilidad técnica de nuevas iniciativas, identificar impactos arquitectónicos, detectar riesgos y proponer un roadmap de evolución alineado con la visión de FinanceOS.

---

# DOCUMENTACIÓN OBLIGATORIA

Antes de responder debes leer y analizar completamente:

* CLAUDE.md
* PROJECT_HANDOFF.md
* docs/TechnicalDebt.md
* docs/Roadmap-Implementacion-2026-06-02.md
* docs/UX-Recommendations-2026-06-02.md
* docs/Audit-Global-2026-06-02.md
* docs/Audit-Funcional-2026-06-02.md
* docs/Audit-Financiero.md
* docs/Audit-Frontend.md
* docs/Audit-Backend.md

Si encuentras contradicciones entre documentos, considera como fuente de verdad:

1. PROJECT_HANDOFF.md
2. CLAUDE.md
3. Estado real del código
4. Auditorías

---

# INVARIANTES NO NEGOCIABLES

Todas las propuestas deben respetar:

* Vanilla JavaScript ES Modules
* Sin React
* Sin Vue
* Sin Angular
* Sin frameworks
* Sin build step
* Sin dependencias npm en runtime
* Arquitectura Services → Store → Views
* Offline-first
* PWA instalable
* Google OAuth
* GitHub Pages
* Google Apps Script
* Google Sheets
* Exportabilidad total
* Costo mínimo o cero
* App personal para Alejo

Si alguna propuesta viola un invariante debes indicarlo explícitamente.

---

# OBJETIVO GENERAL

Determinar:

1. Si cada propuesta tiene sentido dentro de FinanceOS.
2. Cómo debería implementarse.
3. Qué riesgos introduce.
4. Qué beneficios aporta.
5. En qué sprint debería ejecutarse.
6. Qué iniciativas NO deberían implementarse.

---

# PROPUESTAS A EVALUAR

## INICIATIVA 1 — AUTENTICACIÓN BIOMÉTRICA

Analizar:

### Seguridad

* Riesgo real actual
* Beneficio real para una PWA financiera

### Tecnología

* WebAuthn
* Passkeys
* Biometría Android
* Face ID
* Touch ID
* Windows Hello

### Compatibilidad

* OAuth actual
* PWA instalada
* Navegador móvil
* Navegador desktop
* Offline-first

### Preguntas a responder

* ¿Debe ser reemplazo o complemento de OAuth?
* ¿Debe ser obligatorio u opcional?
* ¿Cuál es la arquitectura recomendada?
* ¿Cuál es la complejidad real?

Entregable:

* Diseño técnico
* Riesgos
* Recomendación final

---

## INICIATIVA 2 — MARCAR DEUDA COMO PAGADA

Problema:

En Dashboard y Vista Hoy aparecen próximos pagos.

Muchas veces el usuario ya revisó ese pago y no desea seguir viéndolo.

NO se desea:

* modificar saldo
* generar transacción
* alterar deuda
* alterar tarjeta de crédito

Solo ocultar visualmente el recordatorio.

Analizar:

* UX ideal
* Persistencia
* Modelo de datos
* Experiencia móvil
* Experiencia desktop

Diseñar una solución elegante y coherente.

---

## INICIATIVA 3 — SOPORTE MULTICUENTA / MULTIUSUARIO

Evaluar múltiples enfoques:

### A

Múltiples perfiles independientes

### B

Múltiples usuarios

### C

Múltiples bases de datos

### D

Múltiples cuentas Google autorizadas

### E

Instancias completamente separadas

Analizar:

* Arquitectura
* Complejidad
* Riesgo
* Escalabilidad
* Costos
* Compatibilidad con Apps Script
* Compatibilidad con Google Sheets

Responder:

¿Cuál es la mejor estrategia para permitir que familiares usen FinanceOS sin mezclar datos?

---

## INICIATIVA 4 — ANALÍTICA E INSIGHTS

Auditar:

* Insights actuales
* Calidad de proyecciones
* Flujo de caja
* Utilidad real
* Precisión financiera

Detectar:

* Insights absurdos
* Proyecciones irreales
* Duplicidades
* Métricas poco útiles

Proponer:

### Nuevos insights

Ejemplos:

* Concentración de gastos
* Tendencias
* Liquidez
* Cobertura financiera
* Alertas
* Variaciones importantes

Priorizar por impacto.

---

## INICIATIVA 5 — EXPERIENCIA FIRE

Auditar:

* Comprensión actual
* Descubribilidad
* UX
* Terminología

Objetivo:

Que un usuario sin conocimientos avanzados entienda:

* Qué es FIRE
* Cuánto falta
* Qué necesita hacer
* Cómo progresa

Proponer:

* Nuevas visualizaciones
* Tooltips
* Simuladores
* Indicadores
* Comparaciones

---

## INICIATIVA 6 — IMPORTACIÓN Y EXPORTACIÓN

Auditoría completa.

Revisar:

### Importación

* UX
* Robustez
* Casos borde
* Calidad del parsing
* Integridad financiera

### Exportación

* CSV
* JSON
* PDF

Evaluar:

* Compatibilidad
* Riesgos
* Experiencia usuario
* Escalabilidad

Proponer roadmap de mejoras.

---

## INICIATIVA 7 — RECOMENDACIONES DE INVERSIÓN CON IA

Analizar una nueva sección al final de Inversiones.

Objetivo:

Generar recomendaciones personalizadas utilizando:

* Portafolio actual
* Distribución
* Concentración
* Diversificación
* Riesgo

Evaluar:

### Datos

* Alpaca
* Yahoo Finance
* Alpha Vantage
* Twelve Data

### IA

* Gemini
* Claude
* OpenAI

### Casos de uso

* ETFs sugeridos
* Diversificación
* Exposición geográfica
* Exposición sectorial
* Concentración excesiva
* Falta de renta fija

IMPORTANTE:

Analizar riesgos regulatorios.

Determinar:

* Qué recomendaciones sí deberían darse
* Qué recomendaciones NO deberían darse

Proponer arquitectura compatible con:

* Apps Script
* GitHub Pages
* Offline-first
* Costos mínimos

---

## INICIATIVA 8 — CUENTAS REMUNERADAS

Contexto:

* Global66 → 10%
* RappiCuenta → 9%

Analizar cómo modelarlas.

Opciones:

* Cuenta bancaria
* Inversión
* Activo híbrido
* Producto de rendimiento

Evaluar:

* UX
* Modelo de datos
* Reportes
* Patrimonio
* Liquidez
* Automatización futura

Proponer la mejor solución.

---

## INICIATIVA 9 — SNAPSHOTS DE PATRIMONIO

Auditoría profunda.

Verificar:

* Qué captura actualmente
* Qué excluye
* Qué errores puede tener

Evaluar evolución hacia:

### Snapshot enriquecido

Guardar además:

* Patrimonio total
* Liquidez
* Inversiones
* Activos
* Pasivos
* Deudas

Y opcionalmente:

* Desglose por cuenta
* Desglose por inversión
* Desglose por categoría patrimonial

Objetivo:

Poder comparar históricamente:

* Qué cambió
* Cuánto cambió
* Por qué cambió

Analizar:

* Impacto en Google Sheets
* Impacto en IndexedDB
* Impacto en sincronización
* Compatibilidad con snapshots históricos

---

# FASE 1 — AUDITORÍA DE ESTADO ACTUAL

Para cada iniciativa:

Clasificar como:

* Ya existe
* Parcialmente existe
* No existe
* Existe pero necesita rediseño

Identificar:

* Archivos implicados
* Servicios implicados
* Selectores implicados
* Backend implicado

---

# FASE 2 — ANÁLISIS DE VIABILIDAD

Construir tabla:

| Iniciativa | Beneficio | Complejidad | Riesgo | ROI | Recomendación |

Explicar cada decisión.

---

# FASE 3 — DISEÑO DE ARQUITECTURA

Para cada iniciativa viable:

Definir:

* Arquitectura propuesta
* Flujo de datos
* Impacto en frontend
* Impacto en backend
* Impacto en IndexedDB
* Impacto en sincronización
* Impacto en OAuth
* Compatibilidad offline

NO escribir código.

---

# FASE 4 — QUICK WINS

Identificar mejoras:

* Menos de 30 minutos
* Menos de 2 horas
* Menos de medio día

Ordenadas por ROI.

---

# FASE 5 — ROADMAP ACTUALIZADO

Integrar las iniciativas dentro del roadmap existente.

No crear roadmap paralelo.

Distribuir entre:

* Sprint 5
* Sprint 6
* Sprint 7
* Sprint 8
* Sprint 9

Y crear:

* Sprint 10
* Sprint 11
* Sprint 12

solo si es estrictamente necesario.

Para cada sprint incluir:

* Objetivo
* Features
* Dependencias
* Riesgos
* Estimación
* ROI

---

# FASE 6 — ACTUALIZACIÓN DEL ROADMAP

Generar el bloque exacto que debe añadirse a:

docs/Roadmap-Implementacion-2026-06-02.md

Con formato listo para copiar y pegar.

---

# CRITERIOS DE CALIDAD

Antes de proponer cualquier trabajo:

* Verifica si ya existe.
* Verifica si ya fue implementado.
* Verifica PROJECT_HANDOFF.
* Verifica TechnicalDebt.
* Verifica el código actual.
* Evita duplicar funcionalidades.
* Evita sobreingeniería.
* Prioriza simplicidad.
* Prioriza ROI.
* Prioriza mantenibilidad.

NO IMPLEMENTES NADA.

NO ESCRIBAS CÓDIGO.

SOLO:

* Auditoría
* Arquitectura
* Roadmap
* Priorización
* Recomendaciones
* Plan técnico detallado.
