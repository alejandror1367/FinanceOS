/**
 * Migration.gs — funciones de migración de datos (ejecutar una sola vez).
 * FinanceOS · TD-01 modelo híbrido de saldos.
 */

/**
 * Recalcula los saldos de todas las cuentas sumando sus transacciones desde cero.
 * Útil cuando el usuario quiere que los saldos reflejen exclusivamente las
 * transacciones registradas en el sistema, ignorando los saldos declarados previos.
 *
 * IMPORTANTE: úsalo solo si tienes registradas todas tus transacciones históricas.
 * Si no, los saldos quedarán en 0 + solo las transacciones que hay en el sistema.
 */
function recalculateAccountBalances_() {
  var accounts = repoReadAll_('Accounts');
  var transactions = repoReadAll_('Transactions');

  // Inicializar saldos en 0 para todas las cuentas
  var balances = {};
  accounts.forEach(function (a) { balances[a.id] = 0; });

  // Aplicar todas las transacciones
  transactions.forEach(function (t) {
    var amt = t.amount || 0;
    if (t.type === 'income') {
      if (balances[t.accountId] !== undefined) balances[t.accountId] += amt;
    } else if (t.type === 'expense') {
      if (balances[t.accountId] !== undefined) balances[t.accountId] -= amt;
    } else if (t.type === 'transfer') {
      if (balances[t.accountId] !== undefined) balances[t.accountId] -= amt;
      if (t.toAccountId && balances[t.toAccountId] !== undefined) balances[t.toAccountId] += amt;
    }
  });

  // Persistir nuevos saldos
  var results = [];
  accounts.forEach(function (a) {
    var prev = a.balance || 0;
    var next = Math.round(balances[a.id] || 0);
    repoUpdate_('Accounts', a.id, { balance: next });
    logAudit_('update', 'Accounts', a.id, 'Recalculo: ' + prev + ' → ' + next);
    results.push({ accountId: a.id, name: a.name, prev: prev, next: next });
  });

  Logger.log('[Migration] recalculateAccountBalances_ completado: ' + accounts.length + ' cuentas.');
  return { accounts: results };
}
