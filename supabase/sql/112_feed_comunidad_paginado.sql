-- ============================================================
-- Feed de Comunidad paginado en Postgres. Cierra AUDIT-2026-09-15.md — P2-10
-- (la mitad de Comunidad; la de reseñas de curso va aparte).
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-111.
-- Depende de normalizar_busqueda() (034), de comunidad_autor_publico (085,
-- redefinida en 091) y de la RLS de Comunidad (083/084/105).
--
-- El problema
-- -----------
-- getComunidadFeed (src/lib/comunidad.ts) leía TODAS las publicaciones no
-- eliminadas de la categoría y, con todas ellas —no con las 20 de la
-- página—, traía reacciones, adjuntos y respuestas y firmaba en Storage
-- cada imagen del feed completo. Recién después filtraba la búsqueda,
-- ordenaba y cortaba la página. Además de lento, eso fallaba en silencio:
--   · los `.in("id_post", [...])` con todos los UUID del feed crecen con el
--     número de publicaciones y terminan pasando el largo máximo de URL;
--   · la consulta de reacciones del feed entero choca con el tope de filas
--     de la API y los conteos (y el orden por relevancia) salen mal sin
--     ningún error.
--
-- Qué hace
-- --------
-- Filtro, búsqueda, orden y paginación ocurren aquí; la app recibe solo la
-- página y enriquece esas filas (autores, adjuntos, firmas). Mismo patrón que
-- buscar_catalogo (034): el total viaja repetido en cada fila para armar la
-- paginación sin otra consulta.
--
-- `security invoker` (el default), igual que buscar_catalogo: corre con los
-- permisos de quien llama, así que la RLS de comunidad_posts,
-- comunidad_respuestas y comunidad_reacciones sigue decidiendo qué se ve.
-- Sin acceso a Comunidad la función no devuelve filas; no repite el gate.
--
-- "Mis publicaciones" usa auth.uid(), no un id que mande la app.
--
-- Búsqueda
-- --------
-- Título, contenido o NOMBRE DEL AUTOR, sin distinguir tildes ni mayúsculas
-- (normalizar_busqueda). El nombre sale de comunidad_autor_publico, no de
-- perfiles: la RLS de perfiles solo deja leer la fila propia, y la vista
-- existe justamente para exponer el nombre sin el resto del perfil.
--
-- El término se busca LITERAL: `%`, `_` y `\` se escapan antes del LIKE.
-- Sin eso, buscar "100%" o "a_b" haría coincidir cosas que no contienen ese
-- texto, cuando el filtro en JavaScript que reemplaza usaba `includes()`.
--
-- Paginación
-- ----------
-- `p_pagina` se acota a [1, última página] aquí mismo, como hacía el código
-- anterior: pedir la página 99 de un feed de 3 páginas devuelve la 3, y la
-- columna `pagina` dice cuál se devolvió realmente.
--
-- Orden
-- -----
-- Fijadas primero siempre. Después, "reciente" (por fecha) u otra cosa
-- tratada como "relevancia": respuestas no eliminadas + reacciones, y a
-- igual puntaje, la más reciente. El puntaje solo se calcula cuando se
-- ordena por relevancia; con "reciente" los conteos se calculan únicamente
-- para las filas de la página.
-- ============================================================

-- Índices de trigramas para la búsqueda, mismo criterio que los del catálogo
-- (034). `if not exists` y no drop/create: db:rls corre en cada despliegue y
-- reconstruir un GIN sobre `contenido` cada vez no aporta nada.
create index if not exists comunidad_posts_titulo_trgm_idx
  on public.comunidad_posts using gin (public.normalizar_busqueda(titulo) gin_trgm_ops);

create index if not exists comunidad_posts_contenido_trgm_idx
  on public.comunidad_posts using gin (public.normalizar_busqueda(contenido) gin_trgm_ops);

drop function if exists public.buscar_feed_comunidad(text, boolean, text, text, int, int);
create or replace function public.buscar_feed_comunidad(
  p_categoria text default null,
  p_solo_propios boolean default false,
  p_busqueda text default null,
  p_orden text default 'reciente',
  p_pagina int default 1,
  p_por_pagina int default 20
)
returns table (
  id uuid,
  slug text,
  id_usuario uuid,
  categoria text,
  titulo text,
  contenido text,
  fijado boolean,
  creado_en timestamptz,
  empleo_empresa text,
  empleo_modalidad text,
  empleo_ubicacion text,
  empleo_enlace text,
  total_respuestas bigint,
  total_reacciones bigint,
  me_reaccione boolean,
  total_resultados bigint,
  pagina int
)
language sql
stable
set search_path = public, extensions
as $$
  with parametros as (
    select
      coalesce(p_orden, '') = 'relevancia' as por_relevancia,
      greatest(1, least(coalesce(p_por_pagina, 20), 100)) as por_pagina,
      case
        when nullif(trim(coalesce(p_busqueda, '')), '') is null then null
        else '%' || replace(replace(replace(
          public.normalizar_busqueda(trim(p_busqueda)),
          '\', '\\'), '%', '\%'), '_', '\_') || '%'
      end as patron
  ),
  -- CTE aparte y no una subconsulta dentro del WHERE de `filtradas`: allí
  -- `prm.patron` viene de otra fila del FROM, y eso vuelve la subconsulta
  -- CORRELACIONADA — Postgres ejecutaba la vista de autores una vez por cada
  -- publicación (medido: ~4 s con 2.000 publicaciones, contra ~22 ms así).
  autores_coincidentes as materialized (
    select a.id
    from public.comunidad_autor_publico a, parametros prm
    where prm.patron is not null
      and public.normalizar_busqueda(a.nombre) like prm.patron
  ),
  filtradas as (
    select p.id, p.fijado, p.creado_en
    from public.comunidad_posts p, parametros prm
    where not p.eliminado
      and (
        case
          when coalesce(p_solo_propios, false) then p.id_usuario = (select auth.uid())
          else p_categoria is null or p.categoria::text = p_categoria
        end
      )
      and (
        prm.patron is null
        or public.normalizar_busqueda(p.titulo) like prm.patron
        or public.normalizar_busqueda(p.contenido) like prm.patron
        or p.id_usuario in (select id from autores_coincidentes)
      )
  ),
  total as (
    select count(*) as n from filtradas
  ),
  pagina_efectiva as (
    select
      greatest(1, least(
        coalesce(p_pagina, 1),
        ceil(total.n::numeric / prm.por_pagina)::int
      )) as n,
      prm.por_pagina
    from total, parametros prm
  ),
  ordenadas as (
    select
      f.id,
      f.fijado,
      f.creado_en,
      case
        when (select por_relevancia from parametros) then
          (select count(*) from public.comunidad_respuestas r where r.id_post = f.id and not r.eliminado)
          + (select count(*) from public.comunidad_reacciones re where re.id_post = f.id)
        else 0
      end as puntaje
    from filtradas f
    order by f.fijado desc, puntaje desc, f.creado_en desc, f.id
    limit (select por_pagina from pagina_efectiva)
    offset (select (n - 1) * por_pagina from pagina_efectiva)
  )
  select
    p.id,
    p.slug,
    p.id_usuario,
    p.categoria::text,
    p.titulo,
    p.contenido,
    p.fijado,
    p.creado_en,
    p.empleo_empresa,
    p.empleo_modalidad,
    p.empleo_ubicacion,
    p.empleo_enlace,
    respuestas.total,
    reacciones.total,
    reacciones.mia,
    (select n from total),
    (select n from pagina_efectiva)
  from ordenadas o
  join public.comunidad_posts p on p.id = o.id
  cross join lateral (
    select count(*) as total
    from public.comunidad_respuestas r
    where r.id_post = p.id and not r.eliminado
  ) respuestas
  cross join lateral (
    select
      count(*) as total,
      coalesce(bool_or(re.id_usuario = (select auth.uid())), false) as mia
    from public.comunidad_reacciones re
    where re.id_post = p.id
  ) reacciones
  order by o.fijado desc, o.puntaje desc, o.creado_en desc, o.id;
$$;

revoke execute on function public.buscar_feed_comunidad(text, boolean, text, text, int, int) from public;
revoke execute on function public.buscar_feed_comunidad(text, boolean, text, text, int, int) from anon;
grant execute on function public.buscar_feed_comunidad(text, boolean, text, text, int, int) to authenticated;

-- ------------------------------------------------------------
-- Riel "Más respondidas esta semana". getComunidadDestacados traía todas las
-- publicaciones de los últimos 7 días y contaba sus respuestas en Node, con el
-- mismo `.in()` que crece sin límite. Aquí se agrega y se corta en SQL.
-- Mismo `security invoker` y mismo criterio que antes: solo cuentan
-- respuestas no eliminadas, y una publicación sin respuestas no aparece.
-- ------------------------------------------------------------
drop function if exists public.comunidad_mas_respondidas(int, int);
create or replace function public.comunidad_mas_respondidas(
  p_dias int default 7,
  p_limite int default 4
)
returns table (
  id uuid,
  slug text,
  titulo text,
  total_respuestas bigint
)
language sql
stable
set search_path = public
as $$
  select p.id, p.slug, p.titulo, count(r.id) as total_respuestas
  from public.comunidad_posts p
  join public.comunidad_respuestas r on r.id_post = p.id and not r.eliminado
  where not p.eliminado
    and p.creado_en >= now() - make_interval(days => greatest(1, coalesce(p_dias, 7)))
  group by p.id, p.slug, p.titulo, p.creado_en
  order by count(r.id) desc, p.creado_en desc
  limit greatest(1, least(coalesce(p_limite, 4), 20));
$$;

revoke execute on function public.comunidad_mas_respondidas(int, int) from public;
revoke execute on function public.comunidad_mas_respondidas(int, int) from anon;
grant execute on function public.comunidad_mas_respondidas(int, int) to authenticated;
