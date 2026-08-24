# SQL de Supabase (fuera de Prisma)

Prisma solo gestiona `schema.prisma` y las tablas (ver `docs/technical-spec.md` §2.1).
Todo lo que es específico de Supabase (triggers sobre `auth.users`, políticas RLS,
funciones `SECURITY DEFINER`, buckets de Storage) vive aquí como SQL plano.

## Cómo se aplican

**Ya no se pegan a mano en el SQL Editor.** Los 22 archivos se aplican con un
comando, en orden y dentro de una sola transacción:

```bash
npm run db:rls          # aplica (COMMIT)
npm run db:rls:check    # aplica y hace ROLLBACK — verifica sin escribir nada
```

La secuencia completa para dejar un entorno al día:

```bash
npx prisma migrate deploy   # 1. tablas
npm run db:rls              # 2. políticas, triggers y funciones
npm run test:rls            # 3. verificación (sale con código 1 si algo falla)
```

El applier es `scripts/apply-rls.ts`. Ordena por el prefijo numérico del nombre
—no alfabéticamente— y aborta si algún archivo no sigue el formato
`NNN_descripcion.sql`, porque el orden es lo que hace correcto el resultado.
Como todo va en un único `BEGIN`/`COMMIT`, un fallo a mitad de camino revierte
el lote entero: no existe el estado "la mitad aplicada".

### Por qué no son migraciones de Prisma

`prisma migrate dev` replica todas las migraciones en una *shadow database*
vacía para detectar drift, y esa base no tiene el schema `auth` de Supabase.
Estos scripts dependen de él en todas partes: `auth.uid()` en unas 35 políticas,
el trigger sobre `auth.users` (`000`), la FK `perfiles.id → auth.users(id)`
(`010`) y las lecturas de `auth.identities` (`007`). Moverlos a
`prisma/migrations/` rompería `npm run prisma:migrate` para todo el equipo,
salvo falsificando objetos internos de Supabase dentro de la shadow DB. Por eso
son un pipeline propio — automatizado y verificable, que es lo que importaba.

### Idempotencia

Los scripts se re-ejecutan sin efecto (`drop policy if exists` antes de cada
`create policy`, `create or replace function`, `add constraint` capturando
`duplicate_object`, `cron.unschedule` antes de `cron.schedule`), así que correr
`db:rls` sobre una base ya al día no cambia nada.

Postgres no tiene `create or replace policy`, así que ese par `drop`/`create` es
la única forma de lograrlo. **`001` no lo tenía** —se escribió antes de que se
adoptara el idiom en `002`— y fallaba con «policy ... already exists» en la
segunda corrida. Lo detectó `npm run db:rls:check` la primera vez que se usó,
sin haber escrito nada. Si agregas un script nuevo, corre `db:rls:check` dos
veces: la idempotencia es una afirmación que se verifica, no que se supone. El único `DELETE` del lote vive dentro del cuerpo
de `private.limpiar_usuarios_no_verificados()` (`010`) y solo lo dispara el cron
diario, nunca la aplicación del script.

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

  **Nota (decisión confirmada en la auditoría de RLS):** el checklist
  de seguridad general para este tipo de tabla dice "solo admin
  escribe" — acá el estudiante sí puede insertar su propia fila, pero
  únicamente la de auto-inscripción por membresía, con el `with check`
  de arriba cerrando cualquier otro caso (no puede poner
  `tipo_acceso = 'CORTESIA'`, no puede fijar `otorgado_por`, no puede
  insertarse sin suscripción activa). Es una excepción de negocio
  deliberada, no un descuido: sin ella, cada primera entrada a un curso
  tendría que pasar por un admin. Verificado por `scripts/rls-test.ts`.
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

### `006_rls_instructores.sql`
RLS de la tabla `instructores`, creada por la migración que convirtió
`cursos.instructor` de texto libre a relación. Incluye el `alter table …
enable row level security` explícito: `001` solo activó RLS sobre las tablas
que existían entonces, así que una tabla creada después nace **sin** RLS —
legible y escribible por `anon` vía PostgREST.

Mismo criterio que `categorias` en `005`: `SELECT` público (el catálogo
muestra quién dicta cada curso sin login) y escritura solo para
`private.es_administrador()`. Sin filtro de `activo` porque el modelo no
tiene esa columna.

