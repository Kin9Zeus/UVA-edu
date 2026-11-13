# Paquete para el abogado

**Fase 7. Textos legales**
**Fecha:** 13 de noviembre de 2026
**Estado:** borrador para mi revisión. **No lo he enviado.** Lo envío yo, después de exportar el documento oficial y completar los datos de la empresa (ver `02-datos-por-completar.md`).

Esto no es una revisión jurídica. Es el resumen de lo que hay que decidir con un abogado colombiano antes de publicar.

## Resumen de una página

**Qué se publica:** términos y condiciones, tratamiento de datos personales, aviso de privacidad, política de cookies y normas de la comunidad. Los cinco ya tienen ruta en la plataforma (`/legal/…`) y esperan el texto aprobado.

**Cómo funciona hoy la plataforma:** acceso gratuito por código de invitación con cupo y vigencia, sin cobro. Se recogen nombre, correo, celular (opcional), país, especialidad, foto y lo que la persona publica en la comunidad. Hay inicio de sesión con Google. Usamos Supabase, Railway, Mux, Resend, Sentry, Cloudflare, Better Stack y un modelo de Google (Gemini) para generar preguntas y descripciones a partir de las clases. Ningún dato de estudiantes va al modelo.

### Decisiones pendientes

| # | Decisión | Por qué se pregunta |
| ---: | --- | --- |
| 1 | **Edad mínima de 18 años.** ¿Se mantiene? ¿Cómo se comprueba o se declara? | El borrador dice «mayores de 18». El registro no pregunta la edad. |
| 2 | **Inscripción en el Registro Nacional de Bases de Datos** según los activos de la empresa. | El borrador no da por hecho que aplique ni que no aplique. |
| 3 | **Representante en la Unión Europea.** ¿Hace falta si hay estudiantes allá? | El público es de Colombia y Latinoamérica, pero el registro es abierto con invitación. |
| 4 | **Texto vigente del derecho de retracto** tras la Ley 2439 de 2024. | La sección 3.5 del borrador se redactó antes y habla de pagos que hoy no existen. |
| 5 | **Licencia de las plantillas descargables.** ¿Qué puede hacer el estudiante con ellas? | Las plantillas se anuncian como beneficio. No hay licencia escrita. |
| 6 | **Conservación de certificados tras eliminar la cuenta.** | El código los conserva siempre, con el nombre congelado. El borrador dice «salvo que solicites su supresión». |
| 7 | **Contratos con instructores.** Autoría, cesión de derechos y uso de sus videos y sus nombres. | Se publica el nombre del instructor y su especialidad. |

### Puntos que salieron de la auditoría contra el código

Detalle en [`00-texto-vs-codigo.md`](00-texto-vs-codigo.md), con archivo y línea:

| # | Punto |
| ---: | --- |
| 8 | Los términos describen planes y renovación automática. La plataforma funciona por invitación y, cuando haya pagos, serán únicos y no se renuevan solos (D1, D2). |
| 9 | La lista de encargados no incluye Sentry, Google (inicio de sesión y Gemini), Cloudflare ni Better Stack (D3). |
| 10 | Mux puede recibir métricas del navegador y país aproximado (D4). |
| 11 | Se usan dos cookies de preferencia, almacenamiento local, Cloudflare Turnstile y Sentry. ¿Basta con decirlo o hace falta un banner? (D6) |
| 12 | La casilla de aceptación no se guarda. Quien entra con Google no la ve (D7). |
| 13 | Hay datos que se conservan sin plazo escrito: bitácora, reportes, notificaciones y copias de textos moderados (D9). |
| 14 | No hay registro de las solicitudes de los titulares con sus plazos (D10). |
| 15 | La ubicación de cada proveedor no está confirmada, y de eso depende la sección de transferencia internacional (D12). |

## Borrador del correo

**Para:** `[CORREO DEL ABOGADO]`
**Asunto:** Revisión de los textos legales de la plataforma de cursos de UVA

> Buenos días, `[NOMBRE]`:
>
> Le escribo de parte de UVA, una escuela en línea del oficio de la construcción. Vamos a abrir el registro de nuestra plataforma de cursos y necesitamos que revise los textos legales antes de publicarlos.
>
> Le adjunto:
> 1. Los cinco textos: términos y condiciones, tratamiento de datos personales, aviso de privacidad, política de cookies y normas de la comunidad.
> 2. Un resumen de lo que la plataforma hace hoy con los datos, comparado con lo que dicen los textos.
>
> Hoy la plataforma es gratuita y funciona por código de invitación. Hay siete puntos en los que necesito su criterio, y le dejo la lista con una explicación breve de cada uno:
>
> 1. Edad mínima de 18 años y cómo declararla.
> 2. Si debemos inscribirnos en el Registro Nacional de Bases de Datos.
> 3. Si necesitamos un representante en la Unión Europea.
> 4. El texto actual del derecho de retracto, a la luz de la Ley 2439 de 2024.
> 5. La licencia de las plantillas descargables.
> 6. La conservación de los certificados cuando alguien elimina su cuenta.
> 7. Los contratos con nuestros instructores.
>
> También quedaron ocho diferencias entre los textos y lo que hace la plataforma, que preferimos corregir en un lado o en el otro con su orientación.
>
> ¿Podríamos hablar esta semana o la próxima? Le agradezco que me indique el tiempo y el costo estimado de la revisión.
>
> Quedo atento.
>
> Aleck Martínez
> Director del proyecto, UVA

**Antes de enviarlo:** completar los datos de la empresa, adjuntar el documento oficial exportado y confirmar si prefieres que el correo salga con copia al CEO.

## Qué más necesito

La aprobación del abogado y del CEO **por escrito**. Con eso se pide al equipo cargar y publicar los textos y activar las casillas.
