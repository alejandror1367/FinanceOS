# Fixtures de correos de alerta (Sprint K)

Ejemplos reales de correos de compra con tarjeta, usados para escribir y testear
los parsers de `backend/EmailCapture.gs`. **Anonimizados por el dueño** antes de
commitear (este repo es público).

## Cómo añadir un correo

1. Abre el correo de alerta en Gmail (en PC).
2. Menú `⋮` (arriba a la derecha del correo) → **Mostrar original**.
3. Botón **Copiar al portapapeles** (o **Descargar original** y abre el `.eml` con Bloc de notas).
4. Pega el contenido en el Bloc de notas y guarda en esta carpeta como:
   - `bancolombia-compra-1.txt`, `bancolombia-compra-2.txt`, …
   - `rappicard-compra-1.txt`, `rappicard-compra-2.txt`, …
5. **Antes de guardar, borra o reemplaza** (con `XXXX`) lo que no quieras publicar:
   - Tu nombre completo, número de documento, dirección.
   - El número de tarjeta completo si apareciera (los **últimos 4 dígitos SÍ se dejan**).
   - Enlaces de rastreo largos (los `https://...` kilométricos).
6. **Lo que el parser NECESITA intacto** (no lo borres):
   - Monto y moneda
   - Nombre del comercio
   - Fecha y hora de la compra
   - Últimos 4 dígitos de la tarjeta
   - Asunto del correo y remitente original (línea `From:` / `Subject:`)

> Si "Mostrar original" te resulta engorroso, plan B: selecciona todo el texto
> visible del correo, cópialo y pégalo en el Bloc de notas. Sirve para empezar;
> el original completo es mejor porque trae las cabeceras.

## Estado

- [ ] Bancolombia × 2–3
- [ ] RappiCard × 2–3
