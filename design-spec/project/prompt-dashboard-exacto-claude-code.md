# Prompt para Claude Code — Dashboard de U.V.A. (réplica exacta del diseño)

Copia todo lo que sigue (desde "Construye…") y pégalo en Claude Code, en VS Code.

---

Construye el panel del estudiante (dashboard interno) de **U.V.A.**, una plataforma de formación para el gremio de la construcción en LATAM. Sigue esta especificación al pie de la letra — colores, textos y estructura exactos, no una interpretación libre.

Entrega archivos separados por lenguaje, sin build ni dependencias, abribles con doble clic:

```
dashboard.html
css/dashboard.css
js/dashboard.js
```

## Sistema visual (valores exactos)

Modo oscuro, variables CSS en `:root`:

| Rol | Valor |
| --- | --- |
| Fondo | `#09090B`, degradado fijo `linear-gradient(168deg,#101013 0%,#09090B 52%,#09090B 100%)` |
| Superficie / tarjeta | `#18181B`; superficie secundaria (sidebar, chips) `#141417` |
| Bordes | `#27272A` |
| Texto primario | `#FAFAFA` |
| Texto secundario | `#A1A1AA`; terciario `#71717A` / `#52525B` |
| Acento de marca | `#FF007A` (fucsia) |
| Acento secundario | `#F2C012` (amarillo vial), tinte `#FFDD55` |

Tipografía (Google Fonts): **Plus Jakarta Sans** 700 (`letter-spacing:-0.03em`) para títulos, **Inter** 400–600 para cuerpo, **JetBrains Mono** para métricas y duraciones. Radio de esquina uniforme de **10px** en tarjetas, botones e inputs; circular solo en avatares y puntos indicadores.

## Sidebar (izquierda, ancho fijo 248px, colapsable a 76px)

- Arriba: marca `U.V.A.` en texto (Plus Jakarta Sans, `letter-spacing:.1em`), el punto final en fucsia — sin logotipo gráfico. Botón de colapsar al lado (icono de dos rectángulos).
- Nav principal, filas a todo el ancho, iconos de trazo fino (`stroke-width:1.9`):
  - **Inicio**
  - **Academia**
  - **Comunidad** (con un punto amarillo pequeño a la derecha, indicando novedad)
- Encabezado de sección "TU PROGRESO" en JetBrains Mono 10px, mayúsculas, `letter-spacing:.22em`, color `#52525B`.
- Segundo grupo de nav:
  - **Mis rutas**
  - **Progreso**
  - **Certificados**
- El ítem activo tiene fondo `#18181B` y texto blanco; el resto en `#A1A1AA` con hover que aclara a `#1C1C20`.
- Al pie: tarjeta con borde (`#141417`, borde `#27272A`) con badge "Período de gracia" (punto amarillo + texto en mono sobre fondo `#F2C012` al 14%), la línea "Quedan 12 días de acceso." y un botón sólido fucsia "Ver planes".

## Header de contenido (sticky, blur, borde inferior)

- Buscador (máx. 420px, 38px alto) con placeholder "¿Qué quieres aprender hoy?".
- Botón secundario "Preguntar" (icono de estrella).
- Chip con racha (icono de fuego + número de días).
- Chip con puntos, ej. "4.820 pts".
- Avatar circular con iniciales del usuario sobre `#27272A`, nombre, botón `▾` que abre un menú desplegable: Ver mi perfil, Mi suscripción, Mis certificados, separador, Cerrar sesión.

## Pantalla Inicio — contenido exacto

1. **Saludo**: `<h1>` "Hola {nombre}, tienes metas que alcanzar." (38px) + párrafo "Te faltan 3 clases para cerrar tu semana con racha de 13 días." en texto secundario.

2. **Tus rutas activas** (`<h3>` + enlace "Ver todas" a la derecha): dos tarjetas horizontales, cada una con:
   - Portada rectangular (112×130px) — usa un div con trama diagonal `repeating-linear-gradient(135deg,rgba(250,250,250,.045) 0 2px,transparent 2px 9px)` sobre `#141417` como marcador, no imagen real.
   - Tag de tipo ("Ruta curada" en fucsia / "Personalizada" en amarillo) + tag de nivel.
   - Título: "De cero a presupuestador de obra" (4/9 cursos · 21 h restantes, barra al 44%) y "Mi ruta BIM para licitaciones" (1/6 cursos · 34 h restantes, barra al 17%).
   - Botón "Continuar ruta" / "Ver ruta".

3. **Sigue aprendiendo** (`<h3>`): rejilla de 4 tarjetas de clase, cada una con portada de trama diagonal, categoría en mono, etiqueta "En curso", barra de progreso al pie de la portada, título, curso/número de clase y minutaje "mm:ss / mm:ss":
   - "Cómo armar un APU de mampostería" · Presupuestos de obra · Clase 7/18 · 18:24/29:40 · 62%
   - "Familias paramétricas en Revit" · Revit para obra · Clase 3/24 · 04:10/17:05 · 24%
   - "Cantidades de acero de refuerzo" · Cantidades de obra · Clase 11/14 · 22:31/25:12 · 88%
   - "Lectura de planos estructurales" · Lectura de planos · Clase 2/16 · 01:02/12:44 · 9%

4. **Banda de webinar + recursos** (dos columnas, 1.4fr/1fr):
   - Izquierda: tarjeta con degradado fucsia→amarillo, radio 20px, tag "Evento en vivo", título "Webinar: actualización NSR-10 y su impacto en presupuestos", texto "Con el equipo técnico de Uva. Incluye plantilla de reajuste de precios.", countdown de Días/Horas/Minutos en mono y botón "Reservar mi lugar".
   - Derecha: card con icono, título "Recursos nuevos para ti" y 3 filas con etiqueta de formato (XLSX/DWG/PDF) + nombre del recurso, enlace "Ver todos los recursos →".

5. **Explora por categoría** (`<h3>`): 5 tiles grandes con degradado tintado alternando fucsia y amarillo, círculo decorativo, icono de línea e info:
   - Presupuestos y Costos — 4 rutas · 26 cursos (fucsia)
   - Software y BIM — 3 rutas · 31 cursos (amarillo)
   - Construcción y Obra — 2 rutas · 22 cursos (neutro)
   - Normativa y Legal — 2 rutas · 14 cursos (amarillo)
   - Gestión de Obra — 1 ruta · 12 cursos (fucsia)
   - Cada tile eleva ligeramente al pasar el cursor (`transform: translateY(-3px)`).

## Comportamiento (`js/dashboard.js`)

- JavaScript plano, sin frameworks, con `addEventListener`.
- Navegación entre secciones cambia de vista sin recargar la página (mostrar/ocultar secciones).
- El menú del avatar y el botón de colapsar sidebar alternan clases; persiste el estado colapsado en `localStorage`.
- Ítems de nav que aún no tienen pantalla propia (Academia, Comunidad, Mis rutas, Progreso, Certificados) pueden llevar a un estado simple "Próximamente" si no se pide construirlos ahora — dilo explícitamente si quieres que Claude Code también los genere con el mismo detalle.

## Responsive

Sidebar de ancho fijo; el contenido usa `max-width:1320px` centrado con márgenes `clamp(20px,3vw,44px)`. Las rejillas (tarjetas de clase, categorías) usan `repeat(auto-fill,minmax(…,1fr))` para reflow fluido.

## Accesibilidad

HTML semántico (`aside`, `header`, `main`, `nav`, `section`); un solo `h1`. Foco visible en fucsia. Sin imágenes externas — todo con marcadores de trama. Sin emojis. Texto en español.
