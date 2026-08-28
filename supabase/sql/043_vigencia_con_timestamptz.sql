-- ============================================================
-- La vigencia deja de depender de la TimeZone de la sesión
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-042.
-- Redefine `private.suscripcion_da_acceso()` (última versión: 038) y la
-- vista `public.metricas_panel_usuarios` (036). Nada más cambia: la lógica
-- de negocio es idéntica, solo se corrige cómo se comparan las fechas.
--
-- Requiere la migración de Prisma `esquema_listo_para_cobro`, que convierte
-- `suscripciones.fecha_renovacion` y `codigos_invitacion.fecha_vencimiento`
-- a `timestamptz`.
--
-- El problema que había
-- ---------------------
-- Esas columnas eran `timestamp` SIN zona. La cabecera de 036 ya lo
-- documentaba como riesgo ("hoy funciona porque servidor y sesión están en
-- UTC (...) pero es una coincidencia no declarada") y se protegía con
-- `AT TIME ZONE 'UTC'`. 038, escrita después, usó `AT TIME ZONE
-- 'America/Bogota'` sobre la misma columna — y esa NO es la misma
-- operación. En Postgres `AT TIME ZONE` hace cosas opuestas según el tipo:
--
--   timestamptz AT TIME ZONE z  ->  timestamp   (instante -> hora de pared)
--   timestamp   AT TIME ZONE z  ->  timestamptz (hora de pared -> instante)
--
-- Como la columna era `timestamp` desnudo con hora UTC guardada dentro, la
-- expresión de 038 la interpretaba como si fuera hora de Bogotá: sumaba
-- cinco horas en lugar de restarlas. Los dos lados de la comparación se
-- calculaban con reglas distintas, y el resultado era que toda membresía
-- otorgada después de las 2:00 p.m. hora de Colombia vencía un día más
-- tarde de lo que la plataforma le anunció al estudiante — con la capa
-- TypeScript (`suscripcionDaAcceso`, que sí calculaba bien el día civil)
-- diciendo lo contrario. El token de Mux se cortaba un día antes de que la
-- RLS de `recursos_descargables` dejara de permitir la descarga, cuando la
-- cabecera de 038 exige explícitamente que las dos digan lo mismo.
--
-- Qué cambia aquí
-- ---------------
-- Con la columna ya en `timestamptz`, las expresiones sobre
-- 'America/Bogota' pasan a significar lo que siempre quisieron decir —el
-- día civil en Colombia— y se quedan como están.
--
-- Las que sobran son las de `AT TIME ZONE 'UTC'`: eran correctas mientras
-- la columna fue desnuda, pero ahora convierten un instante a hora de pared
-- UTC y lo comparan contra `now()`, lo que reintroduce por la puerta de
-- atrás el cast implícito dependiente de la sesión que querían evitar. Con
-- las dos partes en `timestamptz` la comparación es directa y no depende de
-- nada externo.
--
-- Precedente: 020_actualiza_verificar_certificado_timestamptz.sql, la misma
-- clase de corrección sobre otra función.
-- ============================================================


-- ------------------------------------------------------------
-- private.suscripcion_da_acceso (redefine la de 038)
--
-- Regla de negocio SIN CAMBIOS — es la misma de 038 y su gemela sigue
-- siendo `suscripcionDaAcceso()` en src/lib/estadoAcceso.ts:
--
--   ACTIVA   -> vigente hasta el FINAL del día colombiano de
--               `fecha_renovacion` (es la fecha que la app le imprime al
--               estudiante como "Vigente hasta ..."; cortar en el instante
--               exacto le quitaría el acceso a media mañana del día que se
--               le prometió entero).
--   PAST_DUE -> solo dentro de los 5 días de gracia.
--   VENCIDA / CANCELADA -> no.
--
-- Los 5 días son DURACION_GRACIA_DIAS en src/lib/gracia.ts; hay un test que
-- falla si este número y el de la vista de métricas se separan
-- (src/lib/gracia.test.ts).
--
-- `private.cerrar_suscripcion_caducada()` (041) delega en esta función, así
-- que hereda la corrección sin tocarse.
-- ------------------------------------------------------------
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
            -- Con fecha_renovacion ya en timestamptz, esto es de verdad el
            -- día civil en Bogotá a ambos lados.
            or (s.fecha_renovacion at time zone 'America/Bogota')::date
               >= (now() at time zone 'America/Bogota')::date
          )
        )
        or (
          s.estado = 'PAST_DUE'
          and (
            s.fecha_renovacion is null
            -- Sin `at time zone 'UTC'`: los dos operandos son timestamptz,
            -- así que la comparación es entre instantes y no depende de la
            -- TimeZone de la sesión.
            or s.fecha_renovacion + interval '5 days' > now()
          )
        )
      )
  );
$$;

grant execute on function private.suscripcion_da_acceso(uuid) to authenticated;


-- ------------------------------------------------------------
-- metricas_panel_usuarios (redefine la de 036)
--
-- Idéntica a la de 036 salvo por las tres comparaciones de fecha, que ya no
-- necesitan `at time zone 'UTC'`. Se repite entera porque una vista no se
-- puede parchear: `create or replace view` exige volver a declararla, y
-- cambiar la forma del resultado obliga a soltarla antes.
--
-- Todos los comentarios de diseño (por qué los cupos se cuentan por la FK y
-- no por `veces_usado`, por qué los administradores quedan fuera, por qué
-- `security_invoker` es obligatorio) siguen vigentes en 036; no se
-- reproducen aquí para que la explicación no viva duplicada y pueda
-- separarse.
-- ------------------------------------------------------------
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
estudiantes as (
  select p.id
  from public.perfiles p
  where p.rol = 'ESTUDIANTE'::"RolPerfil"
),
-- Misma regla que private.suscripcion_da_acceso() de arriba. Va escrita
-- aquí en vez de llamando a esa función por el motivo que ya explicaba 036:
-- la vista se crea antes que ella en el orden del pipeline.
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
