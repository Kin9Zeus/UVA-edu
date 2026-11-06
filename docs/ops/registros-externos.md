# Registros fuera de Railway y alertas de seguridad (fase 10)

Sin registros no hay cómo saber qué pasó en un incidente. Railway guarda los
suyos poco tiempo y, si la cuenta de Railway es la comprometida, quien entró
también los puede ver o perder. Este documento cubre 10.1 (llevarlos fuera,
90 días), 10.2 (qué se registra) y 10.3 (alertas).

## 10.2 — Qué registra la app (hecho)

`src/lib/eventos-seguridad.ts` escribe **una línea JSON por evento** en la
salida estándar, con `"tipo":"seguridad"`:

| Evento | Cuándo | Va también a Sentry |
| --- | --- | --- |
| `login_fallido` | Contraseña incorrecta (entrar, cambiar contraseña, eliminar cuenta) | No |
| `login_bloqueado` | Se alcanzó el tope de 5 intentos en 15 min | Sí |
| `segundo_factor_fallido` | Código de 2 pasos rechazado, o tope de Supabase | Sí |
| `origen_rechazado` | 403 por llegar a Railway sin pasar por Cloudflare | No |
| `limite_de_uso` | 429 de los límites de la base (134) | No |
| `admin_denegado` | Una sesión sin rol de administrador pidió el panel o una acción de administrador | Sí |
| `accion_admin` | Toda acción que queda en la bitácora (incluye cambios de rol y suspensiones) | No |

Campos posibles: `usuarioId`, `ip`, `ruta` (sin la query), `accion`,
`motivo`, `entidad`, `entidadId`. Es una lista cerrada: nunca correos,
contraseñas, códigos, tokens ni formularios. Un valor con "@" se redacta.

Para buscarlos en Railway (pestaña de registros): `"tipo":"seguridad"`.

## 10.1 — Llevarlos fuera de Railway, 90 días

Decisión (2026-11-05): **Better Stack** gratis para buscar y alertar (guarda
3 días) y **Cloudflare R2** como archivo de 90 días. Ningún plan gratis
guarda 90 días buscables; R2 cuesta $0 con nuestro volumen (10 GB gratis).

```
App (Railway) --POST por la red privada--> Vector (Railway) --> Better Stack (3 días)
      |                                                    \-> R2: registros/AAAA/MM/DD/ (90 días)
      \-- sigue escribiendo en la salida estándar (Railway)
```

