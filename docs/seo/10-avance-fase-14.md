# Fase 14 SEO y GEO: lo que se hizo y cómo terminarla

**Fecha:** 18 de noviembre de 2026.

**Para quién:** cualquier persona del equipo que retome la Fase 14 sin haber estado en ella. Con este documento debería poder terminarla sin preguntar.

**Fuentes:** los PR fusionados en `master`, los comentarios de pendientes de cada tarea de la Fase 14 en Notion y los documentos de Aleck (`00` a `09` de esta carpeta).

---

## 1. Cómo usar este documento

1. Lee la sección 2 para entender qué es SEO y GEO en este proyecto y dónde vive el código.
2. La sección 3 dice qué ya está hecho. No lo rehagas.
3. La sección 4 lista **lo que falta, en el orden en que hay que hacerlo**. Cada punto dice quién lo hace, qué hace falta antes, los pasos y cómo comprobar que quedó bien.
4. La sección 5 tiene las reglas para no romper el SEO al tocar código.
5. La sección 6 resume el estado de cada tarea de Notion, para actualizarla al terminar.

**Regla de Notion:** cada tarea lleva **un solo comentario** con lo que falta, no con el avance. Al terminar algo, edita ese comentario y quítalo; no agregues otro.

---

## 2. Contexto mínimo

### Qué es cada cosa
- **SEO:** que Google y Bing encuentren, entiendan e indexen la plataforma.
- **GEO:** lo mismo para los asistentes de IA (ChatGPT, Claude, Perplexity, Copilot). La mayoría de sus rastreadores **no ejecutan JavaScript**: solo ven el HTML que manda el servidor.

### Situación de hoy
- La plataforma está en **`beta.uvarq.com`**, detrás de **Cloudflare Access**: pide iniciar sesión para todo, incluidos `/robots.txt` y `/sitemap.xml`. **Ningún buscador ni rastreador de IA puede entrar.** Por eso casi todo lo que falta se verifica después del lanzamiento.
- **Dominio final:** según `docs/ops/etapas-dominio-uvarq.md` (etapa 3), la plataforma va en **`www.uvarq.com`** y `uvarq.com` redirige a `www`. Hoy `www.uvarq.com` es la web corporativa de Aleck, que vende los cursos con precio. **Confirmar con Aleck** que esta es la decisión final antes del lanzamiento: en su lista de pausas figuraba «definir con o sin www».
- **Local = staging, desplegada = producción.** `.env.local` apunta a la base de staging. La de producción solo se toca con la skill `pasar-a-produccion`, antes de fusionar un PR que cambie la base.
- `master` exige un PR con 4 checks en verde. Uno de ellos es el job `e2e`, que incluye las pruebas de SEO.

### Dónde vive el código de SEO

| Qué | Archivo |
| --- | --- |
| Metadatos de cada página (título, descripción, canónica, Open Graph) | `src/lib/seo/metadata.ts` (`metadataPublica()`, constante `MARCA`) |
| Descripciones recortadas y plantillas | `src/lib/seo/descripciones.ts` |
| Organización (`Organization`, logo, `sameAs`) | `src/lib/seo/organizacion.ts` y las redes en `src/lib/contacto.ts` (`REDES`) |
| Datos estructurados (WebSite, migas, lista de cursos, curso, persona) | `src/lib/seo/sitio.ts`, `migas.ts`, `lista-cursos.ts`, `curso-jsonld.ts`, componente `src/components/seo/JsonLd.tsx` |
| `robots.txt` y rastreadores de IA | `src/app/robots.ts` |
| Sitemap | `src/app/sitemap.ts` |
| Detectar rastreadores (para mandarles la página sin esqueleto) | `src/lib/seo/rastreador.ts` |
| Imagen social de cada curso | `src/app/(public)/cursos/[cursoSlug]/opengraph-image.tsx` y `twitter-image.tsx` |
| Íconos e imagen social general | `src/app/icon.png`, `apple-icon.png`, `favicon.ico`, `public/logo-uva.png`, `public/og-uva.png` |
| Historial de slugs (redirección de URL viejas) | `src/lib/slugs-anteriores.ts`, `src/lib/admin/slugsOcupados.ts`, `supabase/sql/137_slugs_anteriores.sql` |
| Caché del catálogo y su invalidación desde el admin | `src/lib/cache-catalogo.ts` |
| Analítica y aviso de cookies | `src/components/analitica/`, `src/lib/analitica.ts`, `src/lib/consentimiento.ts`, `src/lib/csp.ts`; guía en `docs/seo/09-analitica.md` |
| Dirección pública del sitio | `src/lib/site-url.ts` (lee `NEXT_PUBLIC_SITE_URL`) |

