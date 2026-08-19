# Prompt para Claude Code — Home público de U.V.A.

Copia todo lo que sigue (desde "Construye…") y pégalo en Claude Code.

---

Construye la página de inicio pública (home / landing) de **U.V.A.**, una plataforma de formación en línea para el gremio de la construcción en LATAM: arquitectos, residentes de obra, presupuestadores y coordinadores BIM.

Entrega tres archivos separados por lenguaje, sin build ni dependencias, que se abran con doble clic:

```
home.html          marcado
css/home.css       tokens y estilos
js/home.js         interacciones
```

## Sistema visual (obligatorio)

Modo oscuro. Define todo como variables CSS en `:root` y no uses valores sueltos fuera de ellas.

| Rol | Valor |
| --- | --- |
| Fondo principal | `#09090B` (degradado sutil `linear-gradient(168deg,#101013 0%,#09090B 52%,#09090B 100%)`, fijo) |
| Superficie / tarjetas | `#18181B` |
| Bordes y separadores | `#27272A` |
| Texto primario | `#FAFAFA` |
| Texto secundario | `#A1A1AA` |
| Texto terciario | `#71717A` / `#52525B` |
| Acento de marca | `#FF007A` (fucsia) |
| Acento secundario | `#F2C012` (amarillo vial), tinte claro `#FFDD55` |

Nunca uses negro puro `#000000` ni blanco puro `#FFFFFF`. El acento fucsia se reserva a interacción directa (botones, enlaces, estados activos): no más del 10% de la superficie.

Tipografía, desde Google Fonts:

- Títulos: **Plus Jakarta Sans**, 700, `letter-spacing: -0.03em`.
- Cuerpo e interfaz: **Inter**, 400–600.
- Métricas, códigos, etiquetas: **JetBrains Mono**, con `font-variant-numeric: tabular-nums`.

Radio de esquina uniforme de **10px** en tarjetas, botones, inputs y contenedores. Solo son circulares (`999px`) los avatares, los botones tipo pill del CTA y los indicadores redondos. Etiquetas (`tag`) a 4px.

Botón de degradado, usado en los dos CTA principales:

```css
background: linear-gradient(96deg, #FF007A 0%, #FF6A3D 52%, #F2C012 100%);
color: #09090B;
border-radius: 999px;
padding: 17px 46px;
font-weight: 700;
box-shadow: 0 10px 30px rgba(255, 0, 122, .28);
```

Estados: todo elemento interactivo necesita `:hover` (aclarar fondo a `#1C1C20` o `filter: brightness(1.08)` en el degradado) y `:focus-visible { outline: 2px solid #FF007A; outline-offset: 2px; }`. Nada de anillo de foco azul por defecto.

## Estructura de la página, en este orden

1. **Header** pegajoso, con `backdrop-filter: blur(14px)` y fondo semitransparente sobre `#09090B`, borde inferior de 1px.
   - Marca en texto: `U.V.A.` en Plus Jakarta Sans 24px, `letter-spacing: .1em`, con el punto final en fucsia. Sin logotipo gráfico.
   - Buscador: input de 46px de alto, máximo 400px de ancho, icono de lupa a la izquierda, placeholder "¿Qué quieres aprender?".
   - Navegación a la derecha: enlaces "Cursos" y "Precios" (15px) y botón sólido "Acceder".

2. **Hero** centrado, con un resplandor radial fucsia detrás del titular.
   - Dos líneas de titular, `clamp(44px, 6vw, 72px)`: "La escuela del oficio" en blanco y "de la construcción" en fucsia.
   - Párrafo de apoyo a 18px en texto secundario, máx. 560px.
   - Botón pill con degradado: **"Iniciar sesión"**.
   - Tres métricas en JetBrains Mono: `12.400` alumnos del gremio · `180+` cursos técnicos · `10` escuelas.

3. **Banda de producto** sobre fondo `#0D0D10` con bordes superior e inferior.
   - Titular centrado y botón secundario "Agenda una demo".
   - Dos columnas: a la izquierda, cinco beneficios con viñeta `▸` (título en 14px y descripción en 12.5px secundaria): clases cortas con entregable, rutas por cargo, plantillas y planos descargables, asistente técnico con IA, reportes de avance por colaborador. A la derecha, un recuadro de 340px de alto con borde, como marcador de captura de pantalla del producto.

