// core/applock.js — bloqueo local opcional con PIN (J.4 / N5).
//
// Capa de DISUASIÓN LOCAL sobre la sesión OAuth: PIN de 4–6 dígitos cuyo hash
// (PBKDF2-SHA256) se guarda en localStorage — nunca el PIN en claro. Añade
// auto-lock por inactividad y al pasar a segundo plano, con fallback a re-login
// OAuth si se olvida el PIN.
//
// Alcance honesto: NO cifra IndexedDB; alguien con acceso a devtools/disco puede
// leer los datos. Para una app personal de un solo dueño es disuasión suficiente.
// crypto.subtle es nativo (cero deps npm); localStorage solo guarda preferencia/estado.

import { auth } from './auth.js';
import { el } from '../utils/dom.js';
import { icon } from '../utils/icons.js';

const LS_KEY = 'financeos.applock';
const PBKDF2_ITERATIONS = 150000;
const AUTOLOCK_MS = 5 * 60 * 1000; // 5 min de inactividad
const MAX_ATTEMPTS = 5;

const enc = new TextEncoder();
const b64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function deriveHash(pin, salt, iterations) {
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, keyMaterial, 256);
  return b64(bits);
}

function load() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch { return null; }
}

// Comparación de tiempo constante (no early-return por carácter).
function constantEq(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function isEnabled() { return !!load(); }

export async function setPin(pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await deriveHash(pin, salt, PBKDF2_ITERATIONS);
  localStorage.setItem(LS_KEY, JSON.stringify({ saltB64: b64(salt), hash, iterations: PBKDF2_ITERATIONS }));
}

export function clearPin() { localStorage.removeItem(LS_KEY); }

export async function verifyPin(pin) {
  const cfg = load();
  if (!cfg) return true; // sin PIN → no hay nada que verificar
  const hash = await deriveHash(pin, unb64(cfg.saltB64), cfg.iterations || PBKDF2_ITERATIONS);
  return constantEq(hash, cfg.hash);
}

// ── Desbloqueo biométrico (J.4b · WebAuthn) ───────────────────────────────────
// Opt-in y SIEMPRE con PIN de respaldo: la huella/Face ID es un atajo, no el único
// factor (no todo dispositivo tiene biometría y hace falta recuperación). La clave
// privada vive en el chip seguro del dispositivo; aquí solo se guarda el credentialId.
// Modelo local sin servidor: no verificamos la firma server-side — usamos WebAuthn
// como gate de PRESENCIA biométrica (si get() resuelve, el SO ya validó la huella).
const LS_BIO_KEY = 'financeos.applock.bio';
const rpId = () => location.hostname;

export async function isBiometricSupported() {
  try {
    return !!(window.PublicKeyCredential
      && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch { return false; }
}

export function isBiometricEnabled() {
  try { return !!localStorage.getItem(LS_BIO_KEY); } catch { return false; }
}

function loadBio() {
  try { return JSON.parse(localStorage.getItem(LS_BIO_KEY) || 'null'); } catch { return null; }
}

export async function registerBiometric() {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = crypto.getRandomValues(new Uint8Array(16));
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: 'FinanceOS', id: rpId() },
      user: { id: userId, name: 'owner', displayName: 'FinanceOS' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
      timeout: 60000,
    },
  });
  if (!cred) throw new Error('No se pudo registrar la huella.');
  localStorage.setItem(LS_BIO_KEY, JSON.stringify({ id: b64(cred.rawId) }));
}

export function clearBiometric() { localStorage.removeItem(LS_BIO_KEY); }

// Lanza el prompt nativo de huella/Face ID. true si el SO valida; false/throw si no.
export async function unlockBiometric() {
  const cfg = loadBio();
  if (!cfg) return false;
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [{ type: 'public-key', id: unb64(cfg.id) }],
      userVerification: 'required',
      timeout: 60000,
      rpId: rpId(),
    },
  });
  return !!assertion;
}

// ── Pantalla de bloqueo ───────────────────────────────────────────────────────
let overlayEl = null;
let locked = false;
let idleTimer = null;

// Muestra la pantalla de bloqueo (overlay a pantalla completa, por encima de todo).
// Devuelve una promesa que resuelve al desbloquear. Idempotente: si ya está bloqueado,
// devuelve una promesa que resuelve cuando el overlay actual se cierre.
export function showLock() {
  if (locked) return Promise.resolve();
  if (!isEnabled()) return Promise.resolve();
  locked = true;

  return new Promise((resolve) => {
    let attempts = 0;
    const input = el('input', {
      class: 'input applock__input', type: 'password', inputmode: 'numeric',
      autocomplete: 'off', maxlength: '6', 'aria-label': 'PIN de desbloqueo',
    });
    const errEl = el('div', { class: 't-caption text-negative', style: { minHeight: '18px', textAlign: 'center' } });

    async function attempt() {
      if (!input.value) return;
      if (await verifyPin(input.value)) { cleanup(); resolve(); return; }
      attempts++;
      input.value = '';
      if (attempts >= MAX_ATTEMPTS) {
        errEl.textContent = 'Demasiados intentos. Cerrando sesión…';
        setTimeout(() => auth.signOut(), 1200);
      } else {
        errEl.textContent = `PIN incorrecto (${attempts}/${MAX_ATTEMPTS})`;
        input.focus();
      }
    }

    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') attempt(); });

    async function tryBio() {
      errEl.textContent = '';
      try {
        if (await unlockBiometric()) { cleanup(); resolve(); }
        else errEl.textContent = 'Biometría no reconocida. Usa tu PIN.';
      } catch { errEl.textContent = 'Biometría cancelada. Usa tu PIN.'; }
    }

    const bioBtn = isBiometricEnabled()
      ? el('button', { class: 'btn btn--ghost', type: 'button', text: 'Usar huella / Face ID', on: { click: tryBio } })
      : null;

    overlayEl = el('div', { class: 'applock', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Aplicación bloqueada' }, [
      el('div', { class: 'applock__card' }, [
        el('div', { class: 'applock__icon', html: icon('settings') }),
        el('h2', { class: 't-h2', text: 'FinanceOS bloqueado' }),
        el('p', { class: 't-caption text-secondary', text: 'Ingresa tu PIN para continuar.' }),
        input,
        errEl,
        el('button', { class: 'btn btn--primary', type: 'button', text: 'Desbloquear', on: { click: attempt } }),
        bioBtn,
        el('button', {
          class: 'btn btn--ghost btn--sm', type: 'button', text: '¿Olvidaste tu PIN? Iniciar sesión de nuevo',
          on: { click: () => auth.signOut() },
        }),
      ].filter(Boolean)),
    ]);
    document.body.append(overlayEl);
    document.body.classList.add('modal-open');
    // Intento biométrico automático (best-effort; si el navegador exige gesto, queda el botón).
    if (bioBtn) setTimeout(() => tryBio().catch(() => {}), 100);
    else setTimeout(() => input.focus(), 50);

    function cleanup() {
      overlayEl?.remove();
      overlayEl = null;
      locked = false;
      document.body.classList.remove('modal-open');
    }
  });
}

// Gate de arranque: si hay PIN configurado, exige desbloqueo antes de montar la app.
export function gateOnStartup() {
  return showLock();
}

// Auto-lock: bloquea tras inactividad y al pasar la app a segundo plano.
export function startAutoLock() {
  if (!isEnabled()) return;
  const reset = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => showLock(), AUTOLOCK_MS);
  };
  ['pointerdown', 'keydown'].forEach((ev) => addEventListener(ev, reset, { passive: true }));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) showLock(); else reset();
  });
  reset();
}
