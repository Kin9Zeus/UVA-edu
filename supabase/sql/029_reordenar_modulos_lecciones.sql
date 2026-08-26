-- ============================================================
-- Reordenar módulos y lecciones en una sola operación transaccional
-- Ver src/lib/orden.ts y moverModulo/moverLeccion en src/actions/admin/cursos.ts.
--
-- Orden de aplicación (npm run db:rls lo respeta): sin dependencias de
-- scripts anteriores, puede ir al final.
--
-- Por qué existe
-- ---------------
-- moverModulo/moverLeccion mueven un elemento escribiendo un solo `orden`
-- fraccionado entre sus dos vecinos (ver ordenEntre() en lib/orden.ts) — eso
-- ya es una sola escritura. Pero los enteros espaciados de 10 en 10 se
-- agotan rápido (10/20 → insertás en 15 → ya no hay hueco entre 10 y 15),
-- y en ese caso hacía falta reespaciar el resto del curso/módulo completo.
-- Antes eso se hacía con un `UPDATE` por fila desde el cliente (`Promise.all`
-- de N peticiones), lo que no es ni una sola operación ni transaccional: si
-- la conexión se cae a la fila 3 de 8, el curso queda con un orden a medio
-- reescribir. Estas funciones hacen el reespaciado completo en un solo
-- `UPDATE ... FROM unnest(...)`, una sola sentencia SQL, una sola llamada
-- desde el servidor.
--
-- Mismo criterio de exposición que canjear_codigo_invitacion (017): viven en
-- `public` porque PostgREST solo expone ese schema, pero se restringen a
-- `service_role` — el Server Action que las llama (requireAdmin() en
-- src/actions/admin/cursos.ts) ya verificó el rol ADMINISTRADOR antes de
-- invocarlas, así que confían en ese chequeo previo en vez de repetirlo.
--
-- El filtro `id_curso = p_curso_id` / `id_modulo = p_modulo_id` en el UPDATE
-- es defensa en profundidad: aunque `p_ids` viniera con un id de otro curso
-- o módulo por error, esa fila no se toca.
-- ============================================================

create or replace function public.reespaciar_orden_modulos(p_curso_id uuid, p_ids uuid[])
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.modulos m
  set orden = t.nuevo_orden
  from (
    select id, (ordinality::int) * 10 as nuevo_orden
    from unnest(p_ids) with ordinality as u(id, ordinality)
  ) t
  where m.id = t.id and m.id_curso = p_curso_id;
end;
$$;

revoke execute on function public.reespaciar_orden_modulos(uuid, uuid[]) from public;
revoke execute on function public.reespaciar_orden_modulos(uuid, uuid[]) from anon;
revoke execute on function public.reespaciar_orden_modulos(uuid, uuid[]) from authenticated;
grant execute on function public.reespaciar_orden_modulos(uuid, uuid[]) to service_role;

create or replace function public.reespaciar_orden_lecciones(p_modulo_id uuid, p_ids uuid[])
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.lecciones l
  set orden = t.nuevo_orden
  from (
    select id, (ordinality::int) * 10 as nuevo_orden
    from unnest(p_ids) with ordinality as u(id, ordinality)
  ) t
  where l.id = t.id and l.id_modulo = p_modulo_id;
end;
$$;

revoke execute on function public.reespaciar_orden_lecciones(uuid, uuid[]) from public;
revoke execute on function public.reespaciar_orden_lecciones(uuid, uuid[]) from anon;
revoke execute on function public.reespaciar_orden_lecciones(uuid, uuid[]) from authenticated;
grant execute on function public.reespaciar_orden_lecciones(uuid, uuid[]) to service_role;