### Herramientas que ya existen

| Comando | Para qué |
| --- | --- |
| `npx playwright test e2e/seo.spec.ts` | Las pruebas de SEO del CI: metadatos, canónica, `h1`, JSON-LD, `noindex`, `robots.txt` y 404 |
| `npm run audit:html-rastreadores` | Tabla por página y por rastreador (Googlebot, GPTBot, ClaudeBot…) de qué contenido llega en el HTML sin JavaScript |
| `npm run audit:produccion` | Auditoría de dependencias de producción, con excepciones documentadas |

Para correr las dos primeras contra un build local:

```bash
npm run build
npx next start -p 3100
npm run audit:html-rastreadores -- --base-url=http://localhost:3100
```

`e2e/seo.spec.ts` usa `http://localhost:3000` por defecto (`playwright.config.ts`).

---

## 3. Lo que ya está en `master`

| PR | Qué hizo | Quién |
| --- | --- | --- |
| #47 | Metadatos: `noindex` en clase, examen y login; nodo `Organization`; plantilla de títulos con la marca al final; descripciones de 140 a 155 caracteres; íconos y `manifest`; imagen social generada para cada curso; marca «UVA» en todo el sitio; la IA escribe la descripción del curso pensando en Google y los asistentes; GA4 apagado por bandera | Andrés |
| #49 | Historial de slugs: si un curso o una escuela cambia de nombre, la URL vieja redirige con 308 a la nueva, y un slug viejo nunca se reutiliza. Las URL con UUID también redirigen con 308. Incluye Sentry 11, Next 16.4.5 y los arreglos de `npm audit` | Andrés |
| #50 | Datos estructurados: `WebSite`, `BreadcrumbList`, `ItemList`, `Course` y `Person` | Juan Miguel |
| #51 | Pendientes del equipo (año del pie, enlaces sin destino, errores de correo en español) y documentos de operación del dominio y Cloudflare | Juan Miguel |
| #52 | `robots.txt`: deja leer el `noindex` de las pantallas públicas, bloquea solo lo que exige sesión y permite a los rastreadores de IA con reglas explícitas (provisional). Sitemap con `lastModified` real. Escuela y texto legal inexistentes dan 404 real | Andrés |
| #53 | Auditoría de dependencias con excepciones documentadas (picomatch, sin parche) | Juan Miguel |
| #54 | Contenido completo en el HTML para rastreadores sin JavaScript: el catálogo y las escuelas se mandan sin esqueleto a los rastreadores, y las respuestas de soporte quedan en la página. Incluye la analítica con aviso de cookies, Clarity y eventos, todo apagado hasta poner los ID | Andrés y Juan Miguel |
| #55 | Pruebas de SEO en el CI (`e2e/seo.spec.ts`) y checklist «SEO de una página nueva» en el `README.md` | Andrés |

**Sin fusionar:** la rama `escuelas-landing` de Juan Miguel, que todavía no está en GitHub. Trae:
- en `/admin/categorias`, la introducción y hasta 5 preguntas frecuentes por escuela, con marcado `FAQPage`;
- migas completas en la ficha del curso y un bloque de 3 cursos relacionados;
- `npm run audit:huerfanas`, que detecta páginas huérfanas y enlaces rotos.