### `007_check_email_provider.sql`
Crea `public.check_email_provider(p_email text)`, usada por el flujo de
"correo inteligente" de login/registro (`promptauthflowplatzi.md`,
`src/actions/auth/check-email.ts`): dado un correo, dice si existe una
cuenta y con qué proveedor(es) se registró (`password`, `google` o `both`
si tiene contraseña y una identidad de Google vinculadas), para que el
frontend muestre "crear cuenta", "iniciar sesión", "continuar con Google" o
ambas opciones — sin pedir nunca una contraseña que la cuenta nunca tuvo.

A diferencia de `000`/`001`/`002` (que mueven todo lo `SECURITY DEFINER` a
`private` para que PostgREST no lo exponga), esta función se queda en
`public` a propósito: el backend de Next.js no tiene conexión Postgres
directa (Prisma es solo schema/migraciones, CLAUDE.md §2), así que solo
puede llamarla vía `supabase.rpc(...)` con la Service Role Key, y eso
requiere que la función viva en un schema que PostgREST sí exponga. Queda
igual de inalcanzable para clientes no autorizados: se revoca `EXECUTE` de
`PUBLIC`/`anon`/`authenticated` y solo se otorga a `service_role`.

**Nota de seguridad:** este endpoint revela deliberadamente si un correo
está registrado (a diferencia de `recuperar.ts`, que nunca lo hace) — es el
comportamiento pedido por el flujo tipo Platzi/GitHub/Google, no un olvido.

### `008_correo_verificado_rls.sql`
Crea `private.correo_verificado()` (¿el usuario autenticado actual tiene
`email_confirmed_at` no nulo en `auth.users`?), mismo patrón que
`private.es_administrador()`. La agrega al `with check` de
`inscripciones_insert_propio` y `progreso_propio` — ver
`docs/functional-spec.md` Flujo 02 (ampliación): sin correo verificado no
se puede autoinscribir a una membresía ni registrar avance de
reproducción.

### `009_reenvio_verificacion_rate_limit.sql`
Crea la tabla `private.verificacion_reenvios` y
`public.registrar_reenvio_verificacion(p_correo text)`, usada por
`src/actions/auth/reenviar-verificacion.ts` (vía Service Role Key) para
limitar el botón "Reenviar enlace de verificación" a 1 solicitud cada 60
segundos por correo. Mismo criterio de exposición que `007` (función en
`public`, `EXECUTE` solo para `service_role`).

### `010_fk_perfiles_cascade_y_limpieza.sql`
Agrega el FK `perfiles.id → auth.users.id` con `on delete cascade` (no
existía: Prisma no puede definirlo porque `auth` es un schema fuera de su
alcance) y crea `private.limpiar_usuarios_no_verificados()`, programada a
diario vía `pg_cron` (`cron.schedule`), que borra de `auth.users` las
cuentas sin confirmar con más de 7 días de antigüedad — la fila espejo en
`perfiles` se limpia sola gracias al FK nuevo. Se eligió `pg_cron` en vez
de un Route Handler o un cron de Railway porque el proyecto todavía no
tiene un entorno Railway desplegado (ver comentario en el propio archivo
sobre la migración futura a un Railway Cron Service).

**Nota de configuración manual (fuera de SQL):** el tiempo de expiración
del token del correo "Confirm signup" se ajusta en el Dashboard de
Supabase (Authentication → Emails → Email OTP Expiration), no aquí — se
dejó en 900 segundos (15 minutos), igual que el token de recuperación de
contraseña (Flujo 03). Repetir en cada entorno (Staging y Production).

### `011_bucket_materiales_lecciones.sql`
Crea el bucket privado `materiales-lecciones` en Supabase Storage y sus 3
policies de `storage.objects` (`insert`/`select`/`delete`, todas
`private.es_administrador()`), usado por "Material adicional" del editor de
lección (panel admin). La fila de metadatos ya tenía RLS desde `003`; esto
resuelve el archivo físico. Admin-only a propósito: todavía no existe la
pantalla de lección del lado estudiante — cuando exista, se agrega ahí una
policy de `select` con el mismo criterio de `recursos_select_con_acceso`
(inscripción vigente o suscripción activa/past_due), sin tocar esta.

### `012_bucket_portadas_cursos.sql`
Crea el bucket **público** `portadas-cursos` en Supabase Storage y sus 4
policies de `storage.objects` (`insert`/`update`/`delete` admin-only,
`select` público), usado por la portada/thumbnail de un curso (InfoTab.tsx
y CrearCursoForm.tsx del panel admin). A diferencia de `011`
(`materiales-lecciones`, privado), este es público a propósito: la portada
se muestra en el catálogo sin login, mismo criterio que `cursos.titulo`.

