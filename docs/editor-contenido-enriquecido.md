# Editor de contenido enriquecido (lecciones) — MVP

Editor Tiptap para que el instructor escriba el contenido teórico/resumen de
una lección con formato enriquecido, y su renderer correspondiente para el
estudiante. Reemplaza al `<Textarea>` de texto plano que existía en el panel
admin. Implementado 2026-09-04.

---

## 1. Qué se implementó (MVP)

**Formato de texto:** negrita, cursiva, subrayado, tachado, código en línea.
**Estructura:** encabezados H1/H2/H3, párrafos, cita, separador.
**Listas:** con viñetas, numeradas, de tareas (checklist).
**Bloques:** código (`<pre><code>`).
**Enlaces:** inserción/edición vía diálogo, con validación de protocolo
(`http:`, `https:`, `mailto:` — nunca `javascript:`/`data:`).
**Edición:** deshacer/rehacer, atajos de teclado nativos de Tiptap
(`Ctrl+B`, `Ctrl+I`, etc.), placeholder, pegado limpio (el esquema de
ProseMirror descarta por sí solo cualquier HTML/atributo que no reconoce —
scripts, estilos inline, clases — sin necesidad de un sanitizador aparte).
**Toolbar:** agrupada por función, con estado activo/presionado visible en
cada botón (negrita, encabezado actual, etc.), iconos Lucide del proyecto.
**Guardado:** integrado al botón único "Guardar cambios" del panel de
lección existente (mismo dirty-state y aviso de `beforeunload` que ya tenían
título/duración/video — sin autosave, a propósito, ver §5.4).
**Compatibilidad con datos viejos:** una lección sembrada/editada antes de
este cambio (con `resumen` en texto plano) se sigue mostrando igual, y el
instructor la ve ya cargada como un párrafo en el editor la primera vez que
abre esa lección — sin migración de datos ni script de backfill.
**Seguridad:** el JSON se valida contra un whitelist estricto de
nodos/marcas en el servidor (no solo en el cliente), con límite de tamaño;
la lectura sigue detrás de las mismas RLS/`requireAdmin()` que ya protegían
`resumen`.

**Explícitamente fuera de este MVP** (ver §6): imágenes, tablas, callouts
(recuadros info/advertencia/ejemplo/éxito), fórmulas LaTeX/KaTeX, embeds.

---

## 2. Modelo de datos

```
lecciones
---------
...
resumen    TEXT   -- legado, ya NO se escribe desde la app. Solo lectura,
                   -- como respaldo de lo sembrado/editado antes de este cambio.
contenido  JSONB  -- documento Tiptap/ProseMirror. Fuente de verdad.
```

Migración: `prisma/migrations/20260904000000_agrega_contenido_lecciones/`.
Escrita a mano y aplicada con `prisma migrate deploy` (no `migrate dev`): este
proyecto no puede usar el diffing automático de Prisma por el FK de
`perfiles` hacia `auth.users` (P4002, documentado también en
`20260825010000_agrega_slug_a_categorias`). Sin cambios de RLS: la policy de
tabla `lecciones_admin_escritura` ya cubre la columna nueva.

`resolverContenidoLeccion(contenido, resumen)` (`src/lib/editor/tipos.ts`) es
la única función que decide qué se muestra: `contenido` si existe y no está
vacío; si no, `resumen` convertido a un documento de un párrafo; si no,
`null`. La usan **los tres** puntos de lectura (panel admin, reproductor,
vista previa pública) — no hay lógica de fallback duplicada.

---

## 3. Arquitectura de archivos