---

## 4. Lo que falta, en orden

Está dividido en tres momentos: **antes del lanzamiento**, **el lanzamiento** y **después del lanzamiento**. Lo de antes se puede hacer ya; lo de después necesita que la plataforma esté en el dominio público.

### 4.1 Antes del lanzamiento

#### A. Fusionar `escuelas-landing`
- **Quién:** Juan Miguel.
- **Pasos:**
  1. Subir la rama a GitHub y abrir el PR.
  2. Si cambia la base (campos nuevos en `categorias`), pasar la migración y el SQL a producción con `pasar-a-produccion` **antes** de fusionar.
  3. Agregar las URL nuevas, si las hay, al sitemap y comprobar que `e2e/seo.spec.ts` siga en verde.
- **Comprobar:** en el PR, los 4 checks en verde. En beta, la página de una escuela con introducción y preguntas cargadas muestra las dos secciones.

#### B. Decisiones de Aleck que cambian código
Cada una es un cambio pequeño. Hazlo en una rama y un PR cuando Aleck responda.

| Decisión | Qué cambiar | Dónde |
| --- | --- | --- |
| **Nombre oficial** (opción A recomendada en `docs/marca/00-variantes-nombre.md`: «UVA» siempre acompañado de «arquitectura» o del nombre completo) | La constante `MARCA` (va al final de todos los títulos) y el nombre del `Organization` | `src/lib/seo/metadata.ts`, `src/lib/seo/organizacion.ts` |
| **Podcast de Spotify como red oficial** | Agregar `REDES.spotify` al arreglo `sameAs` | `src/lib/seo/organizacion.ts` (`organizacionCompleta()`) |
| **Logo vectorial e ícono cuadrado oficiales** | Reemplazar los archivos (los actuales son provisionales) | `public/logo-uva.png` (cuadrado, fondo blanco), `public/og-uva.png` (1200×630), `src/app/icon.png`, `src/app/apple-icon.png`, `src/app/favicon.ico` |
| **Política con los rastreadores de IA de entrenamiento.** Hoy se permiten todos, de forma provisional | Para bloquear `GPTBot`, `ClaudeBot`, `Google-Extended`, `Applebot-Extended` y `CCBot`: en el tercer grupo de `rules`, cambiar `allow: "/"` por `disallow: "/"`. **No tocar** el grupo de búsqueda (`OAI-SearchBot`, `Claude-SearchBot`, `PerplexityBot`…), que es el que trae visitas | `src/app/robots.ts` |
| **Indexar la clase gratuita.** Hoy ninguna clase se indexa, como pide `07-webmasters.md` | Recomendación: dejarlo así. Si Aleck decide lo contrario, quitar el `noindex` solo de la clase de vista previa gratuita | `src/app/(public)/cursos/[cursoSlug]/[leccionSlug]/page.tsx` (`generateMetadata`) |
| **Dirección de la oficina** (solo si atiende público) | Agregar `address` al `Organization` | `src/lib/seo/organizacion.ts` |

**Comprobar** después de cada cambio: `npx tsc --noEmit`, `npm run lint`, `npx vitest run` y `npm run build` en verde, más `e2e/seo.spec.ts`.

#### C. Textos que se cargan desde el admin (Aleck, sin código)
Se cargan en producción desde `/admin/categorias` y `/admin/cursos`. La plataforma no muestra nada que no tenga texto real: no se inventa.
1. **Descripción de cada escuela** (`/admin/categorias` → Editar): de 140 a 155 caracteres. Hoy hay de unos 73. Es la que muestra Google.
2. **Público de cada escuela,** para que el título pase de «Cursos de [escuela]» a «Cursos de [escuela] para [público]». Cuando esté, cambiar la plantilla del título en `generateMetadata` de `src/app/(public)/catalogo/[categoriaSlug]/page.tsx`.
3. **Introducción** de 150 a 300 palabras y **3 a 5 preguntas frecuentes** por escuela (necesita el punto A).
4. **Revisar las descripciones** cuando estén los datos de Keyword Planner y Trends (`02-datos-palabras-clave.md`).

