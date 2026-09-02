-- ============================================================
-- El listado de usuarios subcontaba "Cursos inscritos"
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-053.
-- Redefine `public.admin_listar_usuarios()` (última versión: 040).
--
-- El problema
-- -----------
-- `cursos_inscritos` se calculaba SOLO con `count(*) from inscripciones` —
-- pero un estudiante con acceso por MEMBRESÍA (suscripción activa) nunca
-- tiene fila en `inscripciones`: esa tabla es solo para CORTESIA, el acceso
-- por suscripción se valida en caliente contra `suscripciones` y no se
-- materializa una fila por curso (ver obtenerAccesoAlCurso,
-- src/lib/accesoCurso.ts). El único rastro de que ese estudiante entró a un
-- curso por membresía es una fila en `progreso`.
--
-- Consecuencia real: la tabla de `/admin/usuarios` mostraba "1 curso" para
-- alguien que en realidad tenía varios — exactamente el mismo bug que
-- `044_admin_listado_cursos_inscritos...` (nombre real: ver
-- lib/admin/cursoDetalle.ts) ya había corregido para la pestaña "Estudiantes"
-- DENTRO de un curso, y que `getCursosListado()` (src/lib/admin/cursos.ts)
-- acababa de corregir del lado de "cuántos estudiantes tiene este curso".
-- Esta es la tercera aparición de la misma regla — la ficha de un usuario
-- puntual (src/lib/admin/usuarioDetalle.ts) ya la tenía bien; solo el
-- LISTADO se había quedado atrás.
--
-- La regla, sin inventar una cuarta versión
-- ------------------------------------------
-- "Cursos inscritos" de un usuario = cursos distintos que aparecen en
-- `inscripciones` UNION cursos distintos derivados de `progreso` (vía
-- lecciones → módulos → cursos) para ese usuario. Ni `EstadoSuscripcionListado`
-- ni la tabla ni el CSV cambian de forma — siguen leyendo `cursos_inscritos`
-- como un entero, el arreglo vive entero en la función.
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
      -- UNION (no union all): un curso donde el estudiante tiene cortesía Y
      -- ya le quedó progreso guardado no debe contarse dos veces.
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
      -- Estado EFECTIVO, no el crudo de la fila: una ACTIVA/PAST_DUE cuya
      -- fecha ya pasó se reporta como VENCIDA aunque nada en `suscripciones`
      -- la haya actualizado todavía (ver 040).
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
