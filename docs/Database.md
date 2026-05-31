# Database — FinanceOS

**Esquema de Base de Datos**
Versión 1.0 · Fase 0 (Documentación fundacional)

> Base de datos oficial: **Google Sheets**. Archivo principal: **`FinanceOS_DB`**.
> El frontend **no** conoce este esquema; solo Apps Script lo accede. Consistente con `CLAUDE.md`.

---

## 1. Convenciones generales

Aplican a **todas** las hojas/entidades:

- **`id`** — identificador único por registro (string, p. ej. UUID o ULID). Inmutable.
- **`createdAt`** — fecha/hora de creación, **ISO 8601** (UTC).
- **`updatedAt`** — fecha/hora de última modificación, **ISO 8601** (UTC). Base para reconciliación de sync.
- **Fechas:** siempre **ISO 8601** (`YYYY-MM-DD` o `YYYY-MM-DDTHH:mm:ssZ`). Sin formatos ambiguos.
- **Montos:** numéricos con signo según corresponda; la **moneda** se indica con código ISO 4217 (`currency`).
- **Borrado:** preferir **soft delete** (`isDeleted` / `deletedAt`) para preservar integridad histórica y auditoría; el borrado físico es excepcional.
- **Esquema definido:** toda entidad tiene esquema explícito; no se permiten estructuras ambiguas.
- **Cada fila = un registro.** La **fila 1** de cada hoja contiene los encabezados (nombres de campo).

---

## 2. Hojas obligatorias

`Accounts` · `Transactions` · `Categories` · `Budgets` · `Goals` · `Investments` · `Assets` · `Liabilities` · `NetWorthSnapshots` · `RecurringTransactions` · `AuditLog` · `Settings`

---

## 3. Esquemas por hoja

### 3.1 Accounts
Cuentas donde reside el dinero o el valor.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | string | Identificador único. |
| name | string | Nombre de la cuenta. |
| type | enum | `cash`, `bank`, `savings`, `investment`, `digital_wallet`. |
| currency | string | ISO 4217 (p. ej. `COP`, `USD`). |
| balance | number | Saldo actual (declarado o derivado). |
| institution | string | Entidad/banco (opcional). |
| isArchived | boolean | Cuenta oculta sin eliminar. |
| isDeleted | boolean | Soft delete. |
| createdAt | datetime | ISO 8601. |
| updatedAt | datetime | ISO 8601. |

### 3.2 Transactions
Movimientos financieros.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | string | Identificador único. |
| type | enum | `income`, `expense`, `transfer`. |
| date | date | Fecha del movimiento (ISO 8601). |
| amount | number | Monto (positivo; el signo lo da `type`). |
| currency | string | ISO 4217. |
| accountId | string | FK → `Accounts.id` (origen). |
| toAccountId | string | FK → `Accounts.id` (destino; solo `transfer`). |
| categoryId | string | FK → `Categories.id` (no aplica a `transfer`). |
| description | string | Detalle/nota. |
| status | enum | `pending`, `synced`, `error` (estado de sync). |
| isDeleted | boolean | Soft delete. |
| createdAt | datetime | ISO 8601. |
| updatedAt | datetime | ISO 8601. |

### 3.3 Categories
Clasificación de transacciones.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | string | Identificador único. |
| name | string | Nombre de la categoría. |
| kind | enum | `income`, `expense`. |
| parentId | string | FK → `Categories.id` (subcategoría; opcional). |
| color | string | Token/HEX para UI (semántico). |
| icon | string | Identificador de icono (opcional). |
| isDeleted | boolean | Soft delete. |
| createdAt | datetime | ISO 8601. |
| updatedAt | datetime | ISO 8601. |