### `013_perfiles_bloquea_autopromocion.sql`
Cierra una escalada de privilegios encontrada en la auditoría de RLS:
`perfiles_update_propio` (`001`) solo valida de quién es la fila
(`auth.uid() = id`), no qué columnas cambian, así que un estudiante podía
llamar la API REST directamente y hacer `PATCH /perfiles?id=eq.<su-uuid>`
con `{"rol":"ADMINISTRADOR"}` o `{"estado":"ACTIVO"}` estando suspendido.
GRANT/REVOKE de columna no sirve porque admin y estudiante comparten el
mismo rol de Postgres (`authenticated`); la solución es un trigger
`BEFORE UPDATE` (`private.perfiles_bloquea_autopromocion()`) que compara
`OLD`/`NEW` fila por fila y bloquea el cambio de `rol`/`estado` salvo que
quien ejecuta sea admin (`private.es_administrador()`) o `service_role`.
Verificado por `scripts/rls-test.ts` (caso "NO puede auto-promoverse").

### `014_separa_politicas_for_all.sql`
Separa en `SELECT`/`INSERT`/`UPDATE`/`DELETE` las 13 políticas `for all`
que había hasta ese momento (`cursos`, `modulos`, `lecciones`, `progreso`,
`planes`, `suscripciones`, `pagos`, `cupones`, `inscripciones`,
`recursos_descargables`, `bitacora_administrativa`, `categorias`,
`instructores`). Puramente mecánico — misma condición, sin cambio de
comportamiento — salvo dos ajustes detectados al separarlas: `cupones` no
tenía ninguna policy de `SELECT` propia (dependía por completo del `for
all` para que el admin pudiera leerla, así que se recrea explícita) y la
`admin_select` añadida a `inscripciones` se retiró por redundante
(`inscripciones_select_propio`, de `003`, ya cubre al admin con `or
private.es_administrador()`).

### `015_verificar_certificado_publico.sql`
Crea `public.verificar_certificado(p_codigo text)`, para que la landing
pública de verificación de certificados no tenga que abrir la tabla
`certificados` (que solo su dueño o un admin pueden leer, por `001`). A
diferencia de `check_email_provider`/`registrar_reenvio_verificacion`
(restringidas a `service_role`), esta función SÍ se otorga a `anon`: es la
manera correcta de exponer un dato puntual sin volver pública la tabla
completa. Siempre devuelve una fila (`valido = false` si el código no
existe), y solo los campos mínimos para confirmar validez.

### `016_rls_codigos_invitacion.sql` y `017_canjear_codigo_invitacion.sql`
Códigos de invitación canjeables por acceso completo a la plataforma
(equivalente a un plan de cortesía), agregados en la auditoría de RLS —
tabla nueva (`prisma/migrations/20260824000000_agrega_codigos_invitacion`),
sin precedente en `docs/`. Mismo criterio que `cupones`: `016` deja la
tabla sin ninguna policy de `SELECT` para `anon`/`authenticated` (solo
admin, en 4 políticas separadas desde el inicio) porque un código expone
plan/límite/vencimiento, datos que un cliente no debe poder enumerar.

El canje lo resuelve `public.canjear_codigo_invitacion(p_codigo, p_usuario_id)`
en `017` — mismo patrón de exposición que `007`/`009` (`EXECUTE` solo para
`service_role`, llamada desde `src/actions/codigos-invitacion/canjear.ts`,
que primero verifica la sesión real con el cliente de RLS y solo entonces
pasa el `id` del usuario al backend). Todo en una sola transacción con
`select ... for update` sobre la fila del código, para que dos canjes
simultáneos del mismo código con `limite_usos` no lo superen. El límite de
uso todavía no tiene una regla de negocio definida (single-use vs
multi-use) — el esquema soporta ambas vía `limite_usos` nullable, sin
necesidad de otra migración cuando se decida.

### `018_revierte_with_check_duplicado_perfiles.sql`
Reconciliación entre dos arreglos independientes del mismo hallazgo de
`013`: otro desarrollador encontró por su cuenta la misma escalada de
privilegios y la cerró con un `with check` declarativo en
`perfiles_update_propio` (commit `3173b95`, archivo
`013_fix_perfiles_update_propio.sql`), corrido contra esta misma base
antes de que ese archivo se descartara en el merge hacia esta rama. Se
decidió conservar solo el trigger de `013` (más general — protege la
fila sin importar qué política la deja pasar, no solo esta) y este
script revierte `perfiles_update_propio` a su forma original de `001`
(sin `with check` propio), para que la base compartida vuelva a
coincidir con lo que producen estos archivos corridos en orden desde
cero. Verificado por `scripts/rls-test.ts` tras el revert: la
protección sigue activa (ahora solo vía el trigger).

