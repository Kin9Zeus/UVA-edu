# Prompt para Claude Code — Panel Administrativo de U.V.A.

Copia todo lo que sigue (desde "Construye…") y pégalo en Claude Code, en VS Code.

---

Construye el **panel administrativo** de U.V.A., una plataforma de formación para el gremio de la construcción en LATAM (arquitectos, residentes de obra, presupuestadores, coordinadores BIM). Lo usan administradores internos (no estudiantes) para gestionar cursos, usuarios, categorías e instructores.

Entrega archivos separados por lenguaje, sin build ni dependencias, que se abran con doble clic:

```
admin.html
css/admin.css
js/admin.js
```

## Sistema visual (obligatorio)

Modo oscuro, variables CSS en `:root`, nada de valores sueltos fuera de ellas.

| Rol | Valor |
| --- | --- |
| Fondo principal | `#09090B` (degradado `linear-gradient(168deg,#101013 0%,#09090B 52%,#09090B 100%)`, fijo) |
| Superficie / tarjetas | `#18181B` |
| Superficie secundaria | `#141417` |
| Bordes y separadores | `#27272A` |
| Texto primario | `#FAFAFA` |
| Texto secundario | `#A1A1AA` |
| Texto terciario | `#71717A` / `#52525B` |
| Acento de marca | `#FF007A` (fucsia) |
| Acento secundario | `#F2C012` (amarillo vial), tinte claro `#FFDD55` |
| Éxito / advertencia / error | `#10B981` / `#F59E0B` / `#EF4444` (fondos al 16% de opacidad, texto en su tinte claro) |

Tipografía (Google Fonts): **Plus Jakarta Sans** 700 para títulos, **Inter** 400–600 para cuerpo, **JetBrains Mono** para métricas/códigos/duraciones (`font-variant-numeric: tabular-nums`).

Radio de esquina uniforme de **10px** en tarjetas, botones, inputs, badges (excepto avatares y switches, que son circulares). Iconos SVG en línea, trazo fino (`stroke-width:1.9`), nunca de fuente de iconos.

## Estructura

Layout de dos columnas: sidebar fija a la izquierda (colapsable a solo iconos) + contenido a la derecha con header propio (sticky, con blur).

### Sidebar

- Marca `U.V.A.` + etiqueta `ADMIN` en mono.
- Navegación: **Dashboard, Cursos, Usuarios, Categorías, Instructores, Configuración**. Ítem activo con fondo `#18181B` y texto blanco; el resto en gris con hover que aclara a `#1C1C20`.
- Al pie: "Cerrar sesión" (redirige a la página del home público, ej. `home.html`).

### Header de contenido

Título de la sección + buscador (solo en Cursos/Usuarios) + menú de perfil del admin (avatar, nombre, desplegable con Ver perfil / Configuración / Cerrar sesión).

### Dashboard

- 4 tarjetas de métricas: Usuarios registrados, Cursos publicados, Cursos en borrador, Inscripciones (valor grande en mono + variación).
- Dos columnas: **Actividad reciente** (lista con punto de color + texto + tiempo relativo) y **Cursos más populares** (tabla: curso, categoría, estudiantes, % finalización, estado).

### Cursos (listado)

- Filtros: categoría, estado (Publicado/Borrador/Archivado), nivel (Básico/Intermedio/Avanzado). Botón "+ Crear curso".
- Tabla: curso (clic abre detalle), categoría, nivel, estudiantes, estado (badge), fecha de creación, menú `⋯` con Ver/Editar, Publicar o Despublicar, Eliminar (con confirmación).

### Crear curso

Formulario de un paso: nombre, descripción, imagen (zona de arrastre — usa un marcador con trama diagonal, sin imagen real), categoría, nivel, instructor (select). Botones "Guardar como borrador" y "Publicar curso".

### Detalle de curso — 4 pestañas

1. **Información** — nombre, descripción, categoría, nivel (editable), botón Guardar.
2. **Contenido** — lista de módulos, cada uno una tarjeta arrastrable (drag & drop para reordenar, con `draggable`, `dragstart/dragover/drop`) que contiene sus lecciones, también reordenables por arrastre dentro del módulo. Cada módulo tiene botón "Eliminar" (con confirmación, borra sus lecciones) y "+ Añadir lección" (crea una lección real y abre su editor). Cada lección tiene un botón "✕" para eliminarla (con confirmación) y, al hacer clic en su nombre, abre un editor lateral (nombre, tipo de contenido, input de archivo para el video, duración, input de archivo para material adicional, botón Guardar). Botón "+ Módulo" arriba de la lista crea un módulo real.
3. **Estudiantes** — tabla de inscritos a ese curso: avatar, nombre (clic va al detalle del usuario), progreso (barra), estado (En progreso/Completado), modo de obtención (Membresía/Cortesía). Filtros: buscar por nombre, por acceso (Membresía/Cortesía) y por estado (En progreso/Completado).
4. **Configuración** — switches "Curso visible" y "Curso destacado", campo de orden de visualización, botón Guardar.

