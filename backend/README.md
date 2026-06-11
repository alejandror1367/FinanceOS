# Backend — FinanceOS (Google Apps Script)

Backend y contrato de datos.
Base de datos: **Google Sheets** (`FinanceOS_DB`, 13 hojas). Lógica: **Google Apps Script**.
El frontend nunca conoce Sheets; solo el contrato `action`-based.

> ⚠️ El código se versiona aquí, pero **el despliegue lo haces tú** con tu cuenta de Google. Sigue los pasos.

---

## Archivos

| Archivo | Rol |
|---|---|
| `Config.gs` | Constantes (`APP`), **esquemas** de hojas (`SCHEMAS`), enums (`ENUMS`), `allowedEmails`, `googleClientId`. |
| `Utils.gs` | Acceso a Sheets, **repositorio genérico**, mapeo fila↔objeto, validación, ids, timestamps. |
| `Code.gs` | `doGet`/`doPost`, **router por `action`** (`ROUTES`), `assertAuthorized_`, respuesta estándar. |
| `Auth.gs` | `verifyGoogleToken_` — valida el `id_token` de Google contra `allowedEmails` (cacheado en `CacheService`). |
| `Setup.gs` | `setupDatabase()` — crea el spreadsheet, las 13 hojas y datos semilla (idempotente). |
| `Accounts.gs` · `Transactions.gs` · `Categories.gs` · `Budgets.gs` · `Goals.gs` · `Investments.gs` · `Assets.gs` · `Liabilities.gs` · `Recurring.gs` · `Journal.gs` · `Settings.gs` | CRUD por entidad con validación + auditoría. |
| `NetWorth.gs` | Snapshots de patrimonio (`getNetWorth`, `getNetWorthSnapshots`). |
| `Reports.gs` | `getDashboard`, `computeNetWorth_` (valores derivados, no persistidos). |
| `Quotes.gs` | `getQuotes` — cotizaciones en vivo (Yahoo Finance) para inversiones. |
| `Import.gs` | `parseStatement` — proxy a la API de Gemini para parsear extractos bancarios (`#/import`). |
| `EmailCapture.gs` | **Sprint K** — captura automática de compras desde Gmail: trigger temporal + parsers RappiCard/Bancolombia + `runEmailCapture`. Ver §"Captura desde Gmail". |
| `Migration.gs` | `recalculateAccountBalances_` — recálculo de saldos desde transacciones (TD-01). |
| `Audit.gs` | Registro en `AuditLog`. |
| `appsscript.json` | Manifiesto (runtime V8, web app). |

---

## Modelo de autorización: Google OAuth

Toda acción (salvo `ping`) exige un **`id_token` de Google** válido emitido para uno de
los emails en `allowedEmails` (`Config.gs`). El router (`assertAuthorized_` en `Code.gs`)
delega la verificación a `verifyGoogleToken_` (`Auth.gs`), que valida el token y cachea
el resultado ~25 min en `CacheService`.

- El frontend envía el `idToken` en el parámetro de la petición (GET) o en el cuerpo (POST).
- **No hay token compartido.** `api.token` quedó obsoleto (`null`) — no lo uses.
- Para añadir/quitar acceso: edita `allowedEmails` en `Config.gs` y publica **Nueva versión**.

---

## Despliegue (una vez)

1. Ve a <https://script.google.com> → **Nuevo proyecto**. Nómbralo `FinanceOS`.
2. Activa el manifiesto: ⚙️ *Configuración del proyecto* → marca **"Mostrar `appsscript.json`"**.
3. Copia **el contenido de cada archivo** de esta carpeta a un archivo con el mismo nombre en el editor (los `.gs` como *Script*, `appsscript.json` como el manifiesto). El orden no importa: las funciones son globales.
4. Configura OAuth en `Config.gs`:
   - `googleClientId` — el Client ID de OAuth (Google Cloud Console → Credenciales).
   - `allowedEmails` — los correos autorizados a usar la app.
5. Guarda. En el selector de funciones elige **`setupDatabase`** y pulsa **Ejecutar**.
   - Autoriza los permisos cuando lo pida (acceso a Sheets de tu cuenta).
   - En *Registros* (Ver → Registros) verás el **ID y la URL** del nuevo `FinanceOS_DB`. Ábrelo: tendrá las **13 hojas** con cabeceras + categorías y settings semilla.
6. **Implementar** → *Nueva implementación* → tipo **Aplicación web**:
   - *Ejecutar como*: **Yo**.
   - *Quién tiene acceso*: **Cualquiera con el enlace**.
     > Necesario para que la PWA pueda llamar al endpoint sin login interactivo de
     > Apps Script (evita bloqueos de CORS/redirección). El acceso real lo restringe la
     > **validación del `id_token` de OAuth** contra `allowedEmails`, no el modo de despliegue.
   - Copia la **URL `/exec`**. Va en `src/core/config.js → api.baseUrl`, y el
     `clientId` de OAuth en `src/core/config.js → auth.clientId`.

> Si cambias el código luego, usa *Implementar → Gestionar implementaciones → editar → Nueva versión* para que la URL `/exec` sirva lo último.

