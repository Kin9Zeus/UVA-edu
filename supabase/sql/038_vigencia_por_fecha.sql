-- ============================================================
-- El acceso caduca de verdad: la vigencia se decide por fecha, no solo
-- por el estado de la fila
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-037.
-- Redefine la policy de `recursos_descargables` de 003, la función
-- `private.tiene_acceso_vigente_curso()` de 030 y
-- `canjear_codigo_invitacion()` de 035.
--
-- El problema
-- -----------
-- Nada en la plataforma mueve una suscripción a VENCIDA cuando pasa
-- `fecha_renovacion`: no hay job, ni trigger, ni webhook que lo haga (el de
-- Stripe todavía es un TODO). Toda la autorización preguntaba
-- `estado in ('ACTIVA','PAST_DUE')`, así que una invitación de 30 días
-- seguía abriendo videos y materiales para siempre: el "cupo de días" que
-- el administrador fija al crear el código era decorativo.
--
-- La regla, ahora en un solo sitio
-- --------------------------------
--   ACTIVA   -> vigente hasta el FINAL del día colombiano de
--               `fecha_renovacion` (es la fecha que la app le imprime al
--               estudiante como "Vigente hasta ..."; cortar en el instante
--               exacto le quitaría el acceso a media mañana del día que se
--               le prometió entero).
--   PAST_DUE -> solo dentro de los 5 días de gracia.
--   VENCIDA / CANCELADA -> no.
--
-- Su gemela en TypeScript es `suscripcionDaAcceso()`
-- (src/lib/estadoAcceso.ts), que decide el firmado del token de Mux y el
-- candado del temario. Las dos tienen que decir lo mismo: esta capa es la
-- que aguanta si alguien llama a PostgREST directamente, sin pasar por la
-- aplicación.
--
-- Los 5 días son DURACION_GRACIA_DIAS en src/lib/gracia.ts; hay un test que
-- falla si este número y el de la vista de métricas se separan
-- (src/lib/gracia.test.ts).
-- ============================================================

create or replace function private.suscripcion_da_acceso(p_id_usuario uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1
    from public.suscripciones s
    where s.id_usuario = p_id_usuario
      and (
        (
          s.estado = 'ACTIVA'
          and (
            s.fecha_renovacion is null
            or (s.fecha_renovacion at time zone 'America/Bogota')::date
               >= (now() at time zone 'America/Bogota')::date
          )
        )
        or (
          s.estado = 'PAST_DUE'
          and (
            s.fecha_renovacion is null
            or (s.fecha_renovacion at time zone 'UTC') + interval '5 days' > now()
          )
        )
      )
  );
$$;

grant execute on function private.suscripcion_da_acceso(uuid) to authenticated;

-- ------------------------------------------------------------
-- RECURSOS_DESCARGABLES (redefine la policy de 003)
--
-- Dos cambios: la suscripción se comprueba con la función de arriba, y una
-- fila de `inscripciones` solo cuenta si es CORTESIA. Una MEMBRESIA no es
-- un permiso propio —es el registro de haber entrado al curso bajo una
-- suscripción— y dejarla contar devolvía por un lado el acceso permanente
-- que 032 quitó por el otro (P0-1, AUDIT-2026-08-26.md).
-- ------------------------------------------------------------
drop policy if exists "recursos_select_con_acceso" on public.recursos_descargables;
create policy "recursos_select_con_acceso" on public.recursos_descargables
  for select using (
    private.es_administrador()
    or exists (
      select 1 from public.lecciones
      join public.modulos on modulos.id = lecciones.id_modulo
      join public.cursos on cursos.id = modulos.id_curso
      where lecciones.id = recursos_descargables.id_leccion
        and (
          exists (
            select 1 from public.inscripciones
            where inscripciones.id_usuario = auth.uid()
              and inscripciones.id_curso = cursos.id
              and inscripciones.tipo_acceso = 'CORTESIA'
          )
          or private.suscripcion_da_acceso(auth.uid())
        )
    )
  );

-- ------------------------------------------------------------
-- CURSOS DESPUBLICADOS (redefine la función de 030)
--
-- Mismo cuerpo que en 030 salvo la rama de suscripción, que ahora mira la
-- fecha. La excepción de `mostrado`/progreso se mantiene intacta.
-- ------------------------------------------------------------
create or replace function private.tiene_acceso_vigente_curso(p_id_curso uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select
    -- Cortesía: acceso incondicional, publicado o no.
    exists (
      select 1 from public.inscripciones
      where inscripciones.id_usuario = auth.uid()
        and inscripciones.id_curso = p_id_curso
        and inscripciones.tipo_acceso = 'CORTESIA'
    )
    or (
      -- Membresía: SOLO por suscripción vigente. En 030 esta rama también
      -- aceptaba una fila `inscripciones` de tipo MEMBRESIA como si fuera
      -- equivalente a estar suscrito — lo era cuando el alta automática las
      -- creaba, pero 032 eliminó esa policy y las filas que quedan son
      -- herencia. Aceptarlas mantenía en pie justo el caso que hay que
      -- cerrar: al estudiante se le acaba el periodo y sigue entrando a los
      -- cursos que ya había empezado. Lo detectó npm run test:rls.
      -- Solo alcanza a un curso despublicado si ya tenía progreso en él.
      private.suscripcion_da_acceso(auth.uid())
      and (
        coalesce((select cursos.mostrado from public.cursos where cursos.id = p_id_curso), false)
        or private.tiene_progreso_en_curso(p_id_curso)
      )
    );
$$;

grant execute on function private.tiene_acceso_vigente_curso(uuid) to authenticated;

-- ------------------------------------------------------------
-- CANJE: una suscripción caducada no bloquea la renovación
--
-- `suscripcion_activa_unica_por_usuario` solo admite una fila en ACTIVA o
-- PAST_DUE por usuario, y el canje devolvía 'ya_tiene_suscripcion' contra
-- ella. Como el periodo terminado NO cambia el estado, el estudiante al que
-- se le acabó la invitación quedaba encerrado: sin acceso al contenido y
-- sin poder canjear un código nuevo.
--
-- La función cierra ella misma las suscripciones caducadas del usuario
-- antes de comprobar el índice. Es el único punto del sistema que las
-- necesita cerradas, así que la expiración vive aquí en vez de en un cron
-- que hoy no existe — y de paso deja el estado real en la base, que es lo
-- que lee el panel del administrador.
--
-- Todo lo demás de 035 (el `for update`, el orden de validaciones, el
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
  -- suscripción caducada con una vigente. Mismo criterio que
  -- private.suscripcion_da_acceso().
  update public.suscripciones
  set estado = 'VENCIDA'
  where id_usuario = p_usuario_id
    and estado in ('ACTIVA', 'PAST_DUE')
    and fecha_renovacion is not null
    and case
          when estado = 'ACTIVA' then
            (fecha_renovacion at time zone 'America/Bogota')::date
            < (now() at time zone 'America/Bogota')::date
          else
            (fecha_renovacion at time zone 'UTC') + interval '5 days' <= now()
        end;

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

-- Mismo criterio de exposición que 017, 027 y 035: solo service_role. El
-- Server Action verifica la sesión real antes de invocarla.
revoke execute on function public.canjear_codigo_invitacion(text, uuid) from public;
revoke execute on function public.canjear_codigo_invitacion(text, uuid) from anon;
revoke execute on function public.canjear_codigo_invitacion(text, uuid) from authenticated;
grant execute on function public.canjear_codigo_invitacion(text, uuid) to service_role;
