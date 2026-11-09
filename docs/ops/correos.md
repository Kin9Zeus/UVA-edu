# Correo: direcciones, envío y recepción (fase 8.5 del plan de blindaje)

## Direcciones

| Dirección | Para qué | Dónde está en el código |
| --- | --- | --- |
| `soporte@uvarq.com` | Ayuda a estudiantes; "responder a" de **todos** los correos; peticiones de datos personales (Habeas Data) | `CORREO_SOPORTE` en `src/lib/contacto.ts` |
| `seguridad@uvarq.com` | Reportes de vulnerabilidades (`/.well-known/security.txt`) | `CORREO_SEGURIDAD` en `src/lib/contacto.ts`, `public/.well-known/security.txt` |
| Remitente (`RESEND_FROM_EMAIL` en Railway) | El "De:" de los correos. No recibe: por eso todo correo lleva `replyTo` = soporte (`src/emails/marco/envio.ts`) | Variable de Railway |

Hasta el 2026-11-09 las plantillas citaban un buzón en `uva.edu`, que es de
la **Universidad de Virginia** (verificado con `nslookup` el 2026-10-05). Lo
más grave: el correo "tu contraseña fue actualizada" mandaba a escribirle a
otra institución. `src/lib/contacto.test.ts` falla si vuelve.

**Antes de publicar el código, las dos direcciones tienen que recibir correo**
(paso 1). Si no, los "responder a" rebotan.

## Paso 1. Recibir: Cloudflare Email Routing (gratis)

`uvarq.com` no tenía buzón (sin registros MX en la raíz). Email Routing crea
direcciones que **reenvían** a un correo existente del equipo.

1. Cloudflare → `uvarq.com` → **Email** → **Email Routing** → **Get started**.
2. **Destination addresses**: agregar el correo del equipo que va a leer
   soporte y confirmarlo (Cloudflare manda un correo de verificación).
3. **Routing rules → Create address**:
   - `soporte` → el correo del equipo.
   - `seguridad` → quien atiende seguridad (Miguel o Aleck).
4. Cloudflare pide agregar sus registros MX y un SPF en la **raíz**
   (`uvarq.com`). Aceptar: no tocan a `send` (el de Resend) ni al sitio.
5. Probar: escribir desde un Gmail cualquiera a `soporte@uvarq.com` y
   comprobar que llega.

## Paso 2. Enviar: SPF, DKIM y DMARC (el envío ya existe con Resend)

Registros que había en GoDaddy (ya importados a Cloudflare):

| Registro | Valor | Qué hacer |
| --- | --- | --- |
| `TXT resend._domainkey` | `p=MIGf…` (DKIM de Resend) | Dejar |
| `MX send` | `feedback-smtp.sa-east-1.amazonses.com` (10) | Dejar (rebotes de Resend) |
| `TXT send` | `v=spf1 include:amazonses.com ~all` | **Dejar solo este** |
| `TXT send` | `v=spf1 include:dc-fd741b8612._spfm.send.uvarq.com ~all` | **Borrar**: el segundo SPF lo creó la herramienta de GoDaddy. Dos SPF en el mismo nombre invalidan los dos (PermError). Era la causa probable de que los correos llegaran a "no deseados" en Hotmail (Cerebro, 2026-10-19) |
| `TXT dc-fd741b8612._spfm.send` | `v=spf1 include:amazonses.com ~all` | **Borrar**: solo lo usaba el duplicado |
| `TXT _dmarc` | `v=DMARC1; p=quarantine; … rua=mailto:dmarc_rua@onsecureserver.net` | Cambiar el `rua` (abajo) |

**DMARC:** los reportes iban a un servicio de GoDaddy que nadie mira.
Cloudflare → `uvarq.com` → **Email** → **DMARC Management** → activar. Da su
propia dirección de reportes y cambia el `rua`. Se deja `p=quarantine`: DKIM
ya firma bien y el envío lleva tiempo funcionando.

## Paso 3. Comprobar (criterio de terminado de 8.5)

1. Desde la plataforma, provocar un correo real (recuperar contraseña) a una
   cuenta de **Gmail**, una de **Outlook/Hotmail** y una corporativa.
2. En cada una, abrir el original del mensaje ("Mostrar original" en Gmail):
   **SPF, DKIM y DMARC en `pass`**, y que llegue a la bandeja de entrada.
3. **Responder** el correo: debe llegar a `soporte@uvarq.com` (es decir, al
   correo del equipo, por el reenvío).
4. Opcional: pasar un correo por mail-tester.com.

## Pendientes de diseño (no de seguridad)

- `/soporte` muestra WhatsApp como único canal. Agregar el correo como
  cuarta tarjeta cambia la fila de tres: decidirlo aparte.
- El botón magenta de los correos tiene contraste 3,8:1 (no llega a AA).
- Confirmar cómo se ve el modo oscuro en la app de Outlook.
