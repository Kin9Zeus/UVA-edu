# Etapa 1: pasar el DNS de `uvarq.com` de GoDaddy a Cloudflare

**Objetivo:** que Cloudflare responda el DNS de `uvarq.com` y que **nada
visible cambie**: la landing (`www.uvarq.com`), la redirección de
`uvarq.com` a `www` y el correo `noreply@uvarq.com` (Resend) siguen igual.

**Lo que NO se hace en esta etapa:** poner la plataforma en el dominio, nube
naranja en `www`, WAF, reglas de límite, `ORIGEN_SECRETO`. Todo eso es la
etapa 2 (`docs/ops/cloudflare.md`) y solo empieza cuando esta esté estable.

**Roles:** Andres ejecuta, Miguel verifica y anota, Aleck aprueba (la landing
es suya). Cada paso marcado con "Miguel" lo comprueba otra persona.

**Estado de partida (GoDaddy, revisado 2026-11-05):** 14 registros, DNSSEC
apagado, nameservers `ns45.domaincontrol.com` y `ns46.domaincontrol.com`,
reenvío de `uvarq.com` a `https://www.uvarq.com` (301).

## Cómo funciona el cambio (para entender por qué es seguro)

- Cambiar los nameservers no mueve ningún servidor: solo cambia **quién
  contesta** "¿a dónde va este nombre?". Si Cloudflare contesta lo mismo que
  GoDaddy, nadie nota nada.
- El cambio se propaga **poco a poco, hasta 48 h**. Mientras tanto, unos
  resolutores preguntan a GoDaddy y otros a Cloudflare. **Los dos deben tener
  los mismos registros** durante todo ese tiempo. Por eso no se borra nada de
  GoDaddy.
- Volver atrás es cambiar los nameservers de nuevo (sección "Plan de rescate").

## Antes de empezar: ventana y requisitos

- Día entre martes y jueves, por la mañana. **Nunca viernes ni víspera de
  festivo.** Alguien disponible las 4 horas siguientes.
- Aleck aprobó por escrito (mensaje o nota en `operacion.md`).
- Cuenta de Cloudflare creada con el correo del equipo y **verificación en
  2 pasos activa**, con los códigos de recuperación en la bóveda.
- Acceso a GoDaddy (cuenta del dominio) y a Resend.

## Fase 0: respaldo y línea base (no cambia nada)

1. **Respaldo de GoDaddy.** Capturas de pantalla de: DNS (las 2 páginas de
   registros), Reenvío y Servidores de nombres. Si el menú "Acciones" ofrece
   exportar la zona, descargar también ese archivo. Guardar todo en la
   bóveda. Es la fuente de verdad si hay dudas.
2. **Línea base** (guardar la salida en un archivo de texto):
   ```
   nslookup -type=NS uvarq.com
   nslookup -type=A uvarq.com
   nslookup -type=CNAME www.uvarq.com
   nslookup -type=MX send.uvarq.com
   nslookup -type=TXT send.uvarq.com
   nslookup -type=TXT resend._domainkey.uvarq.com
   nslookup -type=TXT _dmarc.uvarq.com
   curl -I https://www.uvarq.com
   curl -I https://uvarq.com
   curl -I http://uvarq.com
   ```
3. **Resend:** en Domains, `uvarq.com` debe estar en **Verified**. Si ya no
   lo está, arreglarlo antes de seguir.
4. **Bajar el TTL** de los registros en GoDaddy de 1 hora al mínimo que deje
   (10 minutos). Esperar al menos 1 hora (el TTL anterior); lo prudente es
   hacerlo el día anterior.

## Fase 1: agregar el dominio en Cloudflare (sigue sin cambiar nada)

