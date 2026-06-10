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
import { segmented, field, textInput, setFieldError, focusFieldError } from '../components/forms.js';
import { openModal, confirmDialog } from '../components/modal.js';
import { toast } from '../services/toast.js';
import { guardedOp } from '../components/crud.js';
import * as applock from '../core/applock.js';

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
  // FE-013: el segmented (.seg width:100%) va en su propia línea bajo la etiqueta.
  // Antes, con width fijo 260px e inline en una fila de media columna, ahogaba
  // .row__main y el título "Tema" se truncaba a "T…" (.row-list fuerza ellipsis).
  themeControl.style.maxWidth = '320px';

  const appearanceCard = Card({
    title: 'Apariencia',
    body: el('div', { class: 'stack' }, [
      el('div', {}, [
        el('div', { class: 'row__title', text: 'Tema' }),
        el('div', { class: 'row__sub', text: 'Claro, oscuro o según tu sistema' }),
      ]),
      themeControl,
    ]),
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
            await guardedOp(() => syncEngine.retryFailed(), 'Reintento enviado', 'No se pudo reintentar');
          } }),
          Button('Descartar', { variant: 'ghost', iconName: 'trash', onClick: () => confirmDialog({
            title: 'Descartar cambios fallidos',
            message: 'Se eliminarán de la cola las operaciones que no se pudieron sincronizar. Esta acción no se puede deshacer.',
            confirmLabel: 'Descartar', onConfirm: () => guardedOp(() => syncEngine.discardFailed(), 'Cambios descartados'),
          }) }),
        ]),
      ) : null,
      settingRow('Actualizar desde el backend', 'Vuelve a descargar tus datos', Button('Actualizar', { variant: 'ghost', iconName: 'refresh', onClick: async () => {
        if (!connected) { toast('Modo local: sin backend', { type: 'info' }); return; }
        toast('Actualizando…', { type: 'info' });
        await guardedOp(() => dataService.refresh(), 'Datos actualizados', 'No se pudo actualizar');
      } })),
      settingRow('Recalcular saldos', 'Suma todas las transacciones desde 0 y actualiza los saldos de cada cuenta', Button('Recalcular', { variant: 'ghost', iconName: 'analytics', onClick: () => confirmDialog({
        title: 'Recalcular saldos desde transacciones',
        message: 'Se ignorarán los saldos declarados. Cada cuenta quedará en la suma neta de sus transacciones registradas (desde 0). Úsalo solo si tienes todo el historial registrado.',
        confirmLabel: 'Recalcular', onConfirm: () => guardedOp(() => dataService.recalculateBalances(), 'Saldos recalculados correctamente', 'Error al recalcular'),
      }) })),
      settingRow('Purgar eliminados', 'Borra físicamente los registros soft-deleted de la base de datos (Sheets)', Button('Purgar', { variant: 'ghost', iconName: 'trash', onClick: () => confirmDialog({
        title: 'Purgar registros eliminados',
        message: 'Se borrarán de forma permanente todas las filas marcadas como eliminadas en la base de datos. Esta acción no se puede deshacer.',
        confirmLabel: 'Purgar', onConfirm: () => guardedOp(() => dataService.purgeDeleted(), 'Registros purgados correctamente', 'Error al purgar'),
      }) })),
      settingRow('Vaciar caché local', 'Borra los datos locales y vuelve a cargar', Button('Vaciar', { variant: 'ghost', iconName: 'trash', onClick: () => confirmDialog({
        title: 'Vaciar caché local',
        message: 'Se borrarán los datos guardados en este dispositivo y se recargará la app desde el backend. No afecta tu base de datos.',
        confirmLabel: 'Vaciar', onConfirm: () => guardedOp(async () => { await dataService.reset(); toast('Caché vaciada'); setTimeout(() => location.reload(), 400); }, ''),
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

  // Seguridad — App-lock con PIN (J.4). El card se reconstruye al cambiar el estado.
  const securitySlot = el('div');
  function pinModal() {
    const pinEl = textInput({ name: 'pin', value: '', placeholder: '4–6 dígitos' });
    pinEl.type = 'password'; pinEl.inputMode = 'numeric'; pinEl.maxLength = 6;
    const confEl = textInput({ name: 'pin2', value: '', placeholder: 'Repite el PIN' });
    confEl.type = 'password'; confEl.inputMode = 'numeric'; confEl.maxLength = 6;
    openModal({
      title: applock.isEnabled() ? 'Cambiar PIN' : 'Activar PIN',
      body: el('div', {}, [
        el('p', { class: 't-caption text-secondary mt-2', text: 'Protege la app en este dispositivo con un PIN local. Se pedirá al abrir y tras inactividad.' }),
        field('PIN', pinEl),
        field('Confirmar PIN', confEl),
      ]),
      submitLabel: 'Guardar PIN',
      onSubmit: async () => {
        const pin = pinEl.value.trim();
        if (!/^\d{4,6}$/.test(pin)) { focusFieldError(pinEl); return setFieldError(pinEl, 'El PIN debe tener 4 a 6 dígitos'); }
        if (pin !== confEl.value.trim()) { focusFieldError(confEl); return setFieldError(confEl, 'Los PIN no coinciden'); }
        await applock.setPin(pin);
        toast('PIN activado');
        renderSecurity();
        return true;
      },
    });
  }
  function renderSecurity() {
    const enabled = applock.isEnabled();
    const rows = [
      settingRow(
        'Bloqueo con PIN',
        enabled ? 'Activado · se pide al abrir y tras 5 min de inactividad' : 'Protege la app en este dispositivo con un PIN local',
        enabled
          ? el('div', { class: 'row-flex', style: { gap: '8px' } }, [
              Button('Cambiar', { variant: 'ghost', iconName: 'edit', onClick: pinModal }),
              Button('Desactivar', { variant: 'ghost', iconName: 'trash', onClick: () => confirmDialog({
                title: 'Desactivar bloqueo con PIN',
                message: 'La app dejará de pedir PIN en este dispositivo. Esto también quita el desbloqueo por huella. ¿Continuar?',
                confirmLabel: 'Desactivar',
                onConfirm: () => { applock.clearBiometric(); applock.clearPin(); toast('Bloqueo desactivado'); renderSecurity(); },
              }) }),
            ])
          : Button('Activar', { variant: 'primary', iconName: 'settings', onClick: pinModal }),
      ),
    ];
    securitySlot.replaceChildren(Card({ title: 'Seguridad', body: el('div', { class: 'row-list' }, rows) }));

    // J.4b: fila de huella/Face ID — solo si hay PIN activo (respaldo) y el dispositivo
    // lo soporta. La comprobación es async; se añade la fila cuando se resuelve.
    if (enabled) {
      applock.isBiometricSupported().then((supported) => {
        if (!supported) return;
        const bioOn = applock.isBiometricEnabled();
        rows.push(settingRow(
          'Desbloqueo con huella / Face ID',
          bioOn ? 'Activado · úsalo en la pantalla de bloqueo (el PIN sigue como respaldo)' : 'Desbloquea con tu huella o rostro; el PIN queda como respaldo',
          bioOn
            ? Button('Desactivar', { variant: 'ghost', iconName: 'trash', onClick: () => { applock.clearBiometric(); toast('Huella desactivada'); renderSecurity(); } })
            : Button('Activar', { variant: 'ghost', iconName: 'settings', onClick: async () => {
                try { await applock.registerBiometric(); toast('Huella activada'); renderSecurity(); }
                catch { toast('No se pudo activar la huella', { type: 'negative' }); }
              } }),
        ));
        securitySlot.replaceChildren(Card({ title: 'Seguridad', body: el('div', { class: 'row-list' }, rows) }));
      }).catch(() => {});
    }
  }
  renderSecurity();

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
    el('div', { class: 'grid grid--2' }, [appearanceCard, dataCard, securitySlot, backendCard, aboutCard]),
  ]);
}
