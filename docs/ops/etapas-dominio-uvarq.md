# Plan por etapas: la plataforma U.V.A en `www.uvarq.com`

**Decisiones tomadas**
- El dominio final de la plataforma es **`www.uvarq.com`**, que hoy es la
  landing corporativa (sitio de Aleck, en Railway, aparte de este repo).
- La landing **no se puede tumbar**.
- Nadie ajeno al equipo debe entrar a la plataforma antes del lanzamiento.

**Roles:** Andres ejecuta, Miguel verifica y anota (`cerebro/modulos/operacion.md`),
Aleck aprueba (y es dueño de la landing y de GoDaddy).

## Vista general

| Etapa | Qué se logra | Toca la landing | Riesgo | Documento |
| --- | --- | --- | --- | --- |
| 1 | El DNS de `uvarq.com` pasa de GoDaddy a Cloudflare, sin cambios visibles | No cambia | Bajo, con plan de vuelta | `migracion-dns-cloudflare.md` |
| 2 | La plataforma, protegida por Cloudflare, en `beta.uvarq.com`, con puerta de acceso solo para el equipo | No | Bajo | Este documento |
| 3 | `www.uvarq.com` pasa de la landing a la plataforma (lanzamiento) | **Sí** | Alto: es el cambio visible | Este documento |
| 4 | Limpieza y mantenimiento | No | Bajo | Este documento |

**Por qué este orden:** la etapa 1 no cambia nada visible y deja a Cloudflare
al mando del DNS. La etapa 2 protege la plataforma (objetivo del blindaje tras el incidente
de Railway del 21-oct) sin tocar `www`. La etapa 3 es la única que afecta al
público, y llega con todo probado.

Cada etapa es independiente: se pasa a la siguiente solo cuando la anterior
está estable y comprobada.

---

# Etapa 1: DNS en Cloudflare

Ver `docs/ops/migracion-dns-cloudflare.md`. Resumen: respaldo de GoDaddy, copia
exacta de los 14 registros en Cloudflare (`www` en nube gris), redirección de
`uvarq.com` a `www` con una Redirect Rule, cambio de nameservers, verificación
y 7 días de vigilancia sin borrar GoDaddy. Incluye el plan de rescate.

**Se pasa a la etapa 2 cuando:** Cloudflare lleva al menos varios días "Active", la landing
y el correo (Resend) funcionan, y Miguel lo dio por verificado.

---

# Etapa 2: la plataforma protegida en `beta.uvarq.com`

**Qué es:** el mismo servicio `UVA-edu` de Railway, con un dominio más
(`beta.uvarq.com`), detrás de Cloudflare y con una puerta de acceso que solo
deja entrar al equipo. No se necesita contenido nuevo: es la aplicación real
que ya corre.

**Qué no cambia:** la landing, la raíz, el correo. Solo se agrega un
registro DNS nuevo.

## Decisión previa (Aleck/equipo): ¿hay usuarios reales usando la plataforma hoy?

Hoy la plataforma responde en `uva-edu-production.up.railway.app`. El paso
2.6 (secreto de origen) **cierra esa dirección**: quien entre por ahí recibirá
403. Y la puerta de acceso (2.1) deja fuera a todo el que no esté en la lista.

- **Si no hay usuarios reales todavía** (pre-lanzamiento): se hace todo de la
  etapa 2, incluido 2.6.
- **Si ya hay gente usándola por la dirección de Railway:** se hace la etapa
  2 **sin** el paso 2.6 ni quitar el dominio de Railway. Esos dos pasos pasan a la
  etapa 3 (el lanzamiento). Mientras tanto la puerta de atrás sigue abierta,
  como hoy.

## 2.1 Primero, la puerta de acceso (Cloudflare Access)

**Por qué primero:** así `beta.uvarq.com` nunca existe abierto al público.
Ocultar el nombre no sirve, los nombres con certificado se pueden descubrir.

1. Cloudflare → **Zero Trust** (crear el equipo si pide nombre; el plan
   gratuito cubre hasta 50 usuarios; puede pedir una tarjeta, confirmarlo al
   crearlo).
2. Access → Applications → **Add an application** → **Self-hosted**.
   - Dominio: `beta.uvarq.com` (toda la ruta).
   - Política **Allow**, "Emails" = los correos del equipo (y los de
     invitados de prueba que se decida). Método de acceso: **código de un
     solo uso** por correo (One-time PIN).
3. Crear **dos aplicaciones más**, con acción **Bypass** y "Everyone", para
   que pasen sin login las llamadas automáticas:
   - `beta.uvarq.com/api/webhooks/` (Mux y el hook de correos de Supabase no
     pueden iniciar sesión; cada webhook ya se protege con su firma).
   - `beta.uvarq.com/api/health` (monitor de disponibilidad).
