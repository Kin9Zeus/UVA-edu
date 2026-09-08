# Bugs / Incidencias — E2E del flujo de canje y acceso

Registro de hallazgos de la tarea "Pruebas end-to-end del flujo de canje de
código y acceso" (E2E-01). Un fallo encontrado por la suite de Playwright o
por los 3 testers manuales se documenta acá, con severidad, ANTES de
cerrarse — nunca solo en un mensaje de chat.

Severidad: **Bloqueante** (rompe el recorrido crítico, no se lanza así) ·
**Alta** (rompe un caso límite obligatorio) · **Media** (UX degradada, hay
rodeo) · **Baja** (cosmético).

## Abiertos

Ninguno abierto por el momento.

## Resueltos

### BUG-001 — `/login` nunca muestra el motivo de un enlace vencido/usado

- **Severidad:** Media
- **Encontrado por:** `e2e/recuperar-password.spec.ts`
- **Dónde:** `src/app/(public)/login/page.tsx` no desestructuraba `error` de
  `searchParams`, y ningún componente bajo `src/components/auth/` leía
  `?error=enlace_invalido`. Ese query param lo agregan tres redirects:
  `src/app/auth/confirm/route.ts:70`, `src/app/(public)/actualizar-password/page.tsx:35`
  y `src/app/auth/callback/route.ts:27`.
- **Repro (antes del fix):** pedir un enlace de recuperación (o de
  verificación) y usarlo dos veces, o abrirlo ya vencido. Caía en `/login`
  sin ningún mensaje — el usuario no sabía si su enlace falló, si escribió
  mal la URL, o si ya inició sesión.
- **Impacto:** no bloqueaba el recorrido crítico (el usuario puede pedir un
  enlace nuevo desde `/recuperar`), pero era fricción exactamente donde el
  MVP no puede permitírsela (checklist: "sin ayuda del equipo técnico").
- **Corrección (2026-09-03):** `LoginPage` ahora lee `error` de
  `searchParams` y se lo pasa a `AuthFlow` como `initialError`. `AuthFlow`
  mapea `enlace_invalido` a "Ese enlace ya no es válido o ya venció. Pide
  uno nuevo." y siembra `checkError` con ese mensaje al montar — reusa el
  mismo alert que ya mostraba el paso de correo, sin UI nueva.
- **Verificado por:** `e2e/recuperar-password.spec.ts` (actualizado para
  afirmar el mensaje en vez de su ausencia) — 2/2 specs en verde contra el
  servidor real.
- **Estado:** corregido.

### BUG-002 — El Rate Limit de Auth de Supabase se agota con muy pocos registros seguidos, y es el MISMO para la suite y para producción

- **Severidad:** Bloqueante (para el lanzamiento, no para este spec en particular)
- **Encontrado por:** corriendo `e2e/recorrido-critico.spec.ts` manualmente
  durante esta tarea — el segundo intento de `supabase.auth.signUp()` en
  menos de una hora ya devolvió `429 over_email_send_rate_limit`.
- **Corrección sobre la primera versión de este hallazgo:** el proyecto YA
  envía los correos de Auth por Resend a través del "Send Email Hook"
  (`src/app/api/webhooks/supabase-auth/route.ts`), no por el mailer
  incorporado de Supabase — así que el cuello de botella NO es la capacidad
  de envío de Resend (esa es alta). El `429 over_email_send_rate_limit` es
  el **Rate Limit de Auth** de Supabase (Dashboard → Authentication → Rate
  Limits, límite de "emails per hour" o equivalente): un tope que Supabase
  aplica a sus propios endpoints (`signUp`, `resetPasswordForEmail`, etc.)
  **antes** de invocar el hook — con Resend detrás o sin él, ese tope existe
  igual y hay que subirlo a mano en el dashboard si su valor actual sigue
  siendo el bajo por defecto pensado para desarrollo.
- **Dónde:** configuración de Auth del proyecto de Supabase (no es código de
  este repo).
- **Repro:** registrar dos o tres cuentas nuevas seguidas (o pedir dos
  recuperaciones de contraseña) en menos de una hora → `signUp()` /
  `resetPasswordForEmail()` empiezan a fallar con `429`, y `registro.ts`
  (línea ~90) lo traduce a "No pudimos crear tu cuenta. Intenta de nuevo."
  — un mensaje que no dice que es un límite temporal.
