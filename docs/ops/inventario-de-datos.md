# Inventario de datos personales

Fase 7 del plan de blindaje (datos 1). Responde a cuatro preguntas: qué
dato personal guardamos, dónde, para qué y cuánto tiempo se queda. Sale
del código (noviembre de 2026), no de lo que creemos que hace la app.

Se actualiza **en el mismo PR** que agregue una columna con datos de una
persona, un proveedor nuevo o un borrado automático nuevo. Si este documento
y la política de privacidad (`docs/legal/contenido-soporte.md`) no dicen lo
mismo, uno de los dos está mal.

## 1. Datos en la base (Supabase)

"Supresión" es lo que pasa cuando la persona borra su cuenta (Mi perfil) o
un administrador la suprime por Habeas Data. Las dos usan
`private.anonimizar_usuario` (`supabase/sql/120_anonimizar_usuario_actividad.sql`):
la cuenta no se borra, se deja sin ningún dato de la persona, para no
romper los certificados ni los registros contables.

### Cuenta y perfil

| Dato | Dónde | Para qué | Cuánto tiempo | Al suprimir |
| --- | --- | --- | --- | --- |
| Correo, contraseña (cifrada), identidad de Google | `auth.users`, `auth.identities` | Entrar | Mientras exista la cuenta | Correo reemplazado por uno falso, contraseña e identidades borradas, cuenta bloqueada |
| Sesiones abiertas (incluye IP y navegador) | `auth.sessions` | Mantener la sesión | Hasta cerrar sesión o vencer | Borradas |
| Secreto del código de 2 pasos | `auth.mfa_factors` | 2FA de administradores | Mientras exista la cuenta | Se conserva, con la cuenta bloqueada. Un administrador no puede borrar su propia cuenta |
| Nombre, correo, celular, país, especialidad, rol en el gremio, foto | `perfiles`, bucket `avatares` | Perfil y comunidad | Mientras exista la cuenta | Vaciados ("Usuario eliminado"); la foto se borra del bucket |
| Cuentas que nunca confirmaron el correo | `auth.users` | — | **7 días** (cron `limpiar-usuarios-no-verificados`, 3:00) | — |

### Estudio

| Dato | Dónde | Para qué | Cuánto tiempo | Al suprimir |
| --- | --- | --- | --- | --- |
| Avance por clase y segundo del video | `progreso` | Seguir donde iba, certificado | Mientras exista la cuenta | Borrado |
| Días con actividad | `actividad_diaria` | Racha | Mientras exista la cuenta | Borrado |
| Notas de clase | `notas_leccion` | Notas personales | Mientras exista la cuenta | Borradas |
| Respuestas y nota de exámenes | `intentos_examen` | Calificar | Mientras exista la cuenta | Borrados |
| Certificados (nombre congelado al emitirlo) | `certificados`, bucket `certificados` | Que un tercero lo verifique | **Indefinido**, a propósito (lo dice la política) | Se conservan |
| Acceso a cursos y códigos canjeados | `inscripciones`, `suscripciones` | Saber quién tiene acceso | Indefinido | Se conservan (registro de acceso) |
| Pagos e intentos de pago | `pagos`, `intentos_pago` | Obligación contable | Indefinido | Se conservan. Hoy vacías: el MVP es gratuito |

### Comunidad y comentarios

| Dato | Dónde | Para qué | Cuánto tiempo | Al suprimir |
| --- | --- | --- | --- | --- |
| Publicaciones, respuestas, comentarios, reseñas | `comunidad_posts`, `comunidad_respuestas`, `comentarios`, `curso_calificaciones` | Comunidad | Mientras exista la cuenta | Texto vaciado, marcados como eliminados |
| Reacciones y "me gusta" | `comunidad_reacciones`, `comentario_likes`, `curso_calificacion_reacciones` | Contadores | Mientras exista la cuenta | Los "me gusta" de comentarios se borran; ver hallazgo 4 |
| Archivos adjuntos (con su nombre original) | `comunidad_adjuntos`, bucket `comunidad-adjuntos` | Adjuntos de la comunidad | Mientras exista la cuenta | Archivo y fila borrados |
| Copia del texto que un administrador eliminó | `comunidad_moderacion`, `comentario_moderacion` | Revisar una moderación | Indefinido | **Se conserva**; ver hallazgo 4 |
| Reportes (quién reportó y el motivo) | `comunidad_reportes` | Moderación | Indefinido | Se conservan |
| Notificaciones | `notificaciones` | Avisos dentro de la app | Indefinido | Se conservan (solo ids) |

