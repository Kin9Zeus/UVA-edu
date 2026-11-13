# Auditoría de coherencia: textos legales contra el código

**Fase 7. Textos legales**
**Fecha:** 13 de noviembre de 2026
**Código revisado:** rama `master`, commit `11693df`. Solo lectura.

## Alcance y límite

El documento «UVA: marco legal de la plataforma y textos oficiales» **no está exportado** a `docs/legal/textos-legales.md`. Por eso no pude contrastar el código con los textos oficiales. Lo contrasté con lo que sí hay en el repositorio:

1. **El borrador interno** [`contenido-soporte.md`](contenido-soporte.md), que se escribió para el centro de ayuda. No es el texto oficial.
2. **El inventario de datos** [`../ops/inventario-de-datos.md`](../ops/inventario-de-datos.md), que sale del código y ya tiene sus propios hallazgos.

**Cuando exportes el documento oficial, repito esta tabla contra él.** Esto no es una revisión jurídica ni sustituye a un abogado.

## 1. Qué datos recoge el código

Resumen del inventario de datos, comprobado contra los formularios y las acciones:

| Dato | De dónde sale | Archivo |
| --- | --- | --- |
| Correo y contraseña (cifrada) | Registro, o Google | `src/components/auth/RegistroForm.tsx`, `GoogleAuthButton.tsx:35` |
| Nombre, celular, país (indicativo), especialidad, rol en el gremio, foto | Perfil | `src/actions/perfil/actualizar.ts`, `foto.ts` |
| Avance por clase, segundo del video, días con actividad | Mientras estudia | `src/app/api/progreso/beacon`, tabla `progreso` |
| Notas de clase | La persona las escribe | `src/actions/notas/crear.ts` |
| Respuestas y nota del examen | Examen | `src/actions/examenes/intento.ts` |
| Reseñas, comentarios, publicaciones, respuestas, reacciones y adjuntos | Comunidad y clases | `src/actions/comunidad/`, `comentarios/` |
| Reportes (quién reportó y el motivo) | Comunidad | `src/actions/comunidad/reportar.ts` |
| Certificados (con el nombre congelado al emitirlo) | Al terminar | `src/lib/certificados/` |
| Código de invitación canjeado y vigencia del acceso | Canje | `src/actions/codigos-invitacion/canjear.ts` |
| Correo e IP de intentos de entrar, recuperar contraseña o canjear | Defensa contra abusos | tablas `private.intentos_*` |
| IP, navegador y fecha de cada sesión | Supabase Auth | `auth.sessions` |
| Secreto del segundo factor (solo administradores) | Activación del 2FA | `src/actions/seguridad/segundo-factor.ts` |
| Acciones de los administradores | Bitácora | `bitacora_administrativa` |

**No hay** datos de pago hoy: las tablas `pagos` e `intentos_pago` existen y están vacías porque el cobro está apagado.

## 2. Cookies y almacenamiento local

| Nombre o clave | Tipo | Para qué | Archivo |
| --- | --- | --- | --- |
| Cookies de sesión de Supabase Auth | Cookie | Mantener la sesión | `src/lib/supabase/` |
| `uva-sidebar-colapsado` | Cookie | Recordar si el menú está colapsado | `src/lib/sidebar-preferencia.ts:13` |
| `uva-panel-clase` | Cookie | Recordar si el panel de la clase está oculto | `src/components/player/panelLateral.ts:5`, `LeccionMaqueta.tsx:264` |
| Preferencia de tema | `localStorage` | Tema claro u oscuro | `src/lib/tema.ts` |
| Usuario conocido | `localStorage` | Sincronizar el cierre de sesión entre pestañas | `src/components/sesion/SincronizarPestanas.tsx:33` |
| Preguntas falladas del examen | `sessionStorage` | Reabrir el examen donde se dejó | `src/components/examen/ExamenRendir.tsx:43,265` |
| Cloudflare Turnstile | Tercero | Verificar que es una persona en registro, entrada, recuperar y reenviar | `src/components/auth/VerificacionTurnstile`, `src/lib/csp.ts:80` |
| Sentry (navegador) | Tercero | Registrar errores | `src/lib/sentry-privacidad.ts` |
| Mux Data (reproductor) | Tercero | Métricas de reproducción | **SIN VERIFICAR** si deja una cookie propia. El inventario dice que manda métricas por defecto. |

