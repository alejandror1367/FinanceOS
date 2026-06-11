# Perfiles PDF de extractos — diseño (Sprint L)

**Fecha:** 2026-06-11 · **Fuente:** extractos reales del dueño analizados localmente
(`tests/fixtures/import/private/`, gitignored — aquí solo estructura y ejemplos sintéticos).

Los PDFs de Nu y RappiCuenta están **protegidos con contraseña** (el dueño la ingresa en
`#/import` al subirlos; jamás se guarda). El Amex no tiene contraseña y además existe en
**XLSX** (vía preferida si el parser de Excel lo soporta limpio).

---

## 1. Soporte de contraseña (prerequisito)

`src/services/parsers/pdfParser.js`: `getDocument({ data, password })`. PDF.js lanza
`PasswordException` (`name: 'PasswordException'`) si falta o es incorrecta →
`#/import` muestra campo de contraseña y reintenta. La contraseña vive solo en memoria
durante el parse.

## 2. Perfil Nu TC (PDF, página 2+)

Estructura (texto extraído con el agrupado por filas del pdfParser):

```
Fecha  Descripción     Valor     Cuotas     Valor     Interés del mes    Total a pagar     Restante
  09 MAY  Gracias por tu  $450.450,50     -$24.838,05
2026  pago
  29 ABR  Amazon Prime     $24.900,00     1 de 1     $24.900,00  1.97%     $0,00  $24.900,00     $0,00
2026
Intereses en  1.89%     $31,30
mora
```

- **Fecha partida en 2 líneas**: `DD MMM` y luego `YYYY` al inicio de la línea siguiente
  (mes en español abreviado: ENE FEB MAR ABR MAY JUN JUL AGO SEP OCT NOV DIC).
- Compras: `DD MMM <comercio> $monto  N de M  ...` — montos formato CO (`.` miles, `,` decimales).
- Pagos: descripción "Gracias por tu pago", monto del abono en columna posterior (negativo).
- Sub-filas "Intereses en mora" → ignorar como movimiento (son detalle del renglón anterior).
- Importar como: compra → `expense` en cuenta Master NuBank por el **valor total** de la
  compra en su fecha (las cuotas son financiación, el gasto ya ocurrió); pago → `transfer`/abono (decisión abierta D2).

## 3. Perfil Amex Bancolombia (PDF páginas PESOS / XLSX)

```
458659     03/05/2026       DL*DIDI RIDES CO  $ 36.400,00     1/1     $ 36.400,00     0,0000 %     00,0000 %     $ 0,00
191651     05/05/2026       ABONO SUCURSAL VIRTUAL  $ -2.886.877,00     $ -2.886.877,00     $ 0,00
```

- Fila: `[nºauth]  DD/MM/YYYY  DESCRIPCIÓN  $ monto  [n/m]  $ cuota  [%  %]  $ saldo`.
- Montos formato CO. Negativos = abonos/devoluciones.
- **Solo la sección "Nuevos movimientos entre <periodo>"** — la sección
  "Movimientos antes de <fecha>" son cuotas de compras viejas: importarlas duplicaría.
- Cargos sin nº de auth (INTERESES CORRIENTES, CUOTA DE MANEJO, IVA...) → gastos válidos
  (categoría Comisiones/Impuestos por reglas).
- Hay **estado de cuenta en DOLARES** separado (mismas páginas, `Moneda: DOLARES`):
  movimientos en USD → tx en USD con sello FX (mismo contrato TD-54).
- Cabeceras vienen TRIPLICADAS en el texto extraído (`Tarjeta: ... x3`) — artefacto del
  render de columnas; las filas de datos son únicas.
- **XLSX disponible**: evaluar `excelParser.js` primero; si las filas salen limpias,
  el perfil Amex se hace sobre XLSX y el PDF queda de respaldo.

## 4. Perfil RappiCuenta (PDF — cierra F.5)

```
  Detalles de movimientos     Del 1 MAY - 31 MAY (31 días)
  Fecha     Descripción     Valor
  11 May 2026     Redención Cashback     +$8,007.87
  31 May 2026     Intereses ganados     +$1,759.57
```

- Fila simple: `DD Mon YYYY  Descripción  ±$monto` — ⚠ montos en **formato US**
  (`,` miles · `.` decimales), al revés que Nu/Amex. `+` = ingreso.
- Cuenta destino: RappiPay/RappiCuenta (savings).

## 5. Decisiones abiertas (dueño)

- **D1:** compras en cuotas → importar valor TOTAL en la fecha de compra (recomendado:
  así modela la app la deuda de CC) vs. una tx por cuota. **Propuesta: total.**
- **D2:** pagos/abonos del extracto → ¿importar como `transfer` desde la cuenta pagadora
  o saltarlos (ya existen como transferencia manual/captura)? **Propuesta: saltarlos por
  defecto con opción de incluirlos** (el dupKey no los cubre si la contraparte difiere).
- **D3:** falta el extracto PDF de la **tarjeta RappiCard** (el subido era RappiCuenta).

## 6. Tareas (Sprint L)

| # | Tarea | Esf |
|---|---|---|
| L.1 | Password en `pdfParser.js` + campo de contraseña en `#/import` (reintento en `PasswordException`) | S |
| L.2 | Perfil RappiCuenta (PDF texto, formato US) + fixture sintético + tests — cierra F.5 | S |
| L.3 | Evaluar XLSX Amex con `excelParser.js`; perfil Amex (XLSX o PDF): solo "Nuevos movimientos", negativos=abono, sección USD aparte | M |
| L.4 | Perfil Nu TC (PDF): fecha 2 líneas, cuotas, ignorar sub-filas de mora | M |
| L.5 | K.7: verificar dedup contra compras ya capturadas por email (gm_) — puede requerir normalización extra de descripción | S |
| L.6 | Verificación en vivo con los PDFs reales en `#/import` (preview correcto, 0 duplicados) | S |
