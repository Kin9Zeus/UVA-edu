-- ============================================================
-- buscar_catalogo: todas las categorías del curso, no solo la primera
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-058.
-- Redefine buscar_catalogo (034, ya redefinida una vez en 053) — mismo
-- criterio que 053 usó para instructor_nombre: un curso puede tener más de
-- una categoría (`curso_categorias` es muchos-a-muchos, el mismo dato que
-- ya trae getCursoPublico() en lib/curso.ts para el detalle del curso),
-- pero el catálogo solo mostraba la primera por orden alfabético
-- (`categoria_nombre`, `limit 1`). La tarjeta del catálogo pasa a mostrar
-- todas como chips (src/components/catalogo/CursoCard.tsx), en vez de un
-- solo nombre superpuesto sobre la portada.
--
-- `categoria_nombre text` -> `categorias jsonb` (arreglo de {id, nombre},
-- ordenado por nombre). jsonb en vez de un array de un tipo compuesto
-- propio: PostgREST/supabase-js lo deserializa a un array de objetos JS
-- sin fricción, sin tener que registrar un tipo aparte solo para esto.
-- ============================================================

-- CREATE OR REPLACE no puede cambiar el tipo de una columna de salida
-- (categoria_nombre text -> categorias jsonb): hay que soltar la función
-- vieja primero.
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
  total_resultados bigint
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
      -- LEFT JOIN LATERAL, no INNER: un curso publicado al que todavía no se
      -- le asignó profesor tiene que seguir saliendo en el catálogo (la app
      -- muestra "Sin instructor"), no desaparecer de él.
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
    count(*) over() as total_resultados
  from base
  -- orden_visualizacion por sí solo no alcanza: la mayoría de los cursos
  -- comparte el valor por defecto (0), y sin un desempate estable Postgres
  -- no garantiza el mismo orden entre dos llamadas con distinto offset —
  -- la paginación podría repetir o saltarse cursos entre páginas.
  order by base.orden_visualizacion, base.id
  limit p_limite offset p_offset;
$$;

grant execute on function public.buscar_catalogo(text, uuid, int, int) to anon, authenticated;