**No hay banner de cookies.** No hay analítica de terceros instalada (ni GA4 ni GTM).

## 3. Terceros que reciben datos

Del inventario de datos, sección 2:

| Tercero | Qué recibe | ¿Lo nombra el borrador (sección 4.5)? |
| --- | --- | --- |
| Supabase | Todo lo de la base y los registros de Auth | Sí |
| Mux | Videos y métricas de reproducción | Sí, pero dice que no recibe datos identificables (ver D4) |
| Resend | Correo y nombre de quien recibe un correo | Sí |
| Railway | Registros con ids, rutas y mensajes de error | Sí, como «[Railway / proveedor de hosting]» sin completar |
| Stripe y Wompi | Nada hoy | Sí (cobro apagado) |
| **Sentry** | Errores con ids y ruta | **No** |
| **Google** (inicio de sesión) | Que la persona entró con su cuenta | **No** |
| **Google (Gemini)** | Transcripciones de clases y datos del curso. Ningún dato de estudiantes. | **No** |
| **Cloudflare** (Turnstile, DNS, archivo de registros R2) | IP y señales del navegador en Turnstile; registros de eventos en R2 | **No** |
| **Better Stack** | Copia de eventos de seguridad y errores, con id e IP | **No** |

**Inteligencia artificial.** El código usa un modelo de Google (Gemini) para generar preguntas de examen y descripciones de cursos a partir de las transcripciones de las clases (`src/lib/examenes/generacion/`, `src/lib/descripciones-ia/`). Según el inventario, no recibe datos de estudiantes. El borrador no menciona el uso de IA en ninguna sección.

## 4. Discrepancias entre el borrador y el código

