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

Sobre esas tablas se corrieron los 3 scripts de esta carpeta (ver detalle
de cada uno abajo) y luego se revisó **Database → Advisors** en el
dashboard de Supabase: quedó en 0 errores y 0 warnings. Los 10 "Info"
restantes son esperados — son tablas con RLS activo pero sin política
(bloqueadas por completo para `anon`/`authenticated`, solo accesibles vía
Service Role) porque pertenecen a fases futuras del `development-plan.md`
(panel admin, catálogo público, suscripciones/pagos): `planes`,
`categorias`, `cupones`, `suscripciones`, `pagos`, `inscripciones`,
`recursos_descargables`, `bitacora_administrativa`, `eventos_webhook`, y
`_prisma_migrations`.

## Los 3 scripts

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
inventaron reglas de negocio que el spec no define todavía.

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

## Orden de ejecución (proyecto nuevo, desde cero)

1. `npx prisma migrate dev` — crea las tablas a partir de `prisma/schema.prisma`.
2. `000_trigger_perfiles.sql` — sincroniza `auth.users` → `perfiles` al registrarse.
3. `001_rls_policies.sql` — activa RLS y define las políticas base.

Repetir los 3 pasos en cada entorno nuevo (Staging y Production son
proyectos de Supabase separados, ver `docs/technical-spec.md` §10). `002`
no hace falta en instalaciones nuevas — solo se documenta como registro
histórico del parche aplicado en desarrollo.
