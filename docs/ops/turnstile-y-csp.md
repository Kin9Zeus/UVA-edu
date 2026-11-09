# Turnstile y CSP obligatoria (fase 4 del plan de blindaje)

## Qué hace Turnstile

El recuadro anti-bots de Cloudflare aparece solo en los formularios que usa
alguien **sin sesión**: la contraseña al entrar, el registro, recuperar la
contraseña y reenviar el correo de verificación. Con la sesión iniciada no
aparece nunca. Modo **Managed**: casi siempre se marca solo; si la visita
parece sospechosa (VPN, red rara), pide un clic. Nunca acertijos de imágenes.

**Quién lo valida: Supabase Auth, no la app.** Con el CAPTCHA activado en
Supabase, `/signup`, `/token` (contraseña), `/recover` y `/resend` exigen el
token (fuente: `supabase/auth`, `internal/api/api.go`, `verifyCaptcha`). No
lo exigen: confirmar enlaces del correo (`/verify`), Google, renovar la
sesión, ni las llamadas con la llave maestra.

| Pieza | Dónde |
| --- | --- |
| El recuadro (carga el script de Cloudflare, español, tema de la app, compacto a 320 px, token nuevo tras cada intento) | `src/components/auth/VerificacionTurnstile.tsx` |
| Reglas compartidas (campo del token, rechazo del captcha, mensaje) | `src/lib/turnstile.ts` |
| Las 4 acciones pasan `captchaToken` | `src/actions/auth/{login,registro,recuperar,reenviar-verificacion}.ts` |
| Confirmar la contraseña en el perfil, sin captcha y sin tocar la sesión | `src/lib/auth/passwordActual.ts` |
| CSP: `challenges.cloudflare.com` en `script-src` y `frame-src` (era `'none'`) | `src/lib/csp.ts` |

Detalles que importan:
- **Un rechazo del captcha no es una contraseña equivocada:** no suma al
  límite de 5 intentos ni registra `login_fallido`.
- **Recuperar y reenviar** responden "listo" siempre (para no revelar qué
  correos existen), salvo si el captcha falló: ahí el correo no salió, y se
  avisa. No revela nada: falla igual con cualquier correo. Ojo: el intento
  ya contó para su propio límite (1 reenvío por minuto).
- **Cambiar contraseña y eliminar la cuenta** confirman la contraseña actual
  con un cliente aparte de llave maestra (Supabase no le pide captcha) y
  cierran esa sesión de prueba. Antes usaban la sesión de la persona, que
  quedaba reemplazada por una nueva de nivel aal1: un administrador perdía
  su verificación en dos pasos al cambiar la contraseña.
- **Sin `NEXT_PUBLIC_TURNSTILE_SITE_KEY` no aparece el recuadro.** Es lo que
  permite el orden seguro de abajo.
- La llave **secreta** vive solo en Supabase. La app nunca la tiene.

## Llaves de prueba de Cloudflare (públicas)

| | Llave pública (sitekey) | Llave secreta |
| --- | --- | --- |
| Siempre aprueba | `1x00000000000000000000AA` | `1x0000000000000000000000000000000AA` |
| Siempre rechaza | `2x00000000000000000000AB` | `2x0000000000000000000000000000000AA` |

Con llave de prueba el recuadro muestra una franja roja "Solo para
pruebas": es normal y no aparece con las llaves reales. El token que da es
siempre `XXXX.DUMMY.TOKEN.XXXX`; la secreta de prueba lo acepta, la real no.

## Encenderlo: STAGING primero

1. **Cada desarrollador**, ANTES del paso 2: agregar a su `.env.local`
   ```
   NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
   ```
   y reiniciar `npm run dev`. Sin esto, cuando staging exija el captcha, no
   podrá iniciar sesión en local.
2. Supabase **staging** → Authentication → **Bot and Abuse Protection** →
   Enable CAPTCHA protection → proveedor **Cloudflare Turnstile** → llave
   secreta **de prueba** `1x0000000000000000000000000000000AA` → Save.
3. Comprobar: en local, entrar, registrarse y recuperar contraseña.
4. El CI ya está listo: los jobs que construyen la app usan la llave pública
   de prueba, y `scripts/rls-test.ts` manda el token de prueba al iniciar
   sesión.

## Encenderlo: PRODUCCIÓN (el orden importa; al revés nadie entra)

1. Cloudflare → **Turnstile** → **Add widget**:
   - Nombre: `UVA plataforma`.
   - Hostnames: `beta.uvarq.com` y `www.uvarq.com` (y el dominio final, si
     es otro).
   - Widget mode: **Managed**.
   - Pre-clearance: **No**.
   Anotar en el gestor la llave pública (Site Key) y la secreta (Secret Key).
2. Railway, servicio de la app: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` = la Site
   Key **real**. Es `NEXT_PUBLIC_`: entra al compilar, así que hace falta un
   despliegue nuevo, no solo reiniciar.
3. **Probar con el CAPTCHA todavía apagado en Supabase:** el recuadro
   aparece en `/login` (paso de la contraseña), `/registro` y `/recuperar`, se
   marca solo, y entrar, registrarse y recuperar funcionan.
4. **Recién entonces**, Supabase **producción** → Bot and Abuse Protection →
   Enable CAPTCHA → Cloudflare Turnstile → la Secret Key **real** → Save.
5. Probar otra vez lo del paso 3, y además cambiar la contraseña en el perfil.

**Volver atrás:** apagar el CAPTCHA en Supabase (un clic). La app sigue
mandando el token y Supabase lo ignora. Para quitar el recuadro: borrar
`NEXT_PUBLIC_TURNSTILE_SITE_KEY` en Railway y redesplegar.

## CSP obligatoria (parte C, después de Turnstile)

Hoy la política va como `Content-Security-Policy-Report-Only`
(`src/proxy.ts`): reporta a Sentry, no bloquea.

1. Con Turnstile ya encendido en producción, revisar en Sentry los reportes
   de CSP de unos días (Issues, buscar "csp"). Si solo hay extensiones del
   navegador, seguir.
2. En local con la política obligatoria, recorrer: portada, catálogo, ficha
   de curso, login con correo y con Google, registro, un video, panel de
   administración, Comunidad con adjunto. Sin bloqueos en la consola.
3. Cambiar el nombre del encabezado de respuesta a `Content-Security-Policy`
   (sigue reportando por `report-uri`).
4. Desplegar y vigilar Sentry. Volver atrás: revertir esa línea.

Con la CSP obligatoria también desaparece el aviso de consola
"upgrade-insecure-requests is ignored when delivered in a report-only
policy", que hoy sale en cada página.
