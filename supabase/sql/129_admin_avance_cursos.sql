-- ============================================================
-- Cursos del panel: cuánto avanza la gente y dónde se atasca.
--
-- Orden de aplicación: DESPUÉS de 000-128.
--
-- Las dos funciones cuentan solo clases con video LISTO, igual que el avance
-- que ve el estudiante y la regla del certificado
-- (`private.lecciones_completas_curso`). Las vistas `avance_cursos` y
-- `abandono_lecciones` (036) cuentan todas las clases; el panel de Cursos ya
-- no las usa.
--
-- "Se quedó" = empezó y lleva desde `p_quieto` sin tocar el curso (o la
-- clase) sin haberlo terminado. `progreso.actualizado_en` es la última vez que
-- se tocó cada clase.
--
-- Agregado en Postgres para no traer a la aplicación todas las filas de
-- progreso (lo que hacía antes el listado de cursos).
-- ============================================================

-- `admin_resumen_cursos`: por curso, cuántas personas lo empezaron (tocaron
-- alguna clase), cuántas terminaron todas sus clases con video, cuántas se
-- quedaron, cuántas estudiaron desde `p_desde` y cuántos certificados se
-- emitieron desde `p_desde`. La fila con `id_curso` nulo es el total sin
-- repetir personas (GROUPING SETS).
create or replace function public.admin_resumen_cursos(p_desde timestamptz, p_quieto timestamptz)
returns table (
  id_curso uuid,
  empezaron bigint,
  terminaron bigint,
  se_quedaron bigint,
  personas bigint,
  certificados bigint
)
language plpgsql
stable
set search_path = public
as $$
#variable_conflict use_column
begin
  if not private.es_administrador() then
    raise exception 'No tienes permisos de administrador.' using errcode = '42501';
  end if;

  return query
  with listas as (
    select m.id_curso, count(*) as total
    from public.lecciones l
    join public.modulos m on m.id = l.id_modulo
    where l.estado_procesamiento = 'LISTO'
    group by m.id_curso
  ),
  por_persona as (
    select
      m.id_curso,
      pr.id_usuario,
      count(*) filter (where pr.completado and l.estado_procesamiento = 'LISTO') as hechas,
      max(pr.actualizado_en) as ultima
    from public.progreso pr
    join public.lecciones l on l.id = pr.id_leccion
    join public.modulos m on m.id = l.id_modulo
    group by m.id_curso, pr.id_usuario
  ),
  hechos as (
    select
      p.id_curso,
      p.id_usuario,
      coalesce(t.total, 0) > 0 and p.hechas >= t.total as termino,
      p.ultima,
      null::uuid as id_certificado
    from por_persona p
    left join listas t on t.id_curso = p.id_curso
    union all
    select ce.id_curso, null, false, null, ce.id
    from public.certificados ce
    where ce.fecha_emision >= p_desde
  )
  select
    h.id_curso,
    count(distinct h.id_usuario)::bigint,
    count(distinct h.id_usuario) filter (where h.termino)::bigint,
    count(distinct h.id_usuario) filter (where not h.termino and h.ultima < p_quieto)::bigint,
    count(distinct h.id_usuario) filter (where h.ultima >= p_desde)::bigint,
    count(distinct h.id_certificado)::bigint
  from hechos h
  group by grouping sets ((h.id_curso), ());
end;
$$;

revoke execute on function public.admin_resumen_cursos(timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_resumen_cursos(timestamptz, timestamptz) to authenticated;

-- `admin_clases_con_atascos`: las clases con video donde más personas
-- empezaron y llevan desde `p_quieto` sin terminarla, con su módulo y curso.
create or replace function public.admin_clases_con_atascos(p_quieto timestamptz, p_limite int)
returns table (
  id_leccion uuid,
  leccion text,
  modulo text,
  id_curso uuid,
  curso text,
  curso_slug text,
  personas bigint
)
language plpgsql
stable
set search_path = public
as $$
#variable_conflict use_column
begin
  if not private.es_administrador() then
    raise exception 'No tienes permisos de administrador.' using errcode = '42501';
  end if;

  return query
  select l.id, l.titulo::text, m.titulo::text, c.id, c.titulo::text, c.slug::text, count(*)::bigint
  from public.progreso pr
  join public.lecciones l on l.id = pr.id_leccion
  join public.modulos m on m.id = l.id_modulo
  join public.cursos c on c.id = m.id_curso
  where not pr.completado
    and pr.actualizado_en < p_quieto
    and l.estado_procesamiento = 'LISTO'
  group by l.id, m.id, c.id
  order by count(*) desc, c.titulo, l.titulo
  limit p_limite;
end;
$$;

revoke execute on function public.admin_clases_con_atascos(timestamptz, int) from public, anon;
grant execute on function public.admin_clases_con_atascos(timestamptz, int) to authenticated;
