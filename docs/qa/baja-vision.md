# Pruebas — Baja visión y condiciones reales

Registro de la tarea "Front: baja visión y condiciones reales — zoom, letra
grande, sol y movimiento reducido" (rama `front-baja-vision`). Cada prueba que
falló se anota aquí con su causa y su arreglo, para el informe de pruebas;
nunca solo en un mensaje de chat.

Severidad: **Bloqueante** (no se puede usar la pantalla) · **Alta** (se pierde
contenido o una función) · **Media** (se usa con dificultad) · **Baja**
(cosmético).

## Cómo se prueba

- **Automático:** `e2e/a11y-baja-vision.spec.ts`, cada pantalla con el rol que
  la ve (sin sesión, estudiante, admin). Solo bajo pedido, contra un build:
  `A11Y=1 npx playwright test e2e/a11y-baja-vision.spec.ts`. Detecta scroll
  horizontal, elementos fuera de la ventana, texto cortado sin aviso y barras
  fijas que tapan más del 40 % del alto. **No detecta superposiciones**: esas
  salen de las capturas y de la prueba manual.
  - `zoom-200`: 1280×900 al 200 % = ventana de 640×450 px CSS (WCAG 1.4.10).
  - `letra-150` (375 px) y `letra-200` (768 px): letra predeterminada del
    navegador a 24 y 32 px. Todo está en `rem`, así que el 200 % a 375 px
    equivale a ~187 px de ancho; en celular se mide al 150 %.
  - `espaciado-375` y `espaciado-1280`: interlineado 1,5, letras 0,12 em,
    palabras 0,16 em, párrafos 2 em (WCAG 1.4.12).
- **Manual en PC:** Chrome con zoom al 200 %, `chrome://settings/fonts` a 24 y
  32, el CSS de espaciado por consola y `prefers-reduced-motion` desde
  DevTools → Rendering.
- **Manual en celular:** letra del sistema al máximo en Android (Chrome y
  Samsung Internet); en iPhone, el botón **aA** de Safari (la letra del
  sistema de iOS no cambia páginas web: la plataforma no usa
  `-apple-system-body`, decisión del 2026-10-30). Al sol, en claro y oscuro.

## Resultado por prueba

| # | Prueba | Estado |
| --- | --- | --- |
| 1 | Zoom al 200 % | Falló (BV-01, 02, 03, 15, 16) → corregido. Barrido y prueba manual en PC en verde |
| 2 | Letra del sistema al máximo | Falló (BV-01 a 09, 18 a 23) → corregido. 150 % en celular y 200 % desde 768 px en verde. **Sin resultado registrado en celular real** |
| 3 | Espaciado de texto | Falló (BV-01, 08, 09) → corregido. Barrido en verde |
| 4 | Al sol | **Sin resultado registrado** (prueba manual en exteriores) |
| 5 | Movimiento reducido | Falló (BV-10, 11) → corregido; regla global en `globals.css`. **Sin resultado registrado en celular real** |
| 6 | Nada depende solo del color | Falló (BV-12, 13) → corregido |
| 7 | Contraste en ambos temas | Falló (BV-14) → corregido. Tokens: `contraste.test.ts` en verde |

## Cierre (2026-11-03)

- `npx tsc --noEmit`, `npm run lint`, `npx vitest run` (1574 pruebas) y `npm run build`: en verde.
- Último barrido completo en verde antes de BV-18 a BV-23; esos seis se verificaron con su captura antes/después y el barrido del panel con el detector corregido.
- **Fuera de alcance / pendiente:**
  - Letra al 200 % en celular (375 px): no es meta de esta tarea (equivale a ~187 px de ancho); queda por decidir si se hace una pasada solo de lo que impida usar la plataforma.
  - Navegadores del piso de calidad: todo se probó en Chrome; faltan Safari, Firefox, Edge y Samsung Internet.
  - El barrido no detecta superposiciones: se revisaron en capturas y a mano.

## Sin reproducir

### BV-17 — Portada: "se desbordan las categorías en las tarjetas"

- **Prueba:** 2 · **Detectó:** prueba manual del usuario (letra al 150 %, 375 px)
- La lista "Explora por categoría" de la portada y las tarjetas de curso se ven bien en las capturas. Lo más probable es que fuera la misma lista en el inicio del panel (con sesión, el logo lleva ahí), corregida en BV-22.

## Resueltos

### BV-01 — Portada: el bloque principal se sale 17 px con letra grande o espaciado

- **Severidad:** Alta · **Prueba:** 2 y 3 · **Detectó:** barrido (`letra-150`, `espaciado-375`)
- **Causa:** la sección es una grilla sin columnas definidas en celular; la columna creció hasta el ancho del botón "Tengo un código" (`whitespace-nowrap`). Después, la palabra "construcción" del título no cabía sola en un renglón.
- **Arreglo:** `grid-cols-1`, los botones parten su texto, y el título parte la palabra larga (con guion si la letra está agrandada). `97b8920`, `fd03eac`

### BV-02 — Admin: el botón de cuenta se sale 46 px de la cabecera

