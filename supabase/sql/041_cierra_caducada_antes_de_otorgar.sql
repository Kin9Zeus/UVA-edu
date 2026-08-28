-- ============================================================
-- otorgarMembresia puede chocar contra el mismo índice único que
-- canjear_codigo_invitacion ya resolvió (027/038) — para la otra puerta
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-040.
-- Redefine `public.canjear_codigo_invitacion()` (última versión: 038) y
-- agrega `private.cerrar_suscripcion_caducada()` y
-- `public.cerrar_suscripcion_caducada_admin()`.
--
-- El problema
-- -----------
-- `suscripcion_activa_unica_por_usuario` prohíbe dos filas ACTIVA/PAST_DUE
-- del mismo usuario a la vez. 038 le enseñó a `canjear_codigo_invitacion` a
-- cerrar la fila vieja ANTES de insertar cuando ya venció por fecha (aunque
-- la columna todavía diga ACTIVA porque nada la actualizó) — si no, un
-- estudiante cuya invitación caducó hace semanas no podía canjear un código
-- nuevo: quedaba encerrado sin acceso y sin poder renovar.
--
-- Ese cierre vive DENTRO de `canjear_codigo_invitacion` — es el camino del
-- ESTUDIANTE. `otorgarMembresia` (src/actions/admin/usuarios.ts) es el
-- camino del ADMIN otorgando una membresía manual desde el panel, y 038
-- nunca lo tocó: sigue haciendo `insert` a ciegas. Es el mismo choque, la
-- otra puerta — si un admin intenta otorgarle una membresía a alguien cuya
-- ACTIVA anterior ya venció por fecha pero nunca canjeó nada nuevo (nadie
-- cerró esa fila todavía), el insert revienta contra el índice único con un
-- 23505 crudo, y el admin solo ve "No pudimos otorgar la membresía." sin
-- ninguna pista de qué pasó ni cómo resolverlo.
--
-- El arreglo
-- ----------
-- La lógica de "cerrar lo caducado" se extrae UNA vez a
-- `private.cerrar_suscripcion_caducada`, reutilizando el criterio que ya
-- existe (`private.suscripcion_da_acceso`, 038) en vez de re-derivar la
-- comparación de fechas una tercera vez (antes vivía inline dentro de
-- `canjear_codigo_invitacion` como su propio `case`, duplicando la regla
-- que `suscripcion_da_acceso` ya codifica). `canjear_codigo_invitacion`
-- pasa a llamarla — comportamiento idéntico, misma cobertura en
-- scripts/canje-codigo-test.ts.
--
-- Para la puerta del admin se agrega `cerrar_suscripcion_caducada_admin`,
-- un envoltorio PÚBLICO (expuesto a PostgREST, a diferencia de
-- `private.*`) que SÍ verifica `private.es_administrador()` antes de
-- tocar nada. Es una verificación necesaria aquí y no en la del canje:
-- `canjear_codigo_invitacion` se invoca con Service Role (revocado de
-- `authenticated`/`anon`, ver abajo) — no hay sesión de usuario real de la
-- que abusar. `cerrar_suscripcion_caducada_admin`, en cambio, se llama
-- desde la sesión real del admin (`admin.supabase.rpc(...)` en
-- `otorgarMembresia`), y `SECURITY DEFINER` le da permiso de tocar la
-- suscripción de CUALQUIER usuario — sin el chequeo, cualquier
-- autenticado podría vencerle la suscripción a otro con solo saber su id.
-- ============================================================

create or replace function private.cerrar_suscripcion_caducada(p_usuario_id uuid)
returns void
language sql
security definer set search_path = public
as $$
  update public.suscripciones
  set estado = 'VENCIDA'
  where id_usuario = p_usuario_id
    and estado in ('ACTIVA'::"EstadoSuscripcion", 'PAST_DUE'::"EstadoSuscripcion")
    and not private.suscripcion_da_acceso(p_usuario_id);
$$;

-- ------------------------------------------------------------
-- CANJE: mismo comportamiento que 038, ya no duplica la comparación de
-- fechas — todo lo demás (orden de validaciones, el `for update`, el
-- incremento de `veces_usado`) se mantiene idéntico.
-- ------------------------------------------------------------
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
  -- ese es el motivo real aunque el código también esté agotado.
  if exists (
    select 1 from public.suscripciones
    where id_codigo_invitacion = v_codigo.id and id_usuario = p_usuario_id
  ) then
    return query select false, 'ya_canjeado';
    return;
  end if;

  if v_codigo.veces_usado >= v_codigo.limite_usos then
    return query select false, 'codigo_agotado';
    return;
  end if;

  -- Cierra lo que ya no da acceso, para que el índice único no confunda una
  -- suscripción caducada con una vigente (private.cerrar_suscripcion_caducada).
  perform private.cerrar_suscripcion_caducada(p_usuario_id);

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

-- Mismo criterio de exposición que 017, 027, 035 y 038: solo service_role.
-- El Server Action verifica la sesión real antes de invocarla.
revoke execute on function public.canjear_codigo_invitacion(text, uuid) from public;
revoke execute on function public.canjear_codigo_invitacion(text, uuid) from anon;
revoke execute on function public.canjear_codigo_invitacion(text, uuid) from authenticated;
grant execute on function public.canjear_codigo_invitacion(text, uuid) to service_role;

-- ------------------------------------------------------------
-- OTORGAR MEMBRESÍA (admin): mismo cierre, llamado desde
-- src/actions/admin/usuarios.ts justo antes del insert.
-- ------------------------------------------------------------
create or replace function public.cerrar_suscripcion_caducada_admin(p_usuario_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not private.es_administrador() then
    raise exception 'No tienes permisos de administrador.' using errcode = '42501';
  end if;

  perform private.cerrar_suscripcion_caducada(p_usuario_id);
end;
$$;

grant execute on function public.cerrar_suscripcion_caducada_admin(uuid) to authenticated;
