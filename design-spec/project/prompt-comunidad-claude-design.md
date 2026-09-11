# Prompt para Claude Design — Sección Comunidad de U.V.A.

Copia todo lo que sigue (desde "Diseña…") y pégalo en Claude Design (claude.ai/design), en el mismo proyecto donde ya existen `Uva - Mockups.dc.html` y `Uva - Panel Admin.dc.html`, para que la Comunidad salga como una extensión del mismo sistema — no como una pieza suelta.

---

Diseña la sección **Comunidad** del dashboard de **U.V.A.**, una plataforma de formación para el gremio de la construcción. Ya existe un sidebar con un ítem de navegación "Comunidad" marcado con un punto amarillo `#F2C012` (indicando "aún no disponible") — esta sección es lo que hay detrás de ese ítem. Reutiliza el sidebar, el header y los componentes (tarjetas, botones, avatares, badges) ya definidos en el mockup existente; no inventes un sistema visual nuevo.

## Sistema visual (ya establecido, no cambiar)

| Rol | Valor |
| --- | --- |
| Fondo principal | `#09090B`, degradado `linear-gradient(168deg,#101013 0%,#09090B 52%,#09090B 100%)` |
| Superficie / tarjetas | `#18181B` |
| Bordes y separadores | `#27272A` |
| Texto primario | `#FAFAFA` |
| Texto secundario | `#A1A1AA` |
| Texto terciario | `#71717A` / `#52525B` |
| Acento de marca | `#FF007A` (hover `#E00069`) — sólido, sin degradado. Uso exclusivo: CTAs, estado activo, "en progreso" |
| Acento secundario | `#F2C012` (amarillo vial) — solo advertencias/badges, nunca CTA principal |
| Radio de esquina | `10px` en tarjetas, botones, inputs (igual que el resto de la app); circular en avatares |

Tipografía: **Plus Jakarta Sans** 700 para títulos, **Inter** 400–600 para cuerpo, **JetBrains Mono** para métricas, contadores y fechas relativas ("hace 3 días").

Nunca negro puro. Todo interactivo necesita `:hover` y `:focus-visible { outline: 2px solid #FF007A; outline-offset: 2px; }`.

## Pantallas a diseñar

### 1. Feed de Comunidad (`#comunidad`) — pantalla principal

Layout de tres columnas dentro del área de contenido (sidebar y header ya existen, no los rediseñes):

- **Columna izquierda (categorías, 220px):** lista vertical de categorías con contador — "Anuncios", "Muestra tu proyecto", "Preguntas generales", "Empleo". Categoría activa con fondo `#18181B` y borde izquierdo de 3px en fucsia, igual que el patrón de navegación del sidebar.
- **Columna central (feed, ancho flexible):**
  - Composer arriba: tarjeta con avatar del usuario, input de una línea "¿Qué quieres compartir con la comunidad?" que al enfocarse expande a un formulario con título + cuerpo + selector de categoría + botón primario "Publicar".
  - Lista de tarjetas de post, cada una con:
    - Avatar + nombre del autor + badge de actividad en mono, ej. *"completó Presupuestos con Excel · hace 3 días"* (esto reemplaza cualquier indicador de "en línea"; es la señal de que el autor está activo).
    - Categoría del post como tag pequeño.
    - Título (Plus Jakarta Sans) + primeras líneas del cuerpo (Inter), truncado con "Ver más".
    - Pie de tarjeta: contador de reacciones (icono + número), contador de respuestas (icono + número), fecha relativa en mono.
    - Post fijado (`fijado=true`, solo lo puede crear un admin) con un badge sutil "Fijado" y fondo apenas distinto (`#141417`).
  - Estado vacío de una categoría: ilustración simple con trama diagonal (mismo marcador de imagen que las portadas de curso) + "Todavía no hay publicaciones aquí" + CTA "Sé el primero en publicar".
- **Columna derecha (240px, opcional si el ancho lo permite):** tarjeta "Tu actividad" con puntos/respuestas/preguntas en mono (mismo componente que ya existe en la pantalla de Perfil), y una tarjeta de aviso cuando el acceso está por vencer: *"Tu acceso a la comunidad vence en 5 días — completa un curso para mantenerlo activo"*, fondo `#F2C012` al 14%, borde al 28% (mismo patrón que la advertencia de "Período de gracia" del sidebar).

### 2. Detalle de un post (`#comunidad/post`)

- Header del post igual que en la tarjeta del feed, pero completo (sin truncar) y más grande.
- Botón de reacción (like) y botón "Responder" debajo del cuerpo.
- Hilo de respuestas: cada respuesta con avatar más pequeño, nombre, cuerpo, reacción propia y fecha relativa. Respuestas del propio autor del post con un pequeño badge "Autor".
- Si un admin borró una respuesta por moderación: texto reemplazado por "[comentario eliminado]" en `#52525B` cursiva — mismo tratamiento que ya existe en los comentarios de lección.
- Input de nueva respuesta fijo al fondo de la columna central (sticky), mismo estilo que el composer del feed pero compacto.

### 3. Estado bloqueado — sin acceso a la comunidad

Reutiliza literalmente el patrón `.error-shell` / `.error-shell--standalone` de `design-spec-errores/` (mismo componente que 404/403/500, dentro del layout con sidebar en este caso, sin el modificador `--standalone`):

- Código grande o ícono (no ilustración externa) + título "Todavía no puedes entrar a la Comunidad".
- Cuerpo: "Completa un curso en los últimos 30 días para desbloquear el acceso — es nuestra forma de mantener la comunidad activa."
- CTA primario: "Ver catálogo de cursos" (fucsia sólido).
- Sin CTA secundario "Contactar soporte" — este no es un error, es una condición de negocio, así que el tono debe ser motivador, no de fallo.

## Estados a cubrir en las tarjetas de post

- Normal, fijado (admin), con muchas respuestas (contador con "99+"), y el estado vacío de categoría descrito arriba.

## Responsive

Bajo el ancho donde el dashboard ya colapsa el sidebar a solo-iconos, la columna de categorías del feed pasa a un selector horizontal con scroll (chips), y la columna derecha ("Tu actividad") se oculta o se mueve arriba del feed como una fila de chips.

## Qué NO diseñar en esta pasada

- Nada de gamificación con ranking/leaderboard, perfil público compartible, ni portal de empleo — quedan para una fase posterior, no forman parte de este mockup.
- Nada de chat en tiempo real — la comunidad es asíncrona (posts/respuestas), no un chat.

## Entregable

Exporta como handoff (`.dc.html`) dentro del mismo bundle de `design-spec/`, siguiendo el mismo patrón de imports (`_ds/`, `image-slot.js`, `support.js`) que `Uva - Mockups.dc.html`, para que Claude Code pueda leerlo igual que las demás pantallas.
