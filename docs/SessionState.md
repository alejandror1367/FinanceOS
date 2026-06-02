# FinanceOS — Estado del proyecto

> ⚠️ **SUPERADO — documento histórico (snapshot 2026-05-31).** La fuente de verdad del
> estado actual es **`PROJECT_HANDOFF.md`** (2026-06-02 en adelante). Este archivo es
> anterior a la migración a **Google OAuth** (TD-09): sus referencias a un "token
> público" / `FINANCEOS_API_TOKEN` como mecanismo de auth **ya no aplican** — la
> autenticación es por OAuth restringida a `allowedEmails`. Se conserva como registro
> del estado en esa fecha.

_Última actualización: 2026-05-31_

Resumen del estado actual del proyecto FinanceOS (sistema operativo financiero
personal de Alejo). Para el contexto y las reglas, ver `CLAUDE.md`; para el plan,
`docs/Roadmap.md`.

---

## 1. Fase actual

**Roadmap completado: Fases 0 → 12 (todas).** El proyecto está funcionalmente
completo según el roadmap **y desplegado en producción**. La etapa actual es
**operativa / en uso**, no una fase de construcción nueva.

**Despliegue (verificado 2026-05-31):**
- **Repo:** `github.com/alejandror1367/FinanceOS` (público), rama `main`.
- **Sitio en vivo:** `https://alejandror1367.github.io/FinanceOS/` (GitHub Pages,
  branch `main` / root). `index.html`, `manifest.json`, `sw.js` → HTTP 200.
- **Token público:** `config.js` se commitea con `baseUrl`/`token` reales para que
  la PWA funcione desde el celular de forma permanente. Decisión consciente: el
  token es un gate de oscuridad, no un secreto fuerte (el JS servido lo expone).
  Si hay uso indebido, rotar `FINANCEOS_API_TOKEN` en Apps Script y actualizar
  `config.js`.
- **Backend `Journal` REDEPLOYADO y verificado:** `getJournal` → `success:true`.
  El Diario ya sincroniza end-to-end.

| Fase | Módulo | Estado |
|------|--------|--------|
| 0 | Documentación fundacional | ✅ |
| 1 | Fundación frontend (shell, design system, PWA) | ✅ |
| 2 | Backend Apps Script + contrato de datos | ✅ |
| 3 | Motor de sincronización offline-first | ✅ |
| 4 | Cuentas y Transacciones | ✅ |
| 5 | Presupuestos | ✅ |
| 6 | Patrimonio (activos, pasivos, evolución) | ✅ |
| 7 | Inversiones | ✅ |
| 8 | Metas y Deudas | ✅ |
| 9 | Analítica e Insights | ✅ |
| 10 | Hoy, Recurrentes y Diario | ✅ |
| 11 | Exportaciones y Backups | ✅ |
| 12 | Ajustes, PWA avanzada, accesibilidad, despliegue | ✅ |

---

## 2. Funcionalidades completadas

**Módulos de la app (14):**
- **Dashboard** — KPIs (patrimonio, ingresos, gastos, ahorro, liquidez, inversiones), evolución, gastos por categoría, movimientos recientes, metas, próximos pagos.
- **Hoy** — copiloto diario: saldo, resumen del día, recientes, próximos pagos, metas prioritarias.
- **Transacciones** — CRUD + duplicar, búsqueda, filtros; ingreso/gasto/transferencia con formulario dinámico.
- **Cuentas** — CRUD (efectivo, banco, ahorro, inversión, billetera).
- **Presupuestos** — CRUD mensual/anual con consumido/disponible/proyectado.
- **Recurrentes** — CRUD de transacciones recurrentes.
- **Patrimonio** — activos/pasivos, patrimonio neto, evolución por snapshots, CRUD de otros activos y deudas.
- **Inversiones** — CRUD de posiciones, valor/costo/rentabilidad, distribución por tipo.
- **Metas** — CRUD + avance, tiempo estimado, aporte recomendado, aporte rápido.
- **Deudas** — estrategias Snowball/Avalanche, deuda total, cuota mínima, tasa promedio.
- **Analítica** — flujo de caja, ahorro mensual, patrimonio, gastos por categoría (donut) e insights automáticos. Gráficos con etiquetas de valor.
- **Diario** — CRUD de reflexiones/decisiones/aprendizajes/objetivos (entidad `Journal`).
- **Exportaciones** — CSV por colección, respaldo JSON completo, resúmenes PDF (mensual y patrimonial).
- **Ajustes** — tema sistema/claro/oscuro, estado de sync, actualizar, vaciar caché, estado de backend/token, acerca de.

