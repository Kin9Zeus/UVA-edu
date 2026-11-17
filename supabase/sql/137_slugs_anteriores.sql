-- ============================================================
-- Historial de slugs de cursos y escuelas
-- (SEO fase 14, tarea «migración al dominio definitivo», paso 7).
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-136 y de
-- la migración de Prisma 20261117000000_slugs_anteriores (las tablas).
--
-- Qué resuelve
-- ------------
-- El slug de un curso se regenera al cambiar su título, y el de una escuela
-- al cambiar su nombre (src/actions/admin/cursos.ts y categorias.ts). Sin
-- historial, la URL vieja daba 404: se perdía lo ganado en buscadores y
-- cualquier enlace compartido. Con esto, la app busca el slug viejo aquí y
-- redirige con 308 a la URL actual.
--
-- Por qué un trigger y no la Server Action
-- ----------------------------------------
-- Cubre cualquier forma de cambiar el slug (panel, SQL a mano, un script),
-- no solo las dos acciones del admin. Las tablas no admiten escritura desde
-- la API: solo las llena el trigger, que corre como SECURITY DEFINER.
--
-- Lectura
-- -------
-- Una fila es visible si el visitante puede ver el curso o la escuela a la
-- que apunta: la subconsulta pasa por la RLS de `cursos`, así que un curso
-- despublicado no revela su slug actual a quien no lo puede ver.
--
-- Idempotente: drop/create de políticas y triggers, create or replace de
-- funciones.
-- ============================================================

alter table public.cursos_slugs_anteriores enable row level security;
alter table public.categorias_slugs_anteriores enable row level security;

revoke insert, update, delete on public.cursos_slugs_anteriores from public, anon, authenticated;
revoke insert, update, delete on public.categorias_slugs_anteriores from public, anon, authenticated;
grant select on public.cursos_slugs_anteriores to anon, authenticated;
grant select on public.categorias_slugs_anteriores to anon, authenticated;

drop policy if exists "cursos_slugs_anteriores_select" on public.cursos_slugs_anteriores;
create policy "cursos_slugs_anteriores_select" on public.cursos_slugs_anteriores
  for select using (
    exists (select 1 from public.cursos where cursos.id = cursos_slugs_anteriores.id_curso)
  );

drop policy if exists "categorias_slugs_anteriores_select" on public.categorias_slugs_anteriores;
create policy "categorias_slugs_anteriores_select" on public.categorias_slugs_anteriores
  for select using (
    exists (select 1 from public.categorias where categorias.id = categorias_slugs_anteriores.id_categoria)
  );

-- Guarda el slug viejo y saca del historial el nuevo: si un curso vuelve a
-- un título anterior, su slug deja de ser «anterior» y la URL responde
-- directo. `on conflict` reasigna un slug viejo si otro curso lo tuvo antes
-- (no debería pasar: los generadores lo tratan como ocupado).
create or replace function private.guardar_slug_anterior_curso()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.cursos_slugs_anteriores (slug, id_curso)
  values (old.slug, old.id)
  on conflict (slug) do update set id_curso = excluded.id_curso, creado_en = now();

  delete from public.cursos_slugs_anteriores where slug = new.slug;
  return new;
end;
$$;

create or replace function private.guardar_slug_anterior_categoria()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.categorias_slugs_anteriores (slug, id_categoria)
  values (old.slug, old.id)
  on conflict (slug) do update set id_categoria = excluded.id_categoria, creado_en = now();

  delete from public.categorias_slugs_anteriores where slug = new.slug;
  return new;
end;
$$;

revoke execute on function private.guardar_slug_anterior_curso() from public, anon, authenticated;
revoke execute on function private.guardar_slug_anterior_categoria() from public, anon, authenticated;

drop trigger if exists cursos_guarda_slug_anterior on public.cursos;
create trigger cursos_guarda_slug_anterior
  after update of slug on public.cursos
  for each row
  when (old.slug is distinct from new.slug)
  execute function private.guardar_slug_anterior_curso();

drop trigger if exists categorias_guarda_slug_anterior on public.categorias;
create trigger categorias_guarda_slug_anterior
  after update of slug on public.categorias
  for each row
  when (old.slug is distinct from new.slug)
  execute function private.guardar_slug_anterior_categoria();
