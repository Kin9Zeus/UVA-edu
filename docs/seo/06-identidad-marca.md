# Etapa 6. Identidad de marca

**Fase 14 · SEO y GEO · 13 de noviembre de 2026 · Aleck Martínez**
**Entrega objetivo: 20 de noviembre.**

## 1. Borrador de la ficha oficial

Cada dato lleva su origen. Lo que no conozco queda como `[POR COMPLETAR POR ALECK]`; no se inventa nada.

| Campo | Valor | Origen |
| --- | --- | --- |
| **Nombre completo** | Unidad Vectorial de Arquitectura | Nombre usado hoy en la plataforma (`src/lib/seo/organizacion.ts`) |
| **Nombre corto** | `[NOMBRE OFICIAL POR DEFINIR]` (recomendación: `UVA Arquitectura`, ver `00-diagnostico.md`) | Decisión pendiente |
| **Identificador en redes y dominio** | `uvarq` | Redes y dominio actuales |
| **Descripción de una línea** | «Escuela en línea del oficio de la construcción: cursos y diplomados de diseño, presupuesto y gestión de obra.» (113 caracteres) | Borrador, basado en la portada de la plataforma |
| **Descripción de un párrafo** | «[Nombre corto] es una escuela en línea del oficio de la construcción para arquitectos, residentes de obra, presupuestadores y coordinadores BIM de Colombia y Latinoamérica. Enseña con clases en video, plantillas descargables y certificados que cualquiera puede verificar, desde el diseño y el modelado hasta el presupuesto, la contratación y la gestión de obra.» | Borrador. Cada afirmación coincide con `src/content/marketing.ts` y con la portada. |
| **Lema** | «Arquitectura con alma. Diseño con carácter. Construcción con visión.» | `uvarq.com/cursos` (13 nov 2026) |
| **Sitio** | `https://uvarq.com` (host canónico con o sin `www`: `[POR DECIDIR]`) | Tu respuesta: dominio definitivo |
| **Logo** | Ocho versiones en el repositorio: `public/correo/logo-claro.png`, `logo-tinta.png`, `logo-sobre-oscuro.png`, y sus variantes «gruesa» | Repositorio. **Falta una imagen cuadrada para perfiles y una de 1200×630 para compartir.** |
| **Correo público** | `soporte@uvarq.com` | `src/lib/contacto.ts` |
| **WhatsApp** | +57 323 426 0022, lunes a viernes de 8 a. m. a 6 p. m. | `src/lib/contacto.ts` (el horario está marcado allí como confirmado con el equipo) |
| **Dirección** | Calle 14 n.º 23-71, Oficina 501, Edificio Alturia, Pereira, Risaralda, Colombia | `uvarq.com/cursos`, 13 nov 2026. **Pendiente que confirmes si atiende público** (ver sección 5). |
| **Año de fundación** | `[POR COMPLETAR POR ALECK]` | Sin dato |
| **Razón social / NIT** | `[POR COMPLETAR POR ALECK]` | Sin dato |
| **Cifras públicas** (alumnos, cursos, certificados) | `[POR COMPLETAR POR ALECK]` con su fuente | Solo se publican cifras comprobables (`CLAUDE.md`, sección 3.4). La web actual dice «más de 10k personas han comprado nuestros cursos»: **SIN DATO sobre su origen.** |
| **Instructores** | `[POR COMPLETAR POR ALECK]` | Ninguno aparece con nombre en la web actual ni en los datos de cursos de su repositorio |

**Regla de uso:** la misma ficha, palabra por palabra, en los perfiles de cada red, en la página «Sobre nosotros», en el pie de página, en el JSON-LD y en las respuestas a preguntas de asistentes de IA. Los asistentes de IA y los buscadores comparan fuentes: si tu web dice una cosa, Instagram otra y LinkedIn una tercera, la entidad queda difusa.

## 2. Lista de verificación para unificar cada perfil oficial

Las redes oficiales son las que ya enlaza el pie de la plataforma: **YouTube, Instagram, TikTok** y el podcast en **Spotify**. Confirmaste que no hay LinkedIn ni Facebook, y que no habrá más redes oficiales. **Confírmame si el podcast de Spotify cuenta como oficial**: aparece en el pie y en la web actual, pero no lo mencionaste.

Para cada perfil, comprobar:

| Punto | YouTube `@uvarq` | Instagram `uvarq` | TikTok `@uvarq` | Spotify |
| --- | :---: | :---: | :---: | :---: |
| Nombre visible igual al nombre oficial elegido | ☐ | ☐ | ☐ | ☐ |
| Usuario `uvarq` sin variantes | ☐ | ☐ | ☐ | n/a |
| Descripción: la de una línea o la de un párrafo, sin cambios | ☐ | ☐ | ☐ | ☐ |
| Enlace al sitio: `https://uvarq.com` (el host canónico) | ☐ | ☐ | ☐ | ☐ |
| Logo cuadrado, el mismo en los cuatro | ☐ | ☐ | ☐ | ☐ |
| Datos de contacto iguales a la ficha (correo, WhatsApp) | ☐ | ☐ | ☐ | ☐ |
| Sin cifras sin fuente (seguidores, alumnos, cursos) | ☐ | ☐ | ☐ | ☐ |
| Sin enlaces a la web antigua cuando se complete la migración | ☐ | ☐ | ☐ | ☐ |
| Una fecha de revisión anotada (para repetir cada trimestre) | ☐ | ☐ | ☐ | ☐ |

Después de unificar, **repetir las preguntas 24 y 25 de `04-prompts-control.md`** para ver si los asistentes reconocen mejor a la organización.