1. Cloudflare → **Add a domain** → `uvarq.com` → plan **Free**.
2. Cloudflare escanea e importa registros. **Revisarlos todos**; no confiar en
   la importación. Dejar exactamente esto (los valores largos se copian desde
   GoDaddy con el botón "Copiar", nunca a mano):

   | Tipo | Nombre | Contenido | Proxy |
   | --- | --- | --- | --- |
   | CNAME | `www` | `qde39z6f.up.railway.app` | **Solo DNS (gris)** |
   | MX | `send` | `feedback-smtp.sa-east-1.amazonses.com`, prioridad 10 | (no aplica) |
   | TXT | `resend._domainkey` | la llave `p=MIG…` completa, idéntica | (no aplica) |
   | TXT | `send` | `v=spf1 include:amazonses.com ~all` | (no aplica) |
   | TXT | `send` | `v=spf1 include:dc-fd741b8612._spfm.send.uvarq.com ~all` | (no aplica) |
   | TXT | `dc-fd741b8612._spfm.send` | `v=spf1 include:amazonses.com ~all` | (no aplica) |
   | TXT | `_dmarc` | `v=DMARC1; p=quarantine; adkim=r; aspf=r; rua=mailto:dmarc_rua@onsecureserver.net;` | (no aplica) |
   | TXT | `@` | `google-site-verification=…` (copiar de GoDaddy) | (no aplica) |
   | A | `@` | `192.0.2.1` | **Con proxy (naranja)**, solo para la redirección |

   No copiar: NS, SOA ni `_domainconnect` (son de GoDaddy). **Los 2 registros
   A de GoDaddy (`15.197.225.128`, `3.33.251.168`) no se copian**: son del
   reenvío de GoDaddy, que deja de aplicar al cambiar de nameservers. Se
   reemplazan por el A `192.0.2.1` y la regla del paso 3.
3. **Redirect Rule** (Rules → Redirect Rules → Create rule):
   - Si: `http.host eq "uvarq.com"`.
   - Acción: redirección dinámica a `concat("https://www.uvarq.com", http.request.uri.path)`,
     código **301**, conservar la cadena de consulta.