### `022_rate_limit_login_y_recuperacion.sql`
Rate limiting real (server-side) para dos flujos que no lo tenían
(`revisionLogin.md`, checklist de calidad senior del módulo de Auth):

- **Login** (`src/actions/auth/login.ts`): `private.intentos_login` +
  `public.verificar_intentos_login(p_correo)` /
  `public.registrar_login_fallido(p_correo)` /
  `public.limpiar_intentos_login(p_correo)`. Máximo 5 intentos fallidos
  por correo en una ventana de 15 minutos; al quinto fallo, bloquea 15
  minutos más. `login.ts` chequea el bloqueo *antes* de llamar a
  `signInWithPassword` (para no gastar la cuota de Supabase Auth en un
  correo ya bloqueado), registra el fallo si las credenciales son
  incorrectas, y limpia el contador en un login exitoso. Un
  `email_not_confirmed` no cuenta como intento fallido — no es una
  contraseña incorrecta.
- **Recuperación de contraseña** (`src/actions/auth/recuperar.ts`):
  `private.recuperacion_reenvios` + `public.registrar_solicitud_recuperacion(p_correo)`,
  mismo patrón exacto que `009` (1 solicitud por correo cada 60
  segundos). Si el límite bloquea el envío, `recuperar.ts` **sigue
  respondiendo el mismo mensaje de éxito neutro de siempre** — bloquear
  el correo no debe traducirse en una respuesta distinta que delate el
  estado de la cuenta.

Mismo criterio de exposición que `007`/`009`: funciones en `public`
porque el backend solo puede llamarlas vía `supabase.rpc(...)` con la
Service Role Key, `EXECUTE` revocado a `PUBLIC`/`anon`/`authenticated` y
otorgado solo a `service_role`. Igual que `009`, el límite se aplica por
el string de correo tal cual se recibió, sin depender de que la cuenta
exista, para no filtrar existencia de cuentas por timing.

## Orden de ejecución (proyecto nuevo, desde cero)

1. `npx prisma migrate deploy` — crea y actualiza todas las tablas a partir
   del historial completo de `prisma/migrations`. Va primero y de una sola
   vez: los scripts de abajo asumen columnas que introducen las migraciones
   (`categorias.activo` para `005`, la tabla `instructores` para `006`).
2. `000_trigger_perfiles.sql` — sincroniza `auth.users` → `perfiles` al registrarse.
3. `001_rls_policies.sql` — activa RLS y define las políticas base.
4. `002_harden_security_definer_functions.sql` — opcional en instalaciones
   nuevas (no rompe nada si se corre igual, ver nota arriba); solo hace
   falta en proyectos ya provisionados con la versión anterior de las
   funciones en `public`.
5. `003_rls_membresia_y_gestion.sql` — políticas de planes, suscripciones,
   pagos, cupones, inscripciones, recursos descargables y bitácora.
6. `004_categorias_select_publico.sql` — lectura pública de `categorias`.
7. `005_rls_categorias_y_perfiles_admin.sql` — reemplaza la policy de lectura
   de `004` añadiéndole el filtro por `categorias.activo`, y agrega la
   escritura de `categorias` y `perfiles` para admin.
8. `006_rls_instructores.sql` — lectura pública y escritura solo admin de
   `instructores`.
9. `007_check_email_provider.sql` — función para el flujo de correo
   inteligente de login/registro.
10. `008_correo_verificado_rls.sql` — refuerzo de RLS para exigir correo
    verificado en inscripciones y progreso.
11. `009_reenvio_verificacion_rate_limit.sql` — rate limit del reenvío de
    verificación de correo.
12. `010_fk_perfiles_cascade_y_limpieza.sql` — FK de `perfiles` hacia
    `auth.users` y el cron de limpieza de cuentas sin verificar.
13. `011_bucket_materiales_lecciones.sql` — bucket de Storage y policies
    admin-only para el material adicional de las lecciones.
14. `012_bucket_portadas_cursos.sql` — bucket público de Storage para la
    portada/thumbnail de cada curso.
15. `013_perfiles_bloquea_autopromocion.sql` — trigger que impide que un
    usuario cambie su propio `rol`/`estado` vía la API directa.
16. `014_separa_politicas_for_all.sql` — separa las políticas `for all`
    en operaciones individuales.
17. `015_verificar_certificado_publico.sql` — función pública de
    verificación de certificados.
18. `016_rls_codigos_invitacion.sql` — RLS de `codigos_invitacion`
    (requiere antes `prisma migrate deploy` con la migración
    `20260824000000_agrega_codigos_invitacion`).
