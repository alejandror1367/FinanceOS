/**
 * Config.gs — Configuración global del backend (Google Apps Script).
 * FinanceOS · Fase 2.
 *
 * La base de datos oficial es Google Sheets (archivo: FinanceOS_DB).
 * El ID del spreadsheet se guarda en PropertiesES tras ejecutar setupDatabase().
 * El frontend NUNCA conoce esta estructura; solo el contrato action-based.
 */

var APP = {
  name: 'FinanceOS',
  apiVersion: '1.0',
  dbFileName: 'FinanceOS_DB',
  baseCurrency: 'COP',
  propKeySpreadsheetId: 'FINANCEOS_DB_ID',

  // Auth (TD-09 opción C) — Google OAuth. Añade aquí los correos autorizados.
  // J.5: ambos correos pertenecen a Alejo (propietario único). El segundo es su
  // cuenta personal alternativa, con acceso total intencional a la misma BD.
  // Confirmado por el dueño el 2026-06-10. La app sigue siendo monousuario.
  allowedEmails: ['patitosalmir@gmail.com', 'alejandrorr1367@gmail.com'],
  googleClientId: '444939967819-uv535tm5fg5glrj2fqc4l3llrqmhvqbb.apps.googleusercontent.com',

  // SEC-005: límite de caracteres del extracto enviados a Groq (~12k tokens a 4 chars/token).
  // Preserva la cabecera del CSV (el inicio del archivo). Ajustable sin redespliegue si se
  // mueve a PropertiesService, pero al estar aquí es revisable en el repo.
  importMaxChars: 50000,

  // SEC-006: rate-limit de auditoría de accesos denegados.
  // Máximo de registros en AuditLog por IP/email dentro de la ventana TTL (segundos).
  accessDeniedRateLimitMax: 5,
  accessDeniedRateLimitTtl: 60, // 60 segundos
};

/**
 * Esquemas de cada hoja (orden de columnas = orden de cabeceras).
 * Alineado con docs/Database.md. Toda entidad: id, createdAt, updatedAt.
 * Tipos: s=string, n=number, b=boolean, d=date(ISO), ts=timestamp(ISO).
 */