```
src/lib/editor/
  tipos.ts        Tipos + z.ZodType del documento, contenidoEstaVacio(),
                   resumenLegadoComoContenido(), resolverContenidoLeccion(),
                   TAMANO_MAXIMO_CONTENIDO (20 000 caracteres serializados).
  seguridad.ts     esUrlSegura() — allowlist de protocolos de enlace,
                   compartida entre el editor (Link.validate) y el renderer.

src/components/editor/
  RichTextEditor.tsx    Wrapper de useEditor/EditorContent (StarterKit +
                        TaskList/TaskItem/Placeholder). Props:
                        initialContent, onChange, editable, placeholder,
                        disabled. No sabe nada de "lecciones" — reutilizable.
  RichTextToolbar.tsx   Botones agrupados + diálogo de enlace (shadcn
                        Dialog/DropdownMenu). Usa useEditorState de Tiptap
                        para el estado activo/pressed reactivo.
  RichTextRenderer.tsx  Camina el JSON a mano y emite JSX por tipo de nodo/
                        marca — NUNCA dangerouslySetInnerHTML. Un tipo no
                        reconocido se ignora, no rompe el render. No es
                        "use client": puede vivir en un Server Component.
```

Integraciones existentes que se tocaron (sin arquitectura paralela):
`LeccionEditorPanel.tsx` (admin), `cursoDetalle.ts`/`resolverVistaPrevia.ts`/
`lib/leccion.ts` (lectura), `PlayerTabs.tsx`/`PlayerContent.tsx`/
`LeccionVistaPreviaContent.tsx` (render), `actions/admin/cursos.ts`
(`actualizarLeccion`, validación + guardado).

---

## 4. Flujo de guardado

```
RichTextEditor.onUpdate
  → JSON.parse(JSON.stringify(editor.getJSON()))     (*)
  → onChange (setContenido en LeccionEditorPanel, estado local)
  → clic "Guardar cambios"
  → actualizarLeccion(leccionId, cursoId, { titulo, contenido })
      1. requireAdmin()                    — sesión + rol ADMINISTRADOR
      2. límite de tamaño (JSON.stringify)
      3. contenidoLeccionSchema.safeParse  — whitelist de nodos/marcas
      4. contenidoEstaVacio() → null si el doc quedó vacío
      5. UPDATE lecciones SET contenido = ...  (RLS de sesión, no service role)
```

**(\*) Gotcha documentado — no lo repitas:** pasar `editor.getJSON()`
directo a un Server Action falla. ProseMirror comparte/congela los objetos
`attrs` de los nodos (p. ej. `{level: 2}` de un encabezado), y ese objeto en
particular no cruza limpio la frontera de serialización de un Server Action
de Next.js: el servidor termina recibiendo `attrs` como una función en vez
de como el objeto plano, y la validación Zod lo rechaza con "Invalid input"
sin que el cliente muestre nada útil. La solución es clonar a JSON puro
(`JSON.parse(JSON.stringify(...))`) antes de guardarlo en estado, como ya
hace `RichTextEditor.tsx`. Si en el futuro se agrega otro punto que llame a
`editor.getJSON()` para mandarlo a un Server Action (por ejemplo, un
autosave), hay que repetir este mismo clon ahí.

---

## 5. Cómo extender

### 5.1 Agregar una herramienta nueva a la toolbar
1. Si la extensión ya viene en `@tiptap/starter-kit` (bold, italic, link,
   heading, listas, blockquote, codeBlock, hr...), no hay que instalar nada:
   solo agregar el botón en `RichTextToolbar.tsx` llamando al comando de
   Tiptap correspondiente (`editor.chain().focus().toggleX().run()`).
2. Si es una extensión nueva de Tiptap (como `TaskList`/`TaskItem`), instalar
   el paquete `@tiptap/extension-*` **a la misma versión exacta** que el
   resto (`3.31.3` al momento de escribir esto — revisar
   `package.json`), añadirla al array `extensions` de `RichTextEditor.tsx`.
3. **Actualizar `contenidoLeccionSchema` en `src/lib/editor/tipos.ts`** para
   aceptar el/los tipo(s) de nodo/marca nuevos — si no, el guardado falla
   con el whitelist aunque el editor y el botón funcionen perfecto (el
   error se ve igual al del §4: revisar `parseo.error.issues` con un
   `console.error`/debug temporal si vuelve a pasar).
