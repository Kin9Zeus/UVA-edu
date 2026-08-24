-- ============================================================
-- RLS de curso_categorias (tabla puente curso↔categoría)
-- Ver Bloque 3 de la auditoría de esquema
-- (prisma/migrations/20260824030000_curso_categorias_muchos_a_muchos).
--
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de 000-020 y de correr
-- esa migración de Prisma.
--
-- Mismo criterio que "modulos_select_curso_publico" (001/002): la
-- lectura sigue la visibilidad del curso padre (mostrado = true, o
-- admin). Escritura solo admin, separada por operación (Bloque 2 de
-- la auditoría de RLS: nada de políticas `for all`).
-- ============================================================

alter table public.curso_categorias enable row level security;

drop policy if exists "curso_categorias_select_publico" on public.curso_categorias;
create policy "curso_categorias_select_publico" on public.curso_categorias
  for select using (
    exists (
      select 1 from public.cursos
      where cursos.id = curso_categorias.id_curso
        and (cursos.mostrado = true or private.es_administrador())
    )
  );

drop policy if exists "curso_categorias_admin_insert" on public.curso_categorias;
create policy "curso_categorias_admin_insert" on public.curso_categorias
  for insert with check (private.es_administrador());

drop policy if exists "curso_categorias_admin_update" on public.curso_categorias;
create policy "curso_categorias_admin_update" on public.curso_categorias
  for update using (private.es_administrador())
  with check (private.es_administrador());

drop policy if exists "curso_categorias_admin_delete" on public.curso_categorias;
create policy "curso_categorias_admin_delete" on public.curso_categorias
  for delete using (private.es_administrador());
