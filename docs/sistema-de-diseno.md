# Sistema de diseño de U.V.A

Guía para construir una pantalla nueva coherente con el resto sin preguntar. Las **reglas** están en `CLAUDE.md` (3.2 a 3.4); aquí está el **cómo**: qué token y qué componente usar en cada caso.

- **Fuente de verdad de los valores:** `src/app/globals.css`. Si este documento y el CSS no coinciden, manda el CSS y se corrige este documento.
- **Catálogo vivo:** `npm run dev` y abre `/dev/componentes` (solo en desarrollo). Ahí está cada componente con sus estados, en los dos temas.
- **Dirección visual:** «Maqueta». La UI en producción ya se aparta a propósito de `design-spec/`: para una pantalla existente, la referencia es la UI actual.

## 1. Cómo hacer una pantalla nueva

1. **Busca una pantalla parecida** y copia su estructura: lista con filtros (`/dashboard/progreso`), detalle (`CursoFicha`), formulario (`PerfilForm`), panel admin (`/admin/cursos`), paso de acceso (`AccesoMarco` + `PasoAcceso`).
2. **Móvil primero (375 px)** y luego amplía. Los puntos de quiebre (640/768/1024/1280) solo cambian la disposición, nunca el tamaño de letra.
3. **Solo tokens:** nada de `#hex`, `text-[17px]` ni `rounded-xl`. Si falta un token, se agrega en `globals.css` (con su par claro/oscuro y su contraste en `docs/contrastes.md`), no se escribe suelto.
4. **Los cuatro estados:** cargando (`loading.tsx` con `Skeleton`), vacío (`EstadoVacio`), error (`lanzarSiFalla` → `error.tsx`) y con datos.
5. **Verifica:** `npm run audit:overflow` (320 a 2560 px), los dos temas, teclado, y la lista del piso de calidad (CLAUDE.md 3.4).

## 2. Tokens

### 2.1 Color

Se usan como clases de Tailwind: `bg-uva-surface`, `text-uva-text-muted`, `border-uva-line-strong`… El tema oscuro es el de defecto (clase `.dark` en `<html>`); cada token cambia solo, no escribas `dark:`.

| Para qué | Token | Claro | Oscuro |
| --- | --- | --- | --- |
| Fondo de la página | `uva-bg` | `#F4F4F5` | `#09090B` |
| Tarjetas, paneles, barras | `uva-surface` | `#FFFFFF` | `#18181B` |
| Bloque hundido dentro de una tarjeta | `uva-surface-2` | `#E9E9EC` | `#0D0D10` |
| Texto principal | `uva-text` | `#18181B` | `#FAFAFA` |
| Texto de apoyo (AA) | `uva-text-muted` | 70 % del texto | 60 % del texto |
| Separador decorativo | `uva-divider` | `#E4E4E7` | `#27272A` |
| Borde de un control (campo, select, casilla) | `uva-line-strong` | `#8A8A93` | `#71717A` |
| Hover de filas y botones neutros | `uva-hover` | `#F4F4F5` | `#1C1C20` |
| Fondo de un modal | `uva-overlay` | — | — |

**Acento (magenta).** Solo para la acción principal, el estado activo y el progreso. Nunca decorativo.

| Para qué | Token |
| --- | --- |
| Relleno de un botón principal (letra blanca, AA) | `uva-btn` (`#CC006D` / hover `uva-btn-hover`) |
| Detalles: barra de progreso, punto activo, borde de foco | `uva-accent` (`#FF007A`) |
| Texto o ícono en magenta sobre fondo normal | `uva-accent-ink` (en claro baja a `#C2005B`) |
| Texto sobre `uva-accent-soft` (ítem activo de un menú) | `uva-accent-text` |
| Fondo suave de lo activo | `uva-accent-soft` |
| Letra sobre el magenta | `uva-on-accent` (blanco en los dos temas) |

**Amarillo de marca:** `uva-accent-2` (`#FFC400`); como texto, `uva-accent-2-text`.

**Estados:** `uva-error` / `-soft` / `-text`, `uva-warning` / `-soft` / `-text`, `uva-valid` / `-soft`. **Insignias:** `uva-badge-{success,warn,danger,neutral}-{bg,fg}` (los pares ya están medidos para AA). **Gráficos:** `uva-serie-1…5`; categorías, `uva-pair-1…6` con su `-soft`.

No uses negro puro, ni los tokens de shadcn (`bg-primary`, `text-muted-foreground`): existen solo para que los componentes base compilen.

### 2.2 Tipografía

`Plus Jakarta Sans` en todo; `font-mono` es la misma Jakarta con números de ancho fijo (cifras, contadores). `JetBrains Mono` (`font-codigo`) solo para códigos de invitación, cupones, folios y enlaces.

