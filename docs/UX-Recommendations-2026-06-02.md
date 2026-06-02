# Recomendaciones UX/UI — FinanceOS
**Fecha:** 2026-06-02  
**Basado en:** Auditoría visual con Playwright MCP + análisis del código fuente  
**Referencia aspiracional:** Copilot Money · Monarch Money · Kubera · Wealthfront · Linear · Stripe Dashboard

---

## Evaluación general: ¿Se siente como las referencias?

### Lo que sí funciona bien (mantener)
- **Tipografía Inter + tokens CSS**: La jerarquía visual es correcta. H1/H2/Caption están diferenciados.
- **KPI Cards**: El patrón `label + value heroico + foot contextual` es correcto. Similar a Stripe Dashboard.
- **Dark mode tokens**: La dualidad light/dark con variables semánticas está bien implementada.
- **Sidebar organizativo**: Categorías "General / Patrimonio / Inteligencia / Sistema" son claras.
- **Módulo Deudas**: Panel de tarjeta rico (utilización, próximo corte, días urgentes con Badge) es excelente. Comparable a Monarch Money.
- **Inversiones**: DCA agrupado por ticker + expansión de compras individuales es profesional.
- **Sync pill**: Indicador de estado de sincronización en topbar es correcto.

### Gaps respecto a las referencias

| Gap | Referencia mejor | Impacto |
|---|---|---|
| Sin filtros globales de fecha | Copilot Money, Monarch | No puedo ver "Mayo 2026" en dashboard |
| Sin búsqueda global | Linear, Raycast | No hay Command Palette funcional |
| Densidad del sidebar muy alta en mobile | Arc, Linear | Dificulta navegación táctil |
| Sin sparklines en KPI Cards del dashboard | Copilot Money | KPIs sin tendencia visual |
| Gráficos de barras sin hover/tooltip | Stripe Dashboard | No puedo ver el valor exacto al hover |
| Sin modo "compacto" para tablas de transacciones | Linear | Listas largas sin virtualización |
| Formularios sin validación visual en tiempo real | Stripe Elements | Solo valida al submit |
| Sin confirmación optimista visual | Stripe | Las acciones no tienen feedback inmediato claro |

---

## Recomendaciones por módulo

---

### Dashboard

**Estado actual:** Funcional. KPIs correctos, gráfico de patrimonio, recientes, metas.  
**Problemas:**
1. **Gráfico de patrimonio vacío o con datos de prueba** — el BarChart muestra datos ficticios hasta que se tomen snapshots reales. Mostrar EmptyState más claro cuando hay < 2 snapshots válidos.
2. **KPIs sin tendencia inline** — Copilot Money muestra una mini sparkline debajo de cada KPI. Agregar `Trend(pct)` a todos los KPIs relevantes (liquidez vs mes anterior, gastos vs mes anterior).
3. **Score financiero sin breakdown** — El score 90/100 no explica sus componentes. Añadir tooltip o mini breakdown al hacer click.
4. **Sin acceso rápido por fecha** — Agregar selector de mes en el header del dashboard.

**Propuesta de layout mejorado:**
```
[Header: "Hola, Alejo · Junio 2026 ▼] [+ Nuevo movimiento]

[KPI: Patrimonio hero]  [KPI: Score] [KPI: Inversiones]
[KPI: Gastos ↓]  [KPI: Ingresos ↑] [KPI: Ahorro] [KPI: Liquidez]

[Evolución patrimonio — línea suave] [Gastos por categoría — donut]
[Movimientos recientes]  [Metas + Próximos pagos]
```

---

### Transacciones

**Estado actual:** Funciona bien. Agrupación por fecha, filtros, búsqueda live.  
**Problemas:**
1. **Filtro de mes truncado visualmente** ("de 2026") — el input `type=month` se corta en la UI.
2. **Sin totales visibles de ingresos/gastos por el período filtrado** — solo muestra "neto".
3. **Sin agrupación por semana** — solo por día. Con muchas transacciones se vuelve largo.
4. **Sin indicador de categoría en el filtro** — las categorías no tienen ícono en el dropdown.

**Propuesta:**
- Añadir barra de totales: `Ingresos: +$4.236.000 · Gastos: -$411.000 · Neto: +$3.825.000`
- Categorías con ícono en el dropdown de filtro

---

### Inversiones

**Estado actual:** Muy bien implementado. DCA, cost basis, precios en vivo, FX.  
**Problemas menores:**
1. **Precio actual "US$1.064,10"** — en pantallas pequeñas, los números grandes se cortan.
2. **Distribución del portafolio** — la barra de progreso no es interactiva. Hacer clickable para ir a la sección.
3. **Sin gráfico de evolución** — no hay sparkline de precio histórico por posición.
4. **Métricas faltantes para presentar:** No hay XIRR/CAGR ni Sharpe ratio. Para el usuario actual esto puede no ser urgente pero sería P3.
5. **Dividendos**: Registrar como transacción de ingreso es correcto. Falta campo de retención en la fuente.

**Propuesta de mejora para positionCard:**
```
[TICKER] [Nombre]  [Badge tipo]  [Badge divisa]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Valor actual: US$87.96    Ganancia: +US$55.16 (+168%)
             ≈ $314.122 COP        Hoy: +2.76%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Shares: 0.082064  ·  Avg cost: US$396.79
[Ver compras] [+ Compra] [Vender] [Dividendo]
```

---

### Patrimonio

**Estado actual:** Sólido. Donut de composición es un plus excelente.  
**Problemas:**
1. **Sin gestión de snapshots** — no hay forma de eliminar snapshots individuales desde la UI. Con datos de prueba que distorsionan la historia, esto es urgente.
2. **Gráfico de barras sin valores en eje Y** — no se sabe qué monto representa cada barra.
3. **Evolución muestra solo las últimas 8 snapshots** — sin opción de ver todo el histórico.