### 3.4 Budgets
Presupuestos por categoría y periodo.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | string | Identificador único. |
| categoryId | string | FK → `Categories.id`. |
| period | enum | `monthly`, `annual`. |
| periodKey | string | Periodo objetivo (`YYYY-MM` o `YYYY`). |
| amount | number | Monto presupuestado. |
| currency | string | ISO 4217. |
| isDeleted | boolean | Soft delete. |
| createdAt | datetime | ISO 8601. |
| updatedAt | datetime | ISO 8601. |

> Consumido, disponible y proyectado se **calculan** en Apps Script a partir de `Transactions`; no se almacenan.

### 3.5 Goals
Metas financieras.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | string | Identificador único. |
| name | string | Nombre de la meta. |
| type | enum | `emergency_fund`, `housing`, `travel`, `retirement`, `vehicle`, `other`. |
| targetAmount | number | Monto objetivo. |
| currentAmount | number | Monto acumulado. |
| currency | string | ISO 4217. |
| targetDate | date | Fecha objetivo (opcional). |
| linkedAccountId | string | FK → `Accounts.id` (opcional). |
| status | enum | `active`, `paused`, `completed`. |
| isDeleted | boolean | Soft delete. |
| createdAt | datetime | ISO 8601. |
| updatedAt | datetime | ISO 8601. |

> Avance, tiempo estimado y aporte recomendado se **calculan**.

### 3.6 Investments
Posiciones de inversión.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | string | Identificador único. |
| name | string | Nombre/descripción del instrumento. |
| assetType | enum | `stock`, `etf`, `fund`, `bond`, `cdt`, `crypto`. |
| symbol | string | Ticker/símbolo (opcional). |
| accountId | string | FK → `Accounts.id` (cuenta de inversión; opcional). |
| quantity | number | Unidades/cantidad. |
| avgCost | number | Costo promedio por unidad. |
| currentPrice | number | Precio actual por unidad. |
| currency | string | ISO 4217. |
| isDeleted | boolean | Soft delete. |
| createdAt | datetime | ISO 8601. |
| updatedAt | datetime | ISO 8601. |

> Valor actual, rentabilidad y distribución se **calculan** (`quantity * currentPrice`, etc.).

### 3.7 Assets
Activos que componen el patrimonio (no líquidos o fuera de cuentas).

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | string | Identificador único. |
| name | string | Nombre del activo (p. ej. inmueble, vehículo). |
| category | string | Tipo de activo (libre/controlado). |
| value | number | Valor estimado actual. |
| currency | string | ISO 4217. |
| isDeleted | boolean | Soft delete. |
| createdAt | datetime | ISO 8601. |
| updatedAt | datetime | ISO 8601. |

### 3.8 Liabilities
Pasivos/deudas.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | string | Identificador único. |
| name | string | Nombre de la deuda. |
| type | string | Tipo (préstamo, tarjeta, hipoteca, ...). |
| balance | number | Saldo pendiente. |
| interestRate | number | Tasa de interés (anual, %). |
| minimumPayment | number | Cuota mínima. |
| dueDate | date | Próximo vencimiento (ISO 8601). |
| currency | string | ISO 4217. |
| isDeleted | boolean | Soft delete. |
| createdAt | datetime | ISO 8601. |
| updatedAt | datetime | ISO 8601. |

> Estrategias **Snowball** y **Avalanche** se calculan sobre este conjunto.

### 3.9 NetWorthSnapshots
Histórico de patrimonio neto para evolución temporal.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | string | Identificador único. |
| date | date | Fecha del snapshot (ISO 8601). |
| totalAssets | number | Suma de activos (cuentas + inversiones + assets). |
| totalLiabilities | number | Suma de pasivos. |
| netWorth | number | `totalAssets − totalLiabilities`. |
| currency | string | ISO 4217 (moneda base de consolidación). |
| createdAt | datetime | ISO 8601. |
| updatedAt | datetime | ISO 8601. |

