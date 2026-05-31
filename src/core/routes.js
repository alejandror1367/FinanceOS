// core/routes.js — declaración de rutas/módulos y su orden en navegación.
// Cada vista expone render(state) -> HTMLElement.

import { renderDashboard } from '../views/dashboard.js';
import { renderAccounts } from '../views/accounts.js';
import { renderTransactions } from '../views/transactions.js';
import { makeStub } from '../views/stub.js';

export const routes = {
  dashboard:    { title: 'Dashboard',     icon: 'dashboard',    nav: 'primary', render: renderDashboard },
  today:        { title: 'Hoy',           icon: 'today',        nav: 'primary', render: makeStub('Hoy', 'Tu copiloto financiero diario: saldo, movimientos recientes, próximos pagos y metas prioritarias.', 'today') },
  transactions: { title: 'Transacciones', icon: 'transactions', nav: 'primary', render: renderTransactions },
  accounts:     { title: 'Cuentas',       icon: 'accounts',     nav: 'primary', render: renderAccounts },
  budgets:      { title: 'Presupuestos',  icon: 'budgets',      nav: 'primary', render: makeStub('Presupuestos', 'Presupuestos mensuales y anuales: consumido, disponible y proyectado.', 'budgets') },

  networth:     { title: 'Patrimonio',    icon: 'networth',     nav: 'wealth',  render: makeStub('Patrimonio', 'Activos menos pasivos y evolución histórica de tu patrimonio neto.', 'networth') },
  investments:  { title: 'Inversiones',   icon: 'investments',  nav: 'wealth',  render: makeStub('Inversiones', 'Acciones, ETFs, fondos, bonos, CDT y cripto: costo, valor y rentabilidad.', 'investments') },
  goals:        { title: 'Metas',         icon: 'goals',        nav: 'wealth',  render: makeStub('Metas', 'Fondo de emergencia, vivienda, viaje, retiro y vehículo con avance y aportes.', 'goals') },
  debts:        { title: 'Deudas',        icon: 'debts',        nav: 'wealth',  render: makeStub('Deudas', 'Saldo, tasa, cuota y vencimiento, con estrategias Snowball y Avalanche.', 'debts') },

  analytics:    { title: 'Analítica',     icon: 'analytics',    nav: 'insights', render: makeStub('Analítica', 'Flujo de caja, patrimonio, gastos por categoría, ahorro y tendencias.', 'analytics') },
  journal:      { title: 'Diario',        icon: 'journal',      nav: 'insights', render: makeStub('Diario financiero', 'Reflexiones, decisiones, aprendizajes y objetivos.', 'journal') },
  exports:      { title: 'Exportaciones', icon: 'exports',      nav: 'insights', render: makeStub('Exportaciones', 'PDF, CSV, resúmenes mensual/anual y estado patrimonial.', 'exports') },
  settings:     { title: 'Ajustes',       icon: 'settings',     nav: 'system',   render: makeStub('Ajustes', 'Preferencias, tema, moneda base y respaldos exportables.', 'settings') },
};

export const navSections = [
  { id: 'primary',  label: 'General' },
  { id: 'wealth',   label: 'Patrimonio' },
  { id: 'insights', label: 'Inteligencia' },
  { id: 'system',   label: 'Sistema' },
];

// Rutas destacadas para la barra inferior móvil.
export const bottomNavOrder = ['dashboard', 'today', 'transactions', 'networth', 'settings'];
