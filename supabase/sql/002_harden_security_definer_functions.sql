-- ============================================================
-- Parche: mueve las funciones SECURITY DEFINER fuera de `public`
-- para que Supabase (PostgREST) deje de exponerlas como endpoints
-- REST públicos (/rest/v1/rpc/es_administrador,
-- /rest/v1/rpc/handle_new_user).
--
-- Solo hace falta correr esto UNA VEZ, en un proyecto donde ya se
-- ejecutaron 000_trigger_perfiles.sql y 001_rls_policies.sql en su
-- versión anterior (con las funciones en `public`). Para proyectos
-- nuevos, 000 y 001 ya crean todo directamente en `private`.
-- ============================================================

create schema if not exists private;
grant usage on schema private to anon, authenticated, service_role;

-- --- handle_new_user: recreada en `private`, trigger reapuntado ---
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

revoke execute on function private.handle_new_user() from public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

drop function if exists public.handle_new_user();

-- --- es_administrador: recreada en `private`, políticas reapuntadas ---
create or replace function private.es_administrador()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and rol = 'ADMINISTRADOR'
  );
$$;

drop policy if exists "perfiles_select_propio" on public.perfiles;
create policy "perfiles_select_propio" on public.perfiles
  for select using (auth.uid() = id or private.es_administrador());

drop policy if exists "cursos_select_publicos" on public.cursos;
create policy "cursos_select_publicos" on public.cursos
  for select using (mostrado = true or private.es_administrador());

drop policy if exists "cursos_admin_escritura" on public.cursos;
create policy "cursos_admin_escritura" on public.cursos
  for all using (private.es_administrador())
  with check (private.es_administrador());

drop policy if exists "modulos_select_curso_publico" on public.modulos;
create policy "modulos_select_curso_publico" on public.modulos
  for select using (
    exists (
      select 1 from public.cursos
      where cursos.id = modulos.id_curso
        and (cursos.mostrado = true or private.es_administrador())
    )
  );

drop policy if exists "modulos_admin_escritura" on public.modulos;
create policy "modulos_admin_escritura" on public.modulos
  for all using (private.es_administrador())
  with check (private.es_administrador());

drop policy if exists "lecciones_select_curso_publico" on public.lecciones;
create policy "lecciones_select_curso_publico" on public.lecciones
  for select using (
    exists (
      select 1 from public.modulos
      join public.cursos on cursos.id = modulos.id_curso
      where modulos.id = lecciones.id_modulo
        and (cursos.mostrado = true or private.es_administrador())
    )
  );

drop policy if exists "lecciones_admin_escritura" on public.lecciones;
create policy "lecciones_admin_escritura" on public.lecciones
  for all using (private.es_administrador())
  with check (private.es_administrador());

drop policy if exists "certificados_select_propio" on public.certificados;
create policy "certificados_select_propio" on public.certificados
  for select using (auth.uid() = id_usuario or private.es_administrador());

drop function if exists public.es_administrador();