> **Claves de APIs externas** (p. ej. Gemini para `Import.gs`) van en *Propiedades del
> script*, **nunca** en el repo ni en el frontend. El backend actúa de proxy.

---

## Contrato de la API

- **Lecturas** → `GET {URL}?action=getDashboard&idToken=...`
- **Escrituras** → `POST {URL}` con cuerpo JSON `{ "action": "createTransaction", "idToken": "...", "data": { ... } }`

Respuesta estándar:
```json
{ "success": true,  "data": { } }
{ "success": false, "error": "mensaje" }
```

### Acciones
```
Lectura (GET) : ping · getDashboard · getNetWorth · getNetWorthSnapshots · getReports
                getAccounts · getTransactions · getCategories · getBudgets
                getGoals · getInvestments · getAssets · getLiabilities
                getRecurring · getJournal · getSettings · getQuotes
Escritura(POST): createAccount/updateAccount/deleteAccount
                createTransaction/updateTransaction/deleteTransaction
                createCategory/updateCategory/deleteCategory
                createBudget/updateBudget/deleteBudget
                createGoal/updateGoal/deleteGoal
                createInvestment/updateInvestment/deleteInvestment
                createAsset/updateAsset/deleteAsset
                createLiability/updateLiability/deleteLiability
                createRecurring/updateRecurring/deleteRecurring
                createJournal/updateJournal/deleteJournal
                setSetting
                recalculateBalances        (recálculo de saldos — TD-01)
                parseStatement             (parsing de extractos con Gemini)
                runEmailCapture            (corrida manual de la captura Gmail — Sprint K)
```

---

## Captura de compras desde Gmail (Sprint K)

`EmailCapture.gs` lee los correos de alerta de compra (RappiCard y Bancolombia) en el
Gmail de la cuenta que ejecuta el script y crea la transacción como gasto en la tarjeta
correspondiente (fecha+hora, monto, comercio, categoría). Idempotente por `messageId`
(`id = gm_<messageId>`): re-ejecutar nunca duplica. Lo no parseable queda etiquetado
`FinanceOS/revisar` y auditado — jamás se pierde en silencio.

**Puesta en marcha (una vez):**
1. Copia `EmailCapture.gs` al proyecto de Apps Script y **guarda** → al ejecutar pedirá
   re-autorizar con el scope de Gmail. Acepta.
2. Ejecuta **`setupEmailCapture()`** desde el editor: crea las etiquetas
   `FinanceOS/procesado` y `FinanceOS/revisar`, las claves de Settings y el **trigger
   cada 15 min** (`processEmailCapture`).
3. En la hoja **Settings** del spreadsheet rellena (editar la celda directamente;
   `setSetting` trunca a 240 chars):
   - `emailcapture.cardmap` → JSON últimos-4-dígitos → accountId de la tarjeta.
   - `emailcapture.fallbackcategoryid` → categoryId (kind=expense) para comercios sin regla.
   - `emailcapture.categoryrules` → JSON `[["REGEX","categoryId"], ...]` (primera que matchea gana).
   - `emailcapture.enabled` → `true` / `false` (apagado de emergencia sin tocar el trigger).
4. Publica **Nueva versión** de la implementación (para exponer la acción `runEmailCapture`).

**Prueba:** ejecuta `processEmailCapture()` desde el editor (o POST `runEmailCapture`)
y revisa el resumen `{ created, skipped, review, scanned }` + la hoja Transactions.

**Notas de diseño:**
- El trigger toma el **mismo `ScriptLock`** que `doPost` (no se pisa con escrituras del
  frontend); si no lo consigue en 20 s, lo reintenta el próximo run.
- La búsqueda re-escanea `newer_than:7d` sin filtrar por etiqueta: la idempotencia por id
  hace el dedup real; las etiquetas son solo trazabilidad humana.
- Los correos reenviados desde otro Gmail (filtro de reenvío) conservan remitente y cuerpo
  originales → los parsers funcionan igual.
- Parsers testeados en Node contra fixtures reales: `node --test tests/emailCapture.test.js`.

---

## Pruebas rápidas

**Desde el editor (sin desplegar):**
- Ejecuta `setupDatabase()` y revisa el spreadsheet.
- Pega en un archivo temporal y ejecuta para probar el dashboard:
  ```js
  function _test() {
    var dash = getDashboard_({});
    Logger.log(JSON.stringify(dash, null, 2));
  }
  ```

**Desde el navegador (ya desplegado):**
- `{URL}?action=ping` → `{ "success": true, "data": { "pong": true, ... } }` (no requiere auth).
- Cualquier otra acción sin un `idToken` válido → `{ "success": false, "error": "No autorizado." }`.

---

## Notas

- **Soft delete**: el borrado marca `isDeleted=true`; nada se elimina físicamente (preserva auditoría e histórico).
- **Valores derivados** (patrimonio, rentabilidad, ahorro) se calculan en `Reports.gs`; nunca se guardan.
- **CORS**: el frontend hace `POST` con `Content-Type: text/plain` y lee la respuesta JSON; así se evita el *preflight* que Apps Script no maneja. Las lecturas van por `GET`.
- **IDs**: generables en cliente (offline) o por el backend (`newId_`, estilo ULID). El backend respeta el `id` recibido si viene.