4. La puerta aún no se puede probar de punta a punta: el subdominio no existe
   hasta 2.2.

## 2.2 Agregar el subdominio

1. Railway, servicio `UVA-edu` → Settings → Networking → **Custom Domain** →
   `beta.uvarq.com`. Copiar el destino CNAME que da Railway.
2. Cloudflare → `uvarq.com` → DNS → **Add record**: tipo CNAME, nombre
   `beta`, destino el de Railway, **con proxy (naranja)**, TTL Auto.
3. Esperar a que Railway valide y emita el certificado. Si no valida con el
   proxy activo, ponerlo temporalmente en gris y volver a naranja cuando
   Railway diga "listo".
4. **Probar la puerta:** desde una ventana privada, `https://beta.uvarq.com`
   debe mostrar el acceso de Cloudflare (pide correo), no la plataforma. Entrar
   con un correo de la lista funciona. Desde fuera, `/api/health` responde sin pedir login.

## 2.3 SSL/TLS

Ver `docs/ops/cloudflare.md`, sección 2.1: **Full (strict)** (nunca
"Flexible"), Always Use HTTPS, TLS mínimo 1.2. No activar HSTS en
Cloudflare (la app ya lo manda).

## 2.4 Que la plataforma sepa su dirección nueva

Tabla de `cloudflare.md`, sección 4, con `DOMINIO = beta.uvarq.com`:
`NEXT_PUBLIC_SITE_URL` (requiere un despliegue nuevo), Supabase Auth
(Site URL y Redirect URLs: **agregar** las de `beta`, no quitar las de
Railway todavía), hook de correo de Supabase, webhook de Mux, orígenes de Google y
monitor `/api/health`.

Probar con alguien del equipo: login con correo, login con Google, recuperar
contraseña (llega el correo), ver un video, subir un video de prueba (el
webhook de Mux llega en 200).

**Cuidado:** al cambiar `NEXT_PUBLIC_SITE_URL`, los enlaces de los
correos apuntan a `beta`; quien no esté en la lista de Access no podrá
abrirlos. Coordinar con quien reciba invitaciones durante este periodo.

## 2.5 Seguridad de Cloudflare

`cloudflare.md`, secciones 2.2 a 2.8: WAF administrado, regla de webhooks
(**primera**), regla de `/_next/image`, límite de peticiones a las rutas de
acceso, quitar `x-middleware-subrequest`, caché de `/_next/image` y avisos.
Bot Fight Mode **apagado** en el plan gratuito. Probar los webhooks después
de cada bloque.

## 2.6 Secreto de origen (solo si no hay usuarios reales hoy)

Orden obligatorio (el error clásico tumba todo):
1. Cloudflare: regla "Modify Request Header" `X-Origen-Uva` = un valor largo
   generado (guardado en la bóveda), a todas las peticiones.
2. Railway: `ORIGEN_SECRETO` = el mismo valor, **sellada**.
3. Comprobar (`cloudflare.md`, sección 5): `curl -I
   https://uva-edu-production.up.railway.app/` responde 403; la tarjeta
   "Diagnóstico de red" dice "pasó por Cloudflare".
4. Con todo en verde, quitar el dominio `*.up.railway.app` de Railway y la
   tarjeta "Diagnóstico de red" de `/admin/configuracion` (PR aparte).

## 2.7 Se da la etapa por terminada cuando

- [ ] Quien no está en la lista no puede ver nada de la plataforma.
- [ ] El equipo entra con código por correo y todo funciona (2.4).
- [ ] Webhooks de Mux y de Supabase llegan en 200.
- [ ] (Si se hizo 2.6) la URL de Railway responde 403.
- [ ] La landing y el correo siguen intactos.
- [ ] Miguel lo anotó en `operacion.md`.

## 2.8 Volver atrás

- **Todo responde 403:** borrar `ORIGEN_SECRETO` en Railway (vacío = apagado).
- **Cloudflare da problemas:** el registro `beta` en gris (solo DNS) y borrar
  `ORIGEN_SECRETO`.
- **Un webhook dejó de llegar:** revisar Security → Events y la regla de
  webhooks (primera), y que las aplicaciones Bypass de Access existan.
- **El equipo no puede entrar:** revisar la política de Access (los correos).
- La landing no se ve afectada por nada de esto, porque `www` no se toca.

---

# Etapa 3: lanzamiento, `www.uvarq.com` pasa a la plataforma

**Es el único cambio visible al público.** Se hace con todo lo anterior
estable y con una ventana tranquila (entre martes y jueves por la mañana,
nunca viernes), con Miguel verificando y alguien probando en el celular.

## 3.0 Requisitos (se piden antes, con semanas de aviso)

