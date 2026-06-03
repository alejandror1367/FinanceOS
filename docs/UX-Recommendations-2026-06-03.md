# Recomendaciones UX/UI — FinanceOS

**Fecha:** 2026-06-03 · **HEAD:** `c778e25` · Derivado de la auditoría de `frontend-auditor`. Complementa `Audit-Global-2026-06-03.md`.

> Pre-1.0, app personal con filosofía Linear/Arc/Stripe. Foco: accesibilidad WCAG 2.2 AA, consistencia del Design System y comportamiento responsive. La **validación visual en vivo (responsive 375px, dark/light, charts)** quedó pendiente de Playwright en esta sesión.

---

## 1. Accesibilidad (WCAG 2.2 AA) — prioridad alta

| Tema | Hallazgo | Recomendación | ID |
|---|---|---|---|
| Contraste | `--text-tertiary` 3.1–3.5:1 en captions, `th`, hints ⌘K, métricas de inversión | Subir luminancia del token (dark y light); verificar sobre las 4 superficies. **Una corrección, toda la app conforme.** | FE-002 |
| Nombre accesible | `aria-label` técnico ("amount", "categoryId") sobrescribe el `<label>` visible | Quitar `aria-label:name` de los controles de `forms.js` (ya hay `label[for]`) | FE-003 |
| Movimiento | `prefers-reduced-motion` no detiene shimmer/spin/pulse/modal-pop | Bloque `@media reduce` que anule duraciones de keyframes | FE-004 |
| Progressbar | `role=progressbar` sin rango ni nombre | `aria-valuemin/max` + `aria-label` en metas/presupuestos/CC | FE-007 |
| Foco en diálogos | `confirmDialog` no mueve el foco al diálogo | Enfocar botón submit / contenedor `tabindex=-1` | FE-006 |
| Charts | `<title>` SVG solo por hover de ratón; sin equivalente por teclado | Tabla `sr-only` con valores por serie/segmento (AA pleno) | FE-011 |

## 2. Charts y datos — robustez visual

- **Escape de etiquetas (FE-001):** una categoría/cuenta/ticker con `&<>"` rompe el render del Donut/LineChart. Escapar antes de interpolar en SVG. *(También es un hallazgo de seguridad: markup almacenado.)*
- **Responsive de charts (FE-005):** `height` y `font-size` fijos → etiquetas de eje X se solapan en móvil (Analítica, Patrimonio). Rotar/decimar labels según `n`; tamaño de texto relativo al viewBox; permitir altura responsiva vía `aspect-ratio`.

## 3. Design System — consistencia

| Hallazgo | Recomendación | ID |
|---|---|---|
| `font-size:10px/11px` literales en métricas de inversión/CC | Reemplazar por `var(--fs-micro)` | FE-009 |
| `color:#fff` hardcoded en `.preset-chip:hover` | `var(--accent-contrast)` | FE-010 |
| `select` con flecha custom puede solaparse con texto largo | `padding-right` suficiente; unificar indicador con token | FE-008 |
| Label "Apariencia" truncado como "T..." en Ajustes | Ajustar ancho/wrap del label | FE-013 |

## 4. Navegación y descubribilidad

- **Bottom-nav móvil (FE-012):** fija a 5 rutas (Dashboard, Hoy, Transacciones, Patrimonio, Ajustes). Inversiones y Presupuestos solo se alcanzan en móvil vía menú o ⌘K. Considerar un ítem "Más" o priorizar la barra por uso real. El **Command Palette (⌘K)** ya cubre el acceso rápido en desktop — verificar su descubribilidad en móvil (botón lupa).

## 5. Lo que ya está bien (no tocar)

- Tipografía **Inter** carga correctamente (TD-06 resuelto).
- Charts con `role="img"` + `aria-label` + `<title>` (TD-07 resuelto en la base).
- Labels de formulario asociados vía `field()` con `for/id` (TD-08 — salvo el matiz FE-003).
- `:focus-visible` global con ring de foco (TD-17 resuelto).
- Touch targets de 44px en acciones (TD-18 resuelto).
- Command Palette (⌘K / '/' / '?') y validación inline en formularios — entregados en Sprint 6.

## 6. Pendiente de validación en vivo (Playwright)

Re-lanzar `playwright-reviewer` para confirmar/medir:
- Recorrido de las 15 rutas sin errores JS de consola (re-verificación post-Sprint 5/6).
- Responsive real a 375×812 (solape de ejes en charts, bottom-nav, modales).
- Temas claro/oscuro en todas las vistas.
- Command Palette y validación inline en navegador real.
- Bugs P3 conocidos: proyección de presupuesto días 1–3 (TD-36), truncamiento "Apariencia".