**Propuesta para gestión de snapshots:**

Añadir en la tarjeta "Evolución del patrimonio" un botón "Gestionar" que abre un modal con:
```
HISTORIAL DE SNAPSHOTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
☐  31 may 2026  $1.389.926    [🗑]
☐  01 jun 2026  $44.300.000 ⚠️ [🗑]   ← marcado como atípico
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Eliminar seleccionados]  [Cancelar]
```
Con detección automática de outliers (valor > 10× el anterior o actual).

**Arquitectura recomendada para delete snapshot:**
- Frontend: `dataService.remove('netWorthSnapshots', id)` 
- Backend: `deleteNetWorthSnapshot_` + acción `deleteNetWorthSnapshot` en Code.gs
- Multi-select: array de IDs enviados a acción `batchDeleteSnapshots`

---

### Deudas

**Estado actual:** Excelente. El panel de tarjeta con utilización, fechas y badges urgentes es el mejor módulo visualmente.  
**Mejora propuesta:** Evolucionar hacia "Debt Center":
1. **Calendario de pagos** — vista mensual de todos los vencimientos
2. **Simulador de escenarios** — ¿qué pasa si pago $500k extra este mes?
3. **Comparación Snowball vs Avalanche** — tabla lado a lado con fechas de pago e intereses totales

---

### Metas

**Estado actual:** Funciona. El `goalForecast` es valioso.  
**Problemas:**
1. **Forecast usa ahorro del mes actual** — en día 2 del mes el ahorro es de solo 2 días de data, produciendo proyecciones irreales.
2. **Sin categorías de meta** — mezcla fondo de emergencia, viaje, retiro en la misma lista.
3. **Sin gráfico de progreso histórico** — no hay evolución del avance.

**Propuesta:** Usar el promedio de los últimos 3 meses para el forecast en lugar del mes actual.

---

### Analítica

**Estado actual:** Funcional pero limitado.  
**Problemas:**
1. **Insight "ahorrarás $57.375.000"** — absurdo en día 2 (TD-36 manifestado en insights).
2. **Solo 4 insights** — poco para la riqueza de datos disponible.
3. **Sin navegación temporal** — los gráficos muestran períodos fijos.
4. **Gráficos sin tooltips** — hover sobre una barra no muestra el valor.

**Insights adicionales recomendados:**
- "Tu mayor gasto fue en [Categoría] el [Fecha] (${Monto})"
- "Llevas [N] días sin registrar gastos en [Categoría]"  
- "Tu cuota de CC vence en [N] días. ¿Ya pagaste?"
- "La tasa de ahorro de este mes ([X]%) está [por encima/debajo] de tu promedio ([Y]%)"
- "Tienes [N] meses de gastos en liquidez" (cobertura)

---

### Vista Hoy

**Estado actual:** Buen copiloto diario.  
**Problema:** "Próximos pagos" está vacío aunque la tarjeta vence mañana (ver BUG-P2-4).  
**Mejora:** Fusionar vencimientos de CC con los recurrentes en la sección "Para hoy".

---

### Ajustes

**Estado actual:** Funcional.  
**Bug visual:** La sección "Apariencia" muestra "T..." — el label del tema se trunca.  
**Mejora:** En "Acerca de" mostrar el número de entidades en DB (N cuentas, N transacciones, etc.) para dar contexto de "peso" de los datos.

---

## Diseño visual: brechas vs referencias

### Lo que más aleja la app de Linear/Stripe/Copilot

1. **Sin micro-animaciones** — Las transiciones entre vistas son instantáneas. Agregar `transition: opacity 150ms` al montar vistas daría sensación de fluidez.

2. **Formularios sin validación inline** — Los campos muestran errores solo al hacer submit. Stripe muestra el error al perder foco (`blur`).

3. **Sin shortcuts de teclado** — Linear tiene `G D` para ir a Dashboard, `C` para nuevo ítem, etc. Agregar al menos `N` para nueva transacción.

4. **Modales sin escape de teclado bien probado** — El modal tiene focus trap pero no fue probado con Playwright en mobile.

5. **Tablas sin scroll horizontal en mobile** — La tabla de inversiones (positionCard) con muchas métricas puede desbordar.

6. **Sin Empty States suficientemente ricos** — Los estados vacíos son funcionales pero genéricos. Agregar ilustraciones o prompts más específicos al contexto del módulo.

---

## Puntuación UX/UI vs referencias

| Dimensión | Puntuación | Benchmark |
|---|---|---|
| Jerarquía visual | 8/10 | ✅ Tokens correctos |
| Tipografía | 8/10 | ✅ Inter bien implementada |
| Espaciado / densidad | 7/10 | 🟡 Algunos módulos apretados en mobile |
| Navegación | 7/10 | 🟡 Sin shortcuts, sin búsqueda global |
| Formularios | 6/10 | 🟡 Sin validación inline |
| Gráficos | 6/10 | 🟡 Sin tooltips, sin zoom temporal |
| Feedback de acciones | 7/10 | 🟡 Toast correcto pero sin animaciones |
| Accesibilidad | 7/10 | 🟡 WCAG mejoras aplicadas; falta ARIA en gráficos SVG propios |
| Mobile / Responsive | 7/10 | 🟡 PWA instalada; algunas tablas overflow |
| **Promedio** | **7.0/10** | |

**Conclusión:** La app está a nivel de un MVP de calidad alta. Para alcanzar la sensación de Copilot Money / Linear se necesitan principalmente: (1) micro-animaciones, (2) tooltips en gráficos, (3) filtros temporales globales, (4) validación inline de formularios, (5) gestión de snapshots.

---

*Generado por auditoría global 2026-06-02*