| # | El borrador dice | El código hace | Dónde | Quién decide |
| --- | --- | --- | --- | --- |
| D1 | Términos 3.4: las suscripciones «se renuevan automáticamente» al final de cada periodo. | El cobro está apagado. El pago, cuando exista, es único y **no se renueva solo**. | `src/components/dashboard/PlanesContent.tsx:150`, `CheckoutContent.tsx:482`, `src/emails/recibo-pago.tsx:51` | Abogado y yo, antes de activar los precios |
| D2 | Los términos describen planes, precios, pasarelas, cancelación y retracto. | El único acceso real hoy es por **código de invitación** con cupo y vigencia. El borrador solo menciona la invitación de pasada. No explica qué es un código, cuánto dura ni qué pasa al vencer. | `src/actions/codigos-invitacion/canjear.ts`, `src/lib/estadoAcceso.ts` | Abogado y yo |
| D3 | 4.5 lista Supabase, Mux, Stripe, Wompi, Resend y Railway. | Además reciben datos Sentry, Google (inicio de sesión y Gemini), Cloudflare y Better Stack. | `docs/ops/inventario-de-datos.md`, sección 2 | Yo, con el abogado |
| D4 | 4.5: Mux «no recibe datos personales identificables más allá de tokens de reproducción». | El reproductor puede enviarle métricas con navegador y país aproximado. | `docs/ops/inventario-de-datos.md`, hallazgo 2; `src/components/features/VideoPlayer.tsx` | Yo decido: decirlo en el texto o apagar las métricas (el equipo) |
| D5 | 4.2 lista nombre, correo, celular (opcional), uso, suscripción y facturación, IP. | Se guardan además país, especialidad, rol en el gremio, foto, publicaciones, adjuntos, reportes y notas. «Datos de suscripción y facturación» describe algo que hoy no existe. | `docs/ops/inventario-de-datos.md`, sección 1 | Yo, con el abogado |
| D6 | 4.11: solo cookies técnicas de sesión; sin analítica ni rastreo. | Además hay dos cookies de preferencia, tres usos de almacenamiento local, Turnstile y Sentry. Mux sin verificar. | Tabla de la sección 2 | Abogado: si basta con decirlo o hace falta un banner |
| D7 | 4.4: autorización mediante una casilla no premarcada, que se puede probar. | La casilla existe y parte desmarcada, pero **no se guarda en ningún lado**: es un estado local del formulario. No hay tabla de consentimientos. Quien entra con Google no la ve. | `src/components/auth/RegistroForm.tsx:48,186-190`; `GoogleAuthButton.tsx:35` | Equipo (implementar), abogado (qué debe quedar registrado) |
| D8 | 4.8: el servicio es para mayores de 18 años. | No hay casilla ni comprobación de edad. | `RegistroForm.tsx` | Abogado y equipo |
| D9 | 4.9: después de cerrar la cuenta se conservan los datos solo por el plazo contable. Los certificados, «salvo que solicites su supresión». | La bitácora, los reportes, las notificaciones y las copias de textos moderados se conservan **indefinidamente**, sin plazo escrito. Los certificados se conservan siempre, aunque la persona elimine su cuenta. | `docs/ops/inventario-de-datos.md`, hallazgos 4 y 5; `src/app/(public)/cuenta-eliminada/page.tsx:43` | Abogado y yo |
| D10 | 4.7: los derechos se ejercen escribiendo a soporte@uvarq.com, con plazos de 10 y 15 días hábiles. | El correo está en `src/lib/contacto.ts`. Hay autoservicio de descarga y de eliminación de la cuenta. **No hay un registro de las solicitudes ni de sus plazos.** | `PerfilForm.tsx:419-423`, `src/actions/perfil/exportar-datos.ts`, `eliminar-cuenta.ts` | Yo (procedimiento interno) |
| D11 | 3.8: aprobar el examen basta para el certificado cuando el curso lo exige. | Coincide con la regla del código (`supabase/sql/114_certificado_no_exige_lecciones.sql`). **La interfaz sí dice otra cosa** en `ExamenCta.tsx:37`. | Ver H39 en `docs/textos/01-hallazgos.md` | Equipo (cambiar el texto) |
| D12 | 4.6: transferencia internacional a proveedores fuera de Colombia, con «nota para revisión legal» sobre su ubicación. | **SIN DATO:** el repositorio no dice en qué región está cada proveedor. | Paneles de Supabase, Railway, Mux, Resend, Sentry, Cloudflare y Better Stack | Yo lo consulto en cada panel |
| D13 | Los textos legales se llaman «Términos y condiciones», «Política de tratamiento de datos personales», «Aviso de privacidad», «Política de cookies» y «Normas de la comunidad». | El registro enlaza «Términos» y «Política de privacidad» al centro de soporte, que dice «Contenido en preparación». | `RegistroForm.tsx:193-207`; `src/lib/soporte.tsx:177-185` | Ver H01 en `docs/textos/01-hallazgos.md` |

## 5. Lo que revisé y está coherente

- **Correo de contacto de datos personales:** el borrador y el código usan `soporte@uvarq.com` (`src/lib/contacto.ts`).
- **Certificados públicos:** el borrador dice que la verificación muestra nombre, curso y fecha sin iniciar sesión. La página `VerificacionCertificado.tsx` muestra además la intensidad horaria y el código. El dato extra no es personal.
- **Eliminación de la cuenta:** `anonimizar_usuario` deja el registro de acceso y de pagos sin el nombre de la persona. La pantalla de cuenta eliminada dice lo mismo que el inventario.
- **Seguridad (4.10):** RLS, cifrado en tránsito y credenciales por entorno están en el código y en `docs/ops/`.

## 6. Qué le toca a quién

- **Yo:** decidir D3, D4, D5, D6, D9 con el abogado, y abrir los paneles de cada proveedor para D12 (región).
- **Abogado:** D1, D2, D6, D7, D8 y D9.
- **Equipo (Andres y Miguel):** D7, D8, D11 y D13. Quedan en `docs/pendientes-equipo.md`.