4. **No activar nada más:** DNSSEC apagado, sin WAF, sin reglas, sin cambiar
   SSL/TLS ni Caché. (Opcional ya: SSL/TLS en Full (strict) y "Always Use
   HTTPS"; solo afectan al registro con proxy, el A `@`.)
5. Anotar los **2 nameservers que asignó Cloudflare** (algo como
   `xxx.ns.cloudflare.com`). Son únicos de esta cuenta.

## Fase 2: revisión cruzada (Miguel)

Con la captura de GoDaddy de la Fase 0 al lado, Miguel confirma uno por uno:

- [ ] `www` apunta a `qde39z6f.up.railway.app` y está en **gris**.
- [ ] Los 4 registros TXT de `send`/`dc-fd…`/`resend._domainkey`/`_dmarc` y el
      MX `send` existen y son **idénticos** (el DKIM, carácter por carácter,
      o por la misma longitud y final).
- [ ] El TXT de `google-site-verification` existe.
- [ ] El A `@` es `192.0.2.1` con proxy y la Redirect Rule está activa.
- [ ] No sobra ningún registro que GoDaddy no tuviera.
- [ ] Aleck confirma que **no hay otro servicio** (correo, subdominios) que
      usen `uvarq.com` y no estén en la lista. Hoy no hay MX en la raíz ni
      otros subdominios.

Si algo no coincide, se corrige **antes** de la Fase 3.

## Fase 3: cambiar los nameservers (el único paso con efecto real)

1. GoDaddy → el dominio → DNS → **Servidores de nombres** → **Cambiar
   servidores de nombres** → **Introducir mis propios servidores de nombres
   (avanzado)**.
2. Reemplazar `ns45`/`ns46.domaincontrol.com` por los 2 de Cloudflare. Guardar.
3. **No borrar** nada en GoDaddy: ni los registros ni el Reenvío. Quedan
   como respaldo vivo.
4. En Cloudflare, "Check nameservers now". Llega un correo cuando pasa a
   **Active** (de minutos a 24 h).
5. Si no aparece "Active" tras 2 horas, revisar que en GoDaddy los 2
   nameservers estén escritos exactamente igual.

## Fase 4: verificación (Miguel, apenas diga "Active")

Repetir la línea base de la Fase 0 y comparar:

- [ ] `nslookup -type=NS uvarq.com` devuelve los nameservers de Cloudflare.
- [ ] `https://www.uvarq.com` abre igual que antes (la landing). La respuesta
      **no** trae `cf-ray` (está en gris, no pasa por Cloudflare).
- [ ] `http://uvarq.com` y `https://uvarq.com` responden **301** a
      `https://www.uvarq.com/`. Si `https://uvarq.com` da error de
      certificado, esperar hasta 30 minutos: Cloudflare emite el certificado
      después de activar. `www` no se ve afectada.
- [ ] En Resend, Domains → `uvarq.com` sigue **Verified** (pulsar "Verify DNS
      records" otra vez).
- [ ] **Correo real:** pedir "recuperar contraseña" en producción con una
      cuenta de prueba, o enviar la prueba desde Resend, y confirmar que
      llega.
- [ ] Probar `uvarq.com` y `www.uvarq.com` desde datos móviles y desde otra
      red (también en `dnschecker.org`, mirando el tipo A/CNAME y NS).

## Fase 5: vigilar y cerrar

- Revisar el sitio y el correo cada hora las primeras 4 horas, y de nuevo a las 24 y 48 h.
- **No borrar la zona de GoDaddy durante al menos 7 días.** Y nunca borrar la
  de Cloudflare mientras exista la posibilidad de volver atrás (explicación
  abajo).
- Después de 7 días sin incidentes: anotarlo en `operacion.md`.
- Activar la verificación en 2 pasos en GoDaddy.
- Recién entonces se puede abrir la etapa 2.

---

# Plan de rescate

**Regla maestra:** si la landing o el correo fallan y **no se arregla en 15
minutos**, se **revierte** (opción A). No se depura con el sitio caído.

## Opción A: volver a GoDaddy (revierte todo)

1. GoDaddy → Servidores de nombres → Cambiar → usar los **predeterminados de
   GoDaddy** (`ns45.domaincontrol.com`, `ns46.domaincontrol.com`).
2. GoDaddy todavía tiene los 14 registros y el Reenvío intactos, así que el
   estado vuelve a ser el de antes.
3. **No borrar la zona de Cloudflare.** Algunos resolutores guardan los
   nameservers nuevos hasta 48 h; seguirán preguntando a Cloudflare, y esa
   zona debe seguir respondiendo lo correcto mientras tanto.
4. Avisar a Aleck. Corregir con calma lo que falló y repetir desde la Fase 2.

## Opción B: arreglar un solo registro en Cloudflare

Más rápida cuando la causa es clara (un registro mal copiado). Cloudflare
aplica el cambio en segundos y el TTL bajo hace que se note en minutos.

## Síntomas y qué hacer

| Síntoma | Causa probable | Acción |
| --- | --- | --- |
| `www.uvarq.com` no abre o da error de Railway | CNAME `www` ausente, mal escrito o en naranja | Corregirlo (gris, `qde39z6f.up.railway.app`). Si en 15 min sigue: **opción A** |
| `www` abre pero `uvarq.com` no | Regla o A `@` mal puestos, o certificado en emisión | Esperar hasta 30 min; revisar A `192.0.2.1` con proxy y la Redirect Rule activa. Si no sirve, la landing sigue viva por `www`; escalar a Aleck antes de tocar más |
| Dejan de llegar correos (confirmación, recuperar contraseña) | MX/SPF/DKIM de `send` copiados mal | Copiarlos de GoDaddy con el botón Copiar; en Resend pulsar "Verify". Si en 15 min sigue: **opción A** |
| Resend marca el dominio como "Failed" o "Pending" | Falta o cambia el DKIM (`resend._domainkey`) | Igual que arriba; el DKIM debe ser idéntico |
| El dominio no resuelve en ningún lado (SERVFAIL) | Nameservers mal escritos o DNSSEC activado por error | **Opción A de inmediato** |
| Cloudflare nunca pasa a "Active" | Nameservers distintos a los asignados | Revisar en GoDaddy; si el dominio dejó de resolver, **opción A** |
| Hay que entrar a Cloudflare y no se puede (2FA perdido) | Sin códigos de recuperación | Usar los de la bóveda; mientras, el DNS sigue funcionando. No hace falta revertir |

## Después de un incidente

Anotar en `operacion.md` qué falló, cuánto duró y qué registro estaba mal, y
ajustar este documento.
