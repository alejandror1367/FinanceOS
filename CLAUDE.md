# CLAUDE.md

# FinanceOS

Sistema operativo financiero personal privado para Alejo.

---

# Contexto del proyecto

Construir una aplicación web privada de gestión financiera personal avanzada.

NO es un producto comercial.

NO es una aplicación SaaS.

NO requiere multiusuario.

NO requiere facturación.

NO requiere onboarding.

NO requiere marketing.

NO requiere páginas públicas.

Es una herramienta personal diseñada para centralizar y administrar todas las finanzas de Alejo desde una única plataforma.

El objetivo es construir un "Financial OS" personal que combine:

* Gestión financiera
* Patrimonio neto
* Presupuestos
* Flujo de caja
* Metas financieras
* Inversiones
* Proyecciones
* Planeación patrimonial
* Analítica financiera

La aplicación debe sentirse como una mezcla entre:

* Copilot Money
* Monarch Money
* Wealthfront
* Linear
* Arc Browser
* Apple Wallet
* Notion
* Stripe Dashboard

---

# Reglas absolutas

Estas reglas NO deben romperse.

## Regla 1

No utilizar frameworks frontend.

Prohibido:

* React
* Vue
* Angular
* Svelte
* Next.js
* Nuxt

## Regla 2

No utilizar TypeScript.

Todo debe desarrollarse en JavaScript Vanilla.

## Regla 3

No utilizar build systems.

Prohibido:

* Vite
* Webpack
* Parcel
* Rollup

Todo debe funcionar directamente en navegador.

## Regla 4

No utilizar dependencias npm en runtime.

## Regla 5

No utilizar bases de datos externas.

La base de datos oficial es Google Sheets.

## Regla 6

No utilizar servidores tradicionales.

Toda la lógica backend debe implementarse mediante Google Apps Script.

## Regla 7

Siempre trabajar por fases pequeñas y verificables.

Nunca intentar implementar todo en una sola iteración.

---

# Stack oficial

## Frontend

* HTML
* CSS
* JavaScript ES Modules

## Backend

Google Apps Script

## Base de datos

Google Sheets

## Hosting

GitHub Pages

## PWA

Instalable
Offline-first

---

# Filosofía de desarrollo

Priorizar:

1. Estabilidad
2. Integridad de datos
3. Arquitectura limpia
4. UX
5. Sincronización robusta
6. Mantenibilidad
7. Rendimiento móvil
8. Seguridad
9. Escalabilidad

---

# Filosofía visual

La aplicación debe sentirse:

* Premium
* Moderna
* Sofisticada
* Clara
* Minimalista
* Rápida

Evitar apariencia de:

* ERP
* CRM
* Aplicación bancaria antigua
* Dashboard corporativo genérico

Inspiraciones:

* Linear
* Arc Browser
* Apple
* Raycast
* Vercel
* Stripe Dashboard

---

# Design System

Implementar un Design System completo.

## Temas

* Light Mode
* Dark Mode

## Tipografía

Inter

Jerarquías:

* Display
* H1
* H2
* H3
* Body
* Caption

## Colores

Basados en:

* Slate
* Graphite
* Emerald
* Blue
* Amber
* Red

Utilizar color únicamente para comunicar significado.

---

# Componentes base

Diseñar componentes reutilizables.

* Card
* KPI Card
* Data Table
* Modal
* Drawer
* Bottom Sheet
* Toast
* Badge
* Chart Container
* Empty State
* Skeleton Loader
* Search Box
* Command Palette
* Tabs
* Dropdown
* Context Menu

Todos los componentes deben ser reutilizables.

---

# Arquitectura frontend

Utilizar arquitectura modular.

src/

core/
store/
services/
views/
components/
styles/
utils/

Nunca mezclar:

* UI
* lógica financiera
* persistencia
* sincronización

---

# Backend obligatorio

Toda la lógica backend debe desarrollarse en Google Apps Script.

Prohibido:

* Node.js
* Express
* Supabase
* Firebase Functions
* Cloud Run
* AWS Lambda
* Docker

---

# Estructura backend

backend/

Code.gs

Config.gs

Transactions.gs

Accounts.gs

Budgets.gs

Goals.gs

Investments.gs

Assets.gs

Liabilities.gs

Reports.gs

Audit.gs

Utils.gs

---

# Base de datos

Google Sheets.

Archivo principal:

FinanceOS_DB

---

# Hojas obligatorias

Accounts

Transactions

Categories

Budgets

Goals

Investments

Assets

Liabilities

NetWorthSnapshots

RecurringTransactions

AuditLog

