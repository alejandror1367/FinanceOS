// views/settings.js — Ajustes: apariencia, datos, backend e información.

import { el } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { CONFIG } from '../core/config.js';
import { auth } from '../core/auth.js';
import { store } from '../store/store.js';
import { theme } from '../services/theme.js';
import { dataService } from '../services/dataService.js';
import { apiClient } from '../services/apiClient.js';
import { syncEngine } from '../services/syncEngine.js';
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
    : syncState.failed > 0 ? Badge(`Fallidas: ${syncState.failed}`, 'negative')
      : syncState.pending > 0 ? Badge(`Pendientes: ${syncState.pending}`, 'warning')
        : Badge('Sincronizado', 'positive');

  const dataCard = Card({
    title: 'Datos y sincronización',
    body: el('div', { class: 'row-list' }, [
      settingRow('Estado', s.baseCurrency ? `Moneda base: ${s.baseCurrency}` : null, stateBadge),
      // TD-10: operaciones que no se pudieron sincronizar (error de negocio o reintentos agotados).
      syncState.failed > 0 ? settingRow(
        'Cambios sin sincronizar',
        `${syncState.failed} operación(es) fallaron al guardar en el backend. Reintenta o descártalas.`,
        el('div', { class: 'row-flex', style: { gap: '8px' } }, [
          Button('Reintentar', { variant: 'ghost', iconName: 'refresh', onClick: async () => {
            toast('Reintentando…', { type: 'info' });
            try { await syncEngine.retryFailed(); toast('Reintento enviado'); } catch (e) { toast('No se pudo reintentar', { type: 'negative' }); }
          } }),
          Button('Descartar', { variant: 'ghost', iconName: 'trash', onClick: () => confirmDialog({
            title: 'Descartar cambios fallidos',
            message: 'Se eliminarán de la cola las operaciones que no se pudieron sincronizar. Esta acción no se puede deshacer.',
            confirmLabel: 'Descartar', onConfirm: async () => { try { await syncEngine.discardFailed(); toast('Cambios descartados'); } catch (e) { toast('Error', { type: 'negative' }); } },
          }) }),
        ]),
      ) : null,
      settingRow('Actualizar desde el backend', 'Vuelve a descargar tus datos', Button('Actualizar', { variant: 'ghost', iconName: 'refresh', onClick: async () => {
        if (!connected) { toast('Modo local: sin backend', { type: 'info' }); return; }
        toast('Actualizando…', { type: 'info' });
        try { await dataService.refresh(); toast('Datos actualizados'); } catch (e) { toast('No se pudo actualizar', { type: 'negative' }); }
      } })),
      settingRow('Recalcular saldos', 'Suma todas las transacciones desde 0 y actualiza los saldos de cada cuenta', Button('Recalcular', { variant: 'ghost', iconName: 'analytics', onClick: () => confirmDialog({
        title: 'Recalcular saldos desde transacciones',
        message: 'Se ignorarán los saldos declarados. Cada cuenta quedará en la suma neta de sus transacciones registradas (desde 0). Úsalo solo si tienes todo el historial registrado.',
        confirmLabel: 'Recalcular', onConfirm: async () => {
          try { await dataService.recalculateBalances(); toast('Saldos recalculados correctamente'); }
          catch (e) { toast(e.message || 'Error al recalcular', { type: 'negative' }); }
        },
      }) })),
      settingRow('Vaciar caché local', 'Borra los datos locales y vuelve a cargar', Button('Vaciar', { variant: 'ghost', iconName: 'trash', onClick: () => confirmDialog({
        title: 'Vaciar caché local',
        message: 'Se borrarán los datos guardados en este dispositivo y se recargará la app desde el backend. No afecta tu base de datos.',
        confirmLabel: 'Vaciar', onConfirm: async () => { try { await dataService.reset(); toast('Caché vaciada'); setTimeout(() => location.reload(), 400); } catch (e) { toast('Error', { type: 'negative' }); } },
      }) })),
    ]),
  });

  // Backend
  const authEnabled = !!CONFIG.auth.clientId;
  const sessionToken = auth.getToken();
  const sessionEmail = sessionToken ? (() => { try { return JSON.parse(atob(sessionToken.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).email; } catch { return null; } })() : null;

  const backendCard = Card({
    title: 'Backend y sesión',
    body: el('div', { class: 'row-list' }, [
      settingRow('Conexión', connected ? 'Apps Script configurado' : 'Modo local (sin backend)', connected ? Badge('Conectado', 'positive') : Badge('Local', 'info')),
      authEnabled
        ? settingRow(
            'Sesión activa',
            sessionEmail || 'Google OAuth',
            Button('Cerrar sesión', { variant: 'ghost', iconName: 'close', onClick: () => confirmDialog({
              title: 'Cerrar sesión',
              message: '¿Cerrar la sesión de esta app? Necesitarás iniciar sesión con Google la próxima vez.',
              confirmLabel: 'Cerrar sesión',
              onConfirm: () => auth.signOut(),
            }) }),
          )
        : settingRow('Autenticación', 'Sin Client ID configurado', Badge('Desactivada', 'warning')),
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
