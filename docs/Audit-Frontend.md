# Auditoría de Frontend / Design System — FinanceOS

**Rol:** Frontend Principal Engineer
**Fecha:** 2026-05-31
**Alcance:** 5 hojas CSS (~33 KB) + componentes JS (`ui.js`, `shell.js`, `charts.js`, `forms.js`, `modal.js`)
**Marco a11y:** WCAG 2.2 AA (skill `principle-accessibility`).
**Método:** revisión de `tokens.css`, `themes.css`, `base.css`, `layout.css`, `components.css`, componentes UI, y barrido de estilos hardcoded / inline.

> Documento de solo lectura. No modifica código. Complementa `docs/Audit.md` (arquitectura) y `docs/Audit-Financiero.md` (cálculos) con foco en Design System. Reglas: `CLAUDE.md`.

---

## Veredicto

El Design System tiene una **arquitectura de tokens ejemplar** (2 capas: primitivos → semánticos, y la UI consume **solo** semánticos — verificado: cero colores hardcoded en CSS de componentes, cero `!important` salvo el reset de impresión). El theming, el responsive y el uso de `tabular-nums` son de calidad senior. Los problemas reales son **3 brechas que rompen promesas del DS** (tipografía, accesibilidad de gráficos y de formularios) y **redundancias menores** de componentes. La base es sólida; lo crítico es de *entrega*, no de *estructura*.

| Dimensión | Nota | Comentario |
|---|---|---|
| Tokens | 🟢 9/10 | 2 capas limpias; UI solo usa semánticos. |
| Theming | 🟢 8/10 | Dark/light completos; algunos hex crudos en la capa semántica. |
| Responsive | 🟢 8/10 | `dvh`, `safe-area`, `@media (hover)`, 3 breakpoints coherentes. |
| Accesibilidad | 🟡 5/10 | Buena base, pero gráficos y labels rompen AA. |
| Rendimiento | 🟢 8/10 | CSS ligero (33 KB); blurs múltiples y re-render total como riesgos. |
| Consistencia visual | 🟡 7/10 | Dos sistemas de icon-button; variantes KPI duplicadas. |
| Escalabilidad | 🟡 6/10 | DS prometido > DS implementado; sin tokens de densidad. |

---

## 🔴 CRÍTICO

### DS-C1 · La tipografía Inter **nunca se carga** (la identidad del DS no se entrega)

`--font-sans: "Inter", system-ui, …` (`tokens.css:67`), pero **no hay `@font-face`, ni `<link>` a Google Fonts, ni `preconnect`, ni archivos `.woff` en el repo** (verificado). En la práctica, en casi todos los dispositivos la app cae a `system-ui`. CLAUDE.md exige explícitamente **"Tipografía: Inter"** con jerarquías Display/H1/…; esa promesa premium **no se cumple**. Toda la escala tipográfica está afinada (tracking negativo, pesos) para Inter y se renderiza con otra fuente.

**Fix:** `@font-face` con Inter self-hosted (`.woff2`, coherente con "sin dependencias npm" y offline-first PWA) + `font-display: swap` + `preload` del peso 400/600.

### DS-C2 · Gráficos sin alternativa textual → analítica invisible a lectores de pantalla (WCAG 1.1.1)

`LineChart` y `Donut` (`charts.js`) emiten `role="img"` **sin `aria-label` ni `<title>`**; `BarChart` (`ui.js:73`) solo pone `title` (tooltip) por barra, sin resumen. Un lector de pantalla anuncia "imagen" vacía. **Todo el módulo de Analítica + la evolución de patrimonio + la distribución de inversiones son inaccesibles.**

**Fix:** `aria-label` con resumen (p. ej. "Flujo de caja últimos 6 meses; ingreso máx X, gasto máx Y") y/o tabla `sr-only` equivalente.

### DS-C3 · Labels de formulario no asociados — defecto en la **primitiva** `field()` (WCAG 1.3.1 / 4.1.2)

`forms.field()` pinta `<label>` con texto pero **sin `for`/`id`**; el control es hermano y solo lleva `aria-label = name` (el nombre máquina: "accountId", "amount"). Como `field()` es la primitiva de **todos** los formularios, el defecto se propaga a cuentas, transacciones, presupuestos, metas, inversiones, deudas. (Causa raíz de I-5 en `docs/Audit.md`.)

**Fix:** generar `id` en el control y enlazar `label[for]`, o envolver el control dentro del `<label>`.

---

## 🟠 IMPORTANTE

### DS-I1 · Dos sistemas de botón-icono redundantes

`.icon-btn` (32×32, en filas/acciones) y `.btn--icon` (38×38, en topbar). Dos fuentes de verdad para el mismo patrón → tamaños y estados hover divergentes. **Consolidar en uno con variantes de tamaño.**

### DS-I2 · Variantes de KPI duplicadas

En `components.css`: `.kpi--emerald` ≡ `.kpi--positive` (idénticas) y `.kpi--accent` ≡ `.kpi--info` (mismo mapeo en ambos temas). 4 reglas → 2. Ruido y riesgo de drift.

### DS-I3 · *Touch targets* densos en las acciones de fila (WCAG 2.5.8)

`.icon-btn` 32×32 con `gap: 2px` y 3 acciones juntas (editar/duplicar/borrar) en cada fila del ledger. Superan el mínimo AA (24px) pero quedan **muy por debajo del cómodo 44px** y muy juntos → riesgo de *mis-tap* en móvil sobre operaciones destructivas. Aumentar área o separación en táctil.

