-- ============================================================
-- aplicar_pago_wompi(): todo el efecto de un cobro aprobado, en una sola
-- transacción.
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 100, que crea
-- las restricciones de `intentos_pago`, y de 041, cuyo
-- `private.cerrar_suscripcion_caducada` reutiliza.
--
-- Por qué una función y no varios INSERT desde el handler
-- -------------------------------------------------------
-- Un pago aprobado hace CINCO cosas que tienen que pasar todas o ninguna:
-- cierra la suscripción caducada, crea la nueva, registra el pago,
-- consume el cupón y marca el intento. Hechas desde TypeScript con el
-- cliente de Supabase son cinco round-trips sin transacción común: si el
-- proceso muere entre la tercera y la cuarta, queda un estudiante con
-- acceso y un cupón que nunca se descontó, y ningún reintento lo arregla
-- porque el pago ya figura registrado.
--
-- Mismo criterio que `canjear_codigo_invitacion` (035), que resuelve el
-- problema equivalente para los códigos de invitación.
--
-- Idempotencia: DOS capas independientes
-- --------------------------------------
--   1. `eventos_webhook` (CLAUDE.md §3.1) frena el reenvío del MISMO evento
--      antes de llegar aquí.
--   2. Esta función frena el caso que la primera no cubre: dos eventos
--      DISTINTOS de Wompi (checksums distintos, así que ambos "nuevos")
--      describiendo la misma transacción aprobada. El `for update` sobre el
--      intento serializa, y el chequeo de `estado = 'APROBADO'` hace que el
--      segundo salga sin escribir nada.
--
-- La tercera capa es el UNIQUE (proveedor, ref_transaccion_externa) de
-- `pagos`: aunque todo lo anterior fallara, la base no admite dos filas de
-- pago para la misma transacción de Wompi.
--
-- Se reaplica entera en cada `npm run db:rls` — por eso `create or replace`.
-- ============================================================

create or replace function public.aplicar_pago_wompi(
  p_referencia          text,
  p_id_transaccion      text,
  p_fecha_pago          timestamptz,
  p_monto_centavos      bigint,
  p_moneda              text
)
returns table(ok boolean, motivo text)
language plpgsql
security definer set search_path = public
as $$
declare
  v_intento        public.intentos_pago%rowtype;
  v_duracion_dias  int;
  v_inicio         timestamptz := now();
  v_renueva        timestamptz;
  v_id_suscripcion uuid;
