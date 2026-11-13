# Etapa 8. Informe de cierre

**Fase 14 · SEO y GEO · 13 de noviembre de 2026 · Aleck Martínez**

## Cómo leer el estado

Medí cada tarea contra lo que se pedía entregar, no contra la «definición de terminado» escrita en Notion: **no tengo esos textos (SIN DATO)**. Pégalos si quieres que contraste cada tarea con ellos.

Estados: **Entregado** (listo para pegar en Notion), **Entregado con límites** (listo, con una parte que depende de un dato) y **Pendiente de ti** (el entregable existe, pero falta una acción tuya).

## Estado por tarea

| Tarea | Fecha objetivo | Estado | Documento |
| --- | --- | --- | --- |
| Diagnóstico de marca y rutas | — | **Entregado.** Falta tu decisión del nombre. | `00-diagnostico.md`, `00-anexo-variantes-marca.csv` |
| Investigación de palabras clave | 13 nov | **Entregado con límites.** Los 40 temas están listos; **los volúmenes son SIN DATO** y hay que sacarlos de Keyword Planner y Trends. Con esa fecha (hoy) no se alcanza a cerrar la parte de datos. | `01-semillas.md`, `02-datos-palabras-clave.md` |
| Mapa de contenidos | 13 nov | **Entregado con límites.** 44 búsquedas con prioridad provisional (sin volumen). Los slugs de cursos y escuelas están sin confirmar contra el catálogo real. | `03-mapa-contenidos.md` |
| Preguntas de control para GEO | — | **Entregado.** La línea base de respuestas de los asistentes **no está corrida** (se hace a mano, ver el documento). | `04-prompts-control.md`, `04-prompts-control.csv` |
| Competencia | — | **Entregado con límites.** 20 búsquedas, con la advertencia de que no son posiciones de Google Colombia. | `05-competencia.md` |
| Identidad de marca | 20 nov | **Pendiente de ti.** Borrador completo; faltan nombre, dirección y atención al público, año de fundación, razón social, cifras con fuente e instructores. | `06-identidad-marca.md` |
| Search Console, Bing y analítica | 26 nov a 4 dic | **Guía lista; ejecución pendiente.** Depende de dos decisiones (host canónico y destino de la oferta comercial) y del acceso al DNS. | `07-webmasters.md` |

## Decisiones pendientes

| # | Decisión | De quién | Por qué importa |
| ---: | --- | --- | --- |
| 1 | Nombre oficial (A. `UVA Arquitectura`, B. `U.V.A. — Unidad Vectorial de Arquitectura`, C. `UVA`, D. `UVArq`) | Aleck | Fija título, datos estructurados y perfiles. Recomendación en `00-diagnostico.md`. |
| 2 | Host canónico: `uvarq.com` o `www.uvarq.com` | Aleck con Andrés o Miguel | Fija `NEXT_PUBLIC_SITE_URL`, el sitemap, las canónicas y las redirecciones. Cambiarla después exige redespliegue. |
| 3 | **Dónde queda la oferta comercial** (fichas con precio, libros, asesoría, comunidad) cuando la plataforma ocupe `uvarq.com` | Aleck | La web actual vende a 220 USD con enlace por WhatsApp; la plataforma es por invitación. Define a dónde redirigen las 22 URLs actuales. |
| 4 | ¿La oficina de Pereira atiende público? | Aleck | Define si hay perfil de Google Business Profile y si el JSON-LD lleva dirección. |
| 5 | ¿El podcast de Spotify es red oficial? | Aleck | Entra o no en `sameAs`. |
| 6 | Qué hacer con «más de 10k personas han comprado nuestros cursos» | Aleck | No hay fuente; la regla de contenido veraz de la plataforma exige una. |
| 7 | Fechas realistas para investigación y mapa | Aleck | La fecha objetivo de 13 de noviembre es hoy y los volúmenes no existen aún. |

## Contradicciones que encontré

Como pediste que te avisara cuando algo contradiga lo que me pasaste:

1. **«Acceso por invitación, sin cobro» frente a la web actual.** La plataforma es gratuita y por invitación (`CLAUDE.md`, sección 2), pero la web que ocupa `uvarq.com` hoy vende a 220 USD. Mientras ambas existan hay dos ofertas de los mismos cursos.
2. **El plan de Cloudflare frente a tu decisión.** `docs/ops/cloudflare.md` asume que la plataforma va en un subdominio (por ejemplo `app.uvarq.com`) y que la web corporativa sigue en `www`. Tu respuesta es que la plataforma ocupa `uvarq.com` y la web se muda. Ese documento hay que reescribirlo.
3. **El resultado enriquecido de cursos.** El prompt lo da por retirado (correcto: Google lo confirma). Los comentarios de `src/lib/seo/curso-jsonld.ts` siguen hablando de «entrar al rich result de Course Info».
4. **Los comentarios del código sobre el logo.** `src/lib/seo/organizacion.ts` y `src/lib/seo/metadata.ts` dicen que `public/` no tiene ningún recurso de marca; `public/correo/` tiene ocho versiones del logo. No son 1200×630 ni cuadradas, pero el comentario está desactualizado.
5. **La lista de redes.** Pedías considerar Instagram, LinkedIn, YouTube, Facebook y TikTok. Me confirmaste que solo existen las que ya enlaza el pie. Trabajé con YouTube, Instagram, TikTok y Spotify (este último por confirmar).
6. **Las fechas.** La fecha de investigación y mapa (13 de noviembre) coincide con la de la solicitud.

