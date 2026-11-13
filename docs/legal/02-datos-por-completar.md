# Datos por completar en los textos legales

**Fase 7. Textos legales**
**Fecha:** 13 de noviembre de 2026
**Estado:** `BLOQUEADA` en su versión completa. El documento oficial no está exportado a `docs/legal/textos-legales.md`, así que no puedo listar sus marcadores entre corchetes. Lo que sigue sale del **borrador interno** [`contenido-soporte.md`](contenido-soporte.md) y de lo que pide el plan. Cuando llegue el documento oficial, esta lista se amplía con sus marcadores reales.

## Qué hace falta de mi parte (`ACCIÓN DE ALECK`)

Exportar el documento «UVA: marco legal de la plataforma y textos oficiales» a `docs/legal/textos-legales.md`.

## Datos pendientes, agrupados por quién los entrega

### Los entrego yo (datos de la empresa)

| Dato | Dónde lo pide el borrador | Estado |
| --- | --- | --- |
| Razón social | `contenido-soporte.md:98`, sección 4.1 | `[POR COMPLETAR POR ALECK]` |
| NIT | `contenido-soporte.md:98`, sección 4.1 | `[POR COMPLETAR POR ALECK]` |
| Domicilio, ciudad | `contenido-soporte.md:99,112,290` | `[POR COMPLETAR POR ALECK]`. En `uvarq.com` aparece Calle 14 n.º 23-71, oficina 501, edificio Alturia, Pereira. Hay que confirmar si es el domicilio legal. |
| Teléfono, si aplica | `contenido-soporte.md:100` | El único teléfono público es el de WhatsApp (+57 323 426 0022, `src/lib/contacto.ts`). Decido si va. |
| Oficial o área de protección de datos | La lista del plan lo incluye | `[POR COMPLETAR POR ALECK]` |
| Dominio definitivo | Textos y enlaces | `uvarq.com`, decidido. Falta confirmar con o sin `www`. |
| Correos | Contacto y datos personales | `soporte@uvarq.com` está en el código y en el borrador. Si habrá un buzón dedicado a datos personales, hay que decirlo. |

### Los consulto en el panel de cada proveedor (los entrego yo o el equipo)

| Dato | Dónde se ve |
| --- | --- |
| País o región de Supabase, Railway, Mux, Resend, Sentry, Cloudflare (R2) y Better Stack | Configuración de cada proyecto o cuenta |
| Proveedor de hosting exacto | El borrador tiene `[Railway / proveedor de hosting]` (`contenido-soporte.md:342`). Es Railway. |
| Duración de cada cookie o dato almacenado | Tabla de la sección 2 de `00-texto-vs-codigo.md`. Los nombres están. Las dos cookies de preferencia duran un año (`UN_ANIO_EN_SEGUNDOS` en `src/lib/sidebar-preferencia.ts` y `max-age=31_536_000` en `LeccionMaqueta.tsx:264`). Faltan las duraciones de la cookie de sesión de Supabase y de lo que guarden Turnstile y Mux. |

### Los define el abogado

| Dato | Para qué |
| --- | --- |
| Fechas de vigencia de cada texto | La publicación exige una fecha (`vigente_desde`) y se niega si falta (`prisma/schema.prisma:1853`). |
| Si UVA debe inscribirse en el Registro Nacional de Bases de Datos | Borrador, aviso inicial |
| Fecha de «última actualización» | `contenido-soporte.md:106` |

## Qué cambia cuando llegue el documento oficial

Repetiré esta lista con cada corchete del documento oficial, con su ubicación exacta, agrupada igual. Los datos que dependen de proveedores (región, duración) los dejaré en una columna aparte, para que Andres y Miguel puedan completarlos sin esperarme.