- **Severidad:** Media · **Prueba:** 2 · **Detectó:** barrido (`letra-150` en /admin/cursos, /admin/usuarios y el editor del curso)
- **Causa:** logo, etiqueta "Admin", buscar, tema y avatar no caben en 375 px con la letra al 150 %.
- **Arreglo:** la etiqueta "Admin" se oculta solo con la letra agrandada (el enlace sigue diciendo "Admin" al lector de pantalla). `97b8920`

### BV-03 — Admin, editor del curso: las tarjetas se salen 15 px

- **Severidad:** Media · **Prueba:** 2 · **Detectó:** barrido (`letra-150`)
- **Causa:** la misma grilla sin columnas de BV-01.
- **Arreglo:** `grid-cols-1`. `97b8920`

### BV-04 — Reseñas: las estrellas se salen 13 px

- **Severidad:** Media · **Prueba:** 2 · **Detectó:** barrido (`letra-150`)
- **Causa:** el área táctil de cada estrella estaba en `rem` y crecía con la letra (66 px × 5).
- **Arreglo:** área táctil fija de 44 px. `97b8920`

### BV-05 — Perfil: el indicativo "+57" se corta

- **Severidad:** Alta · **Prueba:** 2 · **Detectó:** barrido (`letra-150`, `letra-200`)
- **Causa:** ancho fijo en px (`w-[108px]`) con el texto en `rem`.
- **Arreglo:** ancho en `rem`. `97b8920`

### BV-06 — Admin, vista previa: la vigencia "15 minutos" se corta

- **Severidad:** Media · **Prueba:** 2 · **Detectó:** barrido (`letra-150`, `letra-200`)
- **Causa y arreglo:** igual que BV-05 (`w-[140px]` → `rem`). `97b8920`

### BV-07 — Portada: los rótulos de la ilustración tocan el título

- **Severidad:** Baja · **Prueba:** 2 · **Detectó:** captura (`letra-150`)
- **Causa:** el margen que lo evitaba estaba en una media query en px (`max-[359px]`), que no reacciona a la letra agrandada.
- **Arreglo:** el mismo margen con una media query en `rem`. `fd03eac`

### BV-08 — Botón de WhatsApp tapa "Tengo un código"

- **Severidad:** Media · **Prueba:** 2 · **Detectó:** captura (`letra-150`)
- **Causa:** tamaño y distancia al borde en `rem`: crecía con la letra.
- **Arreglo:** 56 px fijos (es área táctil, no texto). `920b1db`

### BV-09 — Menú lateral del admin y categoría de las tarjetas de curso se cortan

- **Severidad:** Media · **Prueba:** 3 · **Detectó:** barrido (`espaciado-1280`, `zoom-200`)
- **Causa:** `truncate` en etiquetas que no se pueden leer en otro lado.
- **Arreglo:** pasan a dos líneas. `97b8920`

### BV-10 — Admin, editor de lecciones: el scroll suave ignora movimiento reducido

- **Severidad:** Baja · **Prueba:** 5 · **Detectó:** revisión de código
- **Causa:** `scrollIntoView({ behavior: "smooth" })` desde JS no respeta el `scroll-behavior` de la regla global.
- **Arreglo:** consulta `prefers-reduced-motion`. `1504987`

### BV-11 — Descargas que solo se indican con un ícono girando

- **Severidad:** Baja · **Prueba:** 5 · **Detectó:** revisión de código
- **Causa:** con movimiento reducido el ícono queda quieto y no explica nada (adjuntos de comunidad, recursos de la clase).
- **Arreglo:** texto "Preparando la descarga…" y `aria-label` "Descargando…". `1504987`

### BV-12 — Beneficios incluidos y no incluidos solo se distinguen por el color

- **Severidad:** Media · **Prueba:** 6 · **Detectó:** revisión de código (portada, Planes, pago)
- **Causa:** el mismo guion (o el mismo chulo, en el pago) con otro color.
- **Arreglo:** chulo o X, tachado y "(no incluido)" para lector de pantalla; un solo componente `BeneficioPlan`. `383e92f`

### BV-13 — Filtro activo de Mis cursos casi invisible

- **Severidad:** Baja · **Prueba:** 6 y 4 · **Detectó:** revisión de código
- **Causa:** el activo solo cambiaba a un gris apenas distinto del fondo.
- **Arreglo:** relleno invertido, como los filtros del catálogo. `383e92f`

### BV-14 — Textos informativos por debajo de AA por la opacidad

- **Severidad:** Media · **Prueba:** 7 · **Detectó:** revisión de código
- **Causa:** `opacity-45` / `opacity-50` sobre el token de texto ("No se renueva solo" en Planes, "Clase X de Y" en la vista previa); el test de tokens no mide la opacidad. La casilla usaba tokens de shadcn con borde de error ~2,3:1 en oscuro.
- **Arreglo:** tokens `uva-*` sin opacidad. `383e92f`

### BV-15 — Clase: con zoom al 200 % no hay temario ni forma de salir

