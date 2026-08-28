-- ============================================================
-- La tabla del panel deja de contradecir sus propias tarjetas de KPI
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-039.
-- Redefine `public.admin_listar_usuarios()` (última versión: 037).
--
-- El problema
-- -----------
-- `038_vigencia_por_fecha.sql` cerró el hueco de "nadie mueve una fila a
-- VENCIDA cuando pasa `fecha_renovacion`" en RLS, en el token de Mux y en
-- `metricas_panel_usuarios` (036) — pero `admin_listar_usuarios` (037) es
-- ANTERIOR a esa migración y nadie volvió a tocarla: sigue devolviendo el
-- `estado` crudo de la fila.
--
-- Consecuencia real: un estudiante cuyo cupón de 30 días venció hace dos
-- semanas y no ha vuelto a canjear otro sigue apareciendo en la tabla y en
-- el CSV con la insignia "Activa" — mientras la tarjeta "Con acceso hoy"
-- de arriba, que sí lee `metricas_panel_usuarios`, ya lo cuenta como
-- vencido. El filtro "Vencida" tampoco lo encuentra: sigue indexado bajo
-- 'ACTIVA' hasta que él mismo canjee un código nuevo, momento en el que
-- `canjear_codigo_invitacion` (038) recién cierra la fila vieja.
--
-- Es justo la pantalla cuyo propósito es "la foto real de quién está
-- usando la plataforma" (RevUsuariof4) la que se queda con la foto vieja.
--
-- La regla, una vez más
-- ----------------------
-- Misma que en 038: `private.suscripcion_da_acceso(id_usuario)` decide si
-- una fila ACTIVA/PAST_DUE sigue dando acceso hoy. Si no, se reporta como
-- 'VENCIDA' aunque la columna en `suscripciones` siga sin actualizar — el
-- panel no puede volver a inventar su propio criterio de vigencia.
--
-- El índice parcial `suscripcion_activa_unica_por_usuario` (a lo sumo una
-- fila ACTIVA/PAST_DUE por usuario) es lo que permite que
-- `private.suscripcion_da_acceso(p.id)` sea equivalente a preguntar por
-- ESTA fila en concreto: no hay otra ACTIVA/PAST_DUE con la que pueda
-- confundirse.
--
-- Ni `EstadoSuscripcionListado` (src/lib/admin/usuarios.ts) ni la tabla,
-- el filtro o el CSV cambian de forma: siguen leyendo `suscripcion_estado`
-- como texto. El arreglo vive entero en la función, igual que decidió 038
-- para los otros tres sitios — para no duplicar la regla de vigencia una
-- cuarta vez en TypeScript.
-- ============================================================

create or replace function public.admin_listar_usuarios(
  p_query text default null,
  p_desde date default null,
  p_hasta date default null,
  p_rol text default null,
  p_estado text default null,
  p_suscripcion text default null,
  p_limite int default 25,
  p_offset int default 0
)
returns table (
  id uuid,
  nombre text,
  correo text,
  rol text,
  estado text,
  fecha_registro timestamptz,
  cursos_inscritos bigint,
  suscripcion_estado text,
  suscripcion_acceso_manual boolean,
  suscripcion_tiene_codigo boolean,
  ultima_actividad timestamptz,
  total_resultados bigint
)
language sql
stable
set search_path = public, extensions
as $$
  with base as (
    select
      p.id,
      p.nombre,
      p.correo,
      p.rol::text as rol,
      p.estado::text as estado,
      p.creado_en as fecha_registro,
      (select count(*) from public.inscripciones i where i.id_usuario = p.id) as cursos_inscritos,
      -- Estado EFECTIVO, no el crudo de la fila: una ACTIVA/PAST_DUE cuya
      -- fecha ya pasó se reporta como VENCIDA aunque nada en `suscripciones`
      -- la haya actualizado todavía (ver cabecera).
      e.estado_efectivo as suscripcion_estado,
      s.acceso_manual as suscripcion_acceso_manual,
      (s.id_codigo_invitacion is not null) as suscripcion_tiene_codigo,
      (select max(pr.actualizado_en) from public.progreso pr where pr.id_usuario = p.id) as ultima_actividad
    from public.perfiles p
    -- La suscripción "actual" NO es simplemente la más reciente por
    -- fecha_inicio. El índice parcial `suscripcion_activa_unica_por_usuario`
    -- garantiza a lo sumo UNA en ACTIVA/PAST_DUE, así que la vigente está
    -- bien definida: se prefiere esa, y solo si no existe se cae a la más
    -- reciente.
    left join lateral (
      select su.estado, su.acceso_manual, su.id_codigo_invitacion
      from public.suscripciones su
      where su.id_usuario = p.id
      order by
        (su.estado in ('ACTIVA'::"EstadoSuscripcion", 'PAST_DUE'::"EstadoSuscripcion")) desc,
        su.fecha_inicio desc
      limit 1
    ) s on true
    left join lateral (
      select
        case
          when s.estado in ('ACTIVA'::"EstadoSuscripcion", 'PAST_DUE'::"EstadoSuscripcion")
               and not private.suscripcion_da_acceso(p.id)
          then 'VENCIDA'
          else s.estado::text
        end as estado_efectivo
    ) e on true
    where
      (
        p_query is null or trim(p_query) = ''
        or public.normalizar_busqueda(p.correo) ilike '%' || public.normalizar_busqueda(p_query) || '%'
        or public.normalizar_busqueda(p.nombre) ilike '%' || public.normalizar_busqueda(p_query) || '%'
      )
      and (p_desde is null or p.creado_en >= p_desde::timestamptz)
      -- +1 día para que el rango sea inclusivo en el extremo superior: sin
      -- esto, "hasta el 15" excluiría a quien se registró el 15 a las 10:00.
      and (p_hasta is null or p.creado_en < (p_hasta + 1)::timestamptz)
      and (p_rol is null or p.rol::text = p_rol)
      and (p_estado is null or p.estado::text = p_estado)
      and (
        p_suscripcion is null
        or (p_suscripcion = 'SIN_SUSCRIPCION' and s.estado is null)
        -- Filtra sobre el estado EFECTIVO: si no, "Vencida" seguiría sin
        -- encontrar a quien se le venció el acceso por fecha y nunca volvió
        -- a canjear (la fila sigue en ACTIVA).
        or e.estado_efectivo = p_suscripcion
      )
  )
  select
    base.id,
    base.nombre,
    base.correo,
    base.rol,
    base.estado,
    base.fecha_registro,
    base.cursos_inscritos,
    base.suscripcion_estado,
    base.suscripcion_acceso_manual,
    base.suscripcion_tiene_codigo,
    base.ultima_actividad,
    count(*) over() as total_resultados
  from base
  -- Desempate por id: sin él, dos llamadas con distinto offset no tienen
  -- orden garantizado entre filas con el mismo creado_en y la paginación
  -- podría repetir o saltarse usuarios (misma razón que en 034).
  order by base.fecha_registro desc, base.id
  limit least(coalesce(p_limite, 25), 200) offset greatest(coalesce(p_offset, 0), 0);
$$;

grant execute on function public.admin_listar_usuarios(text, date, date, text, text, text, int, int)
  to authenticated;