### DS-I4 · Foco de input con halo demasiado tenue (WCAG 2.4.11)

`.input:focus { outline: none; box-shadow: 0 0 0 3px var(--accent-bg) }` (`components.css:228`). `--accent-bg` es `rgba(…,0.12–0.14)` → halo muy sutil, probablemente **<3:1** contra el fondo del campo. (Confirma I-6 de `docs/Audit.md`, aquí localizado en la primitiva.) Usar `--accent`/`--focus-ring` sólido.

### DS-I5 · El DS prometido es mayor que el implementado (+ control muerto)

CLAUDE.md lista como base: Drawer, Bottom Sheet, **Command Palette**, **Search Box**, Tabs, Dropdown, Context Menu — **ninguno existe**. Además el botón **"Buscar"** de la topbar (`shell.js:64`) no tiene handler → **control muerto** que promete búsqueda inexistente. Decidir: implementarlos o retirarlos del DS y del topbar.

### DS-I6 · `exports.js` genera CSS hardcoded fuera del DS

El PDF se arma con HTML+CSS embebido con hex crudos (`#111`, `#ddd`, `#666`, `#eee`) y `px`. Aceptable como *print stylesheet* aislado, pero **no respeta tokens ni dark mode** y duplica estilos. Documentarlo como hoja de impresión intencional y, si crece, derivar de tokens.

---

## 🟢 MEJORA FUTURA

- **DS-MF1 ·** `themes.css` mezcla referencias a primitivos con **hex crudos** (`--bg-surface-2: #1E2530`; el tema claro es casi todo hex). Rompe la trazabilidad de la paleta; idealmente semántico → primitivo siempre.
- **DS-MF2 ·** Sin **tokens de densidad/escala**: tamaños fijos. Para crecer en módulos/tablas densas convendría una escala configurable.
- **DS-MF3 ·** Charts con `viewBox` fijo (640×210) y `font-size:11` **hardcoded en el SVG**: no escalan con el zoom de texto del usuario (a11y) y las etiquetas de valor pueden solaparse en móvil.
- **DS-MF4 ·** `--grid--kpi` `minmax(220px)` + `.kpi--hero { grid-column: span 2 }`: en viewports intermedios el *span 2* sobre `auto-fill` puede dejar huecos. Edge visual.
- **DS-MF5 ·** Utilidades de spacing incompletas (solo `mt-2`/`mt-4`); las vistas recurren a clases ad-hoc/inline. Completar la escala utilitaria.
- **DS-MF6 ·** Rendimiento: `backdrop-filter: blur` en topbar + bottom-nav + modal simultáneos (coste GPU en gama baja) y **re-render completo de la vista** ante cualquier cambio del store (ver `docs/Audit.md` MF-1). Considerar `contain` / `content-visibility`.
- **DS-MF7 ·** 5 `<link>` CSS separados (33 KB): correcto sin *build*; con HTTP/2 es aceptable, pero podría reducirse el *render-blocking*.

---

## Tabla resumen

| ID | Área | Tipo | Severidad |
|----|------|------|-----------|
| DS-C1 | Tipografía Inter no cargada | Identidad/DS incumplido | 🔴 |
| DS-C2 | Charts sin texto alternativo | A11y (1.1.1) | 🔴 |
| DS-C3 | Labels no asociados (`field()`) | A11y (1.3.1/4.1.2) | 🔴 |
| DS-I1 | Dos sistemas icon-button | Redundancia | 🟠 |
| DS-I2 | Variantes KPI duplicadas | CSS duplicado | 🟠 |
| DS-I3 | Touch targets densos | A11y (2.5.8) | 🟠 |
| DS-I4 | Foco de input tenue | A11y (2.4.11) | 🟠 |
| DS-I5 | Componentes DS faltantes + botón muerto | Escalabilidad/consistencia | 🟠 |
| DS-I6 | CSS hardcoded en exports | Estilos fuera de tokens | 🟠 |
| DS-MF1–7 | Theming/densidad/charts/perf | Varios | 🟢 |

---

## Orden recomendado (por ROI)

1. **DS-C1** self-host Inter (recupera toda la identidad visual de golpe).
2. **DS-C3** arreglar `field()` (1 primitiva → toda la app conforme).
3. **DS-C2** `aria-label`/resumen en los 3 charts.
4. **DS-I2 / DS-I1** desduplicar variantes KPI e icon-buttons.
5. **DS-I4 / DS-I3** foco sólido + área táctil.
6. **DS-I5** decidir destino de los componentes prometidos.

---

## Lo que está bien (no tocar)

- Tokens en 2 capas (primitivos en `tokens.css`, semánticos en `themes.css`); la UI usa solo semánticos.
- Cero colores hardcoded en CSS de componentes; cero `!important` salvo `@media print`.
- Responsive con `100dvh`, `env(safe-area-inset)`, `@media (hover: hover)` para táctil, breakpoints 920/520/480.
- `@media (prefers-reduced-motion)` anula duraciones; `:focus-visible` global; skip-link; `.sr-only`.
- `font-variant-numeric: tabular-nums` consistente en todas las cifras monetarias.
- Charts SVG propios sin librerías, usando `CHART_PALETTE` con tokens `var(--…)`.

---

## Documentos relacionados

- `docs/Audit.md` — auditoría de arquitectura.
- `docs/Audit-Financiero.md` — auditoría de cálculos financieros.
- `CLAUDE.md` — fuente de verdad (Design System, tipografía, componentes base).
