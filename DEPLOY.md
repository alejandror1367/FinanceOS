# Despliegue del frontend (GitHub Pages)

FinanceOS es estático: GitHub Pages lo sirve tal cual. La app se instala como PWA
en el celular ("Agregar a pantalla de inicio").

## Modelo de seguridad: Google OAuth (no token)

La autenticación es por **Google OAuth (Google Identity Services)**. El token
compartido quedó obsoleto (`api.token: null` en `src/core/config.js`); el backend ya
no lo usa.

Esto cambia por completo las consideraciones de privacidad respecto a versiones
anteriores:

- **El repo puede ser público sin filtrar secretos.** Lo que viaja al navegador es el
  `clientId` de OAuth, que **no es secreto** (está pensado para ser público). La
  protección real es que el backend de Apps Script valida el `id_token` de Google y
  **solo acepta los emails de `allowedEmails`** (en `backend/Config.gs`).
- Si alguien abre la URL del sitio sin estar autenticado con un email autorizado, ve la
  pantalla de login y **no** puede leer ni escribir datos.
- Para añadir/quitar acceso: edita `allowedEmails` en `backend/Config.gs` y publica una
  **nueva versión** del Web App.

> **Claves que SÍ son secretas:** si en el futuro se integran APIs de pago (IA como
> OpenAI, o datos de mercado como Alpha Vantage / Twelve Data), sus claves **no** deben
> ir en `config.js` ni en el repo. Úsalas tras un proxy server-side (Apps Script o
> Cloudflare Worker) que guarde la clave en Script Properties / secrets. Ver
> `CLAUDE.md` → "Seguridad".

## Configuración necesaria antes de publicar

En `src/core/config.js`:

- `api.baseUrl` — URL `/exec` del Web App de Apps Script.
- `auth.clientId` — Client ID de OAuth (Google Cloud Console).

En **Google Cloud Console** (proyecto OAuth), añade el origen autorizado del sitio:
`https://<usuario>.github.io`.

Con `api.baseUrl = null` la app funciona en modo local con datos mock.
Con `auth.clientId` vacío, la autenticación de Google está desactivada.

## Pasos (repo + Pages)

1. Crea un repositorio en GitHub.
2. Añade el remoto y sube el código:
   ```bash
   git remote add origin https://github.com/<usuario>/FinanceOS.git
   git branch -M main
   git push -u origin main
   ```
   > `src/core/config.js` debe estar commiteado con tu `baseUrl` y `clientId`. Como el
   > `clientId` no es secreto y la auth es por OAuth, el repo puede ser público.
3. En GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**,
   rama `main`, carpeta `/ (root)`. Guarda.
4. Espera el despliegue. Tu sitio quedará en `https://<usuario>.github.io/FinanceOS/`.
   El archivo `.nojekyll` (ya incluido) evita el procesamiento Jekyll.

## Instalar en el celular

1. Abre la URL `https://<usuario>.github.io/FinanceOS/` en el navegador del teléfono.
2. **Android/Chrome:** menú ⋮ → "Instalar app" / "Agregar a pantalla de inicio".
   **iOS/Safari:** Compartir → "Agregar a pantalla de inicio".
3. Se instala como PWA (pantalla completa, offline-first, atajos a Hoy/Transacciones/etc.).
4. Inicia sesión con uno de los emails autorizados.

## CORS

El Web App de Apps Script debe estar desplegado como **"Cualquiera con el enlace"**
para que la PWA pueda llamarlo desde otro origen (`github.io`). El acceso no lo
restringe el modo de despliegue, sino la **validación del `id_token` de OAuth** contra
`allowedEmails` en el backend.

## Actualizaciones

Cada `git push` actualiza el sitio. El Service Worker usa estrategia **network-first**
para JS/CSS: un `F5` tras el primer load ya trae la versión nueva. La app detecta el SW
nuevo, envía `SKIP_WAITING` y recarga automáticamente (sin `Ctrl+Shift+R`).

El hook `.githooks/pre-commit` auto-bumpea la versión del Service Worker cuando se
commitean archivos del shell (`src/`, `index.html`, `manifest.json`, `assets/`),
evitando que el PWA mobile sirva caché obsoleta. Actívalo una vez por clon:

```bash
git config core.hooksPath .githooks
```