#### D. Analítica (GA4 y Clarity)
El código ya está en `master` y apagado. **No se enciende sin el texto legal.** Guía completa en `docs/seo/09-analitica.md`.
1. **Abogado:** publicar la política de cookies y cambiar el texto del soporte que dice «solo cookies técnicas, sin rastreo» (`docs/legal/03-paquete-abogado.md`, pregunta 11).
2. **Aleck:** crear la propiedad de GA4 y el proyecto de Clarity, y pasar los ID.
3. **Equipo:** poner en Railway `NEXT_PUBLIC_GA_ID` (`G-XXXXXXX`) y `NEXT_PUBLIC_CLARITY_ID`. Son `NEXT_PUBLIC_`: hace falta un **despliegue nuevo**, no basta con reiniciar.
4. **Aleck, en los paneles:** marcar los eventos clave, crear el canal «Asistentes de IA», vincular Search Console, excluir el tráfico interno y poner Clarity en enmascarado estricto.
5. **Comprobar:**
   - El aviso de cookies aparece y nada carga sin aceptar.
   - La consola del navegador en producción no muestra bloqueos de la CSP para `googletagmanager.com`, `google-analytics.com` ni `clarity.ms`.
   - Probar en celular, Safari y Samsung Internet.

#### E. Probar «Generar con IA» de la descripción del curso
- **Bloqueo:** Gemini responde 402 porque se acabaron los créditos prepagados de Google AI Studio. La misma cuenta genera los exámenes.
- **Pasos:**
  1. Recargar los créditos.
  2. En un curso real con transcripciones, usar «Generar con IA» en la descripción.
- **Comprobar:** la descripción sale de 140 a 155 caracteres y empieza por lo que se aprende.

#### F. Arreglo pendiente de la revalidación (cuando se retome IndexNow)
Hoy todo se actualiza al instante al publicar en el admin **salvo el sitemap**, que tarda hasta una hora.
- **Arreglo:** en `src/lib/cache-catalogo.ts`, agregar `revalidatePath("/sitemap.xml")` dentro de `revalidarCatalogoPublico()` y de `revalidarCategoriasPublicas()`, con su prueba.
- Está anotado en la tarea de IndexNow, que Aleck pausó entera.

### 4.2 El lanzamiento (la plataforma pasa a `www.uvarq.com`)

El procedimiento de operación completo está en `docs/ops/etapas-dominio-uvarq.md` (etapa 3) y en `docs/ops/cloudflare.md` (sección 4). Aquí va solo lo que toca al SEO.

**Requisitos de Aleck, antes de fijar la fecha:**
- Aprobar el cambio por escrito y confirmar `www.uvarq.com` como dominio final.
- Decidir a dónde se muda la web corporativa (por ejemplo `corporativo.uvarq.com`) y qué pasa con la oferta con precio.
- Elegir una fecha que no cierre sesiones activas sin aviso.

**Redirecciones 301 de la web vieja** (en pausa por Aleck hasta la fecha):
1. Partir del mapa de las 22 URL de `docs/seo/07-webmasters.md`, sección 4, y completar la columna «Destino» según dónde quede la oferta comercial.
2. **No redirigir todo a la portada.** Cada URL va a su equivalente: un curso a su ficha si existe con el mismo slug, si no a su escuela.
3. Cargarlas en Cloudflare → Redirect Rules o Bulk Redirects (`etapas-dominio-uvarq.md`, 3.2) y mantenerlas **al menos un año**.

