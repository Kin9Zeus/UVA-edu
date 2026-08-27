-- ============================================================
-- canjear_codigo_invitacion(): la duración sale del código, no del plan
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 027, cuya
-- definición reemplaza por completo. 017 -> 027 -> 035.
--
-- Requiere la migración 20260827000000_codigos_invitacion_por_dias, que
-- agrega `codigos_invitacion.duracion_dias`, borra `codigos_invitacion.id_plan`
-- y hace nullable `suscripciones.id_plan`. Aplicar este script contra el
-- esquema viejo falla en el `select` de v_codigo.duracion_dias; aplicar la
-- migración sin este script deja la función referenciando una columna que
-- ya no existe. Van juntos.
--
-- Qué cambia
-- ----------
-- El MVP del 12 de septiembre de 2026 da acceso solo por códigos de
-- invitación, sin pasarela de pago. Un código ya no apunta a un plan: el
-- administrador fija directamente cuántos días de acceso otorga.
--
--   - `v_renueva` se calcula con `v_codigo.duracion_dias` en vez de
--     `v_plan.duracion_dias`.
--   - Desaparece la búsqueda del plan y con ella el motivo
--     'plan_no_encontrado' (el Server Action que lo traducía ya no puede
--     recibirlo; ver src/actions/codigos-invitacion/canjear.ts).
--   - La suscripción se inserta con `id_plan` NULL — un acceso regalado no
--     compró ningún plan.
--   - `moneda` se fija en 'COP' en vez de heredarla del plan. La columna es
--     NOT NULL y el importe es 0: no hay nada que denominar, pero la fila
--     necesita un valor y 'COP' es la moneda de toda la plataforma.
--   - El chequeo de `limite_usos` deja de contemplar NULL: la migración lo
--     volvió NOT NULL con CHECK >= 1 (regla de negocio: uso único o con
--     límite, nunca ilimitado).
--
-- Todo lo demás — el `for update` que serializa canjes simultáneos, el
-- orden de las validaciones, el incremento de `veces_usado` — se mantiene
-- exactamente como lo dejó 027.
-- ============================================================

create or replace function public.canjear_codigo_invitacion(p_codigo text, p_usuario_id uuid)
returns table(ok boolean, motivo text)
language plpgsql
security definer set search_path = public
as $$
declare
  v_codigo   public.codigos_invitacion%rowtype;
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

  -- Sin `is not null`: la columna es NOT NULL desde la migración
  -- 20260827000000. Un código sin tope ya no se puede crear.
  if v_codigo.veces_usado >= v_codigo.limite_usos then
    return query select false, 'codigo_agotado';
    return;
  end if;

  -- De 027: el índice único parcial `suscripcion_activa_unica_por_usuario`
  -- solo admite una suscripción en ACTIVA o PAST_DUE por usuario. Sin esto
  -- el insert de abajo reventaría con 23505 y el error llegaría al usuario
  -- como un fallo genérico en vez de "ya tienes una suscripción".
  if exists (
    select 1 from public.suscripciones
    where id_usuario = p_usuario_id
      and estado in ('ACTIVA', 'PAST_DUE')
  ) then
    return query select false, 'ya_tiene_suscripcion';
    return;
  end if;

  v_renueva := v_inicio + make_interval(days => v_codigo.duracion_dias);

  insert into public.suscripciones (
    id_usuario, id_plan, fecha_inicio, fecha_renovacion, estado,
    proveedor, monto_centavos, moneda, id_codigo_invitacion,
    acceso_manual, otorgado_por
  ) values (
    p_usuario_id, null, v_inicio, v_renueva, 'ACTIVA',
    'invitacion', 0, 'COP', v_codigo.id,
    true, v_codigo.id_admin_creador
  );

  update public.codigos_invitacion
  set veces_usado = veces_usado + 1
  where id = v_codigo.id;

  return query select true, null::text;
end;
$$;

-- Mismo criterio de exposición que 017 y 027: solo service_role. El Server
-- Action verifica la sesión real antes de invocarla y pasa el id del usuario.
revoke execute on function public.canjear_codigo_invitacion(text, uuid) from public;
revoke execute on function public.canjear_codigo_invitacion(text, uuid) from anon;
revoke execute on function public.canjear_codigo_invitacion(text, uuid) from authenticated;
grant execute on function public.canjear_codigo_invitacion(text, uuid) to service_role;
