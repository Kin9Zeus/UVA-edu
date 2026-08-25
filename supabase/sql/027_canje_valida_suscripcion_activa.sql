-- ============================================================
-- canjear_codigo_invitacion(): comprobar la suscripción activa
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 017, cuya
-- definición reemplaza por completo.
--
-- Qué se arregla
-- --------------
-- `suscripcion_activa_unica_por_usuario` (migración
-- 20260818142831_suscripcion_activa_unica_y_pgcrypto) es un índice único
-- parcial: un usuario no puede tener dos suscripciones en ACTIVA o
-- PAST_DUE a la vez.
--
-- La versión de 017 no lo tenía en cuenta. Si alguien con suscripción
-- vigente canjeaba un código, el INSERT chocaba contra ese índice, la
-- función abortaba con SQLSTATE 23505 y el Server Action —que solo sabe
-- interpretar los `motivo` conocidos— acababa mostrando "No pudimos
-- procesar el código. Intenta de nuevo.".
--
-- Es decir: una regla de negocio perfectamente normal ("ya tienes una
-- suscripción") se comunicaba como un fallo técnico, y el usuario no tenía
-- forma de saber que su código está bien y solo tiene que esperar.
--
-- La comprobación va DESPUÉS de validar el código y ANTES de insertar: así
-- un código inválido sigue reportándose como inválido aunque además el
-- usuario tenga suscripción, y `veces_usado` no se incrementa por un canje
-- que no llegó a ocurrir.
--
-- Se apoya en la comprobación explícita, no en capturar el 23505: el índice
-- es la red de seguridad ante una carrera entre dos canjes simultáneos, no
-- la forma de expresar la regla.
-- ============================================================

create or replace function public.canjear_codigo_invitacion(p_codigo text, p_usuario_id uuid)
returns table(ok boolean, motivo text)
language plpgsql
security definer set search_path = public
as $$
declare
  v_codigo   public.codigos_invitacion%rowtype;
  v_plan     public.planes%rowtype;
  v_inicio   timestamptz := now();
  v_renueva  timestamptz;
begin
  select * into v_codigo
  from public.codigos_invitacion
  where codigo = p_codigo
  for update;

  if not found then
    return query select false, 'codigo_invalido';
    return;
  end if;

  if not v_codigo.activo then
    return query select false, 'codigo_inactivo';
    return;
  end if;

  if v_codigo.fecha_vencimiento < v_inicio then
    return query select false, 'codigo_vencido';
    return;
  end if;

  -- Se valida ANTES que el límite de usos: si este usuario ya lo canjeó,
  -- ese es el motivo real aunque el código también esté agotado — un
  -- reintento del mismo usuario no debería leer "se acabó" sino "ya lo
  -- usaste".
  if exists (
    select 1 from public.suscripciones
    where id_codigo_invitacion = v_codigo.id and id_usuario = p_usuario_id
  ) then
    return query select false, 'ya_canjeado';
    return;
  end if;

  if v_codigo.limite_usos is not null and v_codigo.veces_usado >= v_codigo.limite_usos then
    return query select false, 'codigo_agotado';
    return;
  end if;

  -- NUEVO en 027: el índice único parcial solo admite una suscripción en
  -- ACTIVA o PAST_DUE por usuario. Sin esto el insert de abajo reventaría
  -- con 23505 y el error llegaría al usuario como un fallo genérico.
  if exists (
    select 1 from public.suscripciones
    where id_usuario = p_usuario_id
      and estado in ('ACTIVA', 'PAST_DUE')
  ) then
    return query select false, 'ya_tiene_suscripcion';
    return;
  end if;

  select * into v_plan from public.planes where id = v_codigo.id_plan;
  if not found then
    return query select false, 'plan_no_encontrado';
    return;
  end if;

  v_renueva := v_inicio + make_interval(days => v_plan.duracion_dias);

  insert into public.suscripciones (
    id_usuario, id_plan, fecha_inicio, fecha_renovacion, estado,
    proveedor, monto_centavos, moneda, id_codigo_invitacion,
    acceso_manual, otorgado_por
  ) values (
    p_usuario_id, v_plan.id, v_inicio, v_renueva, 'ACTIVA',
    'invitacion', 0, v_plan.moneda, v_codigo.id,
    true, v_codigo.id_admin_creador
  );

  update public.codigos_invitacion
  set veces_usado = veces_usado + 1
  where id = v_codigo.id;

  return query select true, null::text;
end;
$$;

-- Mismo criterio de exposición que 017: solo service_role. El Server Action
-- verifica la sesión real antes de invocarla y pasa el id del usuario.
revoke execute on function public.canjear_codigo_invitacion(text, uuid) from public;
revoke execute on function public.canjear_codigo_invitacion(text, uuid) from anon;
revoke execute on function public.canjear_codigo_invitacion(text, uuid) from authenticated;
grant execute on function public.canjear_codigo_invitacion(text, uuid) to service_role;
