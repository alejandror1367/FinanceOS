# Resumen de sesión — 2026-06-10/11

## Resumen ejecutivo

Sesión que cierra la v1.0 (criterios 16/16) y entrega el **Sprint K completo en
producción**: captura automática de compras con tarjeta de crédito desde Gmail.
También se cerró J.5 (2º email documentado), el QA en vivo I.1 con sesión real
(64 combinaciones, 0 errores), TD-55/56 (overflow 375px) y dos fixes estructurales
descubiertos por la verificación en vivo: el precache del SW servía assets viejos
(HTTP cache de GitHub Pages) y el backend devolvía fechas en UTC (compras nocturnas
caían al día siguiente).

## Cambios implementados

| Cambio | Impacto |
|---|---|
| J.5: 2º email confirmado y documentado en `Config.gs` | Riesgo de seguridad cerrado; app sigue monousuario |
| Verificaciones en vivo A–H (JWT prueba + IndexedDB + sesión real) | 7 features confirmadas en prod; limpieza total verificada |
| I.1 QA con sesión real: 16 rutas × 2 viewports × 2 temas | **v1.0: criterios 16/16 ✅** — 0 errores JS/red |
| TD-55/56: fixes CSS overflow 375px (`8655293`) | 16/16 rutas sin scroll lateral en móvil |
| Precache SW con `cache: 'reload'` (`14dd401`) | Cada deploy sirve assets frescos; antes podía congelar CSS de hasta 10 min |
| **Sprint K** — `EmailCapture.gs` + reglas + deploy (`1056f3f`…`ce31e08`) | Compras de RappiCard y Amex Bancolombia entran solas a Transacciones en ≤15 min, con comercio, fecha+hora, cuenta y categoría |
| `coerce_` fechas en hora local Bogotá (`ce31e08`, desplegado) | Agrupación por día/mes correcta para tx con hora |
| K.8 verificado en vivo | Tx real creada (Amazon Prime Video → RappiCard → Suscripciones), idempotencia probada |

## Archivos modificados

`backend/EmailCapture.gs` (nuevo) · `backend/EmailCapture.settings.example.json` (nuevo) ·
`backend/Code.gs` · `backend/Utils.gs` · `backend/Config.gs` · `backend/README.md` ·
`src/styles/components.css` · `src/styles/layout.css` · `sw.js` ·
`tests/emailCapture.test.js` (nuevo, 25) · `tests/fixtures/email/` (nuevo) ·
docs (Roadmap-Maestro, TechnicalDebt TD-55/56, handoff, NEXT_SESSION) · `.gitignore`

## Commits

`1ca46c1` J.5 · `e3f11e3` QA I.1 · `8655293` TD-55/56 · `14dd401` SW precache ·
`6e99997` bump v0.2.110 · `036ec9d` docs TD · `abc6a7a`/`d6afef8` Sprint K roadmap ·
`1056f3f` Sprint K núcleo · `7be1aac` filtro solo-compras · `a2c5105` 21 reglas ·
`94e5e08` spam+no-resucitar+diagnóstico · `ce31e08` K.8 fixes · `1063ce7`/`b1c3b7e` docs

## Estado de despliegue

Backend Apps Script **al día** (2026-06-11): `EmailCapture.gs`, `Code.gs`, `Utils.gs`
desplegados por el dueño; scope Gmail autorizado; `setupEmailCapture()` ejecutado
(trigger cada 15 min activo); Settings configurados. Frontend v0.2.110 en Pages.

## Pendiente / no verificado

- **K.7**: el próximo import de extracto no debe duplicar compras ya capturadas por email.
- Amex Bancolombia: confirmar si su PDF de extracto tiene contraseña.

## 2ª parte de la sesión (tarde/noche)

| Cambio | Impacto |
|---|---|
| Global66 Smart Card en EmailCapture (`9f2e663`, desplegado) | Compras débito Global66 entran solas, en la moneda del comercio (COP/USD/EUR) con tasa FX sellada; verificado en vivo |
| Regla Servicios ampliada (`64ea7ce`) | ELECTRIFICADORA/ENERGIA/UNE TELCO categorizan solas |
| Análisis de los 4 extractos reales + diseño Sprint L (`478a110`) | `docs/Import-PDF-Perfiles.md`: layouts Nu/Amex/RappiCuenta/RappiCard TC |
| L.1: PDFs con contraseña (`2ba3af6`) | `#/import` pide la contraseña y reintenta; solo en memoria |
| L.2: perfil RappiCuenta por texto (`2ba3af6`) | Primer perfil PDF nativo sin IA — cierra F.5; test contra el extracto real PASA |

**Decisiones del dueño:** D1 cuotas→valor total · D2 pagos del extracto→saltar · D3 PDF RappiCard TC subido.
**Pendiente del dueño:** pegar permisos en `.claude/settings.json` (bloqueado para el agente) · cardmap `7292` + reglas en hoja Settings.
**Tests:** 251/251 · **SW:** v0.2.111.

## Próximas 5 tareas prioritarias

1. **Soporte de PDFs con contraseña** en `pdfParser.js` (`getDocument({password})` +
   reintento en `PasswordException`) y campo de contraseña en `#/import`.
2. **Perfiles PDF por banco** (Nu, RappiCard, Amex Bancolombia): el dueño sube los PDFs
   reales a `tests/fixtures/import/private/` (gitignored), se aprende el layout con la
   tool Read y se escriben parsers deterministas.
3. **Fixtures sintéticos + tests de regresión** por cada perfil PDF (patrón Sprint F).
4. **K.7**: verificar dedup importando el primer extracto real (RappiCard o Amex) —
   puede requerir matching extra si la descripción del extracto difiere del comercio.
5. **F.5**: perfil RappiCuenta (sale gratis del mismo PDF de RappiCard).
