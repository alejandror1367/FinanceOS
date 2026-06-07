// core/auth.js — Google Identity Services (TD-09 opción C).
// Solo el dueño (patitosalmir@gmail.com) puede acceder.
// El id_token se envía con cada request al backend, que lo verifica contra Google.

import { CONFIG } from './config.js';

const LS_KEY = 'financeos.auth.token';

// Decodifica el payload de un JWT sin verificar la firma — solo para leer exp/email.
function decodePayload(jwt) {
  try {
    return JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
  } catch { return null; }
}

// El token es válido si no ha expirado (dejamos 2 min de margen).
function isTokenValid(token) {
  const p = decodePayload(token);
  return p ? p.exp > Date.now() / 1000 + 120 : false;
}

let _pendingResolve = null;

function onCredential(response) {
  const token = response.credential;
  localStorage.setItem(LS_KEY, token);
  document.getElementById('auth-screen')?.remove();
  if (_pendingResolve) { _pendingResolve(token); _pendingResolve = null; }
}

function initGSI() {
  google.accounts.id.initialize({
    client_id: CONFIG.auth.clientId,
    callback: onCredential,
    auto_select: true,           // Sign-in automático si el dispositivo tiene sesión activa de Google
    cancel_on_tap_outside: false,
    use_fedcm_for_prompt: true,  // Migración FedCM requerida por Google (silencia el warning QA-003)
  });
  renderLoginScreen();
  // One Tap — resuelve sin interacción si hay sesión activa en el dispositivo.
  // En mobile PWA/standalone puede no estar disponible; el botón es el fallback.
  google.accounts.id.prompt((notification) => {
    if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
      console.info('[auth] One Tap no disponible en este contexto — usa el botón de login');
    }
  });
}

function renderLoginScreen() {
  if (document.getElementById('auth-screen')) return;

  const screen = document.createElement('div');
  screen.id = 'auth-screen';
  screen.setAttribute('role', 'main');
  screen.setAttribute('aria-label', 'Iniciar sesión en FinanceOS');
  Object.assign(screen.style, {
    position: 'fixed', inset: '0', zIndex: '9999',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: '2rem',
    background: 'var(--bg-app)', padding: '2rem',
  });

  screen.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:.75rem;text-align:center">
      <div style="
        width:64px;height:64px;border-radius:20px;
        background:var(--accent-bg);display:grid;place-items:center;margin-bottom:.5rem
      ">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none"
             stroke="var(--accent)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 5 10-5"/>
          <path d="M2 12l10 5 10-5"/>
        </svg>
      </div>
      <div style="font-size:1.375rem;font-weight:700;letter-spacing:-.02em">
        Finance<span style="color:var(--accent)">OS</span>
      </div>
      <p style="font-size:.8125rem;color:var(--text-secondary);max-width:260px;line-height:1.55;margin:0">
        Acceso restringido. Inicia sesión con tu cuenta de Google para continuar.
      </p>
    </div>
    <div id="g_id_signin_btn"></div>
  `;

  document.body.appendChild(screen);

  google.accounts.id.renderButton(
    document.getElementById('g_id_signin_btn'),
    {
      theme: document.documentElement.dataset.theme === 'light' ? 'outline' : 'filled_black',
      size: 'large', text: 'signin_with', shape: 'pill', width: 280,
    },
  );
}

export const auth = {
  // Devuelve el id_token si existe y es válido; null si expiró o no hay sesión.
  getToken() {
    const t = localStorage.getItem(LS_KEY);
    return t && isTokenValid(t) ? t : null;
  },

  isAuthenticated() {
    return !!this.getToken();
  },

  // Muestra la pantalla de login y resuelve cuando el usuario se autentica.
  prompt() {
    return new Promise((resolve) => {
      _pendingResolve = resolve;
      if (window.google?.accounts?.id) {
        initGSI();
      } else {
        // El script de GIS todavía no ha cargado; esperamos su evento
        document.addEventListener('gsi:ready', initGSI, { once: true });
      }
    });
  },

  // Cierra la sesión y recarga la app (vuelve a la pantalla de login).
  signOut() {
    localStorage.removeItem(LS_KEY);
    if (window.google?.accounts?.id) google.accounts.id.disableAutoSelect();
    location.reload();
  },

  // Intenta renovar el token en silencio cuando está próximo a expirar.
  // Llamar periódicamente desde app.js.
  refreshSilent() {
    if (this.isAuthenticated() || !window.google?.accounts?.id) return;
    google.accounts.id.prompt();
  },
};
