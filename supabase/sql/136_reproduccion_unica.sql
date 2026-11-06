-- ============================================================
-- Un solo video a la vez por cuenta de estudiante
-- (docs/functional-spec.md, Flujo 05; development-plan.md, Fase 3).
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-135.
--
-- Cómo funciona
-- -------------
-- Cada vez que un reproductor arranca, `reclamar_reproduccion()` le da a la
-- cuenta un token nuevo y reemplaza el anterior: gana el último dispositivo.
-- En cada guardado periódico (~10 s) y en cada renovación del token de Mux,
-- el reproductor pregunta `reproduccion_vigente(token)`; si ya no es el
-- vigente, se pausa y avisa "Tu cuenta se está reproduciendo en otro
-- dispositivo", con un botón para volver a reclamar.
--
-- Los administradores quedan fuera: revisan cursos en varios equipos a la
-- vez. `reclamar` les devuelve null y `vigente` siempre true.
--
-- Por qué en `private` con funciones SECURITY DEFINER
-- ---------------------------------------------------
-- Igual que `private.limites_uso` (134): la tabla no se expone en la API.
-- Las funciones toman el usuario de `auth.uid()`, así que llamarlas directo
-- por la API solo afecta a la propia cuenta.
-- ============================================================

create table if not exists private.reproduccion_activa (
  id_usuario     uuid primary key references auth.users (id) on delete cascade,
  sesion         uuid not null,
  actualizado_en timestamptz not null default now()
);

alter table private.reproduccion_activa enable row level security;
revoke all on private.reproduccion_activa from public, anon, authenticated;

create or replace function public.reclamar_reproduccion()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sesion uuid := gen_random_uuid();
begin
  if auth.uid() is null then
    raise exception 'Hace falta una sesión.' using errcode = '42501';
  end if;
  if private.es_administrador() then
    return null;
  end if;

  insert into private.reproduccion_activa (id_usuario, sesion, actualizado_en)
  values (auth.uid(), v_sesion, now())
  on conflict (id_usuario) do update
    set sesion = excluded.sesion, actualizado_en = excluded.actualizado_en;

  return v_sesion;
end;
$$;

revoke execute on function public.reclamar_reproduccion() from public, anon;
grant execute on function public.reclamar_reproduccion() to authenticated;

-- Sin fila (p. ej. la tabla se vació) cuenta como vigente: no hay otro
-- dispositivo que haya reclamado.
create or replace function public.reproduccion_vigente(p_sesion uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Hace falta una sesión.' using errcode = '42501';
  end if;
  if private.es_administrador() then
    return true;
  end if;

  return not exists (
    select 1 from private.reproduccion_activa
    where id_usuario = auth.uid() and sesion is distinct from p_sesion
  );
end;
$$;

revoke execute on function public.reproduccion_vigente(uuid) from public, anon;
grant execute on function public.reproduccion_vigente(uuid) to authenticated;
