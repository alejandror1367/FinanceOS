# PRD — FinanceOS

**Documento de Requerimientos de Producto**
Versión 1.0 · Fase 0 (Documentación fundacional)
Propietario: Alejo · Producto: FinanceOS

> Este documento deriva directamente de `CLAUDE.md`. En caso de conflicto, `CLAUDE.md` prevalece.

---

## 1. Resumen ejecutivo

FinanceOS es un **sistema operativo financiero personal y privado** para una sola persona (Alejo). Su objetivo es centralizar y administrar la totalidad de las finanzas personales —patrimonio, presupuestos, flujo de caja, metas, inversiones, deudas y proyecciones— desde una única plataforma que se sienta premium, rápida y sofisticada.

No es un producto comercial, no es SaaS, no es multiusuario y no incluye facturación, onboarding, marketing ni páginas públicas. Es una herramienta de uso personal construida con una filosofía de **arquitectura limpia, integridad de datos y experiencia de usuario de primer nivel**.

La aplicación debe sentirse como una mezcla entre Copilot Money, Monarch Money y Wealthfront (dominio financiero) y Linear, Arc Browser, Apple Wallet, Notion y Stripe Dashboard (calidad de producto e interfaz).

---

## 2. Problema y oportunidad

La información financiera personal de Alejo está fragmentada entre cuentas bancarias, billeteras digitales, inversiones, hojas de cálculo y aplicaciones aisladas. Esto impide:

- Conocer el **patrimonio neto real** en cualquier momento.
- Entender el **flujo de caja** (ingresos vs. gastos) con claridad.
- Hacer seguimiento consistente a **presupuestos y metas**.
- Tomar decisiones con **proyecciones e insights** confiables.

**Oportunidad:** construir un "centro de comando" único, privado y propio, que consolide todos los datos y los convierta en decisiones, sin depender de productos de terceros ni exponer información sensible.

---

## 3. Usuario y contexto de uso

- **Usuario único:** Alejo. No hay roles, permisos compartidos ni colaboración.
- **Dispositivos:** uso principal en móvil y escritorio. El **rendimiento móvil** es prioritario.
- **Conectividad:** debe funcionar **offline**; la sincronización es diferida y robusta.
- **Frecuencia:** uso diario (vista "Hoy" como copiloto) y revisiones periódicas (mensual/anual).

---

## 4. Objetivos del producto

1. Mostrar el **patrimonio neto** y su evolución histórica de forma confiable.
2. Registrar y clasificar **transacciones** (ingresos, gastos, transferencias) con fricción mínima.
3. Gestionar **cuentas, presupuestos, metas, inversiones y deudas** en un modelo de datos coherente.
4. Entregar **analítica e insights automáticos** accionables.
5. Garantizar **integridad de datos** y **funcionamiento offline-first**.
6. Sentirse **premium, minimalista y rápido** en todo momento.

### Métricas de éxito (cualitativas, uso personal)
- El patrimonio neto y los saldos mostrados coinciden con la realidad (cero discrepancias por errores de sincronización).
- Registrar una transacción toma pocos segundos, incluso sin conexión.
- La app carga y responde de forma instantánea en móvil.
- La información permite tomar al menos una decisión financiera concreta por semana.

---

## 5. Alcance

### 5.1 Dentro del alcance
- Aplicación web privada instalable como **PWA** (offline-first).
- Módulos: Dashboard, Hoy, Transacciones, Cuentas, Presupuestos, Patrimonio, Inversiones, Metas, Deudas, Analítica, Diario financiero, Insights, Exportaciones.
- Backend de lógica en **Google Apps Script** y base de datos en **Google Sheets**.
- **Design System** completo con modo claro/oscuro.
- Sincronización con Optimistic UI, cola offline, reintentos y reconciliación.

### 5.2 Fuera del alcance (explícitamente)
- Multiusuario, roles o colaboración.
- Facturación, planes de pago o monetización.
- Onboarding comercial, marketing o páginas públicas.
- Integraciones bancarias automáticas (open banking) — fuera de alcance inicial.
- Sistemas empresariales innecesarios (ver Seguridad).

---

## 6. Restricciones (reglas absolutas)

Estas restricciones son **inquebrantables** y condicionan todo requerimiento:

| # | Regla |
|---|-------|
| 1 | Sin frameworks frontend (React, Vue, Angular, Svelte, Next, Nuxt). |
| 2 | Sin TypeScript. Todo en **JavaScript Vanilla** (ES Modules). |
| 3 | Sin build systems (Vite, Webpack, Parcel, Rollup). Debe correr directo en el navegador. |
| 4 | Sin dependencias npm en runtime. |
| 5 | Base de datos oficial: **Google Sheets**. Sin BD externas. |
| 6 | Backend exclusivamente en **Google Apps Script**. Sin servidores tradicionales. |
| 7 | Trabajo por **fases pequeñas y verificables**. Nunca todo en una iteración. |

**Hosting:** GitHub Pages. **PWA:** instalable y offline-first.

---

## 7. Principios de producto

1. **Estabilidad** e **integridad de datos** por encima de features.
2. **Arquitectura limpia**: nunca mezclar UI, lógica financiera, persistencia y sincronización.
3. **UX premium**: minimalista, clara, rápida; el color comunica significado, no decora.
4. **Offline-first**: las acciones se ejecutan primero localmente y luego se sincronizan.
5. **Frontend agnóstico de la BD**: el frontend nunca conoce Google Sheets; todo pasa por Apps Script. Esto permite migrar de BD sin reescribir el frontend.
6. **Entregas completas y verificables**: nunca fragmentos incompletos; siempre indicar cómo probar.