4. **Agregar el caso correspondiente en `RichTextRenderer.tsx`** — si no, el
   contenido se guarda bien pero el estudiante nunca lo ve (el nodo
   desconocido se ignora en silencio, por diseño de seguridad).

### 5.2 Agregar un nodo custom de Tiptap (ej. un callout)
Ver §6.1 para el plan concreto de callouts — el patrón general es: (a)
extensión de nodo de Tiptap con `NodeViewRenderer` en React para la vista de
edición, (b) entrada en `contenidoLeccionSchema` con sus `attrs` propios
(p. ej. `variant: "info"|"warning"|...`), (c) caso en
`RichTextRenderer.tsx` que dibuje el recuadro con los tokens de diseño de
`CLAUDE.md` (nunca colores hardcodeados).

### 5.3 Cambiar el límite de tamaño del contenido
`TAMANO_MAXIMO_CONTENIDO` en `src/lib/editor/tipos.ts` (hoy 20 000
caracteres serializados — un margen generoso sobre el límite viejo de 2000
caracteres de `resumen`, pensado para texto con formato, no para adjuntar
archivos).

### 5.4 Por qué no hay autosave
Decisión explícita tomada con el usuario antes de implementar: mantener el
mismo patrón de guardado manual con botón único que ya tenía el panel de
lección (título + duración + video + contenido, un solo "Guardar cambios",
un solo dirty-state, un solo aviso de `beforeunload`). Si se agrega autosave
en el futuro, debe ser software nuevo y aislado (debounce + indicador
Guardando/Guardado/Error), no una mezcla con el botón manual existente — y
hay que replicar el clon `JSON.parse(JSON.stringify(...))` del §4 en ese
nuevo punto de guardado.

---

## 6. Qué falta para una versión más avanzada

Todo lo siguiente fue **deliberadamente pospuesto** para esta primera
entrega (decisión tomada con el usuario: "MVP por fases"), no olvidado.
Orden sugerido por dependencia/impacto, no por dificultad.

### 6.1 Callouts (recuadros Info/Advertencia/Ejemplo/Éxito)
Nodo custom de Tiptap (`{"type":"callout","attrs":{"variant":"info"},
"content":[...]}`), botón de toolbar con submenú de variante, estilos con
los tokens de `CLAUDE.md` (nunca colores hardcodeados). Es la pieza de menor
esfuerzo de las que quedan pendientes — no depende de Storage ni de
librerías externas.

### 6.2 Imágenes
Decisión ya tomada con el usuario para cuando se implemente: **bucket
privado de Supabase Storage + URL firmada** (igual patrón de intención que
`materiales-lecciones`, no el de `portadas-cursos` público) — porque el
contenido de una lección normal solo debe ser visible a quien tiene acceso
al curso, y un bucket público filtraría imágenes de cursos no comprados a
cualquiera con el link. Falta:
- Migración del bucket + policies (`insert`/`select`/`delete` admin-only,
  siguiendo `011_bucket_materiales_lecciones.sql`).
- Server Action de subida con validación de magic bytes (`sharp`/`file-type`,
  como `procesarPortada`/`procesarRecurso`), reencode a WebP, nombre
  aleatorio, límite de tamaño.
- Firmar la URL en el servidor al renderizar (`RichTextRenderer` pasaría a
  necesitar ser `async`/Server Component en ese punto, o recibir las URLs ya
  resueltas) — hoy no existe en el proyecto ningún punto que sirva un
  archivo privado de Storage a un estudiante con URL firmada; este sería el
  primero, y hay que decidir el tiempo de expiración de la firma.
- Rate limit de subida (reusar el patrón RPC de
  `022_rate_limit_login_y_recuperacion.sql`).
- Definir cuántas imágenes por comentario/lección para el primer alcance
  (pregunta que quedó abierta y sin responder en la conversación de diseño).

