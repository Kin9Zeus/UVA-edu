# U.V.A. — Pantallas de error (handoff)

Tres estados de error en modo oscuro, con los tokens del resto del proyecto.
HTML plano + CSS + JS, sin build ni dependencias. Se abren con doble clic.

## Archivos

- `404.html` → Next.js `not-found.tsx`
- `403-rol.html` → `forbidden.tsx`, variante A (rol incorrecto)
- `403-suspendida.html` → `forbidden.tsx`, variante B (cuenta suspendida)
- `500.html` → `error.tsx`
- `css/error.css` → tokens + componentes (un solo archivo, compartido por las 4 páginas)
- `js/error.js` → solo el botón "Reintentar" de la 500

## Standalone vs. dentro del layout con sidebar

El bloque de error es siempre el mismo:

```html
<main class="error-shell">
  <div class="error-block"> … </div>
</main>
```

- `.error-shell` usa `min-height:100%` + flex centrado → se centra en el espacio
  que le dé el contenedor padre, así que funciona tal cual dentro del área de
  contenido del dashboard o del panel admin, sin tocar el layout.
- Añade `.error-shell--standalone` (que sube a `min-height:100vh`) solo en las
  rutas públicas, donde no hay sidebar.

En Next.js: el `error-shell` sin el modificador va en los `not-found.tsx` /
`error.tsx` dentro de `(dashboard)` y `(admin)`; con el modificador, en `(public)`.

## Las dos variantes de 403

Son un mismo componente con una prop:

```ts
type Motivo = 'ROL' | 'SUSPENDIDA';
```

Cambia tres cosas: el badge amarillo (solo en `SUSPENDIDA`), el copy y la acción
principal (`Volver al inicio` vs. `Contactar soporte`).

## Tokens

| Rol | Valor |
| --- | --- |
| Fondo | `#09090B` + degradado `168deg` |
| Superficie | `#18181B` / `#141417` |
| Bordes | `#27272A` |
| Texto | `#FAFAFA` / `#A1A1AA` / `#71717A` / `#52525B` |
| Acento | `#FF007A` (hover `#E00069`) |
| Advertencia | `#F2C012` al 14% de fondo, 28% de borde |
| Radio | `10px` |

Tipografía: Plus Jakarta Sans 700/800 (títulos y código de error), Inter 400–600
(cuerpo), JetBrains Mono (metadatos y `error_id`).

## Responsive

Bajo 480px de ancho el código grande baja de 92px a 64px y el título de 23px a
20px; el resto de la escala no cambia. Sin imágenes ni ilustraciones externas.