var SCHEMAS = {
  Accounts: [
    { key: 'id', type: 's' },
    { key: 'name', type: 's' },
    { key: 'type', type: 's' },          // cash|bank|savings|investment|digital_wallet|credit_card
    { key: 'currency', type: 's' },
    { key: 'balance', type: 'n' },
    { key: 'institution', type: 's' },
    { key: 'isArchived', type: 'b' },
    { key: 'creditLimit', type: 'n' },
    { key: 'interestRate', type: 'n' },  // tasa EFECTIVA ANUAL % (EA): CC = interés del crédito; savings/bank = rendimiento de la cuenta remunerada
    { key: 'cutoffDay', type: 'n' },
    { key: 'paymentDay', type: 'n' },
    { key: 'minPayment', type: 'n' },
    { key: 'totalDue', type: 'n' },
    { key: 'isDeleted', type: 'b' },
    { key: 'createdAt', type: 'ts' },
    { key: 'updatedAt', type: 'ts' },
    // Sprint D (D.2): APPEND-ONLY — nuevas columnas SOLO al final (ensureHeaders_ no
    // reordena). Última fecha hasta la que se registró rendimiento de una cuenta
    // remunerada; el frontend acumula el interés desde aquí (idempotencia por período).
    { key: 'lastYieldDate', type: 'd' },
    // Subtipo de cuenta (APPEND-ONLY). Hoy solo 'cesantias' en cuentas savings:
    // marca fondos NO retirables libremente (Porvenir) que se EXCLUYEN de la
    // liquidez (selectors.liquidAccounts) pero siguen sumando al patrimonio.
    { key: 'subtype', type: 's' },
  ],
  Transactions: [
    { key: 'id', type: 's' },
    { key: 'type', type: 's' },           // income|expense|transfer
    { key: 'date', type: 'd' },
    { key: 'amount', type: 'n' },
    { key: 'currency', type: 's' },
    { key: 'accountId', type: 's' },
    { key: 'toAccountId', type: 's' },
    { key: 'categoryId', type: 's' },
    { key: 'description', type: 's' },
    { key: 'status', type: 's' },         // pending|synced|error
    { key: 'isDeleted', type: 'b' },
    { key: 'createdAt', type: 'ts' },
    { key: 'updatedAt', type: 'ts' },
    // TD-54: conversion historica a moneda base para cashflow/presupuestos.
    // APPEND-ONLY: no insertar antes de timestamps para no desalinear hojas existentes.
    { key: 'amountBase', type: 'n' },
    { key: 'fxRateToBase', type: 'n' },
    { key: 'fxRateDate', type: 'd' },
  ],
  Categories: [
    { key: 'id', type: 's' },
    { key: 'name', type: 's' },
    { key: 'kind', type: 's' },           // income|expense
    { key: 'parentId', type: 's' },
    { key: 'color', type: 's' },
    { key: 'icon', type: 's' },
    { key: 'isDeleted', type: 'b' },
    { key: 'createdAt', type: 'ts' },
    { key: 'updatedAt', type: 'ts' },
  ],
  Budgets: [
    { key: 'id', type: 's' },
    { key: 'categoryId', type: 's' },
    { key: 'period', type: 's' },         // monthly|annual
    { key: 'periodKey', type: 's' },      // YYYY-MM | YYYY
    { key: 'amount', type: 'n' },
    { key: 'currency', type: 's' },
    { key: 'isDeleted', type: 'b' },
    { key: 'createdAt', type: 'ts' },
    { key: 'updatedAt', type: 'ts' },
  ],
  Goals: [
    { key: 'id', type: 's' },
    { key: 'name', type: 's' },
    { key: 'type', type: 's' },
    { key: 'targetAmount', type: 'n' },
    { key: 'currentAmount', type: 'n' },
    { key: 'currency', type: 's' },
    { key: 'targetDate', type: 'd' },
    { key: 'linkedAccountId', type: 's' },
    { key: 'status', type: 's' },         // active|paused|completed
    { key: 'isDeleted', type: 'b' },
    { key: 'createdAt', type: 'ts' },
    { key: 'updatedAt', type: 'ts' },
  ],
  Investments: [
    { key: 'id', type: 's' },
    { key: 'name', type: 's' },
    { key: 'assetType', type: 's' },      // stock|etf|fund|bond|cdt|crypto
    { key: 'symbol', type: 's' },
    { key: 'accountId', type: 's' },
    { key: 'quantity', type: 'n' },
    { key: 'avgCost', type: 'n' },        // legacy, reemplazado por purchasePrice
    { key: 'purchasePrice', type: 'n' }, // precio por unidad al momento de la compra
    { key: 'purchaseDate', type: 'd' },  // fecha de la compra
    { key: 'currentPrice', type: 'n' },
    { key: 'currentValue', type: 'n' },  // valor actual manual (fondos FIC)
    { key: 'interestRate', type: 'n' },  // tasa EA% (CDT)
    { key: 'maturityDate', type: 'd' },  // fecha vencimiento (CDT)
    { key: 'currency', type: 's' },
    { key: 'isDeleted', type: 'b' },
    { key: 'createdAt', type: 'ts' },
    { key: 'updatedAt', type: 'ts' },
    // NOTA: estos campos se APPENDEAN al final (después de los timestamps) a propósito.
    // El repositorio mapea columnas por posición (rowToObject_ usa schema[c]); insertarlos
    // antes de createdAt/updatedAt desalinearía los datos ya escritos en la hoja.
    { key: 'soldPrice', type: 'n' },       // precio de venta por unidad (posición cerrada)
    { key: 'soldDate', type: 'd' },        // fecha de venta
    { key: 'soldQuantity', type: 'n' },    // cantidad vendida
    { key: 'commission', type: 'n' },      // comisión de la compra (Sprint 5)
    { key: 'soldCommission', type: 'n' },  // comisión de la venta, prorrateada por lote (Sprint 5)
    { key: 'withholdingRate', type: 'n' }, // retención en fuente % de la posición (Sprint 5)
  ],
  Assets: [
    { key: 'id', type: 's' },
    { key: 'name', type: 's' },
    { key: 'category', type: 's' },
    { key: 'value', type: 'n' },
    { key: 'currency', type: 's' },
    { key: 'isDeleted', type: 'b' },
    { key: 'createdAt', type: 'ts' },
    { key: 'updatedAt', type: 'ts' },
  ],
  Liabilities: [
    { key: 'id', type: 's' },
    { key: 'name', type: 's' },
    { key: 'type', type: 's' },
    { key: 'balance', type: 'n' },
    { key: 'interestRate', type: 'n' },
    { key: 'minimumPayment', type: 'n' },
    { key: 'dueDate', type: 'd' },
    { key: 'currency', type: 's' },
    { key: 'isDeleted', type: 'b' },
    { key: 'createdAt', type: 'ts' },
    { key: 'updatedAt', type: 'ts' },
  ],
  NetWorthSnapshots: [
    { key: 'id', type: 's' },
    { key: 'date', type: 'd' },
    { key: 'totalAssets', type: 'n' },
    { key: 'totalLiabilities', type: 'n' },
    { key: 'netWorth', type: 'n' },
    { key: 'currency', type: 's' },
    { key: 'createdAt', type: 'ts' },
    { key: 'updatedAt', type: 'ts' },
    // Append al final (tras los timestamps) por compatibilidad posicional con datos
    // ya escritos. Permite soft-delete rápido (setValues) en vez de deleteRow lento.
    { key: 'isDeleted', type: 'b' },
    // R3: desglose patrimonial enriquecido — append al final para compatibilidad posicional.
    // Snapshots anteriores no tienen estos campos (undefined → leer como 0 en frontend).
    // setupDatabase() idempotente: ensureHeaders_ solo añade si faltan.
    { key: 'investmentsValue', type: 'n' },
    { key: 'investmentsCost',  type: 'n' },
    { key: 'accountsValue',    type: 'n' },
    { key: 'otherAssets',      type: 'n' },
    { key: 'ccDebt',           type: 'n' },
    { key: 'liabilitiesDebt',  type: 'n' },
  ],
  // ⚠ requiere deploy — R3 snapshots enriquecidos
  RecurringTransactions: [
    { key: 'id', type: 's' },
    { key: 'type', type: 's' },
    { key: 'amount', type: 'n' },
    { key: 'currency', type: 's' },
    { key: 'accountId', type: 's' },
    { key: 'toAccountId', type: 's' },
    { key: 'categoryId', type: 's' },
    { key: 'description', type: 's' },
    { key: 'frequency', type: 's' },      // daily|weekly|monthly|yearly
    { key: 'nextRunDate', type: 'd' },
    { key: 'isActive', type: 'b' },
    { key: 'isDeleted', type: 'b' },
    { key: 'createdAt', type: 'ts' },
    { key: 'updatedAt', type: 'ts' },
  ],
  AuditLog: [
    { key: 'id', type: 's' },
    { key: 'timestamp', type: 'ts' },
    { key: 'action', type: 's' },
    { key: 'entity', type: 's' },
    { key: 'entityId', type: 's' },
    { key: 'summary', type: 's' },
    { key: 'createdAt', type: 'ts' },
  ],
  Settings: [
    { key: 'id', type: 's' },
    { key: 'key', type: 's' },
    { key: 'value', type: 's' },
    { key: 'createdAt', type: 'ts' },
    { key: 'updatedAt', type: 'ts' },
  ],
  Journal: [
    { key: 'id', type: 's' },
    { key: 'date', type: 'd' },
    { key: 'category', type: 's' },   // reflection|decision|learning|objective
    { key: 'title', type: 's' },
    { key: 'content', type: 's' },
    { key: 'isDeleted', type: 'b' },
    { key: 'createdAt', type: 'ts' },
    { key: 'updatedAt', type: 'ts' },
  ],
};

// Orden de creación de hojas en el spreadsheet.
var SHEET_NAMES = [
  'Accounts', 'Transactions', 'Categories', 'Budgets', 'Goals',
  'Investments', 'Assets', 'Liabilities', 'NetWorthSnapshots',
  'RecurringTransactions', 'AuditLog', 'Settings', 'Journal',
];

// Enums permitidos (validación autoritativa).
var ENUMS = {
  accountType: ['cash', 'bank', 'savings', 'investment', 'digital_wallet', 'credit_card'],
  txType: ['income', 'expense', 'transfer'],
  categoryKind: ['income', 'expense'],
  budgetPeriod: ['monthly', 'annual'],
  goalStatus: ['active', 'paused', 'completed'],
  assetType: ['stock', 'etf', 'fund', 'bond', 'cdt', 'crypto'],
  frequency: ['daily', 'weekly', 'monthly', 'yearly'],
  journalCategory: ['reflection', 'decision', 'learning', 'objective'],
};