19. `017_canjear_codigo_invitacion.sql` — función de canje de códigos de
    invitación.
20. `019_cuenta_activa_rls.sql` — bloquea escritura nueva (autoinscripción,
    progreso) de una cuenta suspendida a nivel de RLS, complementando el
    `signOut` proactivo de `suspenderActivarUsuario()`.
21. `020_actualiza_verificar_certificado_timestamptz.sql` — ajusta el tipo
    de retorno de `verificar_certificado()` (requiere antes
    `prisma migrate deploy` con la migración
    `20260824010000_estandariza_timestamps`, que cambia
    `certificados.fecha_emision` a `timestamptz`).
22. `021_rls_curso_categorias.sql` — RLS de `curso_categorias`, la tabla
    puente curso↔categoría (requiere antes `prisma migrate deploy` con la
    migración `20260824030000_curso_categorias_muchos_a_muchos`).
23. `022_rate_limit_login_y_recuperacion.sql` — rate limit de intentos de
    login y de solicitudes de recuperación de contraseña.

`018_revierte_with_check_duplicado_perfiles.sql` **no** es parte de esta
secuencia para un ambiente nuevo: en un proyecto que solo corrió 001-017
en orden, `perfiles_update_propio` nunca tuvo el `with check` duplicado
que ese script revierte. Solo hace falta correrlo una vez en un proyecto
que, como este, tuvo ambos arreglos aplicados por separado (ver su
sección arriba).

### `019_cuenta_activa_rls.sql`
Cierra el gap residual de invalidación de sesión al suspender una cuenta
(auditoría de RLS). Tenía dos partes: `suspenderActivarUsuario()`
(`src/actions/admin/usuarios.ts`) solo actualizaba `perfiles.estado` — la
sesión ya abierta del usuario seguía siendo válida hasta la próxima
request a una ruta protegida por `proxy.ts`. Esa parte se cerró en
código: la Server Action ahora llama a
`supabase.auth.admin.signOut(usuarioId, "global")` con el cliente de
Service Role (`createAdminClient()`) justo después de marcar
`SUSPENDIDO`, revocando toda sesión activa del usuario en el servidor de
Auth. Si ese `signOut` falla, no aborta la acción (el estado ya quedó
bien en la DB) — solo se loguea el error.

Pero `admin.signOut("global")` invalida la sesión en Supabase Auth, no
el JWT en sí — un access token ya emitido y todavía no expirado, usado
directo contra la API REST (PostgREST) sin pasar por el middleware de
Next.js, seguiría pasando cualquier policy que solo valide
`auth.uid() = id_usuario`. Este script cierra esa segunda vía: agrega
`private.cuenta_activa()` (mismo patrón que `private.correo_verificado()`,
`008`) con `AND` a las 3 policies de escritura que ya exigían correo
verificado — `inscripciones_insert_propio` (`008`), `progreso_insert_propio`
y `progreso_update_propio` (`014`). Las dos capas se complementan: el
`signOut` corta la sesión normal de inmediato (mejor UX, error claro en
el próximo request); `cuenta_activa()` en RLS cierra el hueco del token
todavía válido usado fuera del flujo normal de la app, sin depender de
que el `signOut` se haya ejecutado con éxito.

A propósito no toca ningún `SELECT`: un usuario suspendido sigue viendo
su progreso histórico y certificados ya emitidos — algo que ya
pagó/tiene legítimamente. Solo se bloquea que genere actividad nueva.

No hay conflicto con `login.ts` (que ya hace su propio `auth.signOut()`
local al detectar `SUSPENDIDO` en el intento de login): son casos
distintos (sesión nueva que el propio usuario intenta crear vs. sesiones
previas que un admin corta desde el panel) y no comparten cliente ni
estado.

Repetir los pasos 1-23 en cada entorno nuevo (Staging y Production son
proyectos de Supabase separados, ver `docs/technical-spec.md` §10).

## Prueba de RLS con 3 sesiones

`scripts/rls-test.ts` (`npm run test:rls`) llama la API de Supabase
directamente (nunca la UI) con tres sesiones — anónimo, estudiante sin
acceso, estudiante con acceso — e intenta leer/escribir datos que no le
corresponden a cada una; falla si alguno de esos intentos tiene éxito.
Crea y borra sus propios datos desechables en cada corrida (dos usuarios
de prueba, un plan, una categoría/instructor/curso sin publicar), así que
no depende del estado de las cuentas sembradas por `prisma/seed.ts`. Se
vuelve a correr en la Fase 7 del `development-plan.md`.
