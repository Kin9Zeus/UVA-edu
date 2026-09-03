-- ------------------------------------------------------------
-- BÚSQUEDA Y FILTRO DE CATÁLOGO EN EL SERVIDOR
--
-- Revf3 ("Catálogo con búsqueda por palabra clave y filtro por categoría"):
-- la búsqueda y el filtro vivían enteramente en el cliente (CatalogoContent
-- traía TODO el catálogo y hacía `.filter()`/`.includes()` en el navegador).
-- Esto mueve la búsqueda, el filtro por categoría y la paginación a
-- Postgres.
--
-- ILIKE + índice de trigramas (pg_trgm), no tsvector/tsquery: la búsqueda
-- necesita coincidir con substrings a mitad de palabra ("iseñ" dentro de
-- "Diseño"), que tsquery no resuelve bien (opera por palabras completas con
-- stemming). `pg_trgm` sí acelera `ILIKE '%term%'` con un índice GIN.
--
-- `unaccent()` normaliza tildes ("diseno" debe encontrar "Diseño") pero es
-- STABLE, no IMMUTABLE — Postgres no deja usarla directo en una expresión
-- de índice. `normalizar_busqueda()` es el wrapper IMMUTABLE de siempre
-- para este problema (mismo patrón documentado en la documentación de
-- Postgres/Supabase para búsqueda insensible a tildes).
-- ------------------------------------------------------------

create extension if not exists unaccent;
create extension if not exists pg_trgm;

create or replace function public.normalizar_busqueda(texto text)
returns text
language sql
immutable
parallel safe
set search_path = public, extensions
as $$
  select lower(unaccent('unaccent', coalesce(texto, '')));
$$;

drop index if exists public.cursos_titulo_trgm_idx;
create index cursos_titulo_trgm_idx
  on public.cursos using gin (public.normalizar_busqueda(titulo) gin_trgm_ops);

drop index if exists public.instructores_nombre_trgm_idx;
create index instructores_nombre_trgm_idx
  on public.instructores using gin (public.normalizar_busqueda(nombre) gin_trgm_ops);

-- --------------------------------------------------------------
-- RPC: buscar_catalogo
--
-- Una fila por curso que cumple todos los filtros, con el total de
-- resultados repetido en cada fila (`count(*) over()`) para que la app
-- arme la paginación sin una segunda consulta. `security invoker` (el
-- default, sin SECURITY DEFINER): corre con los permisos de quien llama,
-- así que RLS de `cursos`/`instructores`/`curso_categorias` sigue
-- aplicando por debajo del filtro explícito `mostrado = true` — igual
-- doble capa que ya usaba getCatalogo() antes de esta migración.
-- --------------------------------------------------------------
-- Idempotencia con 059_categorias_multiples_catalogo.sql: ese script
-- cambia el tipo de la columna `categoria_nombre`/`categorias` del
-- resultado, algo que `create or replace function` no permite sobre una
-- función ya existente ("cannot change return type of existing
-- function"). En un ambiente que ya corrió 059 antes, reejecutar la
-- cadena completa (npm run db:rls/--check) llegaría acá con la firma
-- nueva (jsonb) y esta definición vieja (text) fallaría. El drop deja que
-- esta reconstruya la firma vieja sin problema; 059 la vuelve a
-- reemplazar más adelante en la misma corrida, así que el resultado final
-- de una corrida completa no cambia.
drop function if exists public.buscar_catalogo(text, uuid, int, int);
create or replace function public.buscar_catalogo(
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
  categoria_nombre text,
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
      i.nombre as instructor_nombre,
      (
        select cat.nombre
        from public.curso_categorias cc2
        join public.categorias cat on cat.id = cc2.id_categoria
        where cc2.id_curso = c.id
        order by cat.nombre
        limit 1
      ) as categoria_nombre,
      (
        select count(*)
        from public.modulos m2
        join public.lecciones l2 on l2.id_modulo = m2.id
        where m2.id_curso = c.id
      ) as total_clases
    from public.cursos c
    join public.instructores i on i.id = c.id_instructor
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
        or public.normalizar_busqueda(i.nombre) ilike '%' || public.normalizar_busqueda(p_query) || '%'
      )
  )
  select
    base.id,
    base.titulo,
    base.nivel,
    base.imagen_portada,
    base.instructor_nombre,
    base.categoria_nombre,
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