**En el cambio** (`etapas-dominio-uvarq.md`, 3.5, y tabla de `cloudflare.md`, sección 4):
1. Railway: `NEXT_PUBLIC_SITE_URL=https://www.uvarq.com` y desplegar de nuevo. Con esto cambian solas las canónicas, el sitemap, el JSON-LD, los correos y el QR de los certificados nuevos.
2. Supabase Auth (producción): Site URL y Redirect URLs con el dominio nuevo. No quitar las viejas hasta que todo funcione.
3. Hook de correo de Supabase, webhook de Mux, orígenes de Google OAuth y monitor de disponibilidad, con el dominio nuevo.
4. `www` **sin** Cloudflare Access: es público.

**Redirección desde Railway para siempre** (paso 3 de la tarea de migración):
- Si el dominio de Railway (`uva-edu-production.up.railway.app`) sigue respondiendo, debe redirigir con 301 a la misma ruta en `www.uvarq.com`: los certificados PDF ya emitidos llevan un QR con esa dirección.
- Hoy el secreto de origen (`src/proxy.ts`, `src/lib/origen.ts`) responde 403 a quien llama a Railway sin pasar por Cloudflare. **Decidir** entre:
  - una redirección en Cloudflare o en `src/proxy.ts`, para que esos QR sigan funcionando;
  - aceptar que los QR viejos dejen de abrir.

  No hay certificados emitidos a personas reales, así que hoy el impacto es bajo.

**Una sola variante** (paso 4 de la tarea de migración):
- `http` a `https`, `uvarq.com` a `www.uvarq.com`, y la misma regla de barra final en todas las rutas. Todo en un solo salto.

**Cloudflare no debe bloquear a los rastreadores** (pausado por Aleck dentro de la reescritura de `docs/ops/cloudflare.md`):
- En Security → Bots y en las reglas del WAF y de límites (secciones 2.4 y 2.5), confirmar que Googlebot, Bingbot y los rastreadores de IA permitidos no reciben 403 ni 429.
- Si Cloudflare tiene activado el bloqueo de rastreadores de IA (AI Crawl Control o «Block AI bots»), debe quedar alineado con la decisión de Aleck del punto 4.1 B.

**Revisar la CSP** (`src/lib/csp.ts`) por si nombra el dominio viejo.

**Comprobar el lanzamiento:**

```bash
curl -sI http://uvarq.com/catalogo          # un solo 301 a https://www.uvarq.com/catalogo
curl -sI https://uvarq.com/catalogo         # un solo 301 a https://www.uvarq.com/catalogo
curl -sI https://www.uvarq.com/catalogo     # 200
curl -sI https://www.uvarq.com/cursos/revit-arquitectura   # cada URL vieja: 301 a su destino
```

Probar también el registro, la recuperación de contraseña y el inicio de sesión con Google, y abrir el QR de un certificado.

### 4.3 Después del lanzamiento

Hacerlo en este orden: Search Console va primero porque Bing importa de ahí.

#### G. Google Search Console
- **Quién:** Aleck crea la propiedad; el equipo verifica.
- **Pasos:** `docs/seo/07-webmasters.md`, secciones 1 a 3.
  1. Propiedad de tipo **Dominio** (`uvarq.com`) verificada con un registro TXT en Cloudflare. Cuidar que el TXT no se pierda en el cambio de DNS: `dig TXT uvarq.com`.
  2. Enviar `sitemap.xml`.
  3. Inspección de URLs sobre las páginas de la lista de la sección 3: las públicas deben salir indexables y las privadas no.
- **Comprobar:**
  - el informe de Sitemaps dice «Correcto»;
  - el sitemap **no lista cursos de prueba** (`rls-test`, `e2e-`); si los lista, despublicarlos en producción.

#### H. Revisar `robots.txt` y el sitemap con Aleck
- Abrir `https://www.uvarq.com/robots.txt` y `https://www.uvarq.com/sitemap.xml` y revisarlos línea por línea con él.
- Es la definición de terminado de la tarea de `robots.txt`.