---

## 8. Requerimientos funcionales por módulo

### 8.1 Dashboard (centro de comando)
Mostrar: patrimonio neto, ingresos del mes, gastos del mes, ahorro del mes, liquidez disponible, inversiones, metas activas y próximos pagos. Debe sentirse como un centro de comando financiero.

### 8.2 Hoy (copiloto diario)
Vista especial "Hoy" que muestra: saldo actual, movimientos recientes, próximos pagos, metas prioritarias y resumen diario. Debe actuar como copiloto financiero.

### 8.3 Transacciones
- Operaciones: crear, editar, eliminar, duplicar, buscar, filtrar.
- Tipos: ingreso, gasto, transferencia.
- Clasificación por categoría y cuenta.

### 8.4 Cuentas
Registrar: efectivo, cuenta bancaria, ahorro, inversión, billetera digital. Saldo derivado de transacciones y/o saldo declarado.

### 8.5 Presupuestos
- Periodicidad: mensual y anual.
- Mostrar: consumido, disponible y proyectado.

### 8.6 Patrimonio
- Cálculo: **Patrimonio Neto = Activos − Pasivos**.
- Mostrar evolución histórica (snapshots).

### 8.7 Inversiones
- Tipos: acciones, ETFs, fondos, bonos, CDT, criptomonedas.
- Mostrar: costo promedio, valor actual, rentabilidad y distribución.

### 8.8 Metas
- Tipos: fondo de emergencia, vivienda, viaje, retiro, vehículo.
- Mostrar: avance, tiempo estimado y aporte recomendado.

### 8.9 Deudas
- Mostrar: saldo, tasa, cuota y vencimiento.
- Estrategias de pago: **Snowball** y **Avalanche**.

### 8.10 Analítica
Gráficos de: flujo de caja, patrimonio, gastos por categoría, ahorro histórico y tendencias.

### 8.11 Diario financiero
Registrar: reflexiones, decisiones, aprendizajes y objetivos.

### 8.12 Insights
Generar insights automáticos, por ejemplo:
- "Tus gastos en restaurantes aumentaron 14%."
- "Estás un 10% por encima del presupuesto."
- "Si mantienes este ritmo ahorrarás X este mes."

### 8.13 Exportaciones
Permitir: PDF, CSV, resumen mensual, resumen anual y estado patrimonial.

---

## 9. Requerimientos no funcionales

| Categoría | Requerimiento |
|-----------|---------------|
| **Rendimiento** | Respuesta instantánea en móvil; carga inicial mínima; sin bloqueos de UI. |
| **Offline-first** | Funcional sin conexión; cola de operaciones y sincronización diferida. |
| **Integridad** | Cada registro con `id`, `createdAt`, `updatedAt`; fechas ISO 8601; esquemas definidos. |
| **Mantenibilidad** | Arquitectura modular; separación estricta de responsabilidades. |
| **Seguridad** | Validación de entradas, sanitización, auditoría básica, backups exportables. Sin sistemas empresariales innecesarios. |
| **Escalabilidad** | Modelo de datos y capa de servicios preparados para crecer en módulos y volumen. |
| **Portabilidad** | Migrable a otra BD sin reescribir el frontend (gracias a la capa Apps Script). |

---

## 10. Experiencia y diseño (resumen)

La aplicación debe sentirse premium, moderna, sofisticada, clara, minimalista y rápida; debe evitar apariencia de ERP, CRM, banca antigua o dashboard corporativo genérico.

- **Tipografía:** Inter, con jerarquías Display / H1 / H2 / H3 / Body / Caption.
- **Color:** paletas Slate, Graphite, Emerald, Blue, Amber, Red — usadas solo para comunicar significado.
- **Temas:** Light Mode y Dark Mode.
- **Componentes base:** Card, KPI Card, Data Table, Modal, Drawer, Bottom Sheet, Toast, Badge, Chart Container, Empty State, Skeleton Loader, Search Box, Command Palette, Tabs, Dropdown, Context Menu.

El detalle de tokens y componentes se desarrollará en la Fase 1 (ver `Roadmap.md`).

---

## 11. Criterios de aceptación de alto nivel

- Todos los módulos respetan las **reglas absolutas** sin excepción.
- El frontend **no contiene** ninguna referencia directa a Google Sheets.
- Toda escritura genera registro en **AuditLog** y mantiene `createdAt`/`updatedAt`.
- El patrimonio neto y los saldos son **reproducibles** a partir de los datos.
- La app es **instalable** y **usable offline**.
- Cada fase entrega artefactos completos, con instrucciones de prueba y aprobación previa antes de avanzar.

---

## 12. Forma de trabajo

Para cada cambio: (1) explicar qué se modificará, (2) por qué, (3) entregar archivos completos, (4) mantener compatibilidad, (5) indicar cómo probar, (6) esperar validación antes de la siguiente fase. Nunca entregar fragmentos incompletos ni eliminar funcionalidades existentes sin justificación.

---

## 13. Documentos relacionados
- `docs/Architecture.md` — arquitectura técnica y capas.
- `docs/Database.md` — esquema de Google Sheets.
- `docs/Roadmap.md` — fases y criterios de salida.
- `CLAUDE.md` — fuente de verdad del proyecto.
