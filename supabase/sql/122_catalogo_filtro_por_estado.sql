-- ============================================================
-- Filtro por estado en el catálogo del panel: `buscar_catalogo` acepta una
-- lista de cursos a incluir y otra a excluir.
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-121.
-- Reemplaza la definición de 121_duracion_en_catalogo.sql (misma salida).
--
-- Por qué
-- -------
-- El catálogo con sesión filtra por "Sin empezar", "En progreso" y
-- "Completados". El estado de cada curso lo decide la app con la regla de
-- siempre (`estadoDeCurso`, src/lib/examenes/estadoPorCurso.ts) sobre
-- `progreso_cursos_estudiante`; aquí solo llega el resultado como lista de
-- ids. Filtrar en la base, y no en Next, mantiene el conteo y "Cargar más"
-- correctos sin traer el catálogo entero.
--
-- - `p_incluir`: si no es null, solo esos cursos ("En progreso",
--   "Completados"). Un arreglo vacío da cero resultados, que es lo correcto
--   cuando el estudiante no tiene cursos en ese estado.
-- - `p_excluir`: si no es null, todos menos esos ("Sin empezar" excluye los
--   que el estudiante ya tocó).
--
-- No abre nada nuevo: los dos filtros solo RESTAN cursos al listado público
-- de siempre (`mostrado = true`). Los parámetros van al final y con default
-- null, así que las llamadas de 4 argumentos siguen funcionando igual.
-- Idempotente: drop + create.
-- ============================================================

drop function if exists public.buscar_catalogo(text, uuid, int, int);
drop function if exists public.buscar_catalogo(text, uuid, int, int, uuid[], uuid[]);

create function public.buscar_catalogo(
  p_query text default null,
  p_categoria_id uuid default null,
  p_limite int default 12,
  p_offset int default 0,
  p_incluir uuid[] default null,
  p_excluir uuid[] default null
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
      and (p_incluir is null or c.id = any (p_incluir))
      and (p_excluir is null or not (c.id = any (p_excluir)))
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

grant execute on function public.buscar_catalogo(text, uuid, int, int, uuid[], uuid[]) to anon, authenticated;