Railway no tiene envío nativo de registros a otro servicio: la app manda
una copia ([guía de Railway](https://railway.com/guides/ship-logs-third-party)).

| Pieza | Dónde |
| --- | --- |
| Enviador de la app: junta las líneas y las manda en lotes cada 2 s, en segundo plano. Si Vector no responde, descarta el lote y avisa una vez por minuto; nunca frena una petición | `src/lib/envio-registros.ts` |
| Qué se manda: los eventos de seguridad y las líneas de `logError` (ya filtradas por privacidad) | `eventos-seguridad.ts`, `log.ts` |
| Configuración de Vector (versión y digest fijos) | `infra/vector/` |

Probado en local (2026-11-05) con Vector 0.61.0: la configuración valida, un
inicio de sesión fallido llega a Vector a los 2 s, y con Vector apagado la
app responde igual (contraseña incorrecta en < 1 s) y deja un solo aviso.

### Paso a paso para encenderlo

**1. Better Stack**
1. Cuenta nueva → "Log management".
2. Telemetry → Sources → Connect source. Nombre `uva-produccion`,
   plataforma HTTP, región de Estados Unidos.
3. Anotar en el gestor de contraseñas el **Source token** y el
   **Ingesting host**.

**2. Cloudflare R2**
1. Cuenta de Cloudflare (gratis; R2 pide una tarjeta aunque no cobre
   dentro de los 10 GB).
2. R2 → Create bucket: `uva-registros`, clase **Standard** (la única dentro
   del plan gratis).
3. Bucket → Settings → **Object lifecycle rules**: `borrar-90-dias`, prefijo
   `registros/`, borrar a los **90 días**. (La regla "Default Multipart
   Abort Rule" que trae el bucket se deja.)
4. Bucket → Settings → **Bucket lock rules**: `proteger-90-dias`, prefijo
   `registros/`, retención de **90 días**. R2 no tiene llaves "solo de
   escritura": el permiso mínimo para escribir también deja borrar. El
   bloqueo es lo que impide que una llave robada (o una cuenta comprometida)
   borre o pise un registro antes de tiempo.
5. R2 → Manage API tokens → **Create Account API token** (queda de la
   cuenta, no de una persona: sigue funcionando si alguien sale del equipo).
   Nombre `vector-registros`, permiso **Object Read & Write** (nunca Admin),
   solo para `uva-registros`, TTL Forever, sin filtro de IP (Railway no tiene
   IP fija). Anotar el Access Key ID, el Secret Access Key y el endpoint
   (`https://<cuenta>.r2.cloudflarestorage.com`).

Hecho el 2026-11-06: fuente `uva-produccion` en Better Stack (plataforma
Vector, región Estados Unidos, host `…us-west-2a.betterstackdata.com`, 3
días), R2 activado, bucket `uva-registros` con la regla de 90 días y la
llave `vector-registros`.

**3. Railway** (proyecto de producción)
1. New → GitHub Repo → este repo. Nombre del servicio: **`vector`** (la
   dirección privada sale del nombre: `vector.railway.internal`).
2. Settings → Root Directory: `/infra/vector`. Watch paths:
   `/infra/vector/**` (para que no se redespliegue con cada cambio de la app).
3. **Sin dominio público.** No agregar uno.
4. Variables del servicio `vector`: `BETTERSTACK_HOST`, `BETTERSTACK_TOKEN`,
   `R2_ENDPOINT`, `R2_BUCKET`, `R2_LLAVE_ID`, `R2_LLAVE_SECRETA`. Si falta
   una, Vector no arranca (a propósito: se ve en Railway).
5. Desplegar y esperar el verde.
6. En el servicio **de la app**, agregar `VECTOR_URL` =
   `http://vector.railway.internal:9000` (http, no https: es la red
   privada). Redesplegar la app.
7. Comprobar: un inicio de sesión fallido aparece en Better Stack (Live
   tail) a los pocos segundos, y a los 5 minutos hay un archivo en R2 bajo
   `registros/<fecha>/`.
8. Anotar las variables en `salida-de-miembro-y-cambio-de-llaves.md`.

Para apagarlo: quitar `VECTOR_URL` de la app. Todo vuelve a ser como antes.

## 10.3 — Alertas

Hoy, en Sentry: los eventos marcados "Sí" arriba llegan como avisos con el
tag `area:seguridad`. Falta crear la regla (ver `canal-alertas.md`): "tag
`area` igual a `seguridad`, más de 5 eventos en 10 min, aviso al canal".

En el servicio de registros, cuando exista:

| Alerta | Condición | Por qué |
| --- | --- | --- |
| Fuerza bruta | `login_fallido` > 30 en 10 min en total, o > 10 de una misma `ip` | Alguien probando contraseñas |
| Ráfaga de abuso | `limite_de_uso` > 20 en 10 min | Un script publicando |
| Intento en el panel | `admin_denegado`, cualquier ocurrencia | Nadie llega ahí usando la app normal |
| Administrador de madrugada | `accion_admin` entre 0:00 y 6:00 de Colombia | Una sesión de administrador robada suele actuar de noche |
| Puerta trasera | `origen_rechazado` > 100 en 10 min, con el cierre de origen encendido | Alguien encontró el dominio de Railway |

Las de 403 y 429 por IP también pueden vivir en Cloudflare (`cloudflare.md`).
