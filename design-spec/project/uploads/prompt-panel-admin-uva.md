# Prompt para Claude Code — Panel Administrativo U.V.A (UI/UX, mock data)

> Pegar este prompt completo en la terminal del proyecto (`C:\Proyecto_U.V.A\UVA-edu`), rama `Miguel`.
> Referencias obligatorias antes de generar código: `technical-spec.md`, `functional-spec.md`, `development-plan.md` en la raíz del proyecto.

---

## 0. Contexto y restricciones (leer primero)

Estás trabajando sobre **U.V.A v2**, un LMS Next.js (App Router) + TypeScript + Tailwind + shadcn/ui, con identidad visual **Swiss Minimalist** (Magenta Neon `#FF007A` sobre Zinc 950 `#09090B`, tokens `uva-primary`, `uva-bg-primary`, `uva-bg-secondary`, `uva-border`, utilidad `shadow-neon`).

Reglas duras:
1. **No toques nada del frontend de estudiante** (`(public)`, `(student)`, `(auth)`). Cero cambios de estilos globales, layouts existentes, componentes compartidos que puedan alterar esas vistas.
2. Trabaja **exclusivamente** dentro del route group `src/app/(admin)/` conforme a la estructura ya definida en `technical-spec.md` §3.
3. Esta fase es **solo UI/UX con datos mock**. No conectar Supabase, no auth real, no RLS, no subida real de archivos, no persistencia real.
4. El código debe quedar **listo para swap a Supabase**: tipos y nombres de campo en los mocks deben coincidir 1:1 con el diccionario de datos de `technical-spec.md` §4 (español: `titulo`, `mostrado`, `orden`, `estado_procesamiento`, etc.), y las mutaciones deben simularse en funciones aisladas dentro de `src/actions/admin/` (aunque hoy solo muten un array en memoria/mock), para que después solo se reemplace el cuerpo de la función por la llamada real a Supabase — sin tocar los componentes que las consumen.
5. Reutiliza componentes base ya existentes en `src/components/ui/` (shadcn/ui) en vez de crear nuevos primitivos si ya existen.
6. Sigue la convención de alias `@/*`.

---

## 1. Layout del panel

Crear en `src/app/(admin)/layout.tsx`:

- **AdminSidebar** (`src/components/features/admin/AdminSidebar.tsx`)
  - Logo U.V.A.
  - Links: Dashboard, Cursos, Usuarios, Categorías, Estadísticas, Configuración.
  - Botón "Cerrar sesión" (visual, sin lógica real).
  - Colapsable en desktop/tablet (icono-only cuando está colapsado).
  - En mobile se convierte en drawer (overlay + trigger en el header).
- **AdminHeader** (`src/components/features/admin/AdminHeader.tsx`)
  - Título de la sección activa (recibido por prop o vía `usePathname`).
  - Buscador contextual (solo se muestra en las secciones que lo necesitan).
  - Icono de notificaciones (mock, con badge de conteo).
  - Avatar + nombre del admin + dropdown de perfil (Ver perfil, Configuración, Cerrar sesión).

Ambos deben usar los tokens de color existentes (Zinc/Magenta), no inventar paleta nueva.

---

## 2. Estructura de rutas a crear

```
src/app/(admin)/
├── layout.tsx
├── page.tsx                      → /admin (Dashboard)
├── cursos/
│   ├── page.tsx                  → /admin/cursos
│   ├── crear/page.tsx            → /admin/cursos/crear
│   └── [id]/page.tsx             → /admin/cursos/[id]
├── usuarios/
│   ├── page.tsx                  → /admin/usuarios
│   └── [id]/page.tsx             → /admin/usuarios/[id]
├── categorias/page.tsx           → /admin/categorias
├── estadisticas/page.tsx         → /admin/estadisticas
└── configuracion/page.tsx        → /admin/configuracion
```

---

## 3. Dashboard (`/admin`)

- Título "Dashboard" + subtítulo "Resumen general de la plataforma".
- 4 `StatCard`: Usuarios registrados, Cursos publicados, Cursos en borrador, Inscripciones (con variación % donde aplique).
- Sección "Actividad reciente" (lista tipo timeline, mock: registros, publicaciones, inscripciones).
- Sección "Cursos más populares": tabla o cards con imagen, nombre, categoría, nº estudiantes, % de finalización promedio, estado (`StatusBadge`).

---

## 4. Gestión de cursos (`/admin/cursos`)

- Título "Cursos" + botón primario "+ Crear curso" → `/admin/cursos/crear`.
- `SearchBar` "Buscar cursos...".
- `FilterDropdown` por Categoría, Estado (Publicado/Borrador/Archivado), Nivel.
- `CourseTable` (usa `DataTable` genérico): Curso, Categoría, Nivel, Estudiantes, Estado (`StatusBadge`), Fecha de creación, Acciones (menú: Ver, Editar, Gestionar contenido, Publicar/Despublicar, Eliminar → `ConfirmModal`).
- `EmptyState` si no hay cursos: "No hay cursos todavía" / "Comienza creando tu primer curso" + CTA.

### 4.1 Crear curso (`/admin/cursos/crear`)
Tabs: **Información** | **Configuración** (el tab "Contenido" queda deshabilitado hasta guardar, con tooltip "Disponible después de crear el curso").
- Información: nombre, descripción, imagen/thumbnail (dropzone visual), categoría, nivel, instructor.
- Configuración: estado (`mostrado` boolean), curso destacado, orden de visualización.
- Botones: "Guardar como borrador" / "Publicar curso".

### 4.2 Editar curso (`/admin/cursos/[id]`)
Header con imagen, nombre, `StatusBadge`, nº de estudiantes.
Tabs: **Información** | **Contenido** | **Configuración**.

