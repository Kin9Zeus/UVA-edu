# Pendientes para Andres y Miguel

**Fecha:** 13 de noviembre de 2026
**Origen:** las tareas de Aleck de la Fase 8 (textos), la Fase 7 (textos legales) y la Fase 14 (SEO y GEO).
**Regla:** nada de esto está hecho. Son cambios de código que no me corresponde hacer. Cada fila dice archivo, línea, qué cambiar y si depende de una decisión mía.

## 1. Textos de la interfaz (Fase 8)

Detalle y propuesta de texto en [`textos/01-hallazgos.md`](textos/01-hallazgos.md). **Solo se aplican las filas con «sí» en la columna Aprobado.** Son cambios de cadenas de texto: no tocan lógica.

| # | Archivo y línea | Qué cambiar | Quién | Depende de mí |
| ---: | --- | --- | --- | --- |
| 1 | `src/components/auth/RegistroForm.tsx:193-232` | Enlazar «Términos y condiciones» y «Aviso de privacidad» a `/legal/terminos` y `/legal/privacidad` cuando los textos estén publicados. Hoy llevan al centro de soporte (H01). | Andres o Miguel | Sí: textos legales aprobados y publicados |
| 2 | `BottomTabBar.tsx:19`, `dashboard/Sidebar.tsx:61`, `EstadoAccesoCard.tsx:63`, `lib/soporte.tsx:66` | Cambiar la etiqueta «Suscripción» por «Mi acceso» (H03). La ruta puede seguir siendo `/dashboard/suscripcion`. | Andres o Miguel | Aprobar H03 |
| 3 | `actions/codigos-invitacion/canjear.ts:43`, `actions/comunidad/crear.ts:123,215` | Quitar «suscripción» de esos mensajes (H02, H15) | Andres o Miguel | Aprobar H02 y H15 |
| 4 | `ReportarComunidadDialog.tsx:83,100`; `EliminarCuentaCard.tsx:80` | Corregir el voseo (H14, H11) | Andres o Miguel | Aprobar H11 y H14 |
| 5 | `src/components/examen/ExamenCta.tsx:37` | Quitar el requisito de terminar las clases, que ya no existe (H39) | Andres o Miguel | Aprobar H39 |
| 6 | `src/components/home/Footer.tsx:182` | Que el año del «© 2026» lo calcule el código | Andres o Miguel | No |
| 7 | `Footer.tsx:134` | Quitar el `href="#"` de la columna oculta, o darle destino antes de reactivarla (H25) | Andres o Miguel | No |
| 8 | `src/lib/resend.ts:41,87,120,158,201` | Devolver un texto propio en vez de `error.message` del proveedor, que viene en inglés (H28) | Andres o Miguel | No |
| 9 | 30 archivos del panel admin | Alinear el vocabulario del panel con el de los estudiantes: lección a clase, categoría a escuela, profesor a instructor (ver `textos/02-glosario.md`) | Andres o Miguel | Aprobar el glosario |
| 10 | `src/lib/descripciones-ia/prompt.ts:16,66` | «escuela online» a «escuela en línea», y el nombre de la marca cuando esté decidido | Andres o Miguel | Sí: nombre oficial |
| 11 | `src/components/admin/codigos/CodigoFormDialog.tsx:40` | El mensaje que se copia para invitar usa «U.V.A» sin el punto final (H22) | Andres o Miguel | Sí: nombre oficial |
| 12 | `src/components/dashboard/Proximamente.tsx` | Es un componente que no se usa en ninguna pantalla. Quitarlo o dejarlo anotado. Su texto dice «Este módulo todavía no está disponible». | Andres o Miguel | No |
| 13 | `src/emails/vencimiento-proximo.tsx`, `recibo-pago.tsx` | No se envían hoy. Revisar su texto (planes, pagos, «Renovar») antes de activarlos con el modelo de invitación (H37). | Andres o Miguel | Sí, cuando se decida el cobro |

