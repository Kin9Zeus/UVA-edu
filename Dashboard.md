# Prompt para Claude Code — Dashboard de U.V.A. (solo Inicio y Perfil)

Copia todo lo que sigue (desde "Construye…") y pégalo en Claude Code, en VS Code, dentro de tu proyecto.

---

Construye el panel interno (dashboard) de **U.V.A.**, una plataforma de formación para el gremio de la construcción. Por ahora solo necesito **dos pantallas activas: Inicio y Mi perfil** (el resto de ítems del menú se muestran pero llevan a un estado "próximamente").

Entrega archivos separados por lenguaje, sin build ni dependencias, que se abran con doble clic:

```
dashboard.html
css/dashboard.css
js/dashboard.js
```

## Sistema visual (obligatorio, igual en toda la app)

Modo oscuro, variables CSS en `:root`, nada de valores sueltos fuera de ellas.

| Rol                   | Valor                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------- |
| Fondo principal       | `#09090B` (degradado `linear-gradient(168deg,#101013 0%,#09090B 52%,#09090B 100%)`, fijo) |
| Superficie / tarjetas | `#18181B`                                                                                 |
| Bordes y separadores  | `#27272A`                                                                                 |
| Texto primario        | `#FAFAFA`                                                                                 |
| Texto secundario      | `#A1A1AA`                                                                                 |
| Texto terciario       | `#71717A` / `#52525B`                                                                     |
| Acento de marca       | `#FF007A` (fucsia)                                                                        |
| Acento secundario     | `#F2C012` (amarillo vial), tinte claro `#FFDD55`                                          |

Nunca negro puro ni blanco puro. El fucsia solo en interacción directa: ítem activo, botones primarios, barras de progreso.

Tipografía (Google Fonts): **Plus Jakarta Sans** 700 para títulos (`letter-spacing:-0.03em`), **Inter** 400–600 para cuerpo e interfaz, **JetBrains Mono** para métricas y códigos (`font-variant-numeric: tabular-nums`).

Radio de esquina uniforme de **10px** en tarjetas, botones, inputs. Circular (`999px`) solo en avatares, indicadores de punto y botones pill. Etiquetas (`tag`) a 4px.

Todo elemento interactivo necesita `:hover` (aclarar a `#1C1C20`) y `:focus-visible { outline: 2px solid #FF007A; outline-offset: 2px; }`.

## Estructura de la página

Layout de dos columnas: sidebar fija a la izquierda + contenido a la derecha con header propio.

### Sidebar (`#0B0B0D`, borde derecho de 1px)

- Marca en texto arriba: `U.V.A.` en Plus Jakarta Sans 20px, `letter-spacing:.1em`, punto final en fucsia. Botón de colapsar al lado.
- Navegación, filas a todo el ancho (12px 16px), icono SVG de trazo fino (stroke-width 1.9) + etiqueta:
  - **Inicio** (activo por defecto)
  - Catálogo
  - Comunidad (con punto amarillo `#F2C012` a la derecha)
- Encabezado "TU PROGRESO" en JetBrains Mono 10px, mayúsculas, `letter-spacing:.22em`, color `#52525B`.
- Segundo grupo de navegación:
  - Progreso
  - Certificados (con contador en mono, ej. "05")
  - **Perfil** (esta sí funciona)
  - Suscripción
- El ítem activo tiene fondo `#18181B` y un borde izquierdo de 3px en fucsia; el resto en `#A1A1AA`, hover aclara a `#1C1C20` y pone el texto en `#FAFAFA`.
- Al pie, tarjeta con borde: badge "Período de gracia" (punto amarillo + texto en mono), una línea de aviso y un botón primario "Ver planes" (sin funcionalidad real por ahora, o deshabilitado).
- Todo ítem que no sea Inicio o Perfil (Catálogo, Comunidad, Progreso, Certificados, Suscripción) navega a un estado simple: tarjeta centrada con "Próximamente" y un botón para volver a Inicio.

### Header del contenido

Sticky, con blur, borde inferior de 1px:

