-- ============================================================
-- Slug de curso en las vistas/RPC que alimentan las tarjetas y links
-- públicos, para que la app pueda armar /cursos/<slug> sin una consulta
-- aparte por curso.
--
-- `cursos.slug` existe desde
-- prisma/migrations/.../agrega_slug_a_cursos_y_lecciones (ver
-- prisma/schema.prisma), pero no viajaba todavía en `buscar_catalogo`
-- (059_categorias_multiples_catalogo.sql) ni en la vista
-- `progreso_cursos_estudiante` (033_vista_progreso_cursos.sql) — hasta
-- ahora las rutas públicas de curso/lección usaban el UUID crudo.
-- ============================================================

-- CREATE OR REPLACE no puede agregar una columna en medio del `returns
-- table` sin romper el orden posicional que ya usa supabase-js — se agrega
-- al final para no reordenar las columnas existentes, pero igual hay que
-- soltar la función porque cambia su firma de salida.
drop function if exists public.buscar_catalogo(text, uuid, int, int);

create function public.buscar_catalogo(
  p_query text default null,
  p_categoria_id uuid default null,
  p_limite int default 12,
  p_offset int default 0
)
returns table (
  curso_id uuid,
  titulo text,
  nivel text,
  imagen_portada text,
  instructor_nombre text,
  categorias jsonb,
  total_clases bigint,
  total_resultados bigint,
  curso_slug text
)
language sql
stable
set search_path = public, extensions
as $$
  with base as (
    select
      c.id,
      c.titulo,
      c.nivel::text,
      c.imagen_portada,
      c.orden_visualizacion,
      c.slug,
      ins.instructor_nombre,
      (
        select jsonb_agg(jsonb_build_object('id', cat.id, 'nombre', cat.nombre) order by cat.nombre)
        from public.curso_categorias cc2
        join public.categorias cat on cat.id = cc2.id_categoria
        where cc2.id_curso = c.id
      ) as categorias,
      (
        select count(*)
        from public.modulos m2
        join public.lecciones l2 on l2.id_modulo = m2.id
        where m2.id_curso = c.id
      ) as total_clases
    from public.cursos c
    left join lateral (
      select string_agg(cip.nombre, ', ' order by cip.nombre) as instructor_nombre
      from public.curso_instructores_publico cip
      where cip.id_curso = c.id
    ) ins on true
    where c.mostrado = true
      and (
        p_categoria_id is null
        or exists (
          select 1 from public.curso_categorias cc
          where cc.id_curso = c.id and cc.id_categoria = p_categoria_id
        )
      )
      and (
        p_query is null or trim(p_query) = ''
        or public.normalizar_busqueda(c.titulo) ilike '%' || public.normalizar_busqueda(p_query) || '%'
        or exists (
          select 1
          from public.curso_instructores_publico cip2
          where cip2.id_curso = c.id
            and public.normalizar_busqueda(cip2.nombre) ilike '%' || public.normalizar_busqueda(p_query) || '%'
        )
      )
  )
  select
    base.id,
    base.titulo,
    base.nivel,
    base.imagen_portada,
    base.instructor_nombre,
    base.categorias,
    base.total_clases,
    count(*) over() as total_resultados,
    base.slug
  from base
  order by base.orden_visualizacion, base.id
  limit p_limite offset p_offset;
$$;

grant execute on function public.buscar_catalogo(text, uuid, int, int) to anon, authenticated;

-- --------------------------------------------------------------
-- progreso_cursos_estudiante: agrega slug del curso, mismo motivo.
-- --------------------------------------------------------------
drop view if exists public.progreso_cursos_estudiante;

create view public.progreso_cursos_estudiante
with (security_invoker = true) as
with cursos_tocados as (
  select distinct m.id_curso
  from public.progreso pr
  join public.lecciones l on l.id = pr.id_leccion
  join public.modulos m on m.id = l.id_modulo
)
select
  c.id as curso_id,
  c.slug as curso_slug,
  c.titulo,
  c.imagen_portada,
  c.nivel,
  count(l.id) filter (where l.estado_procesamiento = 'LISTO') as lecciones_total,
  count(l.id) filter (where l.estado_procesamiento = 'LISTO' and pr.completado) as lecciones_completadas,
  max(pr.actualizado_en) as ultima_actividad
from cursos_tocados ct
join public.cursos c on c.id = ct.id_curso
join public.modulos m on m.id_curso = c.id
join public.lecciones l on l.id_modulo = m.id
left join lateral (
  select bool_or(pr.completado) as completado, max(pr.actualizado_en) as actualizado_en
  from public.progreso pr
  where pr.id_leccion = l.id
) pr on true
group by c.id, c.slug, c.titulo, c.imagen_portada, c.nivel;

grant select on public.progreso_cursos_estudiante to authenticated;
