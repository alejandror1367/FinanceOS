# Architecture — FinanceOS

**Documento de Arquitectura Técnica**
Versión 1.0 · Fase 0 (Documentación fundacional)

> Consistente con `CLAUDE.md`. Las reglas absolutas condicionan cada decisión aquí descrita.

---

## 1. Principios arquitectónicos

1. **Separación estricta de responsabilidades.** Nunca mezclar UI, lógica financiera, persistencia y sincronización.
2. **Frontend agnóstico de la base de datos.** El frontend no conoce Google Sheets; toda interacción ocurre vía API de Apps Script. Esto permite migrar de BD sin reescribir el frontend.
3. **Offline-first.** Las acciones se aplican primero localmente (Optimistic UI) y luego se sincronizan.
4. **Vanilla y sin build.** HTML + CSS + JavaScript con ES Modules, ejecutándose directamente en el navegador. Sin frameworks, sin TypeScript, sin bundlers, sin dependencias npm en runtime.
5. **Modularidad.** Código organizado por capas con contratos claros entre ellas.

---

## 2. Stack oficial

| Capa | Tecnología |
|------|------------|
| Frontend | HTML, CSS, JavaScript (ES Modules) |
| Backend | Google Apps Script |
| Base de datos | Google Sheets (`FinanceOS_DB`) |
| Hosting | GitHub Pages |
| App | PWA instalable, offline-first |
| Persistencia local | IndexedDB (principal) + localStorage (preferencias/UI) |

---

## 3. Vista de capas (alto nivel)

```
┌──────────────────────────────────────────────────────────────┐
│                        NAVEGADOR (PWA)                         │
│                                                                │
│  ┌───────────┐   ┌───────────┐   ┌──────────┐   ┌──────────┐  │
│  │   Views   │ → │ Components│   │  Styles  │   │  Utils   │  │
│  └─────┬─────┘   └───────────┘   └──────────┘   └──────────┘  │
│        │                                                       │
│  ┌─────▼─────────────────────────────────────────────────┐    │
│  │                      Store (estado)                    │    │
│  └─────┬───────────────────────────────────┬─────────────┘    │
│        │                                   │                   │
│  ┌─────▼─────┐                       ┌─────▼─────────────┐     │
│  │  Services │ ← lógica financiera   │  Persistencia     │     │
│  │           │                       │  local (IndexedDB)│     │
│  └─────┬─────┘                       └───────────────────┘     │
│        │                                                       │
│  ┌─────▼───────────────────────────────────────────────┐      │
│  │        Sync Engine (cola offline + reconciliación)   │      │
│  └─────┬───────────────────────────────────────────────┘      │
│        │  HTTPS (action-based API)                            │
└────────┼──────────────────────────────────────────────────────┘
         │
┌────────▼──────────────────────────────────────────────────────┐
│                   GOOGLE APPS SCRIPT (Backend)                 │
│   doGet() / doPost()  →  router por `action`  →  servicios     │
│   Validación · Sanitización · Reglas de negocio · AuditLog     │
└────────┬──────────────────────────────────────────────────────┘
         │
┌────────▼──────────────────────────────────────────────────────┐
│              GOOGLE SHEETS — FinanceOS_DB (Datos)              │
│  Accounts · Transactions · Categories · Budgets · Goals · ...  │
└────────────────────────────────────────────────────────────────┘
```

---

## 4. Arquitectura frontend

Estructura modular bajo `src/`:

```
src/
├── core/         # bootstrap, router, ciclo de vida de la app, config global
├── store/        # estado de la aplicación (modelo en memoria) y selectores
├── services/     # lógica financiera y de dominio + cliente de API
├── views/        # vistas/pantallas (Dashboard, Hoy, Transacciones, ...)
├── components/   # componentes UI reutilizables (Card, Modal, Table, ...)
├── styles/       # design system: tokens, temas, tipografía, layout
└── utils/        # utilidades puras (fechas, formato, validación, ids)
```

### 4.1 Responsabilidades por capa