- **Impacto:** doble, y los dos importan para el lanzamiento del 12-sep:
  1. **Esta misma suite se vuelve inestable si corre más de una vez por
     hora** (`e2e/recorrido-critico.spec.ts`, `registro-login.spec.ts` — los
     dos únicos specs que llaman `signUp()`/`resetPasswordForEmail()` de
     verdad en vez de `admin.createUser()`). En CI, dos despliegues en la
     misma hora ya bastan para que el spec del recorrido crítico falle sin
     que el código tenga ningún bug.
  2. **Como no hay staging separado (el mismo proyecto de Supabase sirve
     desarrollo y producción,** ver memoria del proyecto), este tope es
     compartido con usuarios reales el día del lanzamiento. Un puñado de
     registros o recuperaciones de contraseña seguidas podría dejar a
     estudiantes reales viendo "No pudimos crear tu cuenta" sin ninguna
     explicación real.
- **Sugerencia:** revisar y subir el Rate Limit de Auth en Supabase
  Dashboard → Authentication → Rate Limits ANTES del 12-sep (con un Send
  Email Hook propio configurado, Supabase permite un límite bastante más
  alto que el default — pero hay que fijarlo explícitamente, no queda
  alto solo por tener el hook). Confirmar esto es de las pocas cosas de
  este spec que sí hay que resolver antes de firmar la Definición de
  Terminado.
- **Estado:** corregido — confirmado por el usuario (2026-09-03) que el
  Rate Limit de Auth ya está ajustado en el dashboard de Supabase. Si el
  spec del recorrido crítico vuelve a fallar con `over_email_send_rate_limit`
  en CI, es señal de que el límite bajó o se reseteó, no de un bug de código.

## Plantilla para nuevos hallazgos

```md
### BUG-XXX — <resumen de una línea>

- **Severidad:** Bloqueante | Alta | Media | Baja
- **Encontrado por:** <spec de Playwright, o el nombre de quien probó a mano>
- **Dónde:** <archivo:línea si aplica>
- **Repro:** <pasos mínimos>
- **Impacto:** <qué le pasa al usuario real>
- **Estado:** abierto | en curso | corregido en <commit/PR>
```

---

## Qué cubre esta suite y qué queda fuera (léelo antes de firmar la
Definición de Terminado)

Esta tarea (`docs/qa/bugs-e2e.md` + `e2e/*.spec.ts`) asumió dos correcciones
sobre el enunciado original, confirmadas con quien la pidió:

- **No existe un staging separado.** `playwright.config.ts` y
  `AUDIT-2026-08-24.md` (Ground Truth) ya lo dejaban explícito, y la memoria
  del proyecto confirma que el proyecto de Supabase es el mismo para
  desarrollo y producción. Toda esta suite corre contra ESE proyecto real,
  con usuarios/códigos/progreso desechables creados con la Service Role Key
  y borrados al terminar cada spec (pase o falle) — mismo patrón que
  `scripts/rls-test.ts`, `scripts/webhook-test.ts` y
  `scripts/canje-codigo-test.ts`.
- **El plazo real es días, no semanas** (lanzamiento 12-sep-2026): por eso
  la automatización con Playwright no es "deseable", es la única forma de
  correr este recorrido en cada despliegue.

### CI

`.github/workflows/ci.yml` corre `test:e2e` (Playwright) y `test:canje` en
un job `e2e` propio, después de `rls` — así que el recorrido crítico y sus
casos límite se verifican en cada despliegue de verdad, no solo a mano.
Corre SOLO en push a `master` (o disparo manual), nunca en pull requests
—ni siquiera del propio repo, a diferencia de `rls`—: estos specs llaman
`signUp()`/`resetPasswordForEmail()` de verdad contra el proyecto
compartido con producción, y BUG-002 de abajo ya mostró qué tan rápido se
agota ese límite. `playwright.config.ts` y `scripts/canje-codigo-test.ts`
protegen su `process.loadEnvFile(".env.local")` con `try/catch` (mismo
patrón que `scripts/rls-test.ts`) para no reventar en CI, donde ese archivo
no existe y las variables llegan del entorno.

### Recorrido crítico

| Paso | Cubierto por |
|---|---|
| Recibe código → registro → verifica correo → canjea → catálogo → curso → lección → cierra/vuelve → retoma → completa → certificado | `e2e/recorrido-critico.spec.ts` (un solo spec, de punta a punta) |

