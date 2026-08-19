# SQL manual (fuera de Prisma)

Prisma solo gestiona `schema.prisma` y las tablas (ver `docs/technical-spec.md` §2.1).
Todo lo que es específico de Supabase (triggers sobre `auth.users`, políticas RLS)
vive aquí como SQL plano, para correrlo manualmente en el **SQL Editor** del
dashboard de Supabase.

## Qué se hizo (proyecto de desarrollo, agosto 2026)

Se integró la base de datos Postgres de Supabase con el esquema completo de
`docs/technical-spec.md` §4: las 15 tablas del diccionario de datos se
crearon vía `npx prisma migrate dev --name init` (migración
`prisma/migrations/20260812234816_init`), usando la connection string del
**Session pooler** de Supabase (puerto `5432`) — el Direct Connection
(`db.[project].supabase.co:5432`) solo resuelve por IPv6 y falla en redes
IPv4, y el Transaction pooler (puerto `6543`) no soporta bien los locks que
usa Prisma Migrate.

Sobre esas tablas se corrieron los scripts de esta carpeta (ver detalle
de cada uno abajo) y luego se revisó **Database → Advisors** en el
dashboard de Supabase: quedó en 0 errores y 0 warnings. Los 10 "Info"
restantes son esperados — son tablas con RLS activo pero sin política
(bloqueadas por completo para `anon`/`authenticated`, solo accesibles vía
Service Role) porque pertenecen a fases futuras del `development-plan.md`
(panel admin, catálogo público, suscripciones/pagos): `planes`,
`categorias`, `cupones`, `suscripciones`, `pagos`, `inscripciones`,
`recursos_descargables`, `bitacora_administrativa`, `eventos_webhook`, y
`_prisma_migrations`.

## Los scripts

### `000_trigger_perfiles.sql`
Crea la función `private.handle_new_user()` y el trigger
`on_auth_user_created` sobre `auth.users`. Cuando alguien se registra en
Supabase Auth (email o Google OAuth), inserta automáticamente su fila en
`public.perfiles` con `rol = 'ESTUDIANTE'` y `estado = 'ACTIVO'` por
defecto (ver `docs/technical-spec.md` §6). El nombre se toma de los
metadatos de OAuth si existen, si no del correo.

### `001_rls_policies.sql`
Activa Row Level Security en las 15 tablas + `_prisma_migrations`, y crea
la función helper `private.es_administrador()` (¿el usuario autenticado
actual tiene `rol = 'ADMINISTRADOR'` en `perfiles`?). Define las
políticas que ya estaban explícitas en `docs/technical-spec.md` §5:

- **`perfiles`**: cada quien ve/edita su propio perfil; los admin ven todos.
- **`cursos` / `modulos` / `lecciones`**: `SELECT` público solo si el curso
  tiene `mostrado = true`; `INSERT`/`UPDATE`/`DELETE` solo para admin.
- **`progreso`**: cada usuario solo lee/escribe su propio progreso.
- **`certificados`**: cada usuario ve los suyos; los admin ven todos.

Las tablas sin política explícita (`planes`, `suscripciones`, `pagos`,
`cupones`, `inscripciones`, `categorias`, `recursos_descargables`,
`bitacora_administrativa`, `eventos_webhook`) quedan bloqueadas a
propósito para `anon`/`authenticated` — se abrirán con reglas propias en
la Fase 2/4 del `development-plan.md` (panel admin, muro de acceso), no se
inventaron reglas de negocio que el spec no define todavía. `003` abrió
casi todas; `categorias` se quedó por fuera de ese lote y la abre `004`.

### `002_harden_security_definer_functions.sql`
Parche de seguridad aplicado una sola vez sobre el proyecto de Supabase ya
provisionado. Corrige un warning del linter de Supabase
(`anon_security_definer_function_executable`): `es_administrador()` y
`handle_new_user()` son funciones `SECURITY DEFINER`, y al vivir en el
schema `public` quedaban expuestas automáticamente como endpoints REST
públicos (`/rest/v1/rpc/es_administrador`, invocables sin login). Este
script las mueve al schema `private` — que no está en la lista de schemas
que PostgREST expone por HTTP — y reapunta el trigger y las 8 políticas
que dependían de `es_administrador()`. Las políticas RLS las siguen
llamando sin problema (`GRANT USAGE ON SCHEMA private` a `anon`/
`authenticated`), pero ya no son alcanzables desde fuera.

**Nota:** `000` y `001` ya crean las funciones directamente en `private`
desde el inicio — `002` solo existía porque este proyecto ya se había
provisionado con la versión anterior (en `public`) antes de detectar el
warning. En una instalación nueva, `000` + `001` son suficientes y `002`
no aplica (no rompe nada si se corre de todos modos: usa `create or
replace` y `drop if exists`).

### `003_rls_membresia_y_gestion.sql`
Agrega las políticas de las 8 tablas que `001_rls_policies.sql` había
dejado con RLS activo pero sin política propia (pendientes de Fase 2/4
del `development-plan.md`, según quedó documentado ahí). No modifica
ninguna política de `000`/`001`/`002` — solo añade nuevas:

- **`planes`**: `SELECT` público solo si `activo = true` (igual que
  `cursos`/`mostrado`); admin gestiona todo.
- **`suscripciones`**: cada usuario lee las suyas; admin ve todas. Sin
  `insert`/`update` para `authenticated` — el estado lo cambia
  exclusivamente el backend al procesar webhooks de Stripe/Wompi con
  la Service Role Key, que ignora RLS.
- **`pagos`**: cada usuario lee los pagos de sus propias suscripciones
  (vía `join`); admin ve todos. Igual que `suscripciones`, cero
  escritura de cliente.
- **`cupones`**: sin ninguna policy de `SELECT` para `anon`/
  `authenticated` — evita exponer código, tipo de descuento, límite y
  usos. La validación de un cupón en checkout se hace vía Server
  Action con Service Role Key, nunca con una query directa del
  cliente. Solo admin gestiona (`all`).
- **`inscripciones`**: el estudiante ve las suyas e inserta su propia
  fila de tipo `MEMBRESIA` (alta automática al entrar por primera vez
  a un curso con suscripción `ACTIVA`/`PAST_DUE`, ver
  `docs/functional-spec.md` Flujo 01), validado con un `exists` contra
  `suscripciones` en el `with check`. Sin `update`/`delete` para el
  estudiante. Admin gestiona todo, incluyendo las cortesías del
  Flujo 11.
- **`recursos_descargables`**: mismo criterio que el video de la
  lección — `SELECT` si hay inscripción vigente al curso o suscripción
  `ACTIVA`/`PAST_DUE` (join `lecciones` → `modulos` → `cursos`); admin
  gestiona la escritura.
- **`bitacora_administrativa`**: exclusivo admin, sin excepción.
- **`eventos_webhook`**: **sin ninguna policy**, a propósito — la tabla
  ya tiene RLS activo desde `001` y queda 100% inaccesible para
  `anon`/`authenticated` (incluido un admin logueado vía PostgREST),
  solo la usan los endpoints `/api/webhooks/*` con Service Role Key.
  No es un olvido.

### `004_categorias_select_publico.sql`
`SELECT` público sobre `categorias`, la única tabla de catálogo que `003`
no cubrió: `001` le activó RLS y nunca le creó política, así que quedaba
inaccesible para `anon`/`authenticated`.

Hizo falta al conectar el Home a datos reales — la sección "Escuelas" del
footer lista las categorías sin login. El síntoma sin política es
traicionero: PostgREST **no devuelve error**, RLS simplemente filtra todas
las filas y la consulta responde `[]`, así que parece una tabla vacía.

Una categoría es metadato público del catálogo (nombre + descripción), el
mismo criterio que `planes_select_publico` y `cursos_select_publicos`. No
agrega política de escritura: el CMS de categorías es Fase 4, hasta
entonces solo se tocan con Service Role / Prisma.

**Nota:** esta policy queda reemplazada por `005_rls_categorias_y_perfiles_admin.sql`
en cuanto el panel admin (Fase 2) agrega la columna `categorias.activo` — ver ese
archivo para el porqué.

### `005_rls_categorias_y_perfiles_admin.sql`
Panel admin (Fase 2): recrea `categorias_select_publico` para que respete la
columna `activo` que agrega la migración de Prisma del panel (una categoría
desactivada deja de listarse en el catálogo público, igual que
`cursos.mostrado`/`planes.activo`), agrega `categorias_admin_escritura`
(CRUD de categorías para admin) y `perfiles_admin_escritura` (un admin puede
suspender/activar cuentas y cambiar el rol de otro usuario, ver
`docs/functional-spec.md` Flujo 13 — `001` solo dejaba actualizar el propio
perfil).

## Orden de ejecución (proyecto nuevo, desde cero)

1. `npx prisma migrate dev` — crea las tablas a partir de `prisma/schema.prisma`.
2. `000_trigger_perfiles.sql` — sincroniza `auth.users` → `perfiles` al registrarse.
3. `001_rls_policies.sql` — activa RLS y define las políticas base.
4. `002_harden_security_definer_functions.sql` — opcional en instalaciones
   nuevas (no rompe nada si se corre igual, ver nota arriba); solo hace
   falta en proyectos ya provisionados con la versión anterior de las
   funciones en `public`.
5. `003_rls_membresia_y_gestion.sql` — políticas de planes, suscripciones,
   pagos, cupones, inscripciones, recursos descargables y bitácora.
6. `004_categorias_select_publico.sql` — lectura pública de `categorias`.
7. `npx prisma migrate dev` (de nuevo) — aplica la migración del panel admin
   que agrega `categorias.activo` / `categorias.id_admin_creador` y
   `cursos.nivel` / `destacado` / `orden_visualizacion`.
8. `005_rls_categorias_y_perfiles_admin.sql` — ajusta `categorias_select_publico`
   para respetar `activo`, y agrega la escritura de categorías y perfiles
   para admin.

Repetir los pasos en cada entorno nuevo (Staging y Production son
proyectos de Supabase separados, ver `docs/technical-spec.md` §10).
