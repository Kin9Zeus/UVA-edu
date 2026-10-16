-- ============================================================
-- Duración total de cada curso en `buscar_catalogo`.
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-120
-- (119 y 120 son los de actividad diaria).
-- Reemplaza la definición de 062_slug_en_vistas_publicas.sql.
--
-- Por qué
-- -------
-- La tarjeta del catálogo rediseñado muestra "10 clases · 1 h 28 min". La
-- ficha del curso ya suma la duración (getCursoDetalle, src/lib/curso.ts),
-- pero el catálogo no la recibía. Se suma aquí, en la misma fila por curso,
-- para no hacer una consulta aparte por tarjeta.
--
-- Mismo criterio que la ficha: solo cuentan las clases con video LISTO. En
-- cualquier otro estado, `lecciones.duracion` no corresponde a un video real
-- (datos de siembra, subidas que nunca terminaron), así que mostrarla sería
-- anunciar minutos que nadie puede ver. Un curso sin videos listos da 0 y la
-- tarjeta oculta la duración.
--
-- `total_clases` no cambia (cuenta todas las clases, igual que la ficha).
--
-- La columna nueva va AL FINAL del `returns table` para no reordenar las que
-- ya existen; igual hay que soltar la función porque cambia su firma de
-- salida. Idempotente: drop + create.
-- ============================================================

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
  curso_slug text,
  duracion_total_segundos bigint
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
      clases.total_clases,
      clases.duracion_total_segundos
    from public.cursos c
    left join lateral (
      select string_agg(cip.nombre, ', ' order by cip.nombre) as instructor_nombre
      from public.curso_instructores_publico cip
      where cip.id_curso = c.id
    ) ins on true
    -- Un solo recorrido de las clases del curso para las dos cifras.
    cross join lateral (
      select
        count(*) as total_clases,
        coalesce(
          sum(l2.duracion) filter (where l2.estado_procesamiento = 'LISTO'),
          0
        )::bigint as duracion_total_segundos
      from public.modulos m2
      join public.lecciones l2 on l2.id_modulo = m2.id
      where m2.id_curso = c.id
    ) clases
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
    base.slug,
    base.duracion_total_segundos
  from base
  order by base.orden_visualizacion, base.id
  limit p_limite offset p_offset;
$$;

grant execute on function public.buscar_catalogo(text, uuid, int, int) to anon, authenticated;