### Usuarios (listado)

- Filtros: rol (Estudiante/Administrador), estado de cuenta (Activo/Suspendido), estado de suscripción (Activa/Pago pendiente/Vencida/Cancelada).
- Tabla: avatar, nombre (clic abre detalle), email, rol, cursos inscritos, estado de cuenta (badge), suscripción (badge), fecha de registro, botón Suspender/Activar.

### Detalle de usuario

- Encabezado: avatar grande, nombre, email · rol. Tres badges **con etiqueta explícita** para evitar confusión entre estados similares: "Cuenta: Activo/Suspendido", "Suscripción: Activa/Pago pendiente/Vencida/Cancelada", "Plan: Basic/Expert/Expert Duo".
- Dos botones de acción:
  - **Otorgar membresía** — abre un modal con los planes disponibles (Basic mensual $59.900, Expert anual $449.900, Expert Duo anual $749.900); al elegir uno pide **confirmación** mostrando el plan actual del usuario, y al confirmar actualiza su plan y pone la suscripción en Activa.
  - **Ofrecer curso de cortesía** — abre un modal con la lista de cursos existentes; al elegir uno pide **confirmación** antes de otorgarlo. El curso se añade a su lista con modo de obtención "Cortesía".
- 4 tarjetas de métricas: cursos inscritos, completados, progreso promedio, última actividad.
- Tabla "Cursos del usuario": curso, progreso (barra), estado, **modo de obtención** (badge Membresía/Cortesía), última actividad, y — solo en los cursos obtenidos por cortesía — un botón "Quitar cortesía" que pide confirmación antes de retirar el acceso.

### Categorías

Tabla: nombre, descripción, número de cursos, **creado por** (nombre del admin), switch de activa/inactiva, botones Editar / Eliminar (con confirmación). Botón "+ Nueva categoría" abre un modal con nombre y descripción.

Usa categorías del dominio de arquitectura/construcción: Presupuestos y Costos, Software y BIM, Construcción y Obra, Normativa y Legal — nunca categorías genéricas de programación.

### Instructores

Tabla: avatar, nombre (clic abre modal con la lista de cursos que ha creado y su estado), especialidad, número de cursos, número de estudiantes, creado por. Botón "+ Nuevo instructor".

### Configuración

Tres tarjetas: perfil del administrador (nombre, email, avatar), datos de la plataforma (nombre, descripción), seguridad (cambiar contraseña, botón de cerrar sesión).

## Datos mock (arquitectura/construcción, no genéricos)

Cursos de ejemplo: "Fundamentos de presupuesto de obra", "Análisis de Precios Unitarios (APU)", "Licitaciones públicas de construcción", "Revit para arquitectura", "Lectura de planos estructurales", "Excel para presupuestadores". Instructores: Mariana Ospina, Julián Salcedo, Lucía Restrepo, Diana Cortés. Usuarios de ejemplo con nombres latinos y roles Estudiante/Administrador.

## Comportamiento (`js/admin.js`)

- Sin frameworks; JavaScript plano con estado en memoria (objeto simple) y `addEventListener`/delegación de eventos. Re-renderiza solo lo necesario o usa `innerHTML` con datos vinculados; no hace falta un framework reactivo.
- Todas las confirmaciones (eliminar curso/módulo/lección/categoría, otorgar membresía, ofrecer u quitar cortesía) usan un mismo modal genérico de confirmación (título + cuerpo + Cancelar/Confirmar).
- Los toasts de confirmación aparecen abajo a la derecha y se ocultan solos a los ~2,5s.
- El drag & drop de módulos y lecciones reordena el array en memoria y renumera el campo "orden".

## Responsive

Sidebar de ancho fijo (236px, colapsable a 76px con solo iconos); contenido con `max-width:1360px` y márgenes fluidas `clamp(20px,3vw,36px)`. Tablas con scroll horizontal en pantallas angostas si es necesario.

## Accesibilidad

- HTML semántico (`aside`, `header`, `main`, `nav`, `table`); un `h1`/`h2` por vista.
- `aria-label` en botones solo-icono; foco visible con outline de 2px en el acento fucsia.
- Contraste AA en todo el texto. Nada de emojis. Texto en español.
