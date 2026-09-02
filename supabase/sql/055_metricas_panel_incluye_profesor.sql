-- ============================================================
-- Las métricas del panel de usuarios excluían en silencio a los PROFESOR
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-054.
-- Redefine `public.metricas_panel_usuarios` (última versión: 043).
--
-- El problema
-- -----------
-- `036_vistas_metricas_panel.sql` filtró la población de estas métricas a
-- `rol = 'ESTUDIANTE'` cuando el único otro rol que existía era
-- ADMINISTRADOR — excluir admins del "quién está usando la plataforma" era
-- justo la intención. La migración `051_rol_profesor.sql` agregó PROFESOR
-- después, y nadie volvió a tocar esta vista: una cuenta PROFESOR quedó
-- invisible en "Personas que entraron", "Con acceso hoy", "Avanzando esta
-- semana" y en el total de "registrados" — no porque se decidiera excluirla
-- a propósito, sino porque el filtro nunca se enteró de que el rol existía.
--
-- Verificado contra la base real: 1 ADMINISTRADOR + 1 PROFESOR + 7
-- ESTUDIANTE = 9 perfiles, y la vista reportaba `usuarios_registrados = 7`
-- (justo los ESTUDIANTE, ni el admin ni el profesor).
--
-- La regla
-- --------
-- PROFESOR se trata como ESTUDIANTE para este panel: es una cuenta real que
-- usa la plataforma (puede tener suscripción, entrar a ver contenido,
-- comentar), no personal administrativo. ADMINISTRADOR se sigue excluyendo,
-- sin cambios — sigue sin ser "uso" en el sentido que mide este panel.
--
-- El resto de la vista (cupos de códigos de invitación) no depende de
-- `perfiles.rol` y no cambia; se repite entera porque una vista no admite
-- parchear una sola CTE (`create or replace view` exige la forma completa, y
-- cambiar el filtro de `estudiantes` no cambia la forma del resultado, pero
-- sí se droppea antes por consistencia con el resto del pipeline).
-- ============================================================

drop view if exists public.metricas_panel_usuarios;

create view public.metricas_panel_usuarios
with (security_invoker = true) as
with uso_codigos as (
  select
    c.id,
    c.limite_usos,
    c.activo,
    c.fecha_vencimiento,
    (select count(*) from public.suscripciones s where s.id_codigo_invitacion = c.id) as usados
  from public.codigos_invitacion c
),
cupos as (
  select
    coalesce(sum(limite_usos), 0)::bigint as totales,
    coalesce(sum(usados), 0)::bigint      as canjeados,
    coalesce(sum(
      case when activo and fecha_vencimiento > now()
           then greatest(limite_usos - usados, 0) else 0 end
    ), 0)::bigint as disponibles,
    coalesce(sum(
      case when not activo or fecha_vencimiento <= now()
           then greatest(limite_usos - usados, 0) else 0 end
    ), 0)::bigint as caducados
  from uso_codigos
),
-- ESTUDIANTE y PROFESOR: las dos cuentas reales que "usan" la plataforma en
-- el sentido que mide este panel. ADMINISTRADOR queda fuera, igual que
-- siempre (036).
estudiantes as (
  select p.id
  from public.perfiles p
  where p.rol in ('ESTUDIANTE'::"RolPerfil", 'PROFESOR'::"RolPerfil")
),
acceso as (
  select
    e.id,
    exists (
      select 1 from public.suscripciones s
      where s.id_usuario = e.id
        and (
          (
            s.estado = 'ACTIVA'::"EstadoSuscripcion"
            and (
              s.fecha_renovacion is null
              or (s.fecha_renovacion at time zone 'America/Bogota')::date
                 >= (now() at time zone 'America/Bogota')::date
            )
          )
          or (
            s.estado = 'PAST_DUE'::"EstadoSuscripcion"
            and s.fecha_renovacion is not null
            and s.fecha_renovacion + interval '5 days' > now()
          )
        )
    ) as vigente,
    exists (select 1 from public.suscripciones s where s.id_usuario = e.id) as tuvo_alguna
  from estudiantes e
)
select
  cupos.totales      as cupos_totales,
  cupos.canjeados    as cupos_canjeados,
  cupos.disponibles  as cupos_disponibles,
  cupos.caducados    as cupos_caducados,
  (select count(*) from public.suscripciones s
    where s.acceso_manual = true and s.id_codigo_invitacion is null)::bigint
    as accesos_otorgados_admin,
  (select count(*) from acceso)::bigint                                    as usuarios_registrados,
  (select count(*) from acceso where vigente)::bigint                      as usuarios_acceso_vigente,
  (select count(*) from acceso where not vigente and tuvo_alguna)::bigint  as usuarios_acceso_vencido,
  (select count(*) from acceso where not tuvo_alguna)::bigint              as usuarios_sin_acceso,
  (select count(distinct pr.id_usuario)
     from public.progreso pr
     join estudiantes e on e.id = pr.id_usuario
    where pr.actualizado_en > now() - interval '7 days')::bigint
    as usuarios_activos_7d
from cupos;

grant select on public.metricas_panel_usuarios to authenticated;
