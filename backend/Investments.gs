/**
 * Investments.gs — CRUD de inversiones.
 * Valor/rentabilidad/distribución se calculan en Reports.
 * FinanceOS · Fase 2.
 */

function listInvestments_(p) {
  return repoReadAll_('Investments');
}

function createInvestment_(d) {
  requireFields_(d, ['name', 'assetType', 'quantity']);
  requireEnum_(d.assetType, ENUMS.assetType, 'assetType');
  var dup = idempotentHit_('Investments', d.id);
  if (dup) return dup;
  var rec = repoCreate_('Investments', {
    id:            d.id ? sanitizeString_(d.id, 40) : undefined,
    name:          sanitizeString_(d.name, 80),
    assetType:     d.assetType,
    symbol:        sanitizeString_(d.symbol || '', 20),
    accountId:     sanitizeString_(d.accountId || '', 40),
    quantity:      toAmount_(d.quantity, 'quantity'),
    purchasePrice: toAmount_(d.purchasePrice || d.avgCost || 0, 'purchasePrice'),
    avgCost:       toAmount_(d.avgCost || d.purchasePrice || 0, 'avgCost'),
    purchaseDate:  sanitizeString_(d.purchaseDate || '', 10),
    currentPrice:  toAmount_(d.currentPrice || 0, 'currentPrice'),
    currentValue:  toAmount_(d.currentValue || 0, 'currentValue'),
    interestRate:  toAmount_(d.interestRate || 0, 'interestRate'),
    maturityDate:  sanitizeString_(d.maturityDate || '', 10),
    currency:      sanitizeString_(d.currency || APP.baseCurrency, 3),
  });
  logAudit_('create', 'Investments', rec.id, 'Inversión: ' + rec.name);
  return rec;
}

function updateInvestment_(d) {
  requireFields_(d, ['id']);
  if (d.assetType !== undefined) requireEnum_(d.assetType, ENUMS.assetType, 'assetType');
  var patch = {};
  if (d.name !== undefined) patch.name = sanitizeString_(d.name, 80);
  if (d.assetType !== undefined) patch.assetType = d.assetType;
  if (d.symbol !== undefined) patch.symbol = sanitizeString_(d.symbol, 16);
  if (d.accountId !== undefined) patch.accountId = sanitizeString_(d.accountId, 40);
  if (d.quantity      !== undefined) patch.quantity      = toAmount_(d.quantity,      'quantity');
  if (d.purchasePrice !== undefined) patch.purchasePrice = toAmount_(d.purchasePrice, 'purchasePrice');
  if (d.avgCost       !== undefined) patch.avgCost       = toAmount_(d.avgCost,       'avgCost');
  if (d.purchaseDate  !== undefined) patch.purchaseDate  = sanitizeString_(d.purchaseDate, 10);
  if (d.currentPrice  !== undefined) patch.currentPrice  = toAmount_(d.currentPrice,  'currentPrice');
  if (d.currentValue  !== undefined) patch.currentValue  = toAmount_(d.currentValue,  'currentValue');
  if (d.interestRate  !== undefined) patch.interestRate  = toAmount_(d.interestRate,  'interestRate');
  if (d.maturityDate  !== undefined) patch.maturityDate  = sanitizeString_(d.maturityDate, 10);
  if (d.currency      !== undefined) patch.currency      = sanitizeString_(d.currency, 3);
  var rec = repoUpdate_('Investments', d.id, patch);
  logAudit_('update', 'Investments', rec.id, 'Inversión actualizada: ' + rec.name);
  return rec;
}

function deleteInvestment_(d) {
  requireFields_(d, ['id']);
  repoSoftDelete_('Investments', d.id);
  logAudit_('delete', 'Investments', d.id, 'Inversión eliminada');
  return { id: d.id, deleted: true };
}