Cada token trae su interlineado, espaciado y peso: no agregues `font-bold` ni `leading-*` encima salvo que haga falta.

| Token | Tamaño (360 → 1440 px) | Para qué |
| --- | --- | --- |
| `text-uva-display` | 48 → 88 | Solo el titular de la portada |
| `text-uva-titulo-1` | 32 → 72 | Titular de una página pública |
| `text-uva-titulo-2` | 28 → 56 | Título de sección pública |
| `text-uva-titulo-3` | 22 → 34 | `<h1>` de una pantalla del panel |
| `text-uva-titulo-4` | 18 → 22 | Título de tarjeta o de bloque |
| `text-uva-lead` | 16 → 18 | Párrafo de entrada bajo un título |
| `text-uva-cuerpo` | 16 | Texto de lectura y botones grandes |
| `text-uva-detalle` | 13 → 14 | Metadatos, ayudas, tablas |
| `text-uva-etiqueta` | 12 | Rótulos cortos (barra inferior, insignias) |

Ningún texto de lectura baja de 16 px en celular. Los campos de formulario van en 16 px (`text-base`) para que el iPhone no haga zoom.

### 2.3 Espacio, ancho, radios y sombras

- **Margen lateral de página:** `px-uva-margen` (20 → 56). **Separación entre secciones públicas:** `py-uva-seccion` (56 → 112). **Ancho máximo:** `max-w-uva` (1440 px), centrado con `mx-auto`.
- **Radios:** `rounded-uva-xs` (4), `-sm` (8), `-md` (10, botones, tarjetas y campos), `-lg` (16, hojas y tarjetas grandes). `rounded-full` solo para píldoras, avatares e insignias.
- **Sombras:** lo que está en el flujo de la página **no lleva sombra** (lo separa el borde). `shadow-uva-menu` para menús, selects, tooltips y notificaciones; `shadow-uva-flotante` para avisos y barras fijas encima del contenido; `shadow-uva-acento` para el único elemento destacado de una pantalla.
- **Variantes por altura de pantalla** (`globals.css`): `medio`, `bajo`, `muy-bajo`, `apaisado` (celular girado) y `escritorio-bajo`. Úsalas para recortar aire en pantallas bajas, no para cambiar el diseño.

## 3. Componentes base (`src/components/ui`)

Se importan desde `@/components/ui/<archivo>`. Están construidos sobre Base UI (no Radix): para menús y desplegables, usa estos y no los nativos del navegador.

| Componente | Úsalo para | No lo uses para |
| --- | --- | --- |
| `Button` | Toda acción. Con `render={<Link />}` y `nativeButton={false}` cuando navega | Navegación de texto dentro de un párrafo (usa `<Link>`) |
| `Campo` | Un campo con etiqueta, ayuda y error ya cableados (`aria-describedby`, `role="alert"`, mostrar contraseña) | Selects o áreas de texto (usa `Select` / `Textarea` con `Label`) |
| `Input`, `Textarea`, `Label`, `Checkbox`, `Switch` | Formularios donde `Campo` no alcanza | Dejar un campo sin etiqueta visible (el placeholder no es etiqueta) |
| `Select` | Elegir una opción de una lista | Dos o tres opciones visibles (usa botones con `aria-pressed` en un `role="group"`, como `FiltroCursos`) |
| `Dialog` | Una tarea que interrumpe (crear, editar, confirmar un borrado) | Información que cabe en la página |
| `ConfirmarEnLinea` | Borrar algo propio (comentario, reseña) sin abrir un modal | Acciones que sí se pueden deshacer |
| `DropdownMenu` | Menú de acciones o de cuenta | Navegación principal |
| `Tabs` | Vistas hermanas de la misma cosa | Pasos de un proceso |
| `Accordion` | Preguntas frecuentes, detalles opcionales | Contenido que todos necesitan leer |
| `Card` | Agrupar un bloque con borde | Envolver cada elemento de una lista (usa filas con `border-b`) |
| `Badge` | Estado o categoría corta (`nivel`, `categoria`, `bloqueada`, `completada`) | Texto largo o botones |
| `Avatar` | Foto o iniciales de una persona | Íconos |
| `Progress` | Avance de un curso o periodo | Carga indefinida (usa `Skeleton`) |
| `Skeleton` | `loading.tsx` y bloques que esperan datos | Un vacío o un error |
| `EstadoVacio` | Lista sin datos: qué falta y qué hacer, con una acción | Un fallo de carga (eso es `AvisoErrorCarga` o `error.tsx`) |
| `Table` | Datos tabulares del admin | Listas en celular (pásalas a filas apiladas bajo `md`) |
| `Tooltip` | Nombre de un botón de solo ícono en escritorio | Información que el táctil también necesita |
| `useAviso` (`toast.tsx`) | Confirmar que algo se guardó, avisar un error de una acción | Errores de un campo (van junto al campo) |
| `Separator` | Separar grupos dentro de un menú o panel | Separar secciones de una página (usa `border-t border-uva-divider`) |

