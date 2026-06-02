---
name: frontend-auditor
description: Auditar el frontend de FinanceOS — conformidad con el Design System (tokens, temas claro/oscuro, tipografía Inter), responsive/mobile, accesibilidad, y consistencia visual de las vistas Vanilla JS. Usar al revisar UI/UX, verificar uso de tokens vs. valores hardcoded, auditar dark mode, comprobar responsive, hacer un recorrido funcional de las rutas, o cuando se pida un "frontend audit". Complementa principle-accessibility con el contexto del DS del proyecto.
---

# Frontend Auditor — FinanceOS

Audita el frontend contra el Design System y la filosofía visual del proyecto
(premium, minimalista, estilo Linear/Stripe/Apple — ver `CLAUDE.md`). Trabaja sobre
Vanilla JS sin build. **No** modifiques código salvo que se pida; reporta y prioriza.

Carga también la skill **`principle-accessibility`** para la parte de a11y (WCAG 2.2 AA);
esta skill aporta el contexto específico del DS de FinanceOS.

## Cómo trabajar

1. Recorre las 15 rutas con **Playwright MCP** (`browser_navigate`, `browser_snapshot`,
   `browser_take_screenshot`), tema claro y oscuro, y viewport mobile (375×812) + desktop.
2. Cruza con la auditoría previa `docs/Audit-Funcional-2026-06-02.md` y `docs/Audit-Frontend.md`
   para no re-reportar lo ya conocido y detectar regresiones.
3. Reporta hallazgos priorizados. Las fechas crudas, KPIs en $0 y labels de mes ya
   tienen bugs documentados (BUG-C2, BUG-A1, BUG-A2) — verifica si persisten.

## Qué revisar (checklist específico de FinanceOS)

### Design System / tokens
- **Uso de tokens, no valores crudos.** Los estilos deben venir de `src/styles/tokens.css`
  (primitivos) → `themes.css` (semánticos). Marca cualquier hex/px hardcoded en JS o CSS.
  Excepción conocida y aceptada: el *print stylesheet* de `utils/export.js` (PDF) — TD-32.
- **Tipografía Inter** con jerarquías (Display/H1/H2/H3/Body/Caption). Verifica que cargue
  de verdad (hubo un hallazgo de que caía a `system-ui` — ver `Audit-Frontend.md`).
- **El color solo comunica significado** (Slate/Graphite/Emerald/Blue/Amber/Red). Marca
  color decorativo sin semántica.

### Temas
- Cambia claro/oscuro y verifica que **todos** los componentes respondan vía tokens
  semánticos, sin colores fijos que rompan en un tema.

### Responsive / mobile (es una PWA)
- Sidebar → BottomNav en mobile; topbar; modales como bottom-sheet.
- **Touch targets**: `.icon-btn` de 32px con gap 2px y 3 acciones/fila puede ser denso
  (TD-18). Mínimo recomendado 44×44px.
- Charts SVG: ¿responsive en altura? (hallazgo F-17 en Audit-Frontend).

### Componentes y consistencia
- Reutilización: Card, KpiCard, Modal, Toast, Badge, EmptyState, etc. desde `components/`.
  Marca UI ad-hoc que debería usar un componente existente.
- Estados: empty / loading (skeleton) / error presentes donde corresponde.
- Foco visible: `.input:focus` usaba `--accent-bg` a 14% — puede fallar contraste (TD-17).

### Datos mostrados
- Formato: `formatMoney`/`formatDate` siempre; nunca `Date.toString()` crudo (BUG-C2).
- Multimoneda: conversión USD/EUR→COP visible y correcta donde aplique.

## Formato del informe

Reusa la estructura de `docs/Audit-Funcional-2026-06-02.md`: tabla por severidad
(🔴/🟠/🟡/🟢) con `ID | Síntoma | Archivo | Fix sugerido | Esfuerzo`. Adjunta capturas
de Playwright. Distingue bugs nuevos de los ya catalogados.
