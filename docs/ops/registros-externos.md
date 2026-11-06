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

## 10.1 — Llevarlos fuera de Railway (pendiente: necesita una cuenta)

Railway **no tiene** un envío nativo de registros a otro servicio
([guía de Railway](https://docs.railway.com/guides/ship-logs-third-party)).
Opciones:

| Opción | Cómo | Veredicto |
| --- | --- | --- |
| **Vector en Railway** (la de la guía oficial) | Un servicio pequeño en el mismo proyecto recibe los registros por la red privada y los manda a Better Stack o Axiom | **Recomendada.** Solo necesita la llave de ingreso del servicio externo, que sirve para escribir registros, no para leerlos |
| Locomotive (plantilla de la comunidad) | Lee los registros con la API de Railway | **No:** pide una llave de la **cuenta** de Railway. Si la roban, da acceso a todo el proyecto, que es justo lo que pasó el 21 de octubre |
| Enviarlos desde la app | La app manda cada línea por HTTP | Solo si Vector no funciona: suma latencia y un punto de falla a cada petición |

Servicio de destino, con retención de al menos 90 días: **Better Stack
(Logs)** o **Axiom**. Confirmar la retención del plan antes de elegir.

Pasos (los hace quien tenga acceso a Railway y abra la cuenta):
1. Crear la cuenta y una "source" (Better Stack) o un dataset (Axiom), con
   retención de 90 días o más.
2. Desplegar Vector según la guía de Railway, con la llave de ingreso como
   variable del servicio de Vector, no del de la app.
3. Comprobar que llegan las líneas `"tipo":"seguridad"`.
4. Anotar la llave en `salida-de-miembro-y-cambio-de-llaves.md`.
5. Agregar el servicio a `inventario-de-datos.md` (recibe ids e IP).

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