- Buscador ancho máximo 420px, 38px de alto, placeholder "¿Qué quieres aprender hoy?".
- Botón secundario "Preguntar" con icono de estrella.
- Chip con contador de racha (icono de fuego + número).
- Chip con puntos (ej. "4.820 pts").
- A la derecha: avatar circular con iniciales del usuario sobre fondo `#27272A`, nombre, y un botón `▾` que abre un menú desplegable con: **Ver mi perfil**, Mi suscripción (deshabilitado/próximamente), Mis certificados (deshabilitado/próximamente), separador, **Cerrar sesión**.
- "Cerrar sesión" limpia el estado de sesión (ver JS) y redirige a `home.html`.

### Pantalla Inicio (`#inicio`)

- Saludo: "Hola {nombre}, tienes metas que alcanzar." + una línea de apoyo.
- Sección **Tus rutas activas**: dos tarjetas horizontales con portada rectangular (usa un div con trama diagonal como marcador de imagen: `repeating-linear-gradient(135deg, rgba(250,250,250,.045) 0 2px, transparent 2px 9px)` sobre `#141417`), tag de tipo de ruta, título, "X/Y cursos · Z h restantes", barra de progreso en fucsia y botón "Continuar ruta" / "Ver ruta".
- Sección **Sigue aprendiendo**: rejilla de 4 tarjetas de clase (mismo estilo de portada con trama), con categoría en mono, etiqueta "En curso", barra de progreso al pie de la portada, título, curso/clase y minutaje.
- Sección **Explora por categoría**: 5 tiles grandes con degradado tintado (alternando fucsia y amarillo), icono, nombre de categoría y conteo de rutas/cursos. Todas navegan a "próximamente".
- Todo dato es mock/estático — no hace falta backend.

### Pantalla Mi perfil (`#perfil`) — ver información, editable

Layout de dos columnas (contenido + lateral).

**Columna principal:**

- Tarjeta con: avatar grande con iniciales, nombre completo, `@usuario · país` en mono, badge de plan.
- Formulario con los campos: nombre completo, correo, rol en el gremio, país, usuario público, software que domina — todos en inputs de una columna en rejilla `auto-fit minmax(220px,1fr)`.
- Un textarea "Sobre ti".
- Botones "Guardar cambios" (primario) y "Cancelar"; al guardar, muestra una etiqueta de confirmación "Datos actualizados" y actualiza el nombre en el header.
- Los datos deben venir precargados con los mismos valores del registro (nombre, correo, rol) que ya tienes guardados en `localStorage` o en el estado de la app — si no existen, usa un usuario de ejemplo: `Daniela Arango`, `daniela.arango@estudio.co`, `Presupuestadora`, `Colombia`, `daniela`.

**Columna lateral:**

- Tarjeta "Actividad" con 3 métricas en mono: puntos, respuestas, preguntas.
- Tarjeta "Mis certificados" con 2 filas mock (nombre + fecha) y enlace "Ver todos" (deshabilitado por ahora).
- Tarjeta "Perfil público" con el enlace `uva.co/p/{usuario}` y un botón "Copiar enlace" que copia el texto al portapapeles.

## Comportamiento (`js/dashboard.js`)

- Sin frameworks; JavaScript plano con `addEventListener`.
- Estado simple en memoria + `localStorage` (clave `uva_user`) para persistir el perfil entre recargas.
- Navegación entre Inicio y Perfil cambia una clase `.active`/`.hidden` en las secciones; no recarga la página.
- El resto de ítems del menú muestran el estado "Próximamente" en el mismo panel de contenido.
- "Cerrar sesión" limpia `uva_user` de `localStorage` y hace `window.location.href = 'home.html'`.
- Guardar el formulario de perfil actualiza `localStorage` y refleja el nombre nuevo en el header al instante.

## Responsive

Sidebar de ancho fijo (248px, colapsable a 76px con solo iconos); el contenido usa `max-width:1320px` centrado con márgenes fluidas `clamp(20px,3vw,44px)`. Las rejillas usan `repeat(auto-fill,minmax(…,1fr))`.

## Accesibilidad

- HTML semántico (`aside`, `header`, `main`, `nav`); un solo `h1` por vista.
- `aria-label` en botones solo-icono; `aria-current="page"` en el ítem de navegación activo.
- Contraste AA en todo el texto; el fucsia sobre fondo oscuro en texto pequeño usa el tono `#FF7AB8`.
- Sin imágenes externas ni CDNs de iconos: SVG en línea. Nada de emojis. Texto en español.
