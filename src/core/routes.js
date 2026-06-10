// core/routes.js — declaración de rutas/módulos y su orden en navegación.
// Cada vista expone render(state) -> HTMLElement.

import { renderDashboard } from '../views/dashboard.js';
import { renderAccounts } from '../views/accounts.js';
import { renderTransactions } from '../views/transactions.js';
import { renderBudgets } from '../views/budgets.js';
import { renderNetWorth } from '../views/networth.js';
import { renderInvestments } from '../views/investments.js';
import { renderGoals } from '../views/goals.js';
import { renderDebts } from '../views/debts.js';
import { renderAnalytics } from '../views/analytics.js';
import { renderToday } from '../views/today.js';
import { renderRecurring } from '../views/recurring.js';
import { renderJournal } from '../views/journal.js';
import { renderExports } from '../views/exports.js';
import { renderSettings } from '../views/settings.js';
import { renderImport } from '../views/import.js';
import { renderFire } from '../views/fire.js';

export const routes = {
  dashboard:    { title: 'Dashboard',     icon: 'dashboard',    nav: 'primary', render: renderDashboard },
  today:        { title: 'Hoy',           icon: 'today',        nav: 'primary', render: renderToday },
  transactions: { title: 'Transacciones', icon: 'transactions', nav: 'primary', render: renderTransactions },
  accounts:     { title: 'Cuentas',       icon: 'accounts',     nav: 'primary', render: renderAccounts },
  budgets:      { title: 'Presupuestos',  icon: 'budgets',      nav: 'primary', render: renderBudgets },
  recurring:    { title: 'Recurrentes',   icon: 'calendar',     nav: 'primary', render: renderRecurring },

  networth:     { title: 'Patrimonio',    icon: 'networth',     nav: 'wealth',  render: renderNetWorth },
  investments:  { title: 'Inversiones',   icon: 'investments',  nav: 'wealth',  render: renderInvestments },
  goals:        { title: 'Metas',         icon: 'goals',        nav: 'wealth',  render: renderGoals },
  debts:        { title: 'Deudas',        icon: 'debts',        nav: 'wealth',  render: renderDebts },

  analytics:    { title: 'Analítica',     icon: 'analytics',    nav: 'insights', render: renderAnalytics },
  fire:         { title: 'Simulador FIRE', icon: 'fire',        nav: 'insights', render: renderFire },
  journal:      { title: 'Diario',        icon: 'journal',      nav: 'insights', render: renderJournal },
  exports:      { title: 'Exportaciones', icon: 'exports',      nav: 'insights', render: renderExports },
  import:       { title: 'Importar',      icon: 'importFile',   nav: 'insights', render: renderImport },
  settings:     { title: 'Ajustes',       icon: 'settings',     nav: 'system',   render: renderSettings },
};

export const navSections = [
  { id: 'primary',  label: 'General' },
  { id: 'wealth',   label: 'Patrimonio' },
  { id: 'insights', label: 'Inteligencia' },
  { id: 'system',   label: 'Sistema' },
];

// Rutas destacadas para la barra inferior móvil (FE-012): priorizadas por frecuencia de uso.
// Dashboard · Hoy · Transacciones · Presupuestos · Inversiones.
// El resto (Ajustes, Patrimonio, Metas, Deudas, etc.) sigue accesible desde el menú
// lateral (botón ☰ del topbar) y la paleta de comandos (⌘K).
export const bottomNavOrder = ['dashboard', 'today', 'transactions', 'budgets', 'investments'];