- **Severidad:** Bloqueante · **Prueba:** 1 · **Detectó:** prueba manual del usuario (PC, estudiante)
- **Causa:** a 640×450 px CSS se cumple la variante `apaisado` (pensada para el celular girado), que oculta el encabezado con "volver al curso" y el botón del temario.
- **Arreglo:** el encabezado se oculta solo en táctil (`pointer-coarse`). `f029dc3`

### BV-16 — Examen: "Toca tu respuesta" ocupa mucho alto con zoom al 200 %

- **Severidad:** Media · **Prueba:** 1 · **Detectó:** prueba manual del usuario (PC, estudiante)
- **Causa:** la barra inferior es fija (`sticky`) también cuando solo muestra la indicación: ~90 de 450 px.
- **Arreglo:** solo queda fija con un botón (Comprobar, Siguiente) o un error. `f029dc3`

### BV-18 — Portada, "Entra con una invitación": texto y botones se salen del recuadro

- **Severidad:** Media · **Prueba:** 2 · **Detectó:** prueba manual del usuario (letra al 150 %, 375 px)
- **Causa:** grilla sin columnas en celular (como BV-01): creció hasta el botón más ancho.
- **Arreglo:** `grid-cols-1` y botones que parten su texto.
- **Capturas:** [antes](baja-vision/BV-18-acceso-invitacion-abajo-antes.png) · [después](baja-vision/BV-18-acceso-invitacion-abajo-despues.png)

### BV-19 — Menú ☰: "Claro / Oscuro / Sistema" se salen de sus botones

- **Severidad:** Media · **Prueba:** 2 · **Detectó:** prueba manual del usuario (letra al 150 %, 375 px)
- **Causa:** tres columnas fijas; ocultaba los íconos con una media query en px (`max-[359px]`), que no reacciona a la letra agrandada.
- **Arreglo:** una columna solo con la letra agrandada (`max-[20rem]`).
- **Capturas:** [antes](baja-vision/BV-19-menu-tema-antes.png) · [después](baja-vision/BV-19-menu-tema-despues.png)

### BV-20 — Perfil en celular: el carné se sale y hay scroll horizontal

- **Severidad:** Alta · **Prueba:** 2 · **Detectó:** prueba manual del usuario (letra al 150 %, 375 px). El barrido no lo vio: excusaba todo lo que estuviera dentro de un contenedor con scroll propio, y el área principal del panel lo es.
- **Causa:** grilla sin columnas en celular (como BV-01).
- **Arreglo:** `grid-cols-1`. El barrido ahora solo excusa contenedores con scroll de menos de media pantalla (pestañas, tablas).
- **Capturas:** [antes](baja-vision/BV-20-perfil-antes.png) · [después](baja-vision/BV-20-perfil-despues.png)

### BV-21 — Barra inferior del panel a 768 px: los rótulos se montan

- **Severidad:** Media · **Prueba:** 2 · **Detectó:** prueba manual del usuario (letra al 200 %, 768 px)
- **Causa:** ancho máximo en px (`max-w-[440px]`) con rótulos en rem.
- **Arreglo:** ancho máximo en rem.
- **Capturas:** [antes](baja-vision/BV-21-barra-inferior-768-antes.png) · [después](baja-vision/BV-21-barra-inferior-768-despues.png)

### BV-22 — Inicio del panel: la lista de categorías se sale 48 px

- **Severidad:** Media · **Prueba:** 2 · **Detectó:** barrido, tras corregir el hueco de BV-20 (letra al 150 %, 375 px)
- **Causa:** grilla sin columnas en celular (como BV-01). Al arreglarla apareció una superposición: el nombre ("Arquitectónica") se montaba sobre "2 cursos".
- **Arreglo:** `grid-cols-1`, y con la letra agrandada el contador baja de renglón.
- **Capturas:** [antes](baja-vision/BV-22-categorias-inicio-panel-antes.png) · [después](baja-vision/BV-22-categorias-inicio-panel-despues.png)

### BV-23 — Perfil: "Sesión", "Tus datos" y "Eliminar cuenta" se salen 172 px

- **Severidad:** Alta · **Prueba:** 2 y 3 · **Detectó:** barrido, tras corregir el hueco de BV-20 (letra al 150 % y espaciado, 375 px)
- **Causa:** el botón "Cerrar sesión en todos los dispositivos" no parte su texto y los bloques del perfil son grillas sin columnas.
- **Arreglo:** `grid-cols-1` en `CLASE_BLOQUE_PERFIL` (cubre todos los bloques) y botones que parten su texto.
- **Capturas:** [antes](baja-vision/BV-23-perfil-sesion-antes.png) · [después](baja-vision/BV-23-perfil-sesion-despues.png)

## Recortes aceptados (no son fallas)

El barrido los anota como `recortado` (terminan en "…"): descripciones
resumidas de cursos y categorías (completas en su ficha), el nombre de la
siguiente clase (completo en el temario), títulos en los paneles de resumen
del admin (completos en la tabla de la misma pantalla y en `title`) y el
nombre de autor en comunidad.
