-- ============================================================
-- Categorías del panel: dónde estudió la gente.
--
-- Orden de aplicación: DESPUÉS de 000-127.
--
-- `admin_estudio_por_categoria`: por categoría, cuántas personas tocaron una
-- clase de sus cursos desde `p_desde` y cuántos certificados se emitieron de
-- sus cursos. `progreso.actualizado_en` es la última vez que se tocó cada
-- clase: para "estudió desde tal fecha hasta hoy" basta, porque la última vez
-- es la más reciente.
--
-- La fila con `id_categoria` nulo es el total sin repetir (GROUPING SETS):
-- una persona que estudia en dos categorías cuenta en las dos, pero una sola
-- vez en el total. Agregado en Postgres para no traer miles de filas de
-- progreso a la aplicación.
-- ============================================================

create or replace function public.admin_estudio_por_categoria(p_desde timestamptz)
returns table (id_categoria uuid, personas bigint, certificados bigint)
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
  with hechos as (
    select cc.id_categoria, pr.id_usuario, null::uuid as id_certificado
    from public.progreso pr
    join public.lecciones l on l.id = pr.id_leccion
    join public.modulos m on m.id = l.id_modulo
    join public.curso_categorias cc on cc.id_curso = m.id_curso
    where pr.actualizado_en >= p_desde
    union all
    select cc.id_categoria, null, ce.id
    from public.certificados ce
    join public.curso_categorias cc on cc.id_curso = ce.id_curso
    where ce.fecha_emision >= p_desde
  )
  select h.id_categoria, count(distinct h.id_usuario)::bigint, count(distinct h.id_certificado)::bigint
  from hechos h
  group by grouping sets ((h.id_categoria), ());
end;
$$;

revoke execute on function public.admin_estudio_por_categoria(timestamptz) from public, anon;
grant execute on function public.admin_estudio_por_categoria(timestamptz) to authenticated;
