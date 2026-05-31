# Roadmap — FinanceOS

**Plan de Fases**
Versión 1.0 · Fase 0 (Documentación fundacional)

> Regla absoluta #7: trabajar por **fases pequeñas y verificables**; nunca implementar todo en una sola iteración. **No se avanza** a una fase sin aprobación explícita de la anterior. Consistente con `CLAUDE.md`.

---

## Principios de ejecución

- Cada fase entrega **archivos completos** y **verificables**, con instrucciones de prueba.
- Antes de codificar: explicar **qué** y **por qué**; mantener compatibilidad; no eliminar funcionalidad sin justificación.
- Cada fase define **criterios de salida** (Definition of Done). No se avanza sin cumplirlos y sin aprobación.
- El frontend **nunca** conoce Google Sheets; todo pasa por la API de Apps Script.

---

## Fase 0 — Documentación fundacional ✅ (en curso)

**Objetivo:** establecer la base documental del proyecto.

**Entregables**
- `docs/PRD.md`
- `docs/Architecture.md`
- `docs/Database.md`
- `docs/Roadmap.md`

**Criterios de salida**
- Documentos completos, profesionales y consistentes con `CLAUDE.md`.
- Aprobación para iniciar Fase 1.

> **Estado:** documentación generada. **Sin código.** A la espera de aprobación.

---

## Fase 1 — Fundación del frontend (primera fase de implementación)

**Objetivo:** levantar el esqueleto navegable de la app con design system y datos mock, sin backend real.

**Alcance**
- Estructura del proyecto (`src/` según `Architecture.md`).
- **Design System**: tokens, tipografía (Inter), paletas semánticas, tema claro/oscuro.
- **Shell principal**: layout, encabezado, contenedor de vistas.
- **Navegación** entre vistas.
- **Dashboard inicial** con KPIs (con datos mock).
- **Tema claro/oscuro** conmutador y persistencia en `localStorage`.
- **PWA básica**: manifest + service worker para *app shell* (instalable, arranque offline).
- **Store local** en memoria + base de **persistencia local** (IndexedDB) inicial.
- **Datos mock** para poblar las vistas.

**Fuera de alcance (Fase 1)**
- Backend Apps Script, sincronización real, lógica financiera completa.

**Criterios de salida**
- App instalable y navegable offline con datos mock.
- Tema claro/oscuro funcional y persistente.
- Componentes base mínimos del design system disponibles.
- Sin violar ninguna regla absoluta; sin referencias a Sheets en el frontend.
- Aprobación para Fase 2.

> **No continuar a fases posteriores hasta recibir aprobación.**

---

## Fases posteriores (propuestas, sujetas a aprobación)

> Detalle indicativo. Cada fase se especificará en su momento, respetando entregas pequeñas y verificables.

### Fase 2 — Backend y contrato de datos
- Estructura Apps Script (`Code.gs`, `Config.gs`, `Utils.gs`, ...).
- Creación de `FinanceOS_DB` y hojas obligatorias (ver `Database.md`).
- `doGet()`/`doPost()` con router por `action`; formato de respuesta estándar.
- Validación y sanitización autoritativas; `AuditLog`.

### Fase 3 — Motor de sincronización (offline-first)
- Cliente de API en `services/`.
- Cola offline en IndexedDB, Optimistic UI, reintentos y reconciliación por `updatedAt`.
- Estados de sync por entidad.

### Fase 4 — Transacciones y Cuentas
- CRUD de cuentas y transacciones (crear, editar, eliminar, duplicar, buscar, filtrar).
- Tipos: ingreso, gasto, transferencia; categorías.

### Fase 5 — Presupuestos
- Presupuestos mensual/anual; cálculo de consumido, disponible y proyectado.

### Fase 6 — Patrimonio
- Activos y pasivos; cálculo de patrimonio neto; `NetWorthSnapshots` y evolución histórica.

### Fase 7 — Inversiones
- Posiciones; costo promedio, valor actual, rentabilidad y distribución.

### Fase 8 — Metas y Deudas
- Metas: avance, tiempo estimado, aporte recomendado.
- Deudas: saldo, tasa, cuota, vencimiento; estrategias Snowball y Avalanche.

### Fase 9 — Analítica e Insights
- Gráficos (flujo de caja, patrimonio, gastos por categoría, ahorro, tendencias).
- Generación de insights automáticos.

### Fase 10 — Vista "Hoy", Diario y Recurrentes
- Copiloto diario "Hoy"; diario financiero; transacciones recurrentes y próximos pagos.

### Fase 11 — Exportaciones y Backups
- Exportación PDF/CSV; resúmenes mensual/anual; estado patrimonial; backups.

### Fase 12 — Pulido, rendimiento móvil y endurecimiento
- Optimización de rendimiento, accesibilidad, seguridad y PWA avanzada.

---

## Dependencias entre fases

```
F0 (docs) → F1 (frontend base) → F2 (backend) → F3 (sync)
                                                   │
        ┌──────────────────────────────────────────┘
        ▼
F4 Transacciones/Cuentas → F5 Presupuestos
                         → F6 Patrimonio → F7 Inversiones
                         → F8 Metas/Deudas
        ▼
F9 Analítica/Insights → F10 Hoy/Diario/Recurrentes → F11 Export/Backups → F12 Pulido
```

Los módulos funcionales (F4+) dependen del contrato de datos (F2) y del motor de sincronización (F3).

---

## Documentos relacionados
- `docs/PRD.md` · `docs/Architecture.md` · `docs/Database.md`
- `CLAUDE.md` — fuente de verdad del proyecto.
