# Etapa 7. Search Console, Bing y analítica

**Fase 14, SEO y GEO, 13 de noviembre de 2026, Aleck Martínez**
**Fechas objetivo: Search Console y Bing, del 26 de noviembre al 4 de diciembre.**

Todos los pasos de Google, Bing e IndexNow salen de documentación oficial consultada el 13 de noviembre de 2026, con enlace. Donde la documentación no cubría un paso, lo digo y no lo doy por verificado: las interfaces cambian.

## 0. Antes de empezar: dos decisiones que lo condicionan todo

1. **Host canónico.** La web actual vive en `https://www.uvarq.com`. Tú me dijiste que la plataforma queda en `uvarq.com`. Hay que decidir si la dirección oficial es **`uvarq.com` (sin `www`)** o **`www.uvarq.com`**, y redirigir la otra a la elegida con una redirección permanente. Esa decisión fija `NEXT_PUBLIC_SITE_URL` en Railway. Esa variable entra al compilar, así que cambiarla exige un despliegue nuevo, no basta reiniciar (así lo documenta `docs/ops/cloudflare.md`, sección 4). Hasta que se defina, en este documento uso `https://uvarq.com` como ejemplo.
2. **Cómo se mueve el sitio actual.** `docs/ops/cloudflare.md` (sección 0) escribe que la plataforma «puede ir en un subdominio, por ejemplo `app.uvarq.com`». Tu decisión es otra: la plataforma queda en el dominio principal y la web actual se muda. Ese documento hay que actualizarlo; no lo toqué.

Y una dependencia técnica: hoy `uvarq.com` está en **GoDaddy** y `www.uvarq.com` es el sitio corporativo. Pasar los nameservers a Cloudflare, como describe `docs/ops/cloudflare.md`, **mueve todo el dominio**, incluido ese sitio. Cualquier registro DNS que ponga para Search Console tiene que sobrevivir a ese cambio (ver sección 1).

## 1. Search Console: propiedad de Dominio

**Quién lo hace:** yo (con la cuenta de Google que será dueña) y quien administre el DNS de `uvarq.com` (hoy GoDaddy).

