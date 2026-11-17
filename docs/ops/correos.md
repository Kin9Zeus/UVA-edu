# Correo: direcciones, envío y recepción (fase 8.5 del plan de blindaje)

## Direcciones

| Dirección | Para qué | Dónde está en el código |
| --- | --- | --- |
| `soporte@uvarq.com` | Ayuda a estudiantes; "responder a" de **todos** los correos; peticiones de datos personales (Habeas Data) | `CORREO_SOPORTE` en `src/lib/contacto.ts` |
| `seguridad@uvarq.com` | Reportes de vulnerabilidades (`/.well-known/security.txt`) | `CORREO_SEGURIDAD` en `src/lib/contacto.ts`, `public/.well-known/security.txt` |
| Remitente (`RESEND_FROM_EMAIL` en Railway) | `UVA <soporte@mail.uvarq.com>` desde el 2026-11-10 (antes `noreply@uvarq.com`). Es del subdominio de envío: no recibe en sí mismo, y todo correo lleva `replyTo` = `soporte@uvarq.com` (`src/emails/marco/envio.ts`), que sí recibe | Variable de Railway |

Hasta el 2026-11-09 las plantillas citaban un buzón en `uva.edu`, que es de
la **Universidad de Virginia** (verificado con `nslookup` el 2026-10-05). Lo
más grave: el correo "tu contraseña fue actualizada" mandaba a escribirle a
otra institución. `src/lib/contacto.test.ts` falla si vuelve.

**Antes de publicar el código, las dos direcciones tienen que recibir correo**
(paso 1). Si no, los "responder a" rebotan.

## Estado final (2026-11-10)

Dos dominios con trabajos separados, a propósito: así, si la reputación de
envío se daña, no arrastra al correo que recibe UVA.

| Dominio | Para qué | Dónde |
| --- | --- | --- |
| `mail.uvarq.com` | **Enviar** los correos de la plataforma (Resend) | Resend, dominio `mail.uvarq.com` (Verified) |
| `uvarq.com` (raíz) | **Recibir** `soporte@` y `seguridad@` (Cloudflare Email Routing) | Cloudflare |

### Registros DNS vigentes (todos en Cloudflare; GoDaddy ya no atiende el DNS)

| Tipo | Nombre | Para qué | Quién lo pide |
| --- | --- | --- | --- |
| TXT | `resend._domainkey.mail` | Firma DKIM de los envíos (`d=mail.uvarq.com`) | Resend |
| MX | `send.mail` | Rebotes (`feedback-smtp.sa-east-1.amazonses.com`, prioridad 10) | Resend |
| TXT | `send.mail` | SPF de los envíos (`v=spf1 include:amazonses.com ~all`). **Uno solo** | Resend |
| TXT | `_dmarc.mail` | Política DMARC del subdominio (`p=quarantine`; reportes a Cloudflare). DMARC Management de Cloudflare no cubre subdominios: se creó a mano | Equipo |
| MX | `@` (3) | `route1/2/3.mx.cloudflare.net`, prioridades 16, 18 y 4 | Email Routing |
| TXT | `@` | SPF de la raíz: `v=spf1 include:_spf.mx.cloudflare.net ~all`. **Uno solo** | Email Routing |
| TXT | `cf2024-1._domainkey` | Firma DKIM del reenvío de Cloudflare | Email Routing |
| TXT | `_dmarc` | Política DMARC de la raíz (`p=quarantine`); reportes a Cloudflare (DMARC Management) y todavía al buzón viejo de GoDaddy | Equipo |

Los valores largos (llaves DKIM) no se copian aquí: salen del panel de
Resend y de Cloudflare.

### Reglas de Email Routing
`soporte@uvarq.com` y `seguridad@uvarq.com` reenvían al buzón general
compartido del equipo (`registros-externos.md`, 10.3.1). El catch-all queda en
**Drop** y apagado: cualquier otra dirección se descarta.

### Imágenes de los correos
Los logos se cargan desde `beta.uvarq.com/correo/*`. Esa ruta tiene su propia
aplicación de Cloudflare Access con la política "Bypass automatico"
(`UVA beta correo`), igual que `/api/health` y `/api/webhooks`. Sin ella, Gmail
pide el PNG sin sesión, recibe el login de Access y muestra la imagen rota.
Al abrir al público (Access fuera de `beta`) el problema desaparece solo.

### Pruebas hechas el 2026-11-10 (correo de «recuperar contraseña»)

| Prueba | Resultado |
| --- | --- |
| Gmail | Bandeja de entrada. SPF, DKIM (`mail.uvarq.com`) y DMARC en `pass`. Entrega en 1 s |
| Outlook / Hotmail | Bandeja de entrada. `spf=pass`, `dkim=pass` (`header.d=mail.uvarq.com`), `dmarc=pass`, `compauth=pass`, SCL 1 |
| mail-tester.com | **10/10.** Sin listas negras, SpamAssassin en verde. Dos avisos naranjas que no aplican: DMARC en el dominio padre (herencia que la herramienta no sigue; se creó `_dmarc.mail`) y falta de `List-Unsubscribe` (no corresponde a correos transaccionales) |
| Recepción: escribir a `soporte@` y `seguridad@` | Llegan al buzón general. La primera prueba cayó en spam por el contenido ("Hola"), no por autenticación (SPF, DKIM y DMARC `pass`); se resolvió con un filtro de Gmail |
| Correo corporativo (dominio propio) | **Pendiente:** nadie del equipo tiene un buzón de ese tipo a mano |

### Pendiente de limpieza
- **Registros viejos del dominio raíz, en Cloudflare y en Resend.** No borrar
  todavía. Son `send` (MX y los dos TXT SPF, uno de ellos **duplicado e
  inválido**), `dc-fd741b8612._spfm.send` y `resend._domainkey`. Antes hay que
  comprobar que nada envía ya desde `noreply@uvarq.com`: revisar que los 5
  crons de Railway no tengan su propio `RESEND_FROM_EMAIL`, y que en Resend,
  Emails, no aparezca ningún envío del dominio `uvarq.com`. Después de una
  semana sin envíos, borrarlos y quitar el dominio `uvarq.com` de Resend.
- **Destino viejo de reportes DMARC** (`onsecureserver.net`, de GoDaddy) en el
  `_dmarc` de la raíz: quitarlo si Cloudflare deja editar el registro.
- **Llave de Resend** `UVA-CORREOS`: tiene acceso a todos los dominios. Cuando el
  envío lleve unos días estable, crear una con dominio `mail.uvarq.com`,
  cambiarla en Railway, guardarla en Bitwarden y borrar la vieja.
- Las direcciones `soporte@` y `seguridad@` están provisionales hasta que
  Aleck las confirme; cambiarlas es una constante en `src/lib/contacto.ts` más
  el `security.txt` y estos documentos.

> Los pasos 1 a 3 de abajo son el procedimiento original. Los pasos 1 y 2
> (recibir y SPF/DMARC) quedaron hechos, con la diferencia de que el envío
> pasó a `mail.uvarq.com` en vez de arreglar los registros de `send`.

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
