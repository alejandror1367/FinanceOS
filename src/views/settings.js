// views/settings.js — Ajustes: apariencia, datos, backend e información.

import { el } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { CONFIG } from '../core/config.js';
import { store } from '../store/store.js';
import { theme } from '../services/theme.js';
import { dataService } from '../services/dataService.js';
import { apiClient } from '../services/apiClient.js';
import { Card, Badge, Button } from '../components/ui.js';
import { segmented } from '../components/forms.js';
import { confirmDialog } from '../components/modal.js';
import { toast } from '../services/toast.js';

function settingRow(label, sub, control) {
  return el('div', { class: 'row' }, [
    el('div', { class: 'row__main' }, [
      el('div', { class: 'row__title', text: label }),
      sub ? el('div', { class: 'row__sub', text: sub }) : null,
    ].filter(Boolean)),
    el('div', { style: { flex: '0 0 auto' } }, [control]),
  ]);
}

export function renderSettings() {
  const s = store.get();
  const connected = apiClient.isConfigured();

  // Apariencia
  const themeControl = segmented({
    value: theme.mode(),
    options: [{ value: 'system', label: 'Sistema' }, { value: 'light', label: 'Claro' }, { value: 'dark', label: 'Oscuro' }],
    onChange: (v) => { theme.setMode(v); toast('Tema actualizado', { type: 'info' }); },
  });
  themeControl.style.width = '260px';

  const appearanceCard = Card({
    title: 'Apariencia',
    body: el('div', { class: 'row-list' }, [settingRow('Tema', 'Claro, oscuro o según tu sistema', themeControl)]),
  });

  // Datos y sincronización
  const syncState = s.sync || {};
  const stateBadge = !syncState.online ? Badge('Sin conexión', 'negative')
    : syncState.pending > 0 ? Badge(`Pendientes: ${syncState.pending}`, 'warning')
      : Badge('Sincronizado', 'positive');

  const dataCard = Card({
    title: 'Datos y sincronización',
    body: el('div', { class: 'row-list' }, [
      settingRow('Estado', s.baseCurrency ? `Moneda base: ${s.baseCurrency}` : null, stateBadge),
      settingRow('Actualizar desde el backend', 'Vuelve a descargar tus datos', Button('Actualizar', { variant: 'ghost', iconName: 'refresh', onClick: async () => {
        if (!connected) { toast('Modo local: sin backend', { type: 'info' }); return; }
        toast('Actualizando…', { type: 'info' });
        try { await dataService.refresh(); toast('Datos actualizados'); } catch (e) { toast('No se pudo actualizar', { type: 'negative' }); }
      } })),
      settingRow('Vaciar caché local', 'Borra los datos locales y vuelve a cargar', Button('Vaciar', { variant: 'ghost', iconName: 'trash', onClick: () => confirmDialog({
        title: 'Vaciar caché local',
        message: 'Se borrarán los datos guardados en este dispositivo y se recargará la app desde el backend. No afecta tu base de datos.',
        confirmLabel: 'Vaciar', onConfirm: async () => { try { await dataService.reset(); toast('Caché vaciada'); setTimeout(() => location.reload(), 400); } catch (e) { toast('Error', { type: 'negative' }); } },
      }) })),
    ]),
  });

  // Backend
  const backendCard = Card({
    title: 'Backend',
    body: el('div', { class: 'row-list' }, [
      settingRow('Conexión', connected ? 'Apps Script configurado' : 'Modo local (sin backend)', connected ? Badge('Conectado', 'positive') : Badge('Local', 'info')),
      settingRow('Token', CONFIG.api.token ? 'Protegido por token' : 'Sin token', CONFIG.api.token ? Badge('Activo', 'positive') : Badge('Vacío', 'warning')),
    ]),
  });

  // Acerca de
  const aboutCard = Card({
    title: 'Acerca de',
    body: el('div', { class: 'row-list' }, [
      settingRow('FinanceOS', `Versión ${CONFIG.version}`, el('span', { class: 'row__avatar', html: icon('wallet') })),
      settingRow('Propietario', CONFIG.owner, el('span', {})),
      settingRow('Exportar / Respaldos', 'CSV, JSON y PDF', Button('Ir a Exportaciones', { variant: 'ghost', iconName: 'exports', onClick: () => { location.hash = '#/exports'; } })),
    ]),
  });

  return el('div', {}, [
    el('div', { class: 'page-header' }, [
      el('h2', { class: 't-h1', text: 'Ajustes' }),
      el('p', { class: 'page-header__sub', text: 'Preferencias, datos y configuración de la app.' }),
    ]),
    el('div', { class: 'grid grid--2' }, [appearanceCard, dataCard, backendCard, aboutCard]),
  ]);
}