- **core/**: arranque de la app, registro del Service Worker, enrutamiento entre vistas, configuración global. No contiene reglas financieras.
- **store/**: única fuente de estado en memoria. Expone lectura (selectores) y mutaciones controladas. La UI se suscribe a cambios. No habla con la red ni con IndexedDB directamente.
- **services/**: lógica de dominio (cálculos de patrimonio, presupuestos, rentabilidad, estrategias de deuda) y el **cliente de API** hacia Apps Script. Orquesta persistencia local y sincronización.
- **views/**: composición de pantallas a partir de componentes y datos del store. No contienen lógica financiera ni acceso directo a red/persistencia.
- **components/**: piezas visuales reutilizables y sin estado de dominio (reciben props/datos y emiten eventos).
- **styles/**: design system (ver §8).
- **utils/**: funciones puras y deterministas, sin efectos secundarios.

**Regla de oro:** los datos fluyen `services → store → views`; las acciones del usuario fluyen `views → services` (nunca `views → red` ni `views → IndexedDB`).

---

## 5. Persistencia local

- **IndexedDB** es la **fuente local principal**: almacena entidades (cuentas, transacciones, etc.) y la **cola de sincronización**.
- **localStorage** se usa **solo** para: preferencias, configuración visual (tema) y estado de UI.

La app debe ser plenamente funcional leyendo de IndexedDB aunque no haya conexión.

---

## 6. Modelo de sincronización (offline-first)

Flujo de una mutación (crear/editar/eliminar):

1. **Optimistic UI**: la acción se aplica de inmediato en el store y en IndexedDB.
2. **Encolar**: la operación se agrega a una **cola offline** persistente (IndexedDB).
3. **Sincronización diferida**: el *Sync Engine* envía la operación a Apps Script cuando hay conexión.
4. **Reintentos automáticos**: ante fallo de red, se reintenta con backoff.
5. **Reconciliación**: la respuesta del backend (registro canónico con `id`, `updatedAt`) reemplaza el optimista; se resuelven conflictos por `updatedAt` (last-write-wins, salvo reglas específicas).
6. **Estado**: cada entidad puede marcar su estado de sync (p. ej. `pending`, `synced`, `error`) para la UI.

Garantías: ninguna acción se pierde por falta de conexión; la UI nunca se bloquea esperando a la red.

---

## 7. Contrato de API (Apps Script)

API REST ligera basada en `action`, expuesta mediante `doGet()` y `doPost()`.

- **Lecturas** → `doGet()` con `?action=...`
- **Escrituras** → `doPost()` con cuerpo JSON e `action`

### 7.1 Acciones (ejemplos)
```
getDashboard
getTransactions      createTransaction      updateTransaction      deleteTransaction
getBudgets           getGoals               getInvestments
getAccounts          getNetWorth            getReports
```
(El catálogo completo se define junto con cada módulo en su fase correspondiente.)

### 7.2 Formato de respuesta estándar
Éxito:
```json
{ "success": true, "data": {} }
```
Error:
```json
{ "success": false, "error": "" }
```

Todas las respuestas son **JSON**. El frontend nunca recibe estructuras propias de Sheets; recibe entidades de dominio normalizadas.

---

## 8. Design System (resumen técnico)

- **Tokens** en CSS (custom properties) para color, tipografía, espaciado, radios, sombras, z-index y duración de animaciones.
- **Temas** Light/Dark mediante atributo en la raíz (p. ej. `data-theme`), conmutando tokens.
- **Tipografía:** Inter con jerarquías Display / H1 / H2 / H3 / Body / Caption.
- **Color:** Slate, Graphite, Emerald, Blue, Amber, Red — semánticos (éxito, alerta, error, info, neutro).
- **Componentes base** (sin estado de dominio): Card, KPI Card, Data Table, Modal, Drawer, Bottom Sheet, Toast, Badge, Chart Container, Empty State, Skeleton Loader, Search Box, Command Palette, Tabs, Dropdown, Context Menu.

El detalle de tokens, accesibilidad y comportamiento de cada componente se desarrolla en la Fase 1.

---

## 9. PWA y offline

- **Manifest** para instalación (nombre, iconos, colores, display standalone).
- **Service Worker**: cacheo del *app shell* (HTML/CSS/JS/iconos) para arranque offline; estrategia *cache-first* para el shell y *network-first/stale-while-revalidate* para datos según convenga.
- **Offline-first**: el shell y los datos locales (IndexedDB) permiten operar sin conexión; el Sync Engine reconcilia al recuperar red.

---

## 10. Seguridad

Aplicación privada, de un solo usuario. Medidas proporcionales:

- **Validación de entradas** y **sanitización** en frontend y, de forma autoritativa, en Apps Script.
- **AuditLog**: registro de operaciones de escritura.
- **Backups exportables** (CSV/JSON) como red de seguridad.
- Sin sistemas empresariales innecesarios (sin IAM complejo, sin multi-tenant).

---

## 11. Estrategia de migración de base de datos

Como el frontend solo conoce el **contrato de API** (acciones + entidades JSON), la implementación de almacenamiento (hoy Google Sheets) está aislada en Apps Script. Migrar a otra BD en el futuro implica reescribir únicamente la capa de acceso a datos del backend, **sin cambios en el frontend**.

---

## 12. Decisiones y trade-offs

- **Sin frameworks/build:** máxima longevidad y control, a costa de construir manualmente router, store y componentes. Aceptado por las reglas absolutas y por priorizar estabilidad/mantenibilidad.
- **Sheets como BD:** simplicidad, cero costo y backups naturales, a costa de límites de volumen/latencia. Mitigado con IndexedDB local y sincronización diferida.
- **Apps Script como backend:** sin servidores que mantener, a costa de límites de ejecución de la plataforma. Mitigado con operaciones idempotentes y por lotes.

---

## 13. Documentos relacionados
- `docs/PRD.md` — requerimientos de producto.
- `docs/Database.md` — esquema detallado de Google Sheets.
- `docs/Roadmap.md` — fases de implementación.
