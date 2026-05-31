# Backend — FinanceOS (Google Apps Script)

Fase 2 · Backend y contrato de datos.
Base de datos: **Google Sheets** (`FinanceOS_DB`). Lógica: **Google Apps Script**.
El frontend nunca conoce Sheets; solo el contrato `action`-based.

> ⚠️ El código se versiona aquí, pero **el despliegue lo haces tú** con tu cuenta de Google. Sigue los pasos.

---

## Archivos

| Archivo | Rol |
|---|---|
| `Config.gs` | Constantes, **esquemas** de hojas, enums. |
| `Utils.gs` | Acceso a Sheets, **repositorio genérico**, mapeo fila↔objeto, validación, ids, timestamps. |
| `Code.gs` | `doGet`/`doPost`, **router por `action`**, respuesta estándar. |
| `Audit.gs` | Registro en `AuditLog`. |
| `Setup.gs` | `setupDatabase()` — crea el spreadsheet, hojas y datos semilla. |
| `Accounts.gs` · `Transactions.gs` · `Categories.gs` · `Budgets.gs` · `Goals.gs` · `Investments.gs` · `Assets.gs` · `Liabilities.gs` · `Recurring.gs` · `Settings.gs` | CRUD por entidad con validación + auditoría. |
| `Reports.gs` | `getDashboard`, `getNetWorth` (valores derivados, no persistidos). |
| `appsscript.json` | Manifiesto (runtime V8, web app privada). |

---

## Despliegue (una vez)

1. Ve a <https://script.google.com> → **Nuevo proyecto**. Nómbralo `FinanceOS`.
2. Activa el manifiesto: ⚙️ *Configuración del proyecto* → marca **"Mostrar `appsscript.json`"**.
3. Copia **el contenido de cada archivo** de esta carpeta a un archivo con el mismo nombre en el editor (los `.gs` como *Script*, `appsscript.json` como el manifiesto). El orden no importa: las funciones son globales.
4. Guarda. En el selector de funciones elige **`setupDatabase`** y pulsa **Ejecutar**.
   - Autoriza los permisos cuando lo pida (acceso a Sheets de tu cuenta).
   - En *Registros* (Ver → Registros) verás el **ID y la URL** del nuevo `FinanceOS_DB`. Ábrelo: tendrá las 12 hojas con cabeceras + categorías y settings semilla.
5. **Implementar** → *Nueva implementación* → tipo **Aplicación web**:
   - *Ejecutar como*: **Yo**.
   - *Quién tiene acceso*: **Solo yo** (app privada).
   - Copia la **URL `/exec`**. Esa URL es la que usará el frontend en la **Fase 3** (irá en `src/core/config.js → api.baseUrl`).

> Si cambias el código luego, usa *Implementar → Gestionar implementaciones → editar → Nueva versión* para que la URL `/exec` sirva lo último.

---

## Contrato de la API

- **Lecturas** → `GET {URL}?action=getDashboard`
- **Escrituras** → `POST {URL}` con cuerpo JSON `{ "action": "createTransaction", "data": { ... } }`

Respuesta estándar:
```json
{ "success": true,  "data": { } }
{ "success": false, "error": "mensaje" }
```

### Acciones
```
Lectura : ping · getDashboard · getNetWorth · getReports
          getAccounts · getTransactions · getCategories · getBudgets
          getGoals · getInvestments · getAssets · getLiabilities
          getRecurring · getSettings
Escritura: createAccount/updateAccount/deleteAccount
          createTransaction/updateTransaction/deleteTransaction
          createCategory/updateCategory/deleteCategory
          createBudget/updateBudget/deleteBudget
          createGoal/updateGoal/deleteGoal
          createInvestment/updateInvestment/deleteInvestment
          createAsset/updateAsset/deleteAsset
          createLiability/updateLiability/deleteLiability
          createRecurring/updateRecurring/deleteRecurring
          setSetting
```

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
- `{URL}?action=ping` → `{ "success": true, "data": { "pong": true, ... } }`
- `{URL}?action=getDashboard` → KPIs calculados.

**Escritura (ejemplo con curl, POST como text/plain para evitar preflight CORS):**
```bash
curl -L -X POST "{URL}" \
  -H "Content-Type: text/plain" \
  -d '{"action":"createAccount","data":{"name":"Efectivo","type":"cash","balance":500000}}'
```

---

## Notas

- **Soft delete**: el borrado marca `isDeleted=true`; nada se elimina físicamente (preserva auditoría e histórico).
- **Valores derivados** (patrimonio, rentabilidad, ahorro) se calculan en `Reports.gs`; nunca se guardan.
- **CORS / Fase 3**: el frontend hará `POST` con `Content-Type: text/plain` y leerá la respuesta JSON; así se evita el *preflight* que Apps Script no maneja. Las lecturas van por `GET`.
- **IDs**: generables en cliente (offline) o por el backend (`newId_`, estilo ULID). El backend respeta el `id` recibido si viene.