begin
  -- `for update` serializa dos entregas simultáneas del mismo pago. Sin
  -- esto, ambas leerían PENDIENTE y ambas crearían suscripción.
  select * into v_intento
  from public.intentos_pago
  where referencia = p_referencia
  for update;

  if not found then
    -- La referencia no es nuestra. No se crea nada: es el caso de un evento
    -- dirigido a otro comercio, o de una referencia inventada.
    return query select false, 'intento_no_encontrado';
    return;
  end if;

  -- Segunda capa de idempotencia (ver cabecera). No es un error: el pago ya
  -- se aplicó, así que el handler debe responder 200 y no reintentar.
  if v_intento.estado = 'APROBADO' then
    return query select true, 'ya_aplicado';
    return;
  end if;

  if v_intento.estado = 'RECHAZADO' then
    -- Un intento que ya se marcó rechazado no puede "revivir" con un
    -- APPROVED posterior: si eso llegara, algo está mal y hay que mirarlo a
    -- mano antes de dar acceso.
    return query select false, 'intento_rechazado';
    return;
  end if;

  -- El monto y la moneda tienen que ser EXACTAMENTE los que se firmaron.
  -- Es la defensa contra un evento que pretenda activar una suscripción
  -- anual habiendo pagado una mensual. La firma del webhook ya se verificó
  -- en el handler; esto cubre el caso distinto de un evento legítimo cuyo
  -- contenido no corresponde al intento.
  if v_intento.monto_centavos <> p_monto_centavos
     or v_intento.moneda <> p_moneda then
    return query select false, 'monto_no_coincide';
    return;
  end if;

  -- Cierra la suscripción que ya venció por fecha pero sigue diciendo
  -- ACTIVA (nada en la plataforma la mueve sola). Sin esto, el insert de
  -- abajo chocaría contra `suscripcion_activa_unica_por_usuario` con un
  -- 23505 crudo — y sería un 23505 DESPUÉS de que el estudiante ya pagó.
  perform private.cerrar_suscripcion_caducada(v_intento.id_usuario);

  -- Si después de cerrar la caducada todavía hay una vigente, el estudiante
  -- pagó teniendo acceso. No se le quita ni se le duplica: se devuelve el
  -- motivo para que soporte lo resuelva (extender vigencia o reembolsar),
  -- en vez de reventar contra el índice único.
  if exists (
    select 1 from public.suscripciones
    where id_usuario = v_intento.id_usuario
      and estado in ('ACTIVA'::"EstadoSuscripcion", 'PAST_DUE'::"EstadoSuscripcion")
  ) then
    return query select false, 'ya_tiene_suscripcion';
    return;
  end if;

  select duracion_dias into v_duracion_dias
  from public.planes
  where id = v_intento.id_plan;

  if v_duracion_dias is null then
    return query select false, 'plan_no_encontrado';
    return;
  end if;

  -- `make_interval` sobre un `timestamptz`, igual que 035. La columna es
  -- timestamptz a propósito: `private.suscripcion_da_acceso()` hace
  -- `fecha_renovacion AT TIME ZONE 'America/Bogota'`, y esa expresión
  -- significa cosas opuestas sobre un timestamp desnudo — mientras lo
  -- fueron, toda membresía otorgada después de las 2 p.m. hora de Colombia
  -- vencía un día tarde.
  v_renueva := v_inicio + make_interval(days => v_duracion_dias);

  insert into public.suscripciones (
    id_usuario, id_plan, fecha_inicio, fecha_renovacion, estado,
    proveedor, monto_centavos, moneda, id_cupon,
    acceso_manual
  ) values (
    v_intento.id_usuario, v_intento.id_plan, v_inicio, v_renueva, 'ACTIVA',
    'wompi', v_intento.monto_centavos, v_intento.moneda, v_intento.id_cupon,
    false
  )
  returning id into v_id_suscripcion;

  -- `fecha_pago` es la que reporta Wompi, NO now(): Wompi reintenta la
  -- entrega del webhook, y sin esta distinción el estudiante vería la fecha
  -- del reintento como la fecha de su pago (ver el comentario de
  -- `Pagos.fecha_pago` en schema.prisma).
  insert into public.pagos (
    id_suscripcion, estado, proveedor, monto_centavos, moneda,
    ref_transaccion_externa, fecha_pago
  ) values (
    v_id_suscripcion, 'EXITOSO', 'wompi', v_intento.monto_centavos,
    v_intento.moneda, p_id_transaccion, p_fecha_pago
  );

  -- El cupón se consume AQUÍ, no al iniciar el checkout: un checkout
  -- abandonado no puede gastarle un uso a un cupón limitado.
  if v_intento.id_cupon is not null then
    update public.cupones
    set veces_usado = veces_usado + 1
    where id = v_intento.id_cupon;
  end if;

  update public.intentos_pago
  set estado = 'APROBADO',
      id_transaccion_wompi = p_id_transaccion
  where id = v_intento.id;

  return query select true, null::text;
end;
$$;

-- Mismo criterio de exposición que `canjear_codigo_invitacion`: solo
-- service_role. La invoca el handler del webhook, que ya verificó la firma
-- de Wompi — ningún cliente autenticado tiene por qué poder activarse una
-- suscripción llamando a esto directamente por /rest/v1/rpc/.
revoke execute on function public.aplicar_pago_wompi(text, text, timestamptz, bigint, text) from public;
revoke execute on function public.aplicar_pago_wompi(text, text, timestamptz, bigint, text) from anon;
revoke execute on function public.aplicar_pago_wompi(text, text, timestamptz, bigint, text) from authenticated;
grant execute on function public.aplicar_pago_wompi(text, text, timestamptz, bigint, text) to service_role;


-- ============================================================
-- rechazar_intento_pago(): la contraparte para DECLINED / VOIDED / ERROR.
--
-- No toca el acceso: solo cierra el intento para que la pantalla de retorno
-- pueda decir "el pago no se completó" en vez de quedarse girando en
-- "confirmando". Idempotente por el mismo `estado <> 'PENDIENTE'`.
-- ============================================================
create or replace function public.rechazar_intento_pago(
  p_referencia     text,
  p_id_transaccion text
)
returns table(ok boolean, motivo text)
language plpgsql
security definer set search_path = public
as $$
declare
  v_intento public.intentos_pago%rowtype;
begin
  select * into v_intento
  from public.intentos_pago
  where referencia = p_referencia
  for update;

  if not found then
    return query select false, 'intento_no_encontrado';
    return;
  end if;

  -- Un intento ya APROBADO no se rechaza: un DECLINED que llega después de
  -- un APPROVED de la misma referencia no puede quitarle el acceso a quien
  -- ya pagó.
  if v_intento.estado <> 'PENDIENTE' then
    return query select true, 'sin_cambios';
    return;
  end if;

  update public.intentos_pago
  set estado = 'RECHAZADO',
      id_transaccion_wompi = p_id_transaccion
  where id = v_intento.id;

  return query select true, null::text;
end;
$$;

revoke execute on function public.rechazar_intento_pago(text, text) from public;
revoke execute on function public.rechazar_intento_pago(text, text) from anon;
revoke execute on function public.rechazar_intento_pago(text, text) from authenticated;
grant execute on function public.rechazar_intento_pago(text, text) to service_role;