**Nota de verificación:** cada paso de este spec corrió contra el servidor
real durante esta tarea (canje, catálogo, reproducción de video real,
guardado de progreso, retomar, disparo del trigger de certificado, y
descarga del PDF, los cinco verificados end-to-end con un usuario creado
por `admin.createUser()`). El tramo de registro real por la pantalla
(`auth.signUp()`) no se pudo re-ejecutar una segunda vez en la misma hora
por el límite de correo de BUG-002 más abajo — ese tramo es exactamente el
mismo código ya probado por `registro-login.spec.ts` (sin cambios), así que
no es lógica nueva sin probar, pero vale la pena una corrida completa de
`recorrido-critico.spec.ts` de punta a punta antes de confiar en él para CI.

Usa el curso semilla real **"Render Fotorrealista con V-Ray"**
(`e2e/supabase-admin.ts:CURSO_FIXTURE`) — 3 lecciones ya procesadas en Mux
con video real y corto (9 s, 31 s, 9 s) — en vez de subir un video de
prueba: así el reproductor, el guardado de progreso (`segundo_actual`) y el
trigger de emisión de certificado (`047_emision_automatica_certificados.sql`)
se ejercitan contra el camino real de la app, no una simulación. La lección
intermedia ("ANDRES", 31 s) se marca completada por fixture directo en vez
de reproducirla — el mecanismo de reproducción ya queda probado con las
otras dos lecciones (la primera y la última, ambas de 9 s), y repetirlo ahí
solo alargaría el spec.

### Casos límite obligatorios

| Caso | Cubierto por |
|---|---|
| Código inválido, agotado, vencido, ya canjeado | `e2e/canje-casos-limite.spec.ts` (por la pantalla real) |
| Canje concurrente del último cupo | `scripts/canje-codigo-test.ts` (`npm run test:canje`) — 8 canjes simultáneos reales (`Promise.all`) contra un cupo de 5, ya en el repo antes de esta tarea. No se duplicó en Playwright: la concurrencia real se prueba mejor con peticiones simultáneas de verdad contra el RPC que con dos `BrowserContext`, que solo agregarían la latencia del navegador sin tocar nada nuevo del `for update` que se quiere probar. |
| Registro con un correo que ya existe | `e2e/registro-correo-existente.spec.ts` |
| Mismo correo, password y después Google | **No automatizado** — ver abajo |
| Reproducción en móvil: red que se cae a mitad de video | `e2e/red-cae-video.spec.ts` — `context.setOffline()`; verifica que el listener de `online` en `VideoPlayer.tsx` reintenta el guardado de inmediato, vía `actualizado_en` |
| Reproducción en móvil: pantalla bloqueada, cambio de app | **No automatizable de verdad** — ver abajo |
| Usuario sin acceso por URL directa a una lección | `e2e/acceso-directo-sin-permiso.spec.ts` |
| Recuperación con enlace ya usado o vencido | `e2e/recuperar-password.spec.ts` (encontró BUG-001 de arriba) |
| Probar con una conexión lenta simulada (requisito de calidad) | `e2e/conexion-lenta.spec.ts` — throttling real vía CDP (`Network.emulateNetworkConditions`, perfil tipo Slow 3G) sobre login, catálogo, ficha del curso y arranque del reproductor |

### Lo que necesita un dispositivo real (no es automatizable con Playwright)

- **Registro con correo + login posterior con Google, mismo correo.**
  Automatizar un consentimiento real de Google en un navegador headless es
  frágil por diseño (Google bloquea activamente logins automatizados) y no
  hay forma limpia de fabricar una identidad Google ya vinculada sin pasar
  por ese consentimiento real. Queda para el pase manual de los 3 testers.
- **Pantalla bloqueada y cambio de app en un celular real.** Un navegador
  headless no tiene pantalla que bloquear ni sistema operativo que
  suspenda la pestaña de verdad — lo más cerca que llega Playwright es
  `visibilitychange` (cambiar de pestaña sí lo dispara de verdad), que
  prueba el código de `sendBeacon`/reintento de `VideoPlayer.tsx` pero no
  el comportamiento real de radio/batería de un dispositivo. Necesita los 3
  testers, en sus propios celulares, con conexión real.

### Definición de "Terminado"

La automatización de arriba es la red de regresión para cada despliegue —
no reemplaza el paso final que pide la tarea: **tres personas distintas,
en dispositivos distintos, completando el recorrido crítico sin ayuda del
equipo técnico**. Cualquier fricción que encuentren en ese pase se registra
acá con la plantilla de arriba, igual que un hallazgo de la suite.