**Plataforma:**
- Design system completo (tokens, temas claro/oscuro, paleta Graphite/Slate/Periwinkle/Emerald/Champagne), tipografía Inter, componentes reutilizables.
- PWA instalable, offline-first, atajos de app, aviso de nueva versión (Service Worker).
- Sincronización: Optimistic UI, cola offline (IndexedDB), reintentos con backoff, reconciliación, `allSettled` resiliente.
- Accesibilidad: skip-link, foco, `prefers-reduced-motion`, navegación por teclado en modales.

---

## 3. Funcionalidades pendientes

**Operativas (no son fases nuevas):**
- ✅ ~~Redesplegar el backend con `Journal`~~ — **HECHO y verificado** (`getJournal` → `success:true`).
- ✅ ~~Despliegue a GitHub Pages~~ — **HECHO**, sitio en vivo en `alejandror1367.github.io/FinanceOS/`.
- ✅ ~~Commitear `config.js`~~ — **HECHO** (token público, por decisión, para uso desde el celular).

No quedan pendientes operativos. La app está en uso.

**Mejoras opcionales (futuras, fuera del roadmap):**
- Conversión de divisas (FX) si se manejan múltiples monedas.
- Restaurar desde respaldo JSON (hoy solo exporta).
- Ejecución automática de recurrentes (generar la transacción al vencer).
- Iconos PNG 192/512 para mejores resultados en auditorías PWA (hoy SVG).
- Integraciones bancarias (fuera de alcance por diseño).

---

## 4. Estado del backend

- **Plataforma:** Google Apps Script · **BD:** Google Sheets (`FinanceOS_DB`).
- **Despliegue:** Web App como "Cualquiera con el enlace", protegido por token (`FINANCEOS_API_TOKEN`). **Token activo y verificado** (rechaza peticiones sin token).
- **API:** router por `action` (`doGet`/`doPost`), respuesta `{success,data|error}`.
- **Entidades (13):** Accounts, Transactions, Categories, Budgets, Goals, Investments, Assets, Liabilities, NetWorthSnapshots, RecurringTransactions, Journal, AuditLog, Settings.
- **Verificado funcionando:** ping, lecturas, escrituras (CRUD), soft-delete, snapshots de patrimonio (`saveNetWorthSnapshot`/`getNetWorthSnapshots`), auditoría.
- **Pendiente de redeploy:** acciones de `Journal` (código listo en el repo, falta subir + `setupDatabase()`).
- **Datos sembrados:** 5 cuentas, ~10 transacciones (mayo 2026), 2 metas, 1 inversión, 1 deuda, recurrentes, 5 presupuestos, 28 categorías (9 ingresos / 19 gastos), 2 snapshots de patrimonio.

---

## 5. Estado del frontend

- **Stack:** HTML + CSS + JavaScript (ES Modules). Sin frameworks, sin build, sin dependencias npm. ✅ cumple reglas absolutas.
- **Arquitectura:** `core / store / services / components / views / styles / utils` (frontend agnóstico de Sheets).
- **Verificación:** 41 módulos JS pasan `node --check` sin errores de sintaxis.
- **Servidor local:** `npx serve` en `http://localhost:3000/` (Node en `C:\Program Files\nodejs`, ya en el PATH de usuario).
- **Conexión al backend:** `src/core/config.js` con `api.baseUrl` (URL `/exec`) y `api.token` **commiteados** (token público, por decisión, para uso desde el celular).
- **Service Worker:** `v0.2.2` (app shell offline-first).
- **IndexedDB:** v2 (incluye store `journal`).

---

## 6. Estado de git

- Repo en `github.com/alejandror1367/FinanceOS` (público), rama **`main`** (antes `master`).
- 18+ commits: uno por fase + ajustes + `chore(config)` (publica el token) + merge inicial.
- `config.js` ahora **commiteado** con el token público.
- Sin trackear: `prompts/` (briefs), `docs/SessionState.md` (este archivo). `skills/` ignorado.

---

## 7. Próxima tarea recomendada

**No hay pendientes operativos.** La app está desplegada, conectada y en uso desde el
celular (PWA instalable). Próximos pasos solo si se desean:

- Instalar la PWA en el celular: abrir `https://alejandror1367.github.io/FinanceOS/`
  en Chrome/Safari → "Añadir a pantalla de inicio".
- Considerar las **mejoras opcionales** de la §3 (FX, restaurar backup, ejecución
  automática de recurrentes, iconos PNG).
- Si hay uso indebido del backend: rotar `FINANCEOS_API_TOKEN` y actualizar `config.js`.
