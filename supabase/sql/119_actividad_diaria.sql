-- ============================================================
-- actividad_diaria: un día por estudiante en que avanzó en alguna clase.
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-118, y
-- después de la migración de Prisma que crea la tabla
-- (prisma/migrations/20261016000000_actividad_diaria).
--
-- Para qué
-- --------
-- La racha de días seguidos del inicio del panel ("Tu obra"). `progreso`
-- guarda solo la ÚLTIMA vez que se tocó cada clase, así que no sirve para
-- saber qué días estudió alguien: si ayer y hoy vio la misma clase, ayer se
-- pierde. Esta tabla guarda cada día una vez.
--
-- Quién escribe
-- -------------
-- Solo el trigger sobre `progreso` (insert o update, que es lo que pasa al
-- ver una clase o marcarla completada). El estudiante no inserta, no edita
-- ni borra nada aquí: no tiene ninguna política de escritura. Así la racha
-- no se puede inflar desde el cliente con PostgREST.
--
-- `fecha` es el día en America/Bogota (misma zona que
-- private.suscripcion_da_acceso): estudiar a las 9 p. m. cuenta para ese día.
-- ============================================================

create or replace function private.registrar_actividad_diaria()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.actividad_diaria (id_usuario, fecha)
  values (new.id_usuario, (now() at time zone 'America/Bogota')::date)
  on conflict (id_usuario, fecha) do nothing;
  return null;
end;
$$;

revoke execute on function private.registrar_actividad_diaria() from public, anon, authenticated;

-- AFTER y por fila: el progreso se guarda cada pocos segundos mientras corre
-- el video, y el ON CONFLICT DO NOTHING hace que eso cueste una búsqueda por
-- llave primaria. Solo cuenta un cambio real del avance (segundo o
-- completado): un update que no toca esas columnas no es estudiar.
drop trigger if exists registrar_actividad_diaria on public.progreso;
create trigger registrar_actividad_diaria
  after insert or update of segundo_actual, completado on public.progreso
  for each row execute function private.registrar_actividad_diaria();

alter table public.actividad_diaria enable row level security;

revoke all on public.actividad_diaria from anon;
revoke insert, update, delete on public.actividad_diaria from authenticated;

drop policy if exists "actividad_diaria_select_propio" on public.actividad_diaria;
create policy "actividad_diaria_select_propio" on public.actividad_diaria
  for select using ((select auth.uid()) = id_usuario);

-- Arranque: un día por cada fecha en que quedó registrado algún progreso.
-- Es incompleto a propósito (de antes de esta tabla solo se conoce la última
-- vez que se tocó cada clase), pero no inventa días: todo lo que entra aquí
-- pasó de verdad.
insert into public.actividad_diaria (id_usuario, fecha)
select distinct p.id_usuario, (p.actualizado_en at time zone 'America/Bogota')::date
from public.progreso p
on conflict (id_usuario, fecha) do nothing;
