# Despliegue del frontend (GitHub Pages)

FinanceOS es estático: GitHub Pages lo sirve tal cual. La app se instala como PWA
en el celular ("Agregar a pantalla de inicio").

## ⚠️ Antes de publicar: privacidad del token

`src/core/config.js` contiene `api.baseUrl` y `api.token`. **En una app cliente,
ese token viaja al navegador**: cualquiera que abra la página puede leerlo. Por eso:

- **GitHub Pages gratuito requiere repo público** → el token quedaría visible para
  cualquiera que conozca la URL del sitio. Para una app de finanzas personales esto
  **no es recomendable**.
- Opciones más privadas:
  1. **Repo privado + GitHub Pages** (requiere plan de pago de GitHub).
  2. Hosting con control de acceso (Cloudflare Access / Netlify con contraseña).
  3. Mantener la app solo en local / red doméstica.

El token es tu principal protección: usa uno **largo y aleatorio** y trátalo como
una contraseña. Puedes rotarlo cuando quieras (cambia `FINANCEOS_API_TOKEN` en
Apps Script y `api.token` aquí, y redespliega el Web App).

## Pasos (repo + Pages)

1. Crea un repositorio en GitHub (privado si tu plan lo permite).
2. Añade el remoto y sube el código:
   ```bash
   git remote add origin https://github.com/<usuario>/FinanceOS.git
   git branch -M main
   git push -u origin main
   ```
   > Para que la app conecte con el backend, `src/core/config.js` debe estar
   > commiteado con tu `baseUrl`/`token`. Considera lo anterior sobre privacidad.
3. En GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**,
   rama `main`, carpeta `/ (root)`. Guarda.
4. Espera el despliegue. Tu sitio quedará en `https://<usuario>.github.io/FinanceOS/`.
   El archivo `.nojekyll` (ya incluido) evita el procesamiento Jekyll.

## Instalar en el celular

1. Abre la URL `https://<usuario>.github.io/FinanceOS/` en el navegador del teléfono.
2. **Android/Chrome:** menú ⋮ → "Instalar app" / "Agregar a pantalla de inicio".
   **iOS/Safari:** Compartir → "Agregar a pantalla de inicio".
3. Se instala como PWA (pantalla completa, offline-first, atajos a Hoy/Transacciones/etc.).

## CORS

El Web App de Apps Script debe estar desplegado como **"Cualquiera con el enlace"**
para que la PWA pueda llamarlo desde otro origen (`github.io`). La privacidad la
aporta el token, no el modo de acceso.

## Actualizaciones

Cada `git push` actualiza el sitio. La app detecta la nueva versión del Service
Worker y muestra un aviso para recargar.
