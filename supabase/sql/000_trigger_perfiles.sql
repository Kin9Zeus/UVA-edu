-- ============================================================
-- Trigger: sincroniza auth.users -> public.perfiles
-- Ver docs/technical-spec.md §6 (Autenticación e Identidad).
--
-- Al registrarse un usuario en Supabase Auth (email o Google OAuth),
-- este trigger crea automáticamente su fila en `perfiles` con rol
-- ESTUDIANTE por defecto.
--
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de correr las
-- migraciones de Prisma (la tabla `perfiles` debe existir primero).
-- ============================================================

-- Se crea en el schema `private` (no expuesto por la API REST de
-- Supabase/PostgREST) porque esta función SOLO la invoca el propio
-- trigger de Postgres — nadie debe poder llamarla vía
-- /rest/v1/rpc/handle_new_user. Ver 001_rls_policies.sql para el
-- porqué de este patrón (schema `private` vs `public`).
create schema if not exists private;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.perfiles (id, nombre, correo, rol, estado)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'nombre',
      new.raw_user_meta_data ->> 'full_name',
      split_part(new.email, '@', 1)
    ),
    new.email,
    'ESTUDIANTE',
    'ACTIVO'
  );
  return new;
end;
$$;

-- Los triggers no requieren que el rol que dispara el INSERT tenga
-- privilegio EXECUTE sobre la función, así que no hace falta ningún
-- GRANT adicional aquí.
revoke execute on function private.handle_new_user() from public;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();
