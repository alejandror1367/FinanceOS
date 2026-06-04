Lee primero CLAUDE.md, PROJECT_HANDOFF.md, TechnicalDebt.md y el resto de la documentación relevante del proyecto antes de responder.

CONTEXTO

FinanceOS es una aplicación financiera personal privada.

Stack actual:
- Frontend: HTML + CSS + JavaScript ES Modules
- Sin frameworks
- Sin build step
- Sin dependencias npm en runtime
- GitHub Pages
- Google Apps Script
- Google Sheets
- IndexedDB
- OAuth Google
- PWA offline-first

Invariantes:
- Mantener JS vanilla
- Mantener arquitectura Services → Store → Views
- Mantener exportabilidad total
- Mantener costo cero o lo más cercano posible a cero
- No introducir infraestructura compleja ni costos recurrentes innecesarios

OBJETIVO

Quiero explorar cómo integrar:

1. Claude Live Artifacts
2. Claude como asistente financiero dentro de FinanceOS
3. Automatizaciones inteligentes
4. Análisis automático del portafolio
5. Seguimiento de inversiones
6. Insights financieros generados por IA
7. Simuladores financieros interactivos

REQUISITOS IMPORTANTES

- Priorizar soluciones gratuitas.
- Evitar servicios pagos si existe una alternativa gratuita razonable.
- Aprovechar al máximo la infraestructura actual.
- No romper la arquitectura existente.
- No convertir FinanceOS en un SaaS.
- Seguir siendo una aplicación personal de un único usuario.
- Mantener privacidad de los datos financieros.

ANALIZA

1. ¿Qué es técnicamente posible hacer hoy con Claude Artifacts y Claude Live?

2. ¿Qué integraciones serían posibles sin modificar demasiado FinanceOS?

3. ¿Qué integraciones requerirían cambios arquitectónicos?

4. ¿Cómo conectar Claude con los datos de FinanceOS?

5. ¿Qué información debería exponerse a Claude?
   - Dashboard
   - Inversiones
   - Transacciones
   - Metas
   - Patrimonio
   - Deudas
   - Analítica

6. ¿Cómo hacerlo de forma segura?

7. ¿Cómo hacerlo con costo cero o casi cero?

8. ¿Qué funcionalidades tendría más sentido implementar primero?

PROPÓN

Genera una matriz comparativa:

| Opción | Complejidad | Costo | Valor | Riesgo |
|----------|----------|----------|----------|----------|

Incluye alternativas como:

A. Artifact externo conectado a FinanceOS
B. Chat IA dentro de FinanceOS
C. Agente de inversiones
D. Reportes automáticos
E. Dashboard IA
F. Simulador FIRE
G. Analista de dividendos
H. Asistente financiero conversacional

DESPUÉS

Diseña una hoja de ruta en fases:

Fase 1 (quick wins)
Fase 2
Fase 3
Fase 4

Para cada fase indica:

- Qué construir
- Dónde integrarlo
- Cambios necesarios en frontend
- Cambios necesarios en Apps Script
- Cambios necesarios en Google Sheets
- Coste estimado
- Beneficio esperado

Finalmente responde:

"Si FinanceOS fuera mi proyecto, estas serían las 3 implementaciones de IA que haría primero y por qué."

Sé crítico.
No asumas que Claude es la mejor solución.
Compara también alternativas como Gemini, OpenAI, MCP, agentes locales y generación de reportes sin IA.
