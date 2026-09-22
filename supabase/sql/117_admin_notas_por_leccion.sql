-- ============================================================
-- public.admin_notas_por_leccion(uuid): cuántos estudiantes tienen notas
-- en cada lección y módulo de un curso — solo el número.
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-116.
--
-- Para qué
-- --------
-- D1 (docs/notas-leccion.md §3.2): borrar una lección borra en cascada las
-- notas privadas de los estudiantes. El CMS avisa antes de confirmar —
-- "N estudiantes tienen notas en esta clase; se eliminarán" —, igual que ya
-- avisa del progreso guardado (lib/admin/cursoDetalle.ts).
--
-- Por qué una función y no una lectura directa
-- --------------------------------------------
-- Un administrador NO puede leer `notas_leccion` (115, mínimo privilegio:
-- son apuntes personales). Esta función es la única excepción, y está
-- recortada a lo que el aviso necesita: un conteo agregado por lección y
-- por módulo. Nunca devuelve contenido, segundos ni ids de usuario — ni
-- siquiera quién tiene notas.
--
-- El conteo de módulo es de estudiantes DISTINTOS en todas sus lecciones
-- (quien tiene notas en dos clases cuenta una vez), mismo criterio que
-- `estudiantesConProgreso` del módulo.
-- ============================================================

create or replace function public.admin_notas_por_leccion(p_id_curso uuid)
returns table(nivel text, id uuid, estudiantes int)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not private.es_administrador() then
    raise exception 'Solo un administrador puede consultar esto.' using errcode = '42501';
  end if;

  return query
    select 'leccion'::text, n.id_leccion, count(distinct n.id_usuario)::int
    from public.notas_leccion n
    join public.lecciones l on l.id = n.id_leccion
    join public.modulos m on m.id = l.id_modulo
    where m.id_curso = p_id_curso
    group by n.id_leccion
    union all
    select 'modulo'::text, m.id, count(distinct n.id_usuario)::int
    from public.notas_leccion n
    join public.lecciones l on l.id = n.id_leccion
    join public.modulos m on m.id = l.id_modulo
    where m.id_curso = p_id_curso
    group by m.id;
end;
$$;

revoke execute on function public.admin_notas_por_leccion(uuid) from public, anon;
grant execute on function public.admin_notas_por_leccion(uuid) to authenticated;