## 2. Textos legales (Fase 7)

Detalle en [`legal/00-texto-vs-codigo.md`](legal/00-texto-vs-codigo.md) y [`legal/01-checklist-implementacion.md`](legal/01-checklist-implementacion.md).

| # | Archivo | Qué hace falta | Quién | Depende de mí |
| ---: | --- | --- | --- | --- |
| 14 | `prisma/schema.prisma` y `supabase/sql/` | **Tabla de consentimientos:** usuario, tipo, versión del texto, fecha y hora, IP y origen. Hoy no existe. | Andres o Miguel | Sí: qué debe quedar registrado, con el abogado |
| 15 | `RegistroForm.tsx:186-207` | **Casillas separadas** y sin marcar: términos, autorización de tratamiento de datos y mayoría de edad. La de comunicaciones solo si se van a enviar. Que cada una se guarde en la tabla de consentimientos. | Andres o Miguel | Sí: el abogado define las casillas |
| 16 | `src/components/auth/GoogleAuthButton.tsx:35` y `/auth/callback` | **Aceptación para quien entra con Google:** un paso que muestre los textos y registre la aceptación de una cuenta nueva. | Andres o Miguel | Sí |
| 17 | Nuevo componente | **Banner de cookies** (aceptar, rechazar, configurar), solo si el abogado dice que hace falta. Debe existir antes de instalar cualquier analítica. | Andres o Miguel | Sí |
| 18 | `src/components/features/VideoPlayer.tsx` | Decidir si se apagan las métricas de Mux Data. Si se decide decirlo en el texto, no hay cambio de código. | Andres o Miguel | Sí |
| 19 | `private.anonimizar_usuario` y crones | Fijar plazos para lo que hoy se conserva indefinidamente: bitácora, reportes, notificaciones y copias de moderación (inventario de datos, hallazgos 4 y 5). | Andres o Miguel | Sí: plazos, con el abogado |
| 20 | Hoja interna o tabla | Registro de solicitudes de los titulares, con fecha y plazo de respuesta | Yo | Es mío |

## 3. SEO y GEO (Fase 14)

Detalle en [`seo/08-informe.md`](seo/08-informe.md), sección «Lo que recomiendo a Andres y Miguel». Resumen:

| # | Qué | Archivo |
| ---: | --- | --- |
| 21 | Redirecciones 301 de las 22 URLs de la web actual, **cuando** la plataforma pase a `uvarq.com` (no antes) | Cloudflare o servidor |
| 22 | Nodo `Organization` completo con `sameAs`, logo y contacto | `src/lib/seo/organizacion.ts`, ver `marca/03-sameas.md` |
| 23 | Imagen social de 1200×630 e imagen cuadrada de logo | `public/` |
| 24 | `noindex` en clase, examen y login, y sacar `/login` del sitemap | `src/app/(public)/` y `src/app/sitemap.ts` |
| 25 | Descripción propia por escuela y página «Sobre nosotros» | `src/app/(public)/catalogo/[categoriaSlug]/page.tsx` |
| 26 | Instalar GA4 con el ajuste de la política CSP | `src/lib/csp.ts` |
| 27 | Reescribir `docs/ops/cloudflare.md`, que asume la plataforma en un subdominio | `docs/ops/cloudflare.md` |
| 28 | Actualizar los comentarios desactualizados sobre el resultado enriquecido de cursos y sobre el logo | `src/lib/seo/curso-jsonld.ts`, `organizacion.ts`, `metadata.ts` |

## 4. Pruebas de usabilidad (Fase 13, 16 al 18 de noviembre)

| # | Qué | Quién |
| ---: | --- | --- |
| 29 | Observar al menos 2 de las 5 sesiones, en silencio | Andres o Miguel |
| 30 | Si es posible, aplicar antes del lunes 16 las correcciones de texto de severidad alta (H01, H02, H03, H11, H14, H15 y H39), para que los participantes no tropiecen con ellas | Andres o Miguel |
