-- ============================================================
-- Reordenar y el límite de generaciones con IA aceptan la sesión de un
-- administrador, no solo la llave maestra — FASE 7 (secretos, tarea 2) del
-- plan de blindaje.
--
-- Orden de aplicación: DESPUÉS de 000-131. Necesita
-- `private.es_administrador()` con el segundo factor (131).
--
-- Por qué
-- -------
-- Estas cinco funciones solo las podía llamar `service_role`, así que las
-- acciones del panel las invocaban con la llave maestra y la base confiaba
-- en el `requireAdmin()` de la app. Abiertas a la sesión del administrador,
-- la base comprueba por su cuenta que quien llama es administrador CON el
-- segundo factor vigente (131), y `generarExamenDelCurso` deja de necesitar
-- la llave maestra.
--
-- Qué cambia
-- ----------
-- 1. `private.administrador_o_servicio()` (nueva): true para `service_role`
--    o para un administrador según `es_administrador()`.
-- 2. `reespaciar_orden_modulos`, `reespaciar_orden_lecciones` y
--    `reespaciar_orden_preguntas` (029 y 067): el mismo UPDATE de siempre,
--    pero antes exigen lo de arriba (si no, 42501). Se abren a
--    `authenticated`.
-- 3. `verificar_limite_generar_examen` y `registrar_generacion_examen` (107):
--    reciben el id de quien genera. Con sesión, ese id tiene que ser el de
--    la propia sesión: si no, un administrador podría mirar o gastar el
--    cupo de otro. Se abren a `authenticated`.
--
-- Compatibilidad: `service_role` sigue pudiendo llamarlas igual que antes.
-- Por eso este archivo se aplica ANTES de desplegar el código que las llama
-- con la sesión, y mientras tanto el código viejo sigue funcionando.
-- ============================================================

create or replace function private.administrador_o_servicio()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select coalesce((select auth.role()) = 'service_role', false)
    or private.es_administrador();
$$;

revoke execute on function private.administrador_o_servicio() from public, anon;
grant execute on function private.administrador_o_servicio() to authenticated, service_role;

-- ------------------------------------------------------------
-- Reordenar (029 y 067). El cuerpo del UPDATE es el mismo.
-- ------------------------------------------------------------
create or replace function public.reespaciar_orden_modulos(p_curso_id uuid, p_ids uuid[])
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not private.administrador_o_servicio() then
    raise exception 'Solo un administrador con su segundo factor puede reordenar.' using errcode = '42501';
  end if;

  update public.modulos m
  set orden = t.nuevo_orden
  from (
    select id, (ordinality::int) * 10 as nuevo_orden
    from unnest(p_ids) with ordinality as u(id, ordinality)
  ) t
  where m.id = t.id and m.id_curso = p_curso_id;
end;
$$;

create or replace function public.reespaciar_orden_lecciones(p_modulo_id uuid, p_ids uuid[])
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not private.administrador_o_servicio() then
    raise exception 'Solo un administrador con su segundo factor puede reordenar.' using errcode = '42501';
  end if;

  update public.lecciones l
  set orden = t.nuevo_orden
  from (
    select id, (ordinality::int) * 10 as nuevo_orden
    from unnest(p_ids) with ordinality as u(id, ordinality)
  ) t
  where l.id = t.id and l.id_modulo = p_modulo_id;
end;
$$;

create or replace function public.reespaciar_orden_preguntas(p_examen_id uuid, p_ids uuid[])
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not private.administrador_o_servicio() then
    raise exception 'Solo un administrador con su segundo factor puede reordenar.' using errcode = '42501';
  end if;

  update public.preguntas_examen q
  set orden = t.nuevo_orden
  from (
    select id, (ordinality::int) * 10 as nuevo_orden
    from unnest(p_ids) with ordinality as u(id, ordinality)
  ) t
  where q.id = t.id and q.id_examen = p_examen_id;
end;
$$;

revoke execute on function public.reespaciar_orden_modulos(uuid, uuid[]) from public, anon;
revoke execute on function public.reespaciar_orden_lecciones(uuid, uuid[]) from public, anon;
revoke execute on function public.reespaciar_orden_preguntas(uuid, uuid[]) from public, anon;
grant execute on function public.reespaciar_orden_modulos(uuid, uuid[]) to authenticated, service_role;
grant execute on function public.reespaciar_orden_lecciones(uuid, uuid[]) to authenticated, service_role;
grant execute on function public.reespaciar_orden_preguntas(uuid, uuid[]) to authenticated, service_role;

-- ------------------------------------------------------------
-- Límite de generaciones con IA (107). La lógica del contador es la misma;
-- solo se agrega quién puede preguntar y por quién.
-- ------------------------------------------------------------
create or replace function private.puede_usar_cupo_generacion(p_usuario_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select coalesce((select auth.role()) = 'service_role', false)
    or (p_usuario_id = (select auth.uid()) and private.es_administrador());
$$;

revoke execute on function private.puede_usar_cupo_generacion(uuid) from public, anon;
grant execute on function private.puede_usar_cupo_generacion(uuid) to authenticated, service_role;

create or replace function public.verificar_limite_generar_examen(p_usuario_id uuid)
returns table(permitido boolean, segundos_espera int)
language plpgsql
security definer
set search_path = private
as $$
declare
  v_fila private.intentos_generar_examen%rowtype;
begin
  if not private.puede_usar_cupo_generacion(p_usuario_id) then
    raise exception 'Solo puedes consultar tu propio límite de generaciones.' using errcode = '42501';
  end if;

  select * into v_fila from private.intentos_generar_examen where id_usuario = p_usuario_id;

  if v_fila.id_usuario is null or v_fila.bloqueado_hasta is null or v_fila.bloqueado_hasta <= now() then
    return query select true, 0;
    return;
  end if;

  return query select false, ceil(extract(epoch from (v_fila.bloqueado_hasta - now())))::int;
end;
$$;

create or replace function public.registrar_generacion_examen(p_usuario_id uuid)
returns void
language plpgsql
security definer
set search_path = private
as $$
declare
  v_fila    private.intentos_generar_examen%rowtype;
  v_ventana interval := interval '1 hour';
  v_limite  int := 15;
begin
  if not private.puede_usar_cupo_generacion(p_usuario_id) then
    raise exception 'Solo puedes registrar tus propias generaciones.' using errcode = '42501';
  end if;

  select * into v_fila from private.intentos_generar_examen where id_usuario = p_usuario_id;

  if v_fila.id_usuario is null or now() - v_fila.primer_intento > v_ventana then
    insert into private.intentos_generar_examen (id_usuario, intentos, primer_intento, bloqueado_hasta)
    values (p_usuario_id, 1, now(), null)
    on conflict (id_usuario) do update
      set intentos = 1, primer_intento = now(), bloqueado_hasta = null;
    return;
  end if;

  update private.intentos_generar_examen
  set intentos = v_fila.intentos + 1,
      bloqueado_hasta = case
        when v_fila.intentos + 1 >= v_limite then now() + v_ventana
        else null
      end
  where id_usuario = p_usuario_id;
end;
$$;

revoke execute on function public.verificar_limite_generar_examen(uuid) from public, anon;
revoke execute on function public.registrar_generacion_examen(uuid) from public, anon;
grant execute on function public.verificar_limite_generar_examen(uuid) to authenticated, service_role;
grant execute on function public.registrar_generacion_examen(uuid) to authenticated, service_role;