#### I. Tabla de contenido renderizado
1. Correr:
   ```bash
   npm run audit:html-rastreadores -- --base-url=https://www.uvarq.com --env=.env.produccion.local
   ```
   El script solo usa la clave pública (anónima) de esa base.
2. Pegar la tabla en la tarea de Notion «contenido renderizado».
3. **Comprobar:**
   - las 5 páginas responden 200 a los 8 rastreadores;
   - el contenido está en el HTML inicial (✅), salvo el esqueleto del navegador en el catálogo;
   - la fila de instructores tiene datos; en staging salía «—» porque ningún curso tiene instructor.

#### J. Bing Webmaster Tools
- **Pasos:** `07-webmasters.md`, sección 5. Importar el sitio desde Search Console, que lo verifica y trae el sitemap en un paso.
- **Comprobar:** que el sitemap importado sea el de la plataforma y no el de la web vieja.

#### K. IndexNow (pausado por Aleck; hacerlo cuando lo libere)
- **Cómo funciona:** `07-webmasters.md`, sección 6.
- **Pasos:**
  1. Generar una clave de 8 a 128 caracteres hexadecimales y servirla en `https://www.uvarq.com/{clave}.txt` (un archivo en `public/` basta). La clave es pública por diseño.
  2. Crear una función de servidor que envíe a `https://api.indexnow.org/indexnow` (confirmar la dirección en la documentación oficial) la lista de URL cambiadas, con `host`, `key` y `urlList`.
  3. Llamarla en las acciones del admin que ya llaman a `revalidarCatalogoPublico()` o `revalidarCategoriasPublicas()`: publicar, editar, ocultar o cambiar el slug de un curso o una escuela.
  4. Registrar cada envío y su respuesta en los logs. Si falla, **no** debe romper la acción del admin.
  5. Enviar **solo desde producción**: nunca URL de staging ni de local.
  6. Hacer en el mismo PR el arreglo del sitemap del punto 4.1 F.
- **Comprobar:**
  - `curl -s https://www.uvarq.com/{clave}.txt` devuelve exactamente la clave;
  - al publicar un curso de prueba, el log muestra respuesta 200 o 202;
  - la URL aparece en el informe de IndexNow de Bing Webmaster Tools.

#### L. Auditoría técnica
1. **Screaming Frog SEO Spider** (gratis hasta 500 URL) sobre `https://www.uvarq.com`. Revisar enlaces rotos, redirecciones en cadena, títulos duplicados o largos, imágenes sin `alt` y páginas huérfanas. Corregir todo lo crítico.
2. **Ahrefs Webmaster Tools:** verificar el sitio (se puede importar desde Search Console) y activar la auditoría semanal automática.

#### M. Probar las imágenes al compartir
1. Compartir la portada y un curso por WhatsApp, LinkedIn y X.
2. Revisarlos con LinkedIn Post Inspector y Facebook Sharing Debugger.
3. **Comprobar:** cada curso muestra su propia imagen, su título y su descripción.

#### N. Validar los datos estructurados
- Pasar la portada, una escuela y un curso por Rich Results Test y revisar el informe de mejoras de Search Console.
- Recordatorio: Google retiró el resultado enriquecido de cursos, así que el JSON-LD de `Course` no dará estrellas. Se mantiene porque lo usan Bing y los asistentes de IA.

### 4.4 Para la Fase 15 (no es de esta fase)
- **Campos SEO por curso en el admin:** descripción corta, qué aprenderás, para quién y preguntas frecuentes. Mientras no existan, Google muestra la primera frase de la descripción: debe leerse sola y empezar por lo que se aprende.
- **Página «Sobre UVA» y páginas de instructores,** con el `@id` de cada `Person` en los datos estructurados.
- **Guías y glosario,** que entran al sitemap y a IndexNow.
- **Marcado `FAQPage` en `/soporte`.**