**Por qué «Dominio» y no «Prefijo de URL»:** una propiedad de Dominio reúne los datos de todas las variantes de protocolo y de subdominio (`http`, `https`, `www`, sin `www`, y cualquier subdominio nuevo). Solo se puede verificar con DNS ([fuente](https://support.google.com/webmasters/answer/9008080)). Es la que conviene en una migración, porque la web vieja y la plataforma nueva quedan bajo la misma propiedad.

### Pasos ([fuente oficial](https://support.google.com/webmasters/answer/9008080))

1. En Search Console, añadir una propiedad de tipo **Dominio** y escribir `uvarq.com` (sin `https://` ni barras).
2. Elegir el método **DNS**. Si Google lista tu proveedor, elígelo y sigue el inicio de sesión; si no, elegir **Any DNS provider**.
3. Copiar la cadena del registro **TXT** que muestra Search Console (empieza por `google-site-verification=`).
4. En el panel de DNS de GoDaddy, crear un registro **TXT**: nombre (host) **`@`** o vacío según lo pida el panel, y pegar la cadena como valor.
5. Volver a Search Console y pulsar **Verificar**.

### Tiempos y fallos (misma fuente)

- El registro puede tardar **hasta dos o tres días** en estar visible. Si falla, esperar uno o dos días y reintentar.
- «Your verification DNS TXT record was not found»: el registro aún no es visible.
- «Your verification record did not match»: el valor no coincide; revisar el host (`@` o vacío) y copiar la cadena completa.
- **No borrar el registro TXT después de verificar**: se pierde la verificación.

### Lo que añado por la migración

- **Si los nameservers pasan a Cloudflare, el registro TXT tiene que existir también en la zona de Cloudflare.** `docs/ops/cloudflare.md` dice que Cloudflare copia los registros existentes al agregar el dominio y manda revisarlos uno por uno. Hay que mirar que el TXT de Google esté entre ellos antes de cambiar los nameservers; si no, la propiedad se desverifica. Comprobación al final: `dig TXT uvarq.com` (sección 7).
- **Verificar antes de migrar.** Así el rendimiento de la web actual (consultas, páginas, clics) ya queda registrado como línea base. Exportar el informe de **Rendimiento** antes del día de la migración. **No confirmé en la documentación el paso exacto de exportación**, pero el botón de exportar está en esa misma pantalla. La guía de migraciones de Google recomienda verificar en Search Console todas las variantes de dominio de los dos sitios antes de empezar ([fuente](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes)).

## 2. Enviar el sitemap

**Quién:** yo. **Cuándo:** solo cuando la plataforma esté respondiendo en `uvarq.com`.

Hoy `www.uvarq.com/sitemap.xml` es el de la web actual (22 URLs). **No enviar el de la plataforma hasta que esté en producción:** Google lo leería de inmediato, y si responde con un error o con URLs de un host distinto, el estado queda como fallo.

### Pasos ([fuente oficial](https://support.google.com/webmasters/answer/7451001))

1. Tener permisos de **propietario** de la propiedad.
2. Confirmar que Googlebot llega al sitemap: **Inspección de URLs** sobre `https://uvarq.com/sitemap.xml`, **Probar URL publicada** y ver que «Page fetch» diga correcto. El sitemap no puede pedir sesión.
3. En el informe **Sitemaps**, pegar `sitemap.xml` (o la URL completa) en «Añadir un nuevo sitemap» y pulsar **Enviar**.
4. Revisar el estado:
   - **Correcto:** se leyó sin errores; todas las URLs quedan en cola de rastreo.
   - **Tiene errores:** se leyó pero con errores; las URLs buenas siguen en cola.
   - **No se pudo obtener:** causas habituales, robots.txt que lo bloquea, un 404, una acción manual o un error temporal del servidor. Si falla varias veces Google deja de intentarlo y hay que corregir y reenviar.

**Límites (misma fuente):** hasta 50.000 URLs y 50 MB por sitemap; el informe no muestra los sitemaps descubiertos solo a través de robots.txt; que Google lea una URL no garantiza que la indexe.

**Ya cumple lo que pide Google:** el sitemap de la plataforma se declara en `robots.txt` y se regenera cada hora.

## 3. Inspección de URLs

**Quién:** yo. Va después del sitemap.

### Pasos ([fuente oficial](https://support.google.com/webmasters/answer/9012289))

1. Escribir la URL completa en la barra de inspección (debe pertenecer a la propiedad).
2. Leer el **estado en el índice**. Muestra lo último que Google indexó, no la versión actual.
3. **Probar URL publicada** si cambió la página, para ver lo que Google ve ahora.
4. **Solicitar indexación** si quiere que Google la rastree. No aparece si la prueba en vivo dice que la página no es indexable.

**Cuotas:** hay un límite diario de inspecciones, de pruebas en vivo y de solicitudes de indexación por propiedad. La documentación no da las cifras. Empezar con unas 10 URLs y ver si la interfaz avisa.

**Estados:**
- «URL is on Google»: puede aparecer, sin garantía.
- «URL is on Google, but has issues»: indexada, con avisos.
- «URL is not on Google»: la sección de indexación dice por qué.
- «URL is an alternate version»: revisar la canónica que eligió Google.

Un resultado positivo en la prueba en vivo **no garantiza** que la página aparezca; no revisa acciones manuales ni problemas de calidad.

### Lista de URLs a inspeccionar, generada desde el sitemap

La lista real sale del sitemap en vivo. Ejecutar cuando la plataforma esté en `uvarq.com`:

```bash
curl -s https://uvarq.com/sitemap.xml | grep -o '<loc>[^<]*</loc>' | sed 's/<\/\?loc>//g' > urls-sitemap.txt
wc -l urls-sitemap.txt
```

En Windows (PowerShell):

```powershell
([xml](Invoke-WebRequest https://uvarq.com/sitemap.xml -UseBasicParsing).Content).urlset.url.loc | Set-Content urls-sitemap.txt
(Get-Content urls-sitemap.txt).Count
```

Según el código (`src/app/sitemap.ts`) el archivo trae: la portada, `/catalogo`, `/login`, `/soporte`, los textos legales con versión vigente, cada escuela con al menos un curso publicado y cada curso con `mostrado = true`. Orden de inspección que propongo (**SIN DATO**: cuáles cursos y escuelas están publicados):

| Prioridad | URL | Qué se comprueba |
| ---: | --- | --- |
| 1 | `https://uvarq.com/` | Indexada, canónica propia, `Organization` detectado |
| 2 | `https://uvarq.com/catalogo` | Indexada |
| 3 | Una escuela, `https://uvarq.com/catalogo/[escuela]` | Indexada; descripción propia |
| 4 | Tres cursos, `https://uvarq.com/cursos/[curso]` | Indexada; `Course` válido; canónica con slug |
| 5 | `https://uvarq.com/soporte` | Indexada |
| 6 | Un texto legal, `https://uvarq.com/legal/[texto]` | Indexada |
| 7 | `https://uvarq.com/login` | Confirmar la decisión de indexarla o no (ver `00-diagnostico.md`) |
| 8 | `https://uvarq.com/cursos/[curso]/[clase]` | **Que no sea indexable por un rastreador anónimo** |

Para la migración, además, inspeccionar cinco URLs **viejas** (portada, `/cursos`, dos fichas de curso y `/contacto`) para ver que Google las trate como redirigidas.

## 4. Migración de `uvarq.com`: lo que la guía de Google pide

Fuente: [guía de Google para migrar un sitio con cambios de URL](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes).

1. **Cambiar una sola cosa a la vez.** Las posiciones pueden fluctuar durante semanas o más.
2. **Preparar el sitio nuevo:** contenido, imágenes y archivos, `robots.txt`, 404 o 410 para lo eliminado, y las propiedades de Search Console de **ambos sitios** ya verificadas. Revisar la analítica y la capacidad del servidor, porque Google rastrea con más intensidad tras la migración.
3. **Mapa de URLs.** Recopilar las viejas (sitemap, registros del servidor, analítica) y asignar a cada una su destino.
4. **Redirecciones 301 o 308** del lado del servidor, sin cadenas (máximo tres saltos, mejor uno), y **sin mandar muchas URLs a una página irrelevante, como la portada**.
5. **Mantener las redirecciones al menos un año.** Enviar el sitemap nuevo y actualizar enlaces internos, externos y perfiles (las redes enlazan al sitio).
6. **Herramienta «Cambio de dirección»:** según la guía, se usa cuando cambia el dominio o el subdominio; **no** hace falta para pasar de HTTP a HTTPS ni entre `www` y sin `www`. Confirma en Search Console si está disponible para tu caso (el sitio viejo cambiaría de subdominio dentro del mismo dominio).
7. **Monitorear** sitemaps, indexación y consultas. Es normal ver advertencias de redirección en el sitemap viejo.

### Mapa de redirecciones propuesto

Parto del sitemap actual de la web (22 URLs, consultado el 13 de noviembre de 2026). **La columna «Destino» depende de dónde quede la oferta comercial**, que es una decisión tuya (ver `08-informe.md`): si la web actual se muda a un subdominio, las URLs sin equivalente en la plataforma se redirigen allí, no a la portada.

| URL actual en `www.uvarq.com` | Destino propuesto |
| --- | --- |
| `/` | `/` (la plataforma) |
| `/cursos` | `/catalogo` |
| `/cursos/diplomado-gestion-desarrollo-vivienda` | `/cursos/diplomado-gestion-desarrollo-vivienda`, **si el curso existe en la plataforma con ese slug**; si no, a su escuela |
| `/cursos/render-visualizacion-ia` | Ídem |
| `/cursos/diplomado-gerencia-proyectos` | Ídem |
| `/cursos/abriendo-oficina-arquitectura` | Ídem |
| `/cursos/diplomado-d5-render` | Ídem |
| `/cursos/diplomado-redes-ia` | Ídem |
| `/cursos/diseno-interior-iluminacion` | Ídem |
| `/cursos/revit-arquitectura` | Ídem |
| `/cursos/curso-sketchup` | Ídem |
| `/cursos/diplomado-clinicas-odontologicas` | Ídem |
| `/cursos/diplomado-claude-ia` | Ídem |
| `/cursos/libro-vendiendo-arquitectura` | Sin equivalente en la plataforma (es un libro): subdominio de la web, o 410 si deja de existir |
| `/cursos/libro-del-cad-al-feed` | Ídem |
| `/cursos/asesoria-personalizada` | Ídem |
| `/comunidad` | Subdominio de la web, o página equivalente si se crea |
| `/servicios` | Subdominio de la web (no hay equivalente) |
| `/proyectos` | Subdominio de la web (no hay equivalente) |
| `/podcast` | Subdominio de la web (no hay equivalente). No usar Spotify como destino: es otro dominio y no es una página equivalente |
| `/youtube` | Subdominio de la web (no hay equivalente) |
| `/contacto` | `/soporte` |

**Dos avisos:**
1. **Los slugs coinciden con los de la web actual**, así que una ficha con el mismo slug en la plataforma se puede servir sin redirección. El problema es el **contenido**: la ficha vieja vende a 220 USD; la nueva es por invitación. Si el curso existe en ambas, el buscador mostrará la nueva. Eso es coherente, siempre que los precios y los enlaces de compra de WhatsApp sigan en algún lugar.
2. **Las reglas de redirección las tienen que implementar Andrés o Miguel** (en Cloudflare o en el servidor), y se verifican con `curl -I` (sección 7).

## 5. Bing Webmaster Tools

**Quién:** yo. **Cuándo:** el mismo día que se verifica Search Console.

Bing permite **importar** el sitio desde Search Console y queda verificado sin repetir el proceso. Pasos según el [anuncio oficial de Bing de 2019](https://blogs.bing.com/webmaster/september-2019/Import-sites-from-Search-Console-to-Bing-Webmaster-Tools), contrastados con una guía de 2026 (los nombres de menú pueden variar un poco):

1. Entrar a Bing Webmaster Tools y elegir **Add a site**.
2. Elegir **Import sites from Google Search Console**.
3. Iniciar sesión con la cuenta de Google que tiene acceso a la propiedad y conceder el permiso a Bing.
4. Marcar `uvarq.com` y pulsar **Import**. Queda verificado automáticamente.

**Límites:** la importación solo concede acceso al sitio y a sus sitemaps; **no** da acceso a los datos de analítica de Search Console. Si se revoca el acceso a la cuenta de Google, hay que importar de nuevo o verificar por otro método. Hasta 100 sitios por importación.

Después: comprobar en Bing que el sitemap importado sea el correcto (el de la plataforma, no el de la web vieja).

## 6. IndexNow

**Quién:** Miguel o Andrés montan la clave y el envío; yo verifico.

IndexNow avisa a los buscadores que lo adoptan cuando una URL cambia. **Google no aparece en la documentación que consulté** ([fuente](https://www.indexnow.org/documentation)), así que no puedo confirmar que lo soporte: para Google sirve el sitemap y la Inspección de URLs.

### Cómo funciona ([documentación oficial](https://www.indexnow.org/documentation))

1. Se genera una **clave** de 8 a 128 caracteres hexadecimales (letras, números y guiones).
2. Se aloja un archivo de texto UTF-8 con la clave, en la raíz del sitio, llamado `{clave}.txt`. La clave **es pública por diseño**.
3. Se envían las URLs. Una sola, con `GET`:
   ```text
   https://api.indexnow.org/indexnow?url=https://uvarq.com/cursos/ejemplo&key=TU-CLAVE
   ```
   Varias (hasta 10.000), con `POST` y cuerpo JSON (`host`, `key`, `urlList`, y `keyLocation` si el archivo no está en la raíz).

   La documentación remite a otra página para la lista de buscadores y su dirección de envío. **Confirma la dirección en esa página antes de usarla**; la de ejemplo es la que suele citarse, pero no la verifiqué en esta consulta.

### Cómo verificar que funciona

- **El archivo de clave se sirve:** `curl -s https://uvarq.com/TU-CLAVE.txt` debe devolver exactamente la clave.
- **Un envío de prueba devuelve `200`** (recibido; no garantiza que se indexe). Otros códigos: `202` (recibido, validación de clave pendiente), `400` (formato inválido), `403` (clave no válida o no encontrada), `422` (URLs que no son del host o clave que no cumple el esquema), `429` (demasiadas peticiones).
- Bing Webmaster Tools muestra las URLs enviadas por este medio (verificarlo en pantalla).

## 7. Analítica: GA4 y eventos clave

**Estado:** la plataforma **no tiene analítica instalada** (no hay GA4, GTM ni similares en `src/` ni en `package.json`). Instalarla es un cambio de código y de la política CSP (`src/lib/csp.ts`, que usa `strict-dynamic` con nonce). Es trabajo de Andrés o Miguel.

**Los eventos «definidos en el plan»: SIN DATO.** No tengo el plan de la Fase 14, así que no puedo contrastar esta lista con la suya. Propongo estos para una plataforma gratuita y por invitación, para que los alinees con el plan:

| Evento | Cuándo se dispara | Evento clave |
| --- | --- | :---: |
| `canje_invitacion` | Se canjea un código de invitación con éxito | Sí |
| `registro_completado` | Se crea la cuenta | Sí |
| `inicio_curso` | Primera clase vista de un curso | No |
| `curso_completado` | Se termina un curso | Sí |
| `certificado_emitido` | Se emite un certificado | Sí |
| `verificacion_certificado` | Alguien verifica un código | No |
| `clic_whatsapp` | Clic en cualquier enlace a WhatsApp | No |

**Qué dice la documentación oficial** ([fuente](https://support.google.com/analytics/answer/9267568)): cualquier evento que se recopile puede convertirse en **evento clave**; un evento clave no es lo mismo que una **conversión de Google Ads**, que se crea a partir de un evento clave y se gestiona desde Google Ads. **La parte que pude leer no trae los pasos de la interfaz.** El camino habitual es marcar el evento como clave desde la sección de eventos de la propiedad de GA4; verifícalo en pantalla.

**Antes de instalar:** revisar el texto legal de tratamiento de datos (los textos legales viven en `src/content/legal/`) y si hace falta un aviso de cookies. No lo evalué; es una decisión legal.

## 8. Comandos de verificación para el equipo

Se pueden correr desde cualquier computador. En PowerShell, usar `curl.exe` (con `.exe`; `curl` solo es un alias de otra cosa) y `Resolve-DnsName` en lugar de `dig`.

### El registro TXT de Search Console

```bash
dig +short TXT uvarq.com
```
```powershell
Resolve-DnsName uvarq.com -Type TXT | Select-Object -ExpandProperty Strings
```
Debe salir una línea `google-site-verification=…`. Repetir **después de cambiar nameservers**.

### Redirecciones (de HTTP a HTTPS, con www y sin www, y URLs viejas)

```bash
curl -sI http://uvarq.com/            | head -5
curl -sI https://www.uvarq.com/       | head -5
curl -sI https://uvarq.com/contacto   | head -5
curl -sIL https://www.uvarq.com/cursos | grep -iE '^(HTTP|location)'
```
Esperado: un solo salto `301` o `308` hacia el host canónico; **nunca cadenas de más de tres saltos**, y ningún `302` en las que son permanentes.

### `robots.txt` y sitemap con distintos rastreadores

```bash
for ua in "Mozilla/5.0" "Googlebot" "bingbot" "GPTBot" "ClaudeBot" "PerplexityBot"; do
  echo "== $ua"
  for path in /robots.txt /sitemap.xml; do
    printf "%s " "$path"; curl -s -o /dev/null -w "%{http_code}\n" -A "$ua" "https://uvarq.com$path"
  done
done
```

Cada línea debe dar `200`. **Aviso:** cambiar el `User-Agent` solo prueba las reglas que miran el `User-Agent`. Cloudflare verifica a los rastreadores reales por su origen, así que un `200` con un nombre falso **no demuestra** que el rastreador real pase, y un `403` con un nombre falso **no demuestra** que el real sea bloqueado. La prueba definitiva es la **Inspección de URLs** de Search Console (sección 3) y los registros del WAF. Hay que revisar las reglas de bots de Cloudflare (`docs/ops/cloudflare.md`, sección 2.4): hoy dice que *Bot Fight Mode* se deja apagado en el plan gratuito.

### Lo que ve un rastreador anónimo en la clase y el examen

```bash
curl -sI https://uvarq.com/cursos/CURSO/CLASE
```
Se espera una redirección al inicio de sesión o un `noindex`. Si devuelve `200` con contenido, es un hallazgo para `00-diagnostico.md`.

### Datos estructurados y canónicas

```bash
curl -s https://uvarq.com/ | grep -o '<link rel="canonical"[^>]*>'
curl -s https://uvarq.com/cursos/CURSO | grep -o 'application/ld+json' | wc -l
```

## 9. Quién ejecuta qué

| Tarea | Yo (Aleck) | Equipo (Andrés, Miguel) |
| --- | :---: | :---: |
| Decidir host canónico (con o sin `www`) | ✔ | |
| Decidir dónde queda la oferta comercial | ✔ | |
| Crear la propiedad de Dominio en Search Console | ✔ | |
| Crear el registro TXT en el DNS (GoDaddy o Cloudflare) | | ✔ |
| Comprobar que el TXT sobrevive al cambio de nameservers | | ✔ |
| Enviar sitemap e inspeccionar URLs | ✔ | |
| Exportar el rendimiento de la web actual antes de migrar | ✔ | |
| Implementar redirecciones 301 | | ✔ |
| Importar el sitio a Bing | ✔ | |
| Montar la clave de IndexNow y su envío | | ✔ |
| Instalar GA4 y los eventos (más ajuste de CSP) | | ✔ |
| Marcar los eventos clave en GA4 | ✔ | |
| Correr los comandos de la sección 8 y reportar | | ✔ |

## 10. Orden y fechas

| Fecha objetivo | Paso |
| --- | --- |
| Antes del 26 de nov | Decidir host canónico y destino de la oferta comercial |
| 26 de nov | Crear la propiedad de Dominio y el TXT; exportar el rendimiento de la web actual |
| 27 de nov | Verificar que el TXT es visible (`dig`) y que Search Console lo acepta |
| 30 de nov | Importar a Bing |
| Fecha de la migración | Redirecciones activas, sitemap nuevo enviado, inspección de las 8 URLs de la sección 3 |
| Hasta el 4 de dic | Revisión de indexación y errores; informe en `08-informe.md` |

La verificación por DNS puede tardar hasta dos o tres días. Si la propiedad no verifica el 27 de nov, el calendario se mueve ese tiempo.