### 4.3 Contenido del curso (tab "Contenido")
Árbol Módulos → Lecciones (`ModuleList` + `LessonItem`), con:
- Crear/editar/eliminar módulo y lección (modales o inline).
- Reordenar módulos y lecciones con drag & drop (actualiza campo `orden` en el mock, simulando el *batch update*).
- Cada lección muestra: tipo de contenido (Video/Texto/Quiz/Recurso descargable), duración, `estado_procesamiento` (Subiendo/Procesando/Listo).
- Click en lección → editor de lección.

### 4.4 Editor de lección
Campos: nombre, descripción, tipo de contenido, zona de upload de video ("Arrastra tu video aquí o selecciona un archivo" — visual only, con preview post-selección), duración, material adicional (recursos descargables). Botón "Guardar cambios".

---

## 5. Usuarios (`/admin/usuarios`)

- Título "Usuarios" + botón "+ Crear usuario".
- `SearchBar` "Buscar por nombre o correo...".
- Filtros: Rol (Estudiante/Administrador), Estado (Activo/Suspendido).
- Tabla: Avatar (`UserAvatar`), Nombre, Email, Rol, Cursos inscritos, Estado (`StatusBadge`), Fecha de registro, Acciones (Ver perfil, Editar, Suspender/Activar → `ConfirmModal`).

### 5.1 Detalle de usuario (`/admin/usuarios/[id]`)
- Cabecera: avatar, nombre, email, rol, estado, fecha de registro.
- Stats: cursos inscritos, cursos completados, progreso promedio, última actividad.
- "Cursos del usuario": tabla con curso, barra de progreso, estado (En progreso/Completado), última actividad.

---

## 6. Categorías (`/admin/categorias`)

CRUD visual completo: tabla (Nombre, Descripción, Nº de cursos, Estado, Acciones), botón "+ Nueva categoría", crear/editar vía modal, eliminar vía `ConfirmModal`, activar/desactivar con switch.

---

## 7. Estadísticas (`/admin/estadisticas`)

- Filtros de rango: 7 días / 30 días / 3 meses / último año.
- Gráficos (usa `recharts`, disponible en el entorno): usuarios registrados por mes, inscripciones por mes, cursos más populares, progreso promedio, cursos completados.
- Datos mock coherentes con el rango seleccionado.

---

## 8. Configuración (`/admin/configuracion`)

Secciones: Perfil del administrador (nombre, email, avatar), Plataforma (nombre, logo, descripción), Seguridad (cambiar contraseña — form visual, sesiones activas — lista mock con botón "Cerrar sesión" por dispositivo).

---

## 9. Componentes reutilizables a crear (en `src/components/features/admin/` salvo que ya exista equivalente en `ui/`)

`AdminLayout`, `AdminSidebar`, `AdminHeader`, `StatCard`, `DataTable`, `StatusBadge`, `UserAvatar`, `CourseCard`, `CourseTable`, `SearchBar`, `FilterDropdown`, `ConfirmModal`, `EmptyState`, `LoadingState` (skeletons), `Toast` (o wrapper sobre el sistema de toasts ya existente si lo hay), `CourseForm`, `ModuleList`, `LessonItem`.

Ningún componente debe duplicar lógica ya existente en `src/components/ui/`.

---

## 10. Datos mock

Crear en `src/lib/mock/admin/` (o `src/lib/mock-data/` si ya existe convención en el repo — revisar antes de crear una nueva carpeta):

- `cursos.mock.ts`, `usuarios.mock.ts`, `categorias.mock.ts`, `estadisticas.mock.ts`
- Tipos TypeScript que reflejen exactamente las tablas `Cursos`, `Módulos`, `Lecciones`, `Perfiles`, `Categorías`, `Inscripciones` de `technical-spec.md` §4 (mismos nombres de campo en español, mismos enums: `ESTUDIANTE/ADMINISTRADOR`, `ACTIVO/SUSPENDIDO`, `SUBIENDO/PROCESANDO/LISTO`).
- Datos realistas: cursos (JavaScript desde cero, React desde cero, Desarrollo Web con Next.js, Bases de datos PostgreSQL, Fundamentos de Redes, Python para principiantes) y usuarios (Juan Pérez, María López, Carlos Rodríguez, Laura Gómez).

Mutaciones simuladas: crear `src/actions/admin/cursos.actions.ts`, `usuarios.actions.ts`, `categorias.actions.ts` con funciones que devuelvan siempre `{ success: boolean; data?: T; error?: string }` (mismo contrato que el resto del proyecto) aunque hoy solo operen sobre el array mock en memoria.

---

## 11. Estados de interfaz

Para cada listado/tabla: loading (skeleton), empty state, error state, y toasts de éxito/error tras cada acción simulada (crear, editar, eliminar, publicar, suspender).

---

## 12. Responsive

- Desktop: sidebar fija.
- Tablet: sidebar colapsable.
- Mobile: sidebar → drawer.
- Tablas con scroll horizontal o vista de cards apiladas en mobile.

---

## 13. Criterios de aceptación

- [ ] Cero cambios detectados en `(public)`, `(student)`, `(auth)` (`git diff` limpio fuera de `(admin)` y las carpetas de componentes/actions/mocks nuevas).
- [ ] Las 9 rutas listadas en la sección 2 renderizan con datos mock, sin errores de consola.
- [ ] Sidebar y drawer funcionan en los 3 breakpoints.
- [ ] Todos los componentes reutilizables listados existen y se usan (no una page monolítica).
- [ ] Los tipos de los mocks coinciden con el diccionario de datos de `technical-spec.md`.
- [ ] Las funciones en `src/actions/admin/` devuelven `{ success, data?, error? }`.
- [ ] No hay ninguna importación de `@supabase/supabase-js` en este PR (fase solo-UI).