4. **Planes**, tres tarjetas de igual altura, máximo 1000px, centradas.
   - **Basic** — mensual, 1 estudiante, `$59.900 /mes`. Checklist parcial: los beneficios no incluidos van con equis gris `#52525B` y texto atenuado.
   - **Expert** — anual, 1 estudiante, `$449.900 /año`, badge "Ahorras 5 meses", borde y fondo teñidos de fucsia, botón sólido, nota "o 4 cuotas de $112.475 sin interés". Todos los beneficios con check amarillo.
   - **Expert Duo** — anual, 2 estudiantes, `$749.900 /año`, badge "Ahorras 7 meses", botón outline (borde y texto `#FAFAFA`, fondo transparente), nota "o 4 cuotas de $187.475 sin interés".
   - Beneficios a listar: catálogo completo, certificados digitales, plantillas y planos descargables, certificado físico de rutas, eventos y webinars en vivo.
   - Precios en JetBrains Mono a 28px. Badges en mono 10px, mayúsculas, `letter-spacing: .1em`, sobre tinte amarillo.

5. **CTA final**, centrado, con mucho aire (96px de padding vertical).
   - Titular `clamp(30px, 4.4vw, 52px)` donde "Más de 400 empresas" lleva el degradado fucsia→amarillo aplicado al texto (`background-clip: text`), y el resto en blanco: "usan U.V.A. para la formación de sus equipos".
   - Línea de apoyo en texto secundario.
   - Botón pill con degradado: "Iniciar sesión".

6. **Footer** sobre `#0D0D10`.
   - Cuatro columnas: marca con una línea de descripción, "Escuelas", "U.V.A. y comunidad", "Soporte". Encabezados en JetBrains Mono 12px, mayúsculas, `letter-spacing: .16em`, en fucsia. Enlaces a 14px en texto secundario.
   - Barra inferior separada por un borde: a la izquierda "Hecho en obra, para LATAM · © 2026 U.V.A."; a la derecha cuatro botones cuadrados de 40px con iconos SVG en línea de YouTube, Instagram, LinkedIn y TikTok, con borde de 1px, que al pasar el cursor se rellenan (fucsia y amarillo alternados) y ponen el icono en `#09090B`, con transición de .16s.

7. **Botón flotante de WhatsApp**: círculo verde `#25D366` de 56px, fijo abajo a la derecha (`right: 24px; bottom: 24px`), con sombra y el glifo de WhatsApp en SVG en línea, siempre visible al hacer scroll.

## Comportamiento (`js/home.js`)

- Todos los botones de acceso ("Acceder", los dos "Iniciar sesión", los tres "Suscribirme") navegan a `iniciarsesion-crearusuario.html`.
- El header cambia a un fondo más opaco cuando la página se desplaza más de 20px.
- Sin librerías ni frameworks: JavaScript sencillo con `addEventListener`.

## Responsive

Diseño fluido, sin anchos fijos: contenido centrado con máximo de 1180px y márgenes `clamp(20px, 4vw, 56px)`. Las rejillas usan `repeat(auto-fit, minmax(…, 1fr))` para que reflowen solas. En móvil el nav colapsa a marca + botón "Acceder", y el buscador se oculta.

## Accesibilidad y calidad

- HTML semántico: `header`, `nav`, `main`, `section`, `footer`; un solo `h1`.
- Contraste mínimo AA para el texto; el fucsia no se usa en texto pequeño sobre fondo oscuro (usa `#FF7AB8` si necesitas texto en ese tono).
- Iconos SVG en línea, sin fuentes de iconos ni CDN de terceros; `aria-label` en los botones que solo tienen icono.
- Sin imágenes externas: usa contenedores con borde o una trama diagonal (`repeating-linear-gradient(135deg, rgba(250,250,250,.045) 0 2px, transparent 2px 9px)` sobre `#141417`) como marcadores.
- Nada de emojis. Texto en español.
