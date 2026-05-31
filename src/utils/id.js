// utils/id.js — generación de identificadores únicos (cliente).
// Preferimos un esquema ordenable temporalmente (estilo ULID simplificado),
// con fallback a crypto.randomUUID. Soporta Optimistic UI offline.

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32

function randomChars(len) {
  let out = '';
  const cryptoObj = globalThis.crypto;
  if (cryptoObj && cryptoObj.getRandomValues) {
    const buf = new Uint8Array(len);
    cryptoObj.getRandomValues(buf);
    for (let i = 0; i < len; i++) out += ENCODING[buf[i] % 32];
  } else {
    for (let i = 0; i < len; i++) out += ENCODING[Math.floor(Math.random() * 32)];
  }
  return out;
}

// ULID-like: 10 chars de tiempo + 16 de aleatoriedad.
export function ulid(time = Date.now()) {
  let t = time;
  let timeChars = '';
  for (let i = 0; i < 10; i++) {
    timeChars = ENCODING[t % 32] + timeChars;
    t = Math.floor(t / 32);
  }
  return timeChars + randomChars(16);
}

export function uuid() {
  if (globalThis.crypto && globalThis.crypto.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return ulid();
}

export const newId = ulid;
