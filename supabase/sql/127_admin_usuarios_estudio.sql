-- ============================================================
-- Usuarios del panel: quién estudia, por semana y por persona.
--
-- Orden de aplicación: DESPUÉS de 000-126 (necesita actividad_diaria, 119,
-- y la última versión de admin_listar_usuarios, 074).
--
-- 1. El administrador puede leer `actividad_diaria`. Hasta ahora solo la leía
--    cada estudiante (su racha). `progreso` guarda solo la última vez que se
--    tocó cada clase, así que no sirve para contar quién estudió cada semana:
--    esta tabla sí (un día por persona). Solo lectura; nadie escribe aquí
--    salvo el trigger de 119.
--
-- 2. `admin_estudio_por_semana`: por semana (lunes, hora de Colombia), cuántas
--    personas estudiaron, cuántas lo hicieron por primera vez y cuántas tenían
--    ese día un plan pagado (Stripe o Wompi). Agregado en Postgres para no
--    traer una fila por persona y día a la aplicación.
--
-- 3. `admin_listar_usuarios` con dos filtros nuevos (estudio y origen del
--    acceso) y las columnas que la tabla necesita para decir de dónde viene el
--    acceso y cuándo se acaba. Cambian los parámetros, así que es otra firma:
--    se borra la de 074. Al volver a correr todo el lote, 037-074 recrean la
--    firma vieja y este archivo la vuelve a borrar, así que no queda ninguna
--    sobrecarga ambigua para PostgREST.
-- ============================================================

drop policy if exists "actividad_diaria_select_admin" on public.actividad_diaria;
create policy "actividad_diaria_select_admin" on public.actividad_diaria
  for select using ((select private.es_administrador()));

create or replace function public.admin_estudio_por_semana(p_desde date)
returns table (semana date, personas bigint, nuevas bigint, pagan bigint)
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
  with semanas as (
    select a.id_usuario, date_trunc('week', a.fecha)::date as semana
    from public.actividad_diaria a
    where a.fecha >= p_desde
    group by a.id_usuario, date_trunc('week', a.fecha)
  ),
  primera as (
    select a.id_usuario, date_trunc('week', min(a.fecha))::date as semana
    from public.actividad_diaria a
    group by a.id_usuario
  )
  select
    s.semana,
    count(*)::bigint,
    count(*) filter (where p.semana = s.semana)::bigint,
    -- Pagaba si algún plan de pasarela cubría algún día de esa semana.
    count(*) filter (where exists (
      select 1
      from public.suscripciones su
      where su.id_usuario = s.id_usuario
        and su.proveedor in ('stripe', 'wompi')
        and su.fecha_inicio < ((s.semana + 7)::timestamp at time zone 'America/Bogota')
        and (su.fecha_renovacion is null or su.fecha_renovacion >= (s.semana::timestamp at time zone 'America/Bogota'))
    ))::bigint
  from semanas s
  join primera p on p.id_usuario = s.id_usuario
  group by s.semana
  order by s.semana;
end;
$$;

revoke execute on function public.admin_estudio_por_semana(date) from public, anon;
grant execute on function public.admin_estudio_por_semana(date) to authenticated;

drop function if exists public.admin_listar_usuarios(text, date, date, text, text, text, integer, integer);