### Administración y seguridad

| Dato | Dónde | Para qué | Cuánto tiempo |
| --- | --- | --- | --- |
| Acciones de los administradores (quién, qué, cuándo) | `bitacora_administrativa` | Auditoría | Indefinido |
| Correos e IP de intentos de entrar, recuperar contraseña, canjear o validar | `private.intentos_*`, `private.*_reenvios` | Frenar abusos | Se purgan solos un día después de vencer (cron `limpiar-rate-limit`, 3:30) |
| Avisos de proveedores (pueden traer correo o nombre) | `eventos_webhook` | No procesar dos veces un aviso | **90 días** (cron `purgar-webhooks-y-assets`, 3:45) |
| Enlaces de vista previa | `tokens_vista_previa` | Mostrar un curso sin publicar | Un día después de vencer o revocarse (cron, 3:15) |

## 2. Servicios externos y qué reciben

| Servicio | Qué recibe de una persona | Dónde se ve o se borra |
| --- | --- | --- |
| **Supabase** | Todo lo de la sección 1, más los registros de Auth (correo, IP, fecha de cada entrada) | Panel, Logs. Los registros los guarda Supabase según su plan |
| **Railway** | Nada guardado. Sus registros traen lo que la app escribe con `console`: ids, rutas y mensajes de error. Los campos con nombre de correo, contraseña o token salen como `[redactado]` (`src/lib/log.ts`); un correo escrito dentro de un mensaje de error sí pasaría | Panel de Railway, pestaña de registros |
| **Resend** | Correo y nombre de quien recibe cada correo, y el texto del correo | Panel de Resend, Emails |
| **Sentry** | Errores con ids y la ruta. Correos, tokens de enlaces, cookies, IP y cuerpo se quitan antes de salir (`src/lib/sentry-privacidad.ts`) | Panel de Sentry |
| **Mux** | Los videos. El reproductor manda por defecto métricas de reproducción (navegador, país aproximado por la IP); la app no le pasa nombre ni correo, solo el título del video | Panel de Mux, Data |
| **Google (Gemini)** | Transcripciones de las clases y datos del curso, para generar preguntas y descripciones. **Ningún dato de estudiantes** | — |
| **Google (inicio de sesión)** | Google sabe que la persona entró a U.V.A con su cuenta | Cuenta de Google de la persona |
| **Wompi / Stripe** | Nada hoy (el cobro está apagado). Al activarse: datos de pago | — |

## 3. Copias de seguridad

Lo que se borra o se anonimiza sigue en las copias de Supabase hasta que
esas copias vencen. Retención real y simulacro de restauración:
`docs/ops/respaldos-y-restauracion.md`.

## 4. Hallazgos (para decidir, no corregidos aún)

1. **La política de privacidad no nombra a Sentry ni a Google (Gemini y el
   inicio de sesión con Google).** Los dos reciben datos (sección 2). Hay
   que agregarlos a la tabla de encargados (`docs/legal/contenido-soporte.md`,
   4.5) antes de publicarla.
2. **La política dice que Mux no recibe datos identificables.** Por defecto
   el reproductor le manda métricas con datos del navegador y el país
   aproximado. Dos salidas: decirlo en la política, o apagar esas métricas
   en `src/components/features/VideoPlayer.tsx` (perderíamos las
   estadísticas de reproducción del panel de Mux). Confirmar en el panel
   de Mux, sección Data, si de verdad llegan.
3. **(Corregido, noviembre de 2026)** Al borrar su propia cuenta, los
   adjuntos de la comunidad no se borraban (el administrador sí los borraba).
   Ahora `src/actions/perfil/eliminar-cuenta.ts` los borra antes de la
   supresión, con la llave maestra porque una persona con el acceso a la
   comunidad vencido ya no ve los suyos.
4. **La supresión deja copias del texto.** Si un administrador había
   eliminado una publicación o un comentario, la copia del texto original
   (`contenido_original` en `comunidad_moderacion` y `comentario_moderacion`)
   sigue ahí después de suprimir la cuenta. Las reacciones de la comunidad y
   de las reseñas tampoco se borran (solo son ids, pero dicen qué le gustó a
   la persona). Decidir si se vacían en `private.anonimizar_usuario`.
5. **Lo que se guarda "indefinido" no tiene un plazo escrito.** La bitácora,
   los reportes, las notificaciones y las copias de moderación crecen sin
   límite. No es urgente con el volumen de hoy; conviene fijar un plazo
   antes del lanzamiento abierto.