## Riesgos

| Riesgo | Impacto | Qué lo reduce |
| --- | --- | --- |
| **Migrar `uvarq.com` sin redirecciones 301** | Pierde lo que la web actual ya haya ganado en buscadores. Las 22 URLs actuales dejarían de responder lo que respondían. | Mapa de `07-webmasters.md`, sección 4; mantener las redirecciones al menos un año (guía de Google); no redirigir todo a la portada. |
| **El registro TXT de Search Console se pierde al cambiar los nameservers a Cloudflare** | La propiedad de Dominio se desverifica en plena migración. | Comprobar que el TXT esté en la zona de Cloudflare antes del cambio (`dig TXT uvarq.com`). |
| **Cifra pública sin fuente** («10k») | Contradice la regla de contenido veraz; los asistentes de IA y los buscadores la pueden repetir. | Retirarla o documentar la fuente. |
| **Contenido duplicado entre web vieja y plataforma** | Dos fichas para el mismo curso con precios y accesos distintos. | Decisión 3. |
| **Bloquear a los rastreadores por error en Cloudflare** | Ni Google, ni Bing, ni los rastreadores de IA llegan al sitio. | Revisar reglas de bots y WAF (`docs/ops/cloudflare.md`, sección 2.4) y comprobar con la Inspección de URLs. |
| **Nombre inconsistente en perfiles y datos estructurados** | Los asistentes de IA confunden a UVA con otra entidad (la fruta, la Universidad de Virginia). | Decisión 1, ficha de `06-identidad-marca.md` y preguntas 24 y 25 de control. |
| **La plataforma sigue sin analítica** | Sin medir no se sabe si algo funciona. | Instalar GA4 y la CSP asociada (`07-webmasters.md`, sección 7). |
| **Prioridades de contenido basadas solo en observación** | Se puede invertir en términos de poco volumen. | Obtener datos de Keyword Planner y Trends y recalcular (`02-datos-palabras-clave.md`). |
| **Posiciones de la competencia no verificadas** | El análisis dice quién domina, no en qué lugar aparece cada uno. | Search Console y búsqueda manual desde Colombia. |

## Lo que me toca a mí, en orden

1. Responder las decisiones 1 a 3 (de ellas dependen las demás).
2. Sacar los datos de Keyword Planner y Trends y dejarlos en `docs/seo/datos/`.
3. Responder las preguntas de dirección y de atención al público.
4. Pasar año de fundación, razón social, instructores y la fuente de las cifras.
5. Correr la línea base de las 25 preguntas de control.
6. Crear la propiedad de Dominio en Search Console (26 de noviembre).

## Lo que recomiendo a Andrés y Miguel

Ninguno de estos cambios está hecho. Son recomendaciones.

1. Redirecciones 301 de las 22 URLs actuales (`07-webmasters.md`, sección 4).
2. Registro TXT de Search Console en el DNS, y cuidarlo en el cambio a Cloudflare.
3. Nodo `Organization` completo con `sameAs` (`06-identidad-marca.md`, sección 3).
4. Imagen social de 1200×630 e imagen cuadrada de logo en `public/`.
5. `noindex` en clase, examen y login, y sacar `/login` del sitemap (`00-diagnostico.md`).
6. Descripciones propias por escuela, y página «Sobre nosotros».
7. Sección de guías y glosario (`03-mapa-contenidos.md`).
8. Instalación de GA4 con los eventos propuestos y el ajuste de CSP.
9. Clave y envío de IndexNow.
10. Actualizar `docs/ops/cloudflare.md` y los comentarios desactualizados de `src/lib/seo/`.

## Fuentes consultadas (13 de noviembre de 2026)

- Google, [aviso sobre resultados enriquecidos retirados](https://developers.google.com/search/blog/2025/06/simplifying-search-results)
- Google, [verificar propiedad por DNS](https://support.google.com/webmasters/answer/9008080) · [enviar sitemap](https://support.google.com/webmasters/answer/7451001) · [Inspección de URLs](https://support.google.com/webmasters/answer/9012289) · [migración con cambio de URLs](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes)
- Google Ads, [Keyword Planner](https://support.google.com/google-ads/answer/7337243) · Google Trends, [ayuda](https://support.google.com/trends/answer/4365533) · Analytics, [eventos clave](https://support.google.com/analytics/answer/9267568) · Business Profile, [elegibilidad](https://support.google.com/business/answer/3038177)
- Bing, [importar desde Search Console](https://blogs.bing.com/webmaster/september-2019/Import-sites-from-Search-Console-to-Bing-Webmaster-Tools) · [IndexNow](https://www.indexnow.org/documentation)
- Web actual: `https://www.uvarq.com/cursos`, `/cursos/revit-arquitectura`, `/robots.txt`, `/sitemap.xml`, y el repositorio `Kin9Zeus/UVAWebDL`.
- Competidores: los enlaces de `05-competencia.md`.