---

## 5. Reglas para no romper el SEO

- **Antes de crear o cambiar una página pública,** sigue el checklist «SEO de una página nueva» del `README.md`. Las pruebas de `e2e/seo.spec.ts` revisan la mayoría de esos puntos en cada PR.
- **Una página que puede no existir** llama a `notFound()` **antes** de cualquier esqueleto (`loading.tsx` o `<Suspense>` con fallback). Si el esqueleto ya salió, el estado queda en 200 y Google lo cuenta como soft 404.
- **Una pantalla que no debe salir en Google** lleva `noindex` en la metadata y **no** va en el `disallow` de `robots.txt`: bloqueada, Google no puede leer el `noindex`. Solo las rutas con sesión van en `RUTAS_PRIVADAS` de `src/app/robots.ts`.
- **El contenido público tiene que estar en el HTML sin JavaScript:**
  - un acordeón de Base UI lleva `hiddenUntilFound`;
  - una lista detrás de un `<Suspense>` se manda sin esqueleto a los rastreadores con `esRastreador()`.
- **Nunca** escribas la marca en un `title`: la pone la plantilla del layout.
- **Los cambios de base van a producción antes de fusionar,** con la skill `pasar-a-produccion`.
- **Prettier no se usa en este proyecto:** si lo corres, reformatea archivos enteros.

---

## 6. Estado de cada tarea de Notion

| Tarea | Estado real | Lo que falta (sección) | Destraba |
| --- | --- | --- | --- |
| Metadatos, imágenes para compartir, íconos y recursos de marca | Código en `master` | 4.1 B, C y E; 4.3 M | Aleck, saldo de IA, dominio |
| Migración al dominio definitivo, 301 y canónicas | Pasos 7 a 9 hechos (slugs, UUID, filtros) | 4.2 completa | Aleck y dominio |
| `robots.txt`, sitemap, rastreadores de IA e indexación | Código en `master` | 4.1 B (IA y clases); 4.3 G y H | Aleck y dominio |
| Contenido renderizado en el servidor | Código en `master` | 4.2 (Cloudflare); 4.3 I | Aleck y dominio |
| Pruebas automáticas de SEO en CI | Pruebas en `master` | 4.3 L | Dominio |
| IndexNow y revalidación inmediata | **Pausada por Aleck** | 4.1 F; 4.3 K | Aleck y dominio |
| Datos estructurados completos | Código en `master` | 4.1 B (nombre y Spotify); 4.3 N; `@id` de instructores en 4.4 | Aleck, dominio y Fase 15 |
| Analítica y conversiones | Código en `master`, apagado | 4.1 D | Abogado y Aleck |
| Páginas de escuela como landings, migas y enlazado interno | Rama `escuelas-landing` sin fusionar | 4.1 A y C | Juan Miguel y Aleck |
| Configurar Google Search Console | Sin empezar | 4.3 G | Dominio y Aleck |
| Bing Webmaster Tools e IndexNow | Sin empezar | 4.3 J y K | Search Console y Aleck |
| Identidad de marca y perfiles oficiales | En curso (Aleck) | Nombre, dirección, atención al público, año de fundación, razón social, cifras con fuente e instructores (`06-identidad-marca.md`) | Aleck |
| Palabras clave, preguntas a la IA, competencia y mapa | En curso (Aleck) | Datos de Keyword Planner y Trends; línea base de las 25 preguntas de control (`04-prompts-control.md`) | Aleck |

**La fase se puede dar por cerrada cuando:**
- la plataforma esté en `www.uvarq.com` con las redirecciones de la web vieja;
- Search Console y Bing estén verificados con el sitemap enviado;
- las tablas y auditorías de la sección 4.3 estén sin errores críticos;
- las decisiones de Aleck de la sección 4.1 B estén aplicadas.