### 3.1 Botones

| Variante | Cuándo |
| --- | --- |
| `primary` / `uva-primary` | La **única** acción principal de la pantalla (magenta con letra blanca). `uva-primary` ocupa todo el ancho por defecto: para un botón suelto, `className="w-auto"` |
| `default` / `uva-secondary` | Acciones secundarias |
| `ghost` / `uva-ghost` | Acciones terciarias o dentro de una barra |
| `destructive` | Borrar: borde neutro y texto rojo |
| `destructive-solid` | Solo el botón de confirmar un borrado |
| `link` | Una acción que se lee como enlace |
| `uva-icon` | Botón de solo ícono (lleva `aria-label` en español) |

Las variantes `uva-*` son las del sitio público y del acceso; las otras, las del panel y el admin. Tamaños: `default`, `sm`, `lg`, `uva`; de solo ícono, `icon` (44 px). En táctil, todo botón mide al menos 44 × 44 px; con mouse, 36. Con `cargando` el botón muestra su estado de carga y se desactiva.

## 4. Patrones de la app

| Necesidad | Qué usar | Dónde está |
| --- | --- | --- |
| Error de una consulta que es el contenido | `lanzarSiFalla(error, "modulo:accion")` → `error.tsx` con Reintentar | `src/lib/supabase/errores.ts` |
| Error de un dato secundario | Valor de reemplazo + `registrarSiFalla` | `src/lib/supabase/registrar.ts` |
| Aviso de error dentro de una sección | `AvisoErrorCarga` | `src/components/errores/` |
| Pantallas de error (404, 403, 500) | `.error-shell` | `design-spec-errores/README.md` |
| Barra inferior del celular | `BarraInferior`: 4 accesos fijos + «Más» | `src/components/dashboard/BarraInferior.tsx` |
| Encabezado de una pantalla de foco (clase, examen) | `EncabezadoCurso`: «Inicio» junto al logo y «← Volver» con texto | `src/components/curso/EncabezadoCurso.tsx` |
| Pasos de login, registro y canje | `AccesoMarco` + `PasoAcceso`; enlaces con `ACCESO_ENLACE` | `src/components/auth/` |
| Código pesado que no hace falta al cargar (reproductor, editor) | `useModuloDiferido`: se descarga con la intención de usarlo | `src/lib/useModuloDiferido.ts` |
| Tema claro u oscuro | `SelectorTemaBoton`; la preferencia vive en `localStorage` | `src/components/tema/SelectorTema.tsx`, `src/lib/tema.ts` |
| Cifras y funciones públicas | Solo desde `src/content/marketing.ts` y `src/lib/cifrasPublicas.ts` | — |
| Salto al contenido | `SaltarAlContenido` + `<main id="contenido" tabIndex={-1}>` | `src/components/SaltarAlContenido.tsx` |

## 5. Accesibilidad que el sistema ya resuelve (y cómo no romperla)

- **Foco:** los componentes usan `outline-hidden` + `focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-uva-accent`. Nunca pongas `outline-none` sin un `focus-visible` propio: borra el foco.
- **Íconos:** decorativos con `aria-hidden`; botones de solo ícono con `aria-label` en español.
- **Estado de un botón o filtro:** `aria-pressed` o `aria-current="page"`, nunca solo el color.
- **Nombre visible dentro del nombre accesible** (WCAG 2.5.3): si el botón dice «Inicio», su `aria-label` debe contener «inicio».
- **Movimiento:** las animaciones van con `motion-safe:` o respetan `prefers-reduced-motion`.
- **Contraste:** `npm run audit:contraste` regenera `docs/contrastes.md`, y `src/lib/diseno/contraste.test.ts` hace fallar la suite si un token baja de AA.

## 6. Herramientas

| Comando | Para qué |
| --- | --- |
| `npm run audit:overflow` | Scroll horizontal de 320 a 2560 px |
| `npm run audit:screenshots` | Capturas en 320, 375, 768, 1024, 1440 y 2560 px |
| `npm run audit:contraste` | Tabla de contraste de todos los pares de tokens |
| `npm run audit:lighthouse` | Lighthouse en móvil (Rendimiento se mide en el desplegado) |
| `npm run audit:cwv` | Core Web Vitals |
| `e2e/retroceso-visual.spec.ts` | Capturas de referencia en CI; un cambio visual intencional se actualiza con «actualizar_capturas» (`docs/qa/pruebas-visuales.md`) |