- [ ] **Aleck aprueba** el cambio por escrito.
- [ ] **El contenido público está listo** (`src/content/marketing.ts`): será
      lo primero que vea el público. Cumple "contenido veraz" del piso de
      calidad.
- [ ] **Dónde queda el sitio corporativo.** Un dominio solo puede estar en un
      servicio de Railway. El sitio corporativo necesita otro nombre
      (por ejemplo `corporativo.uvarq.com`) o seguir solo en su URL de Railway.
      Aleck decide.
- [ ] **Lista de URLs de la landing** que existan (`/nosotros`, `/contacto`,
      etc.) para redirigirlas; si no, darían 404 en la plataforma y se
      pierde lo posicionado en Google.
- [ ] La etapa 2 lleva varios días sin incidentes.

## 3.1 Preparar el sitio corporativo en su nuevo nombre

1. Aleck agrega el nombre nuevo (p. ej. `corporativo.uvarq.com`) al servicio
   del sitio corporativo en Railway y crea su CNAME en Cloudflare (gris).
2. Confirmar que abre y se ve bien. **Todavía no se toca `www`.**

## 3.2 Preparar las redirecciones

En Cloudflare → Redirect Rules (o Bulk Redirects), las URLs viejas de la
landing hacia su equivalente (la plataforma o el sitio corporativo). Se
activan en el paso 3.4.

## 3.3 Una hora antes

- Bajar el TTL del registro `www` a 5 minutos.
- Avisar al equipo y a Aleck. Tener a mano el plan de vuelta (3.8).

## 3.4 El cambio

1. Railway, servicio del sitio corporativo: **quitar** `www.uvarq.com`.
2. Railway, servicio `UVA-edu`: **agregar** `www.uvarq.com`; copiar el
   nuevo destino CNAME.
3. Cloudflare → DNS: cambiar el CNAME `www` al nuevo destino, primero **en
   gris**. Esperar a que Railway emita el certificado.
4. Cuando Railway lo marque listo, ponerlo **en naranja (proxy)**.
5. Activar las redirecciones de 3.2.

Entre los pasos 1 y 4 `www` puede estar caído unos minutos. Hacerlo en
horario tranquilo y avanzar sin pausas.

## 3.5 Que la plataforma sepa su dirección final

Tabla de `cloudflare.md`, sección 4, con `DOMINIO = www.uvarq.com`:
`NEXT_PUBLIC_SITE_URL` (despliegue nuevo), Supabase Auth, hook de correo,
webhook de Mux, orígenes de Google, monitor. Dejar las de `beta` mientras
dure la transición. `www` **no** lleva puerta de Access: es público.

## 3.6 Secreto de origen (si no se hizo en 2.6)

Ahora sí: pasos 2.6 y quitar el dominio de Railway.

## 3.7 Verificación (criterio de terminado)

- [ ] `https://www.uvarq.com` abre la plataforma, con candado y `cf-ray`.
- [ ] `https://uvarq.com` redirige a `www` (regla de la etapa 1).
- [ ] Las URLs viejas de la landing redirigen donde corresponde.
- [ ] El sitio corporativo abre en su nuevo nombre.
- [ ] Login con correo, con Google, recuperar contraseña y correo recibido.
- [ ] Un video reproduce y los webhooks de Mux llegan en 200.
- [ ] Resend sigue "Verified".
- [ ] Core Web Vitals y Lighthouse del piso de calidad (sección 3.4 del
      `CLAUDE.md`) sobre el dominio real.
- [ ] Google Search Console: agregar `www.uvarq.com` y revisar el sitemap.

## 3.8 Plan de rescate del lanzamiento

**Regla maestra:** si algo importante falla y no se arregla en 15 minutos,
se vuelve atrás.

1. Railway, servicio `UVA-edu`: quitar `www.uvarq.com`.
2. Railway, servicio del sitio corporativo: volver a agregar `www.uvarq.com`
   y copiar su destino.
3. Cloudflare: CNAME `www` de vuelta a `qde39z6f.up.railway.app`, **gris**.
4. Quitar las redirecciones de 3.2.
5. Poner `NEXT_PUBLIC_SITE_URL` de nuevo en `beta`.

Mientras `beta.uvarq.com` siga funcionando, el equipo conserva la plataforma
en pie. El sitio corporativo vuelve a ser el de antes.

---

# Etapa 4: cierre

- Anotar todo en `operacion.md` y actualizar este documento con lo aprendido.
- Mantener `beta.uvarq.com` detrás de Access como entorno de pruebas previas
  al público, o borrarlo.
- Revisión mensual (`docs/ops/revision-mensual.md`).
- Pendientes de otras fases que no dependen del dominio: registros externos
  (10.1), plan B de despliegue (11), alertas de gasto (`limites-de-gasto.md`).
