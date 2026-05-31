// utils/icons.js — set de iconos SVG (stroke), inline para funcionar offline.
// Estilo: 24x24, stroke currentColor, 1.75. Devuelven string HTML.

const wrap = (paths) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export const icons = {
  dashboard: wrap('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'),
  today: wrap('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  transactions: wrap('<path d="M7 7h13l-3-3M17 17H4l3 3"/>'),
  accounts: wrap('<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/>'),
  budgets: wrap('<path d="M12 3a9 9 0 1 0 9 9h-9z"/><path d="M12 3v9"/>'),
  networth: wrap('<path d="M4 19V5M4 19h16"/><path d="M8 16l3-4 3 2 4-6"/>'),
  investments: wrap('<path d="M4 18l5-6 4 3 7-8"/><path d="M17 7h4v4"/>'),
  goals: wrap('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/>'),
  debts: wrap('<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/>'),
  analytics: wrap('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  journal: wrap('<path d="M5 4h11l3 3v13H5z"/><path d="M8 9h7M8 13h7M8 17h4"/>'),
  exports: wrap('<path d="M12 3v12M8 11l4 4 4-4"/><path d="M5 19h14"/>'),
  settings: wrap('<circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a7.5 7.5 0 0 0 0-3l1.6-1.2-2-3.4-1.9.8a7.5 7.5 0 0 0-2.6-1.5L14 2h-4l-.5 2.2a7.5 7.5 0 0 0-2.6 1.5l-1.9-.8-2 3.4L4.6 10.5a7.5 7.5 0 0 0 0 3l-1.6 1.2 2 3.4 1.9-.8a7.5 7.5 0 0 0 2.6 1.5L10 22h4l.5-2.2a7.5 7.5 0 0 0 2.6-1.5l1.9.8 2-3.4z"/>'),
  wallet: wrap('<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M16 12h2"/><path d="M3 9h13a2 2 0 0 1 2 2"/>'),
  arrowUp: wrap('<path d="M12 19V5M6 11l6-6 6 6"/>'),
  arrowDown: wrap('<path d="M12 5v14M6 13l6 6 6-6"/>'),
  plus: wrap('<path d="M12 5v14M5 12h14"/>'),
  sun: wrap('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/>'),
  moon: wrap('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
  menu: wrap('<path d="M4 6h16M4 12h16M4 18h16"/>'),
  refresh: wrap('<path d="M21 12a9 9 0 1 1-2.6-6.4M21 4v5h-5"/>'),
  search: wrap('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/>'),
  bell: wrap('<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 19a2 2 0 0 0 4 0"/>'),
  calendar: wrap('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/>'),
  food: wrap('<path d="M4 3v7a2 2 0 0 0 4 0V3M6 10v11M16 3c-1.5 0-3 2-3 5s1 4 3 4v9"/>'),
  home: wrap('<path d="M4 11l8-7 8 7"/><path d="M6 10v9h12v-9"/>'),
  car: wrap('<path d="M5 16l1.5-5h11L19 16"/><rect x="3" y="16" width="18" height="4" rx="1"/><circle cx="7.5" cy="20" r="1"/><circle cx="16.5" cy="20" r="1"/>'),
  briefcase: wrap('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'),
  shopping: wrap('<path d="M6 6h15l-1.5 9h-12z"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/><path d="M6 6L5 3H2"/>'),
  cloud: wrap('<path d="M7 18a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.4A3.5 3.5 0 0 1 18 18z"/>'),
  bolt: wrap('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>'),
};

export function icon(name) {
  return icons[name] || icons.bolt;
}
