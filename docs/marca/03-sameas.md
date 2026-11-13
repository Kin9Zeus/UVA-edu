# Lista `sameAs` para los datos estructurados

**Fase 14. Identidad de marca**
**Fecha:** 13 de noviembre de 2026
**Para:** Miguel
**Estado:** la lista está lista. El nodo completo queda `BLOQUEADO` hasta elegir el nombre oficial.

## Las direcciones oficiales

Salen del pie de página de la plataforma (`src/components/home/Footer.tsx`). Son solo perfiles oficiales: no agregar WhatsApp (no es un perfil) ni páginas de terceros.

```text
https://www.youtube.com/@uvarq
https://www.instagram.com/uvarq
https://www.tiktok.com/@uvarq
https://open.spotify.com/show/0JGnY0rLz1CJHhQ4gYeRva
```

La del podcast depende de que yo confirme que es oficial.

## Cómo queda el nodo

Hoy el código publica solo `@id`, `name` y `url` (`src/lib/seo/organizacion.ts`). Propongo el nodo completo. **No cambié el código.** Los valores entre corchetes salen de mis decisiones.

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

## Tres cuidados

1. **No cambiar el `@id`.** Las fichas de curso ya lo usan para referirse a la organización. Si el `@id` cambia, se desligan.
2. **La dirección solo se agrega si confirmo que la oficina atiende público** (`05-google-business-profile.md`).
3. **El host del `@id`, de la URL y del logo** debe ser el host canónico que se decida. Cambia con `NEXT_PUBLIC_SITE_URL`.

## Para los instructores

La ficha del curso solo publica nombre y especialidad del instructor. Si cada instructor tiene un perfil de LinkedIn (ver `04-instructores.md`), el nodo de la persona puede llevar su propio `sameAs`. Es una recomendación para Miguel o Andres.

## Qué me toca a mí

Elegir el nombre, confirmar el podcast, entregar el logo y confirmar la dirección. Con eso se completa el nodo.