### 3.10 RecurringTransactions
Plantillas de movimientos recurrentes (próximos pagos).

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | string | Identificador único. |
| type | enum | `income`, `expense`, `transfer`. |
| amount | number | Monto. |
| currency | string | ISO 4217. |
| accountId | string | FK → `Accounts.id`. |
| toAccountId | string | FK → `Accounts.id` (transfer). |
| categoryId | string | FK → `Categories.id`. |
| description | string | Detalle. |
| frequency | enum | `daily`, `weekly`, `monthly`, `yearly`. |
| nextRunDate | date | Próxima ejecución (ISO 8601). |
| isActive | boolean | Activa/pausada. |
| isDeleted | boolean | Soft delete. |
| createdAt | datetime | ISO 8601. |
| updatedAt | datetime | ISO 8601. |

### 3.11 AuditLog
Bitácora de operaciones de escritura.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | string | Identificador único. |
| timestamp | datetime | Momento de la acción (ISO 8601). |
| action | string | `create`, `update`, `delete`. |
| entity | string | Hoja/entidad afectada (`Transactions`, ...). |
| entityId | string | `id` del registro afectado. |
| summary | string | Descripción breve del cambio. |
| createdAt | datetime | ISO 8601. |

### 3.12 Settings
Configuración global de la aplicación (clave-valor).

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | string | Identificador único. |
| key | string | Clave de configuración (única). |
| value | string | Valor (serializado si es objeto). |
| createdAt | datetime | ISO 8601. |
| updatedAt | datetime | ISO 8601. |

---

## 4. Relaciones entre entidades

```
Accounts 1───* Transactions          (accountId, toAccountId)
Categories 1───* Transactions        (categoryId)
Categories 1───* Budgets             (categoryId)
Categories 1───* Categories          (parentId · jerarquía)
Accounts 1───* Investments           (accountId)
Accounts 0..1───* Goals              (linkedAccountId)
Accounts 1───* RecurringTransactions (accountId, toAccountId)
Categories 1───* RecurringTransactions (categoryId)
```

**Patrimonio Neto** (derivado):
```
totalAssets       = Σ Accounts.balance (activas) + Σ Investments.value + Σ Assets.value
totalLiabilities  = Σ Liabilities.balance
netWorth          = totalAssets − totalLiabilities
```
Se materializa periódicamente en `NetWorthSnapshots`.

---

## 5. Reglas de integridad

1. Todo registro tiene `id`, `createdAt` y `updatedAt`.
2. Las **claves foráneas** deben referenciar registros existentes y no borrados.
3. `transfer` requiere `accountId` y `toAccountId` distintos; **no** lleva `categoryId`.
4. `income`/`expense` requieren `categoryId` cuyo `kind` coincida con el tipo.
5. Montos no negativos; el **signo financiero** lo determina `type`, no el campo `amount`.
6. **Borrado** preferentemente lógico (`isDeleted`), preservando histórico para auditoría y snapshots.
7. Toda escritura genera una entrada en **`AuditLog`**.
8. Las **fechas** se almacenan en ISO 8601; las conversiones de zona horaria se resuelven en presentación.
9. Los **valores derivados** (consumido, proyección, rentabilidad, avance) **no se persisten**: se calculan en Apps Script para evitar inconsistencias.

---

## 6. Estrategia de identificadores

- IDs generados en el cliente (para Optimistic UI offline) usando un esquema único (UUID/ULID).
- El backend **respeta** el `id` recibido si es válido y no colisiona; de lo contrario, reconcilia y devuelve el canónico.
- ULID es preferible por ordenamiento temporal natural (útil para depuración y reconciliación).

---

## 7. Backups

- Exportaciones periódicas a **CSV/JSON** por hoja, descargables desde la app (ver Exportaciones en PRD).
- Google Sheets aporta además **historial de versiones** nativo como respaldo adicional.

---

## 8. Documentos relacionados
- `docs/Architecture.md` — capa de acceso a datos y sincronización.
- `docs/PRD.md` — requerimientos funcionales por módulo.
- `docs/Roadmap.md` — orden de implementación de entidades.
