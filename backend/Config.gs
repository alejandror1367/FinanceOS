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
  allowedEmails: ['patitosalmir@gmail.com', 'alejandrorr1367@gmail.com'],
  googleClientId: '444939967819-uv535tm5fg5glrj2fqc4l3llrqmhvqbb.apps.googleusercontent.com',
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
    { key: 'interestRate', type: 'n' },
    { key: 'cutoffDay', type: 'n' },
    { key: 'paymentDay', type: 'n' },
    { key: 'minPayment', type: 'n' },
    { key: 'totalDue', type: 'n' },
    { key: 'isDeleted', type: 'b' },
    { key: 'createdAt', type: 'ts' },
    { key: 'updatedAt', type: 'ts' },
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
  ],
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