Settings

---

# Reglas de base de datos

Cada registro debe tener:

* id único
* createdAt
* updatedAt

Fechas:

ISO 8601

No usar estructuras ambiguas.

Toda entidad debe tener esquema definido.

---

# Regla importante

El frontend NO debe conocer Google Sheets.

Toda interacción debe pasar por Apps Script.

Esto permitirá migrar a otra base de datos en el futuro sin reescribir el frontend.

---

# API

Implementar API REST mediante Apps Script.

Utilizar:

doGet()

doPost()

Acciones mediante parámetro action.

Ejemplos:

?action=getDashboard

?action=getTransactions

?action=createTransaction

?action=updateTransaction

?action=deleteTransaction

?action=getBudgets

?action=getGoals

?action=getInvestments

Todas las respuestas deben ser JSON.

Formato estándar:

{
success: true,
data: {}
}

o

{
success: false,
error: ""
}

---

# Sincronización

La aplicación debe funcionar offline.

Implementar:

* Optimistic UI
* Cola offline
* Reintentos automáticos
* Reconciliación de cambios
* Sincronización diferida

Las acciones deben ejecutarse primero localmente.

Posteriormente sincronizar con Apps Script.

---

# Persistencia local

Utilizar:

* IndexedDB
* localStorage

IndexedDB es la fuente local principal.

localStorage solo para:

* preferencias
* configuración visual
* estado de UI

---

# Módulos funcionales

## Dashboard

Mostrar:

* patrimonio neto
* ingresos del mes
* gastos del mes
* ahorro del mes
* liquidez disponible
* inversiones
* metas activas
* próximos pagos

Debe sentirse como un centro de comando financiero.

---

## Transacciones

Funciones:

* crear
* editar
* eliminar
* duplicar
* buscar
* filtrar

Tipos:

* ingreso
* gasto
* transferencia

---

## Cuentas

Permitir registrar:

* efectivo
* cuenta bancaria
* ahorro
* inversión
* billetera digital

---

## Presupuestos

* mensual
* anual

Mostrar:

* consumido
* disponible
* proyectado

---

## Patrimonio

Calcular:

Patrimonio Neto = Activos - Pasivos

Mostrar evolución histórica.

---

## Inversiones

Registrar:

* acciones
* ETFs
* fondos
* bonos
* CDT
* criptomonedas

Mostrar:

* costo promedio
* valor actual
* rentabilidad
* distribución

---

## Metas

Permitir:

* fondo de emergencia
* vivienda
* viaje
* retiro
* vehículo

Mostrar:

* avance
* tiempo estimado
* aporte recomendado

---

## Deudas

Mostrar:

* saldo
* tasa
* cuota
* vencimiento

Implementar:

* Snowball
* Avalanche

---

## Analítica

Gráficos:

* flujo de caja
* patrimonio
* gastos por categoría
* ahorro histórico
* tendencias

---

## Diario financiero

Registrar:

* reflexiones
* decisiones
* aprendizajes
* objetivos

---

# Dashboard Hoy

Crear vista especial:

"Hoy"

Mostrar:

* saldo actual
* movimientos recientes
* próximos pagos
* metas prioritarias
* resumen diario

Debe actuar como copiloto financiero.

---

# Insights

Generar insights automáticos.

Ejemplos:

"Tus gastos en restaurantes aumentaron 14%."

"Estás un 10% por encima del presupuesto."

"Si mantienes este ritmo ahorrarás X este mes."

---

# Exportaciones

Permitir:

* PDF
* CSV
* Resumen mensual
* Resumen anual
* Estado patrimonial

---

# Seguridad

Aplicación privada.

Implementar:

* validación de entradas
* sanitización
* auditoría básica
* backups exportables

No implementar sistemas empresariales innecesarios.

---

# Forma de trabajo

Siempre:

1. Explicar qué se modificará.
2. Explicar por qué.
3. Entregar archivos completos.
4. Mantener compatibilidad.
5. Indicar cómo probar.
6. Esperar validación antes de pasar a la siguiente fase.

Nunca entregar fragmentos incompletos.

Nunca eliminar funcionalidades existentes sin justificación.

---

# Primera tarea cuando se inicie el proyecto

Analizar este documento completo.

Generar:

* docs/PRD.md
* docs/Architecture.md
* docs/Database.md
* docs/Roadmap.md

Después construir únicamente la Fase 1:

* estructura del proyecto
* design system
* shell principal
* navegación
* dashboard inicial
* tema claro/oscuro
* PWA básica
* store local
* datos mock

No continuar a fases posteriores hasta recibir aprobación.