## 3. Lista `sameAs` para Miguel

Propuesta de enlaces para el campo `sameAs` del nodo `Organization`. Salen del pie de página de la plataforma (`src/components/home/Footer.tsx`):

```text
https://www.youtube.com/@uvarq
https://www.instagram.com/uvarq
https://www.tiktok.com/@uvarq
https://open.spotify.com/show/0JGnY0rLz1CJHhQ4gYeRva
```

Solo las redes oficiales. No agregar WhatsApp (no es un perfil) ni páginas de terceros.

**Propuesta del nodo completo** (hoy publica solo `@id`, `name` y `url`, y le faltan logo, redes y contacto). Es una recomendación; no cambié el código. Los valores entre corchetes salen de tu decisión:

```json
{
  "@context": "https://schema.org",
  "@type": "EducationalOrganization",
  "@id": "https://uvarq.com/#organizacion",
  "name": "[NOMBRE CORTO OFICIAL]",
  "alternateName": "Unidad Vectorial de Arquitectura",
  "url": "https://uvarq.com",
  "logo": "[URL ABSOLUTA DEL LOGO]",
  "description": "[DESCRIPCIÓN DE UNA LÍNEA]",
  "sameAs": [
    "https://www.youtube.com/@uvarq",
    "https://www.instagram.com/uvarq",
    "https://www.tiktok.com/@uvarq",
    "https://open.spotify.com/show/0JGnY0rLz1CJHhQ4gYeRva"
  ],
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "customer support",
    "email": "soporte@uvarq.com",
    "telephone": "+57 323 426 0022",
    "availableLanguage": "es"
  }
}
```

La dirección (`address`) **solo se añade cuando confirmes que la oficina atiende público** (sección 5). Hoy el nodo usa `Organization` y el `@id` se construye con `siteUrl()`: si se cambia a `EducationalOrganization`, el `@id` no debe cambiar para no desligar las fichas de curso que ya lo referencian.

## 4. Lista de LinkedIn para los instructores

**SIN DATO:** no sé quiénes son los instructores de cada curso publicado (la web actual no los muestra). Cuando los tenga, cada uno debe cumplir:

☐ Nombre completo igual al que aparece en la ficha del curso.
☐ Titular que diga el oficio y mencione a UVA como institución donde enseña.
☐ Experiencia: el cargo «Instructor» en la organización, con las fechas reales y un enlace al sitio oficial.
☐ Acerca de: dos o tres frases sobre su trayectoria, sin cifras inventadas.
☐ Dirección personalizada del perfil de LinkedIn (sin números al final).
☐ Foto reciente y legible.
☐ Un enlace desde el perfil a la ficha del curso que dicta.
☐ El proceso inverso: que la ficha del curso enlace a su perfil. Eso se logra con `sameAs` en el nodo `Person` del instructor (recomendación para Miguel o Andrés; hoy el nodo solo lleva nombre y especialidad).

## 5. Preguntas de elegibilidad para Google Business Profile

Google solo permite un perfil de empresa si el negocio tiene un local al que los clientes pueden acudir o si se desplaza a ellos ([guía oficial](https://support.google.com/business/answer/3038177), consultada el 13 de noviembre de 2026). **No se puede crear un perfil con una dirección inventada o que no sea una ubicación física real.** Según esa guía:

- Los apartados postales y las oficinas virtuales **no son elegibles**.
- Si la oficina está en un espacio de coworking, solo puede figurar si tiene señalización clara, atiende clientes en el lugar durante el horario comercial y el personal del negocio la atiende en ese horario.
- Un negocio que no tiene local con atención pero viaja a sus clientes puede ser de «área de servicio».
- La guía no define una regla general para negocios sin atención al público: la consulta completa está en el artículo «Business eligibility and ownership guidelines», que no pude abrir.

**Lo que necesito saber (todas con sí o no y un dato):**

1. ¿La oficina de **Calle 14 n.º 23-71, Oficina 501, Edificio Alturia, Pereira** es propia de UVA o es un espacio compartido o alquilado?
2. ¿Recibe gente del público (estudiantes, clientes) en horario fijo? ¿Cuál?
3. ¿Hay señalización visible de UVA en el edificio o en la oficina?
4. ¿Se dictan clases o asesorías presenciales ahí, o todo es en línea?
5. ¿Quién atiende ahí en ese horario?
6. ¿El nombre que aparece en el edificio es el mismo que el nombre oficial?

**Si las respuestas 2 a 5 son «no»:** no se crea el perfil. La plataforma sigue funcionando sin él; su valor es en búsquedas locales, y el negocio es mayormente en línea.
**Si son «sí»:** el nombre, la dirección y el teléfono del perfil deben ser **idénticos** a los de la ficha de la sección 1, al pie de página, al JSON-LD y a `uvarq.com`.

## 6. Qué me toca a mí

1. Elegir el nombre oficial (`00-diagnostico.md`).
2. Confirmar dirección y atención al público (sección 5) para decidir sobre Google Business Profile.
3. Confirmar si el podcast de Spotify es oficial.
4. Entregar año de fundación, razón social y cifras con fuente.
5. Pasar la lista de instructores con sus perfiles.

## 7. Qué recomiendo a Miguel o Andrés

1. Publicar el nodo `Organization` completo (sección 3).
2. Añadir `sameAs` a los instructores en el nodo del curso.
3. Subir la imagen cuadrada de logo y la de 1200×630 a `public/`.
4. Crear la página «Sobre nosotros» con la ficha de la sección 1.