### 6.3 Tablas
`@tiptap/extension-table` (+ `table-row`/`table-cell`/`table-header`).
Insertar/agregar/eliminar fila y columna, encabezados. Requiere decidir el
comportamiento responsive en mobile (scroll horizontal propio, como ya hacen
otras tablas del panel admin — ver `components/ui/table.tsx`).

### 6.4 Fórmulas matemáticas (LaTeX/KaTeX)
Nodo custom de Tiptap + diálogo modal para escribir/editar el LaTeX +
render con KaTeX. Cargar KaTeX (CSS + fuentes) solo de forma perezosa,
condicionado a que el contenido realmente tenga un nodo de fórmula — no
agregarlo al bundle general del panel admin ni del reproductor. Manejar
errores de parseo de LaTeX sin romper el editor (mostrar el LaTeX crudo con
un aviso en vez de tirar una excepción).

### 6.5 Autosave
Ver §5.4 — pospuesto a propósito, no técnicamente complejo pero es una
decisión de UX que hay que tomar aparte (¿reemplaza el botón manual o
convive con él? ¿Debounce de cuántos segundos?).

### 6.6 Tests automatizados
El proyecto usa Vitest (`src/lib/*.test.ts` como ejemplo) pero esta feature
no tiene tests todavía. Lo más valioso para agregar primero, en este orden:
1. `contenidoLeccionSchema` — nodos válidos/inválidos, el caso límite de
   `attrs` ausente vs. `attrs` con tipo equivocado (el bug del §4 hubiera
   aparecido antes con un test de "documento real de Tiptap → Server Action
   → validación", no solo un test aislado del schema).
2. `resolverContenidoLeccion`/`resumenLegadoComoContenido` — casos de
   `contenido` vacío, `resumen` con varios párrafos, ambos `null`.
3. `esUrlSegura` — protocolos peligrosos, URLs relativas, mayúsculas
   (`JAVASCRIPT:`), espacios en blanco alrededor.
4. `RichTextRenderer` — snapshot o assertions de que un nodo desconocido no
   rompe el render y que un `href` inseguro nunca llega al DOM como enlace.

### 6.7 Embeds / archivos descargables / contenido interactivo
Mencionados en la conversación original como visión a futuro (video
embebido, PDFs, tarjetas, galerías, cuestionarios). Ninguno tiene diseño
concreto todavía — la arquitectura basada en nodos/extensiones de Tiptap ya
deja el camino abierto (mismo patrón que callouts/tablas/fórmulas), pero
cada uno necesita su propia decisión de producto antes de construirse.

### 6.8 Accesibilidad y responsive — pulido pendiente
La toolbar y el editor son navegables por teclado y tienen `aria-label`/
`aria-pressed` en los botones (heredado del mismo patrón ya usado en la
toolbar de comentarios), pero no se hizo una auditoría WCAG 2.2 AA formal
de este componente en particular, ni una revisión dedicada de la toolbar en
viewport angosto (hoy solo se apoya en `flex-wrap`).

---

## 7. Comandos ejecutados / verificación

```bash
npx prisma migrate deploy       # aplicó 20260904000000_agrega_contenido_lecciones
npx prisma generate
npm install @tiptap/react@3.31.3 @tiptap/core@3.31.3 @tiptap/pm@3.31.3 \
  @tiptap/starter-kit@3.31.3 @tiptap/extension-placeholder@3.31.3 \
  @tiptap/extension-task-item@3.31.3 @tiptap/extension-task-list@3.31.3
npx tsc --noEmit -p .           # sin errores
npx eslint <archivos tocados>   # sin errores
npm run build                   # build de producción exitoso
```

Verificado en vivo (navegador, sesión `admin@uva.test`): editar una lección
real → escribir con encabezado/texto → Guardar cambios → confirmado en
Postgres vía SQL (`lecciones.contenido` con el JSON esperado y
`actualizado_en` actualizado) → visible correctamente en la pestaña Resumen
del reproductor del estudiante. Datos de prueba limpiados después de
verificar (`contenido` vuelto a `null` en la lección usada para la prueba).
