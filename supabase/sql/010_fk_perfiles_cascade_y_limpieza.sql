-- ============================================================
-- FK perfiles -> auth.users + housekeeping de cuentas sin verificar
-- (Flujo 02, ampliación). Ver docs/functional-spec.md Flujo 02 y
-- docs/technical-spec.md §6.
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-009.
-- ============================================================

-- Prisma no puede definir este FK porque `auth` es un schema fuera de su
-- alcance (ver el comentario en prisma/schema.prisma sobre Perfiles.id).
-- Sin él, borrar una fila de auth.users NO limpiaba la fila espejo en
-- perfiles y el job de abajo dejaría cuentas fantasma huérfanas.
do $$
begin
  alter table public.perfiles
    add constraint perfiles_id_fkey
    foreign key (id) references auth.users (id) on delete cascade;
exception
  when duplicate_object then null; -- ya existe, script re-corrido sin problema
end;
$$;

-- Housekeeping: elimina las cuentas que nunca confirmaron su correo y
-- llevan más de 7 días registradas, para liberar esos correos (Flujo 02,
-- paso 9). Vive en `private` porque solo la invoca el propio cron.schedule
-- de abajo, no un caller externo vía PostgREST.
create or replace function private.limpiar_usuarios_no_verificados()
returns void
language plpgsql
security definer
set search_path = auth
as $$
begin
  delete from auth.users
  where email_confirmed_at is null
    and created_at < now() - interval '7 days';
end;
$$;

-- Se usa pg_cron (en vez de un Route Handler o un cron de Railway) porque
-- el proyecto todavía está en fase de pruebas, sin entorno Railway
-- desplegado — es la única opción que no depende de infraestructura que
-- aún no existe. Si más adelante se prefiere mover esta lógica a un
-- Railway Cron Service en TypeScript (más alineado con el Admin API
-- oficial de Supabase para borrar usuarios en vez de DELETE directo sobre
-- auth.users), es una migración simple: reemplazar el cuerpo de la
-- función de arriba por una llamada a supabase.auth.admin.deleteUser()
-- por cada candidato, y desactivar el cron.schedule de abajo con
-- `select cron.unschedule('limpiar-usuarios-no-verificados');`.
create extension if not exists pg_cron;

-- cron.schedule() no acepta "or replace"; se desprograma primero por si
-- este script se vuelve a correr (mismo criterio idempotente que el
-- "drop policy if exists" del resto de esta carpeta).
select cron.unschedule(jobid)
from cron.job
where jobname = 'limpiar-usuarios-no-verificados';

select cron.schedule(
  'limpiar-usuarios-no-verificados',
  '0 3 * * *',
  $$select private.limpiar_usuarios_no_verificados();$$
);
