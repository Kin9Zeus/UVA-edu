# Etapa 1. Diagnóstico de marca y rutas

**Fase 14, SEO y GEO. Preparado el 13 de noviembre de 2026 por Aleck Martínez**
**Alcance:** repositorio `Kin9Zeus/UVA-edu` (rama `master`, commit `11693df`) y lectura pública de `uvarq.com`. No se modificó ningún archivo de código.

## Lo que más importa (en orden)

1. **El nombre no está unificado.** En `src/` hay 231 apariciones de la marca en cuatro formas distintas: «U.V.A.» (171), «UVA» (37), «U.V.A» sin punto final (19) y «Unidad Vectorial de Arquitectura» (4). Las páginas públicas usan «U.V.A.» y la web actual usa «UVA Arquitectura». Hay que decidir un nombre antes de tocar perfiles, datos estructurados y fichas.
2. **«UVA» solo choca con otras cosas.** `uva` es también la fruta en español, y el propio repositorio documenta que el dominio `uva.edu` pertenece a la Universidad de Virginia (`src/lib/contacto.ts`, línea 27). Las redes ya usan `uvarq`, que no tiene ese problema. Esto pesa en la decisión de nombre (ver más abajo).
3. **Hay un riesgo de migración que ningún otro punto del plan cubre.** `www.uvarq.com` hoy es el sitio corporativo y tiene 22 URLs en su sitemap, 11 de ellas cursos con precio. Si la plataforma pasa a `uvarq.com` y ese sitio se muda, cada URL vieja necesita una redirección 301 a su equivalente. Sin eso se pierde lo ya ganado. Está desarrollado en `07-webmasters.md`.
4. **Ninguna página compartida tiene imagen social.** No existe una imagen de 1200×630 y todas las tarjetas salen en formato `summary`.
5. **El nodo `Organization` está incompleto**: sin logo, sin `sameAs` (redes), sin dirección ni contacto.
6. **Google retiró el resultado enriquecido de cursos.** Lo confirma Google en su aviso del 12 de junio de 2025, con retirada completada el 8 de septiembre de 2025 ([fuente](https://developers.google.com/search/blog/2025/06/simplifying-search-results)). El marcado `Course` de la plataforma sigue siendo útil para que los buscadores y los asistentes de IA entiendan la página, pero no hay que esperar la tarjeta enriquecida. Los comentarios de `src/lib/seo/curso-jsonld.ts` todavía hablan de ese resultado enriquecido; es una nota para Andrés o Miguel, no algo que yo corrija.
7. **La plataforma no tiene analítica instalada.** No hay rastro de GA4, GTM ni similares en `src/` ni en `package.json`. Para medir conversiones hace falta un cambio de código y de la política CSP (`src/lib/csp.ts`). Es trabajo de Andrés o Miguel.

## 1. Variantes del nombre

Resumen por superficie (el detalle completo, archivo por archivo y línea por línea, está en [`00-anexo-variantes-marca.csv`](00-anexo-variantes-marca.csv)):

| Superficie | Apariciones |
| --- | ---: |
| Páginas públicas y textos (rutas, pie de página, soporte, legales) | 65 |
| Otros archivos de `src/` | 51 |
| Panel del estudiante (no público) | 27 |
| Correos transaccionales | 27 |
| Panel de administración (no público) | 25 |
| Certificados en PDF | 15 |
| Otras rutas (seguridad, acceso denegado, vista previa) | 13 |
| SEO, metadata y datos estructurados | 8 |
| **Total (sin pruebas automáticas)** | **231** |

Por forma:

| Forma | Apariciones |
| --- | ---: |
| `U.V.A.` | 171 |
| `UVA` | 37 |
| `U.V.A` (sin punto final) | 19 |
| `Unidad Vectorial de Arquitectura` | 4 |

Las ocho que pesan para buscadores:

| Archivo | Línea | Variante | Qué es |
| --- | ---: | --- | --- |
| `src/app/layout.tsx` | 38 | `U.V.A. — Unidad Vectorial de Arquitectura` | Título por defecto de todo el sitio |
| `src/app/layout.tsx` | 39 | `U.V.A.` | Descripción por defecto: «Plataforma de cursos de U.V.A.» |
| `src/lib/seo/metadata.ts` | 43 | `U.V.A. — ` | Prefijo que se antepone al título de cada página pública |
| `src/lib/seo/metadata.ts` | 15 | `U.V.A` | Comentario |
| `src/lib/seo/organizacion.ts` | 25 | `U.V.A. — Unidad Vectorial de Arquitectura` | `name` de la organización en el JSON-LD |
| `src/lib/seo/organizacion.ts` | 4 | `U.V.A` | Comentario |

Otras variantes fuera del repositorio de la plataforma, verificadas en `uvarq.com` y en el repositorio de la web actual (`UVAWebDL`, `src/lib/seo.ts`):

- `UVA Arquitectura`: nombre del proveedor en el JSON-LD de los cursos de la web actual y sufijo de sus títulos sociales (`| UVA Arquitectura`).
- `UVA`: en los títulos de tarjetas de X (`| UVA`) y en la página de curso («Certificación Profesional UVA»).

### Opciones de nombre oficial

La decisión es mía. Esta es la comparación:

| Opción | Pros | Contras |
| --- | --- | --- |
| **A. `UVA Arquitectura`** | Ya lo usa la web actual en el JSON-LD y en los títulos sociales. Se pronuncia y se busca como se escribe. La palabra «Arquitectura» desambigua frente a la fruta y a la Universidad de Virginia. Encaja con el usuario `uvarq`. | Deja de lado «Unidad Vectorial», que sigue siendo el nombre completo de la escuela. Cuesta cambiar los 171 «U.V.A.» ya escritos. |
| **B. `U.V.A. — Unidad Vectorial de Arquitectura`** (lo actual en la plataforma) | Es el nombre completo y ya está en los datos estructurados. | Es largo para un título de búsqueda (se corta). Los puntos hacen que la gente escriba «UVA» o «U.V.A» indistintamente. No coincide con ninguna red social. |
| **C. `UVA`** | Corto, ya escrito en la mayoría de textos. | Ambiguo: la fruta, la Universidad de Virginia. Sin contexto, un buscador o un asistente de IA no sabe a qué entidad te refieres. |
| **D. `UVArq`** | Igual al dominio y a las redes. Es una palabra inventada, así que no se confunde con otra cosa (no verifiqué su uso por terceros). | Nadie lo escribe así hoy. Hay que enseñarlo desde cero. |

**Qué recomendaría yo, para que lo decidas:** usar `UVA Arquitectura` como nombre corto en títulos, fichas y perfiles, y «Unidad Vectorial de Arquitectura» como nombre completo en la descripción y en `alternateName`. Mantener `uvarq` como identificador en todas las redes y el dominio. Es la combinación que más reduce la ambigüedad sin renunciar al origen del nombre. La decisión final es tuya, y hasta que la tomes dejo `[NOMBRE OFICIAL POR DEFINIR]` en los demás documentos.

## 2. Rutas públicas

Cada ruta con lo que hoy declara el código. «Indexable» significa que no hay `noindex` en la metadata ni `Disallow` en `robots.ts`.

| Ruta | Título que ve Google | Descripción | Canónica | Indexable | Datos estructurados |
| --- | --- | --- | --- | --- | --- |
| `/` | `U.V.A. — La escuela del sector de la construcción` | «Del primer boceto a la entrega final: diseño, modelado, presupuesto, contratación y gestión de obra.» | Sí (`/`) | Sí | `Organization` (sin logo, sin `sameAs`) |
| `/catalogo` | `U.V.A. — Catálogo de cursos` | «Cursos de arquitectura, obra, presupuesto y BIM. Explora el catálogo completo de U.V.A. por escuela y nivel.» | Sí | Sí | Ninguno |
| `/catalogo/[escuela]` | `U.V.A. — {nombre de la escuela}` | «Cursos de {escuela} en U.V.A.: formación técnica para el oficio de la construcción.» (plantilla igual para todas) | Sí, siempre por slug | Sí | Ninguno |
| `/cursos/[curso]` | `U.V.A. — {título del curso}` | La descripción del curso | Sí, siempre por slug | Sí | `Course` con `provider`, `inLanguage`, `educationalLevel`, `about`, `hasCourseInstance`; `instructor`, `aggregateRating` e imagen solo si existen. Sin `offers` a propósito. |
| `/cursos/[curso]/[clase]` | `U.V.A. — {clase}` | Ninguna | Sí | **No verificado**: no hay `noindex` ni `Disallow`; el código dice que la sesión se exige dentro de la página. Hay que comprobar con `curl` qué recibe un rastreador anónimo (ver `07-webmasters.md`). | Ninguno |
| `/cursos/[curso]/examen` | `U.V.A. — Examen final` | Ninguna | No | Igual que la anterior | Ninguno |
| `/login` | `U.V.A. — Iniciar sesión o crear cuenta` | «Entra a tu cuenta U.V.A. o créala con tu correo…» | Sí | Sí. Además está en el sitemap con prioridad 0,3. | Ninguno |
| `/registro` | (redirige a `/login`) | n/a | n/a | n/a | n/a |
| `/soporte` | `U.V.A. — Soporte` | «Respuestas a las dudas frecuentes sobre cuenta, acceso, certificados y pagos en U.V.A.…» | Sí | Sí | Ninguno (hay preguntas frecuentes sin marcado `FAQPage`) |
| `/legal/[texto]` | `U.V.A. — {nombre del texto legal}` | Una por texto | Sí | Sí si es la versión vigente | Ninguno |
| `/planes` | n/a | n/a | n/a | Responde 404 mientras `PRECIOS_HABILITADOS` esté apagado | n/a |
| `/canjear` | `U.V.A. — Canjea tu invitación` | Ninguna | No | `noindex` en la metadata; no está en `robots.ts` | n/a |
| `/verificar-certificado` y `/verificar-certificado/[código]` | `U.V.A. — Verificar certificado` | Sí | No | `noindex` y además `Disallow` en `robots.ts` | n/a |
| `/cuenta-eliminada`, `/verificar-correo`, `/recuperar`, `/actualizar-password` | `U.V.A. — …` | Ninguna o mínima | No | Con `noindex` o bajo `Disallow` según la ruta | n/a |
| Cualquier ruta sin metadata propia | `U.V.A. — Unidad Vectorial de Arquitectura` | «Plataforma de cursos de U.V.A.» | No | Sí | n/a |

### Hallazgos de esta tabla

- **El título de la portada no dice qué se vende.** «La escuela del sector de la construcción» no contiene «cursos», «arquitectura», «presupuestos» ni «BIM». La descripción sí menciona diseño, modelado, presupuesto y gestión de obra.
- **Todos los títulos empiezan por la marca** (`U.V.A. — `). En una búsqueda, lo que se corta primero es el final del título, y lo que pierde es la parte descriptiva. Conviene invertir el orden: descripción primero y marca al final.
- **`/login` está indexable y en el sitemap.** No es una página que alguien busque. Sugiero que Andrés o Miguel la saquen del sitemap y valoren un `noindex`. Lo describo como recomendación, no como cambio hecho.
- **Las páginas de escuela repiten la misma descripción con el nombre intercambiado.** Es el patrón más débil de la plataforma para posicionar una escuela.
- **La clase y el examen no tienen `noindex` ni descripción.** Si un rastreador las viera, mostrarían contenido con muy poco texto. Se comprueba con `curl` antes de decidir nada.
- **Falta una página «Sobre nosotros».** El pie de página tiene una columna con «Sobre nosotros», «Blog del gremio», «Casos de éxito» y «Empleo», pero está oculta (`MOSTRAR_COLUMNA_COMUNIDAD = false` en `src/components/home/Footer.tsx`) porque las páginas no existen. Es la página que respalda la identidad de la organización para buscadores y asistentes de IA.

## 3. `robots.txt` y sitemap

**Plataforma** (`src/app/robots.ts`, `src/app/sitemap.ts`):

- `robots.txt` permite todo y bloquea `/dashboard`, `/admin`, `/seguridad`, `/api`, `/vista-previa`, `/verificar-certificado`, `/acceso-denegado`, `/auth`, `/recuperar`, `/actualizar-password` y `/verificar-correo`. Declara el sitemap.
- El sitemap incluye portada, `/catalogo`, `/login`, `/soporte`, los textos legales con versión vigente, las escuelas con al menos un curso publicado y los cursos con `mostrado = true`. Se regenera cada hora. Solo los cursos llevan `lastModified`.
- No hay reglas para rastreadores de IA: al no estar prohibidos, hoy están permitidos. Es coherente con querer aparecer en respuestas de asistentes.
- `/cursos/[curso]/[clase]` y `/cursos/[curso]/examen` no figuran en `Disallow`.

**Web actual (`https://www.uvarq.com`, consultada el 13 de noviembre de 2026):**

- `robots.txt`: `Allow: /`, `Disallow: /api/` y `/devleck-demo/`, con el sitemap declarado.
- `sitemap.xml`: 22 URLs, todas con el mismo `lastmod` (`2026-11-07T18:49:42Z`). Incluye 8 secciones (`/cursos`, `/servicios`, `/proyectos`, `/podcast`, `/youtube`, `/comunidad`, `/contacto` y la portada) y 14 fichas bajo `/cursos/`.

## 4. Qué ya vi en `uvarq.com` que afecta a la plataforma

- La web actual vende los cursos a **220 USD** cada uno, con enlace de compra por WhatsApp. La plataforma, en cambio, es gratuita y por invitación. Cuando la web se mude, las fichas de curso van a dejar de existir en `uvarq.com`. Hay que decidir dónde queda la oferta comercial (ver `08-informe.md`).
- La ficha del curso de Revit dice «Más de 10k personas han comprado nuestros cursos» y «Certificación Profesional UVA». **SIN DATO** sobre la veracidad de la cifra. La regla de contenido veraz de la plataforma (`CLAUDE.md`, sección 3.4) exige una fuente comprobable para cualquier cifra pública. La necesito de ti antes de reutilizarla.
- Esa misma ficha no muestra instructor con nombre, duración en horas, nivel ni fecha de actualización (verificado en la página, 13 de noviembre de 2026).
- La ficha de Revit se titula «Diplomado en Autodesk Revit — Arquitectura desde Cero», pero el listado la llama «Revit Arquitectura». Son dos nombres para el mismo producto.
- `beta.uvarq.com` está detrás de Cloudflare Access (responde con redirección 302 al inicio de sesión de Access), así que no es rastreable. Está bien así mientras sea el entorno de pruebas.

## 5. Qué me toca a mí

- Elegir el nombre oficial (sección 1).
- Entregar la fuente de la cifra «10k» o retirarla.
- Confirmar el host canónico (con o sin `www`) para `uvarq.com`.

## 6. Qué recomiendo a Andrés o Miguel (sin que yo haya tocado nada)

1. Cambiar el título por defecto y el formato de título cuando se decida el nombre.
2. Publicar el nodo `Organization` completo: logo, `sameAs` con las redes, `alternateName`, descripción y contacto.
3. Crear una imagen social de 1200×630 en `public/` y pasarla a `metadataPublica`. Los comentarios del código dicen que no existe ningún recurso de marca en `public/`, pero `public/correo/` ya tiene ocho versiones del logo; sirven como punto de partida.
4. Valorar `noindex` en clase, examen y login, y sacar `/login` del sitemap.
5. Instalar analítica (GA4) con el ajuste de CSP correspondiente.
6. Escribir la descripción de cada escuela a mano (la plantilla actual se repite).
7. Crear la página «Sobre nosotros» antes de reactivar esa columna del pie.