create or replace function public.admin_listar_usuarios(
  p_query text default null,
  p_desde date default null,
  p_hasta date default null,
  p_rol text default null,
  p_estado text default null,
  p_suscripcion text default null,
  -- SEMANA: estudió en los últimos 7 días. PARADOS: tiene acceso y lleva 14
  -- días o más sin estudiar (o nunca estudió). NUNCA: nunca vio una clase.
  p_estudio text default null,
  -- INVITACION, MANUAL o PAGO (Stripe o Wompi): de dónde salió su acceso actual.
  p_origen text default null,
  p_limite integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid,
  slug text,
  nombre text,
  correo text,
  rol text,
  estado text,
  fecha_registro timestamptz,
  cursos_inscritos bigint,
  suscripcion_estado text,
  suscripcion_acceso_manual boolean,
  suscripcion_tiene_codigo boolean,
  suscripcion_proveedor text,
  suscripcion_inicio timestamptz,
  suscripcion_fin timestamptz,
  suscripcion_plan text,
  suscripcion_monto bigint,
  suscripcion_moneda text,
  ultima_actividad timestamptz,
  total_resultados bigint
)
language plpgsql
stable
set search_path = public, extensions
as $$
-- Mismo motivo que en 074: ante un nombre repetido gana la columna.
#variable_conflict use_column
begin
  if not private.es_administrador() then
    raise exception 'No tienes permisos de administrador.' using errcode = '42501';
  end if;

  return query
  with base as (
    select
      p.id,
      p.slug,
      p.nombre,
      p.correo,
      p.rol::text as rol,
      p.estado::text as estado,
      p.creado_en as fecha_registro,
      (
        select count(*) from (
          select i.id_curso as id_curso from public.inscripciones i where i.id_usuario = p.id
          union
          select m.id_curso
          from public.progreso pr
          join public.lecciones l on l.id = pr.id_leccion
          join public.modulos m on m.id = l.id_modulo
          where pr.id_usuario = p.id
        ) cursos_del_usuario
      ) as cursos_inscritos,
      e.estado_efectivo as suscripcion_estado,
      s.acceso_manual as suscripcion_acceso_manual,
      (s.id_codigo_invitacion is not null) as suscripcion_tiene_codigo,
      s.proveedor as suscripcion_proveedor,
      s.fecha_inicio as suscripcion_inicio,
      s.fecha_renovacion as suscripcion_fin,
      pl.nombre as suscripcion_plan,
      s.monto_centavos as suscripcion_monto,
      s.moneda as suscripcion_moneda,
      (select max(pr.actualizado_en) from public.progreso pr where pr.id_usuario = p.id) as ultima_actividad
    from public.perfiles p
    -- La vigente si la hay (a lo sumo una, por el índice parcial), si no la
    -- más reciente: mismo criterio que 074.
    left join lateral (
      select su.estado, su.acceso_manual, su.id_codigo_invitacion, su.proveedor, su.fecha_inicio,
             su.fecha_renovacion, su.id_plan, su.monto_centavos, su.moneda
      from public.suscripciones su
      where su.id_usuario = p.id
      order by
        (su.estado in ('ACTIVA'::"EstadoSuscripcion", 'PAST_DUE'::"EstadoSuscripcion")) desc,
        su.fecha_inicio desc
      limit 1
    ) s on true
    left join public.planes pl on pl.id = s.id_plan
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
      and (p_hasta is null or p.creado_en < (p_hasta + 1)::timestamptz)
      and (p_rol is null or p.rol::text = p_rol)
      and (p_estado is null or p.estado::text = p_estado)
      and (
        p_suscripcion is null
        -- Un administrador no necesita acceso: no es alguien que "nunca tuvo".
        or (p_suscripcion = 'SIN_SUSCRIPCION' and s.estado is null and p.rol <> 'ADMINISTRADOR'::"RolPerfil")
        or e.estado_efectivo = p_suscripcion
      )
      and (
        p_origen is null
        or (p_origen = 'INVITACION' and s.proveedor = 'invitacion')
        or (p_origen = 'MANUAL' and s.proveedor = 'manual')
        or (p_origen = 'PAGO' and s.proveedor in ('stripe', 'wompi'))
      )
  )
  select
    base.id,
    base.slug,
    base.nombre,
    base.correo,
    base.rol,
    base.estado,
    base.fecha_registro,
    base.cursos_inscritos,
    base.suscripcion_estado,
    base.suscripcion_acceso_manual,
    base.suscripcion_tiene_codigo,
    base.suscripcion_proveedor,
    base.suscripcion_inicio,
    base.suscripcion_fin,
    base.suscripcion_plan,
    base.suscripcion_monto,
    base.suscripcion_moneda,
    base.ultima_actividad,
    count(*) over() as total_resultados
  from base
  where
    p_estudio is null
    or (p_estudio = 'SEMANA' and base.ultima_actividad >= now() - interval '7 days')
    or (p_estudio = 'NUNCA' and base.ultima_actividad is null)
    or (
      p_estudio = 'PARADOS'
      and base.suscripcion_estado in ('ACTIVA', 'PAST_DUE')
      and (base.ultima_actividad is null or base.ultima_actividad < now() - interval '14 days')
    )
  order by base.fecha_registro desc, base.id
  limit least(coalesce(p_limite, 25), 200) offset greatest(coalesce(p_offset, 0), 0);
end;
$$;
