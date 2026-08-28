-- ============================================================
-- MÉTRICAS DEL PANEL DE USUARIOS (Fase 4)
--
-- RevUsuariof4 ("Panel de usuarios: cupos usados/disponibles, activos e
-- inactivos"). Especificación completa en docs/fase4-panel-usuarios.md.
--
-- Tres vistas, todas `security_invoker = true`:
--   - metricas_panel_usuarios   (una fila: los KPIs escalares)
--   - avance_cursos             (una fila por curso)
--   - abandono_lecciones        (una fila por lección con abandonos)
--
-- Por qué vistas y no funciones: no reciben parámetros. El filtro de rango
-- de fechas del panel actúa solo sobre la tabla de usuarios, nunca sobre
-- los KPIs (docs §6.0): "cupos disponibles" es un saldo, no un flujo, y
-- acotarlo a un rango no significa nada.
--
-- security_invoker OBLIGATORIO
-- ----------------------------
-- Una vista normal se ejecuta con los permisos de su DUEÑO, no de quien
-- consulta, y se saltaría por completo la RLS de las tablas que lee. Con
-- `security_invoker = true` (Postgres 15+, mismo criterio que
-- 033_vista_progreso_cursos.sql) las políticas siguen aplicando por debajo:
-- un administrador ve el agregado real y un estudiante ve ceros, porque las
-- políticas `*_select_propio` le devuelven solo sus propias filas.
--
-- NO convertir a SECURITY DEFINER ni cambiar el dueño para "arreglar"
-- números que salgan en cero: eso convertiría estas vistas en una fuga del
-- padrón completo hacia cualquier usuario autenticado.
--
-- Zonas horarias
-- --------------
-- `codigos_invitacion.fecha_vencimiento` y `suscripciones.fecha_renovacion`
-- son `timestamp` SIN zona horaria, a diferencia del resto del esquema
-- (que es `timestamptz`). Compararlas contra `now()` provoca un cast
-- implícito que usa la TimeZone de la sesión: hoy funciona porque servidor
-- y sesión están en UTC y la app escribe con .toISOString(), pero es una
-- coincidencia no declarada. Aquí se convierte explícitamente con
-- `AT TIME ZONE 'UTC'`. El proyecto ya tuvo que emitir
-- 020_actualiza_verificar_certificado_timestamptz.sql por esta misma clase
-- de bug; no es un riesgo teórico.
-- ============================================================

-- ------------------------------------------------------------
-- metricas_panel_usuarios
--
-- Cupos: se cuentan por la llave foránea `suscripciones.id_codigo_invitacion`,
-- NO por `codigos_invitacion.veces_usado`. `veces_usado` es un contador
-- suelto que mantiene canjear_codigo_invitacion(); si un canje falla a
-- medias, miente y nada lo detecta. La FK es la relación real. (En una base
-- sembrada los dos números divergen a propósito: el seed declara usos que no
-- tienen suscripción detrás — ver docs §9.10.)
--
-- La aritmética cierra por construcción:
--   cupos_totales = cupos_canjeados + cupos_disponibles + cupos_caducados
-- porque las tres se derivan del mismo `usados` por código. Un código
-- desactivado o vencido con usos sin gastar no es disponible (ya nadie
-- puede canjearlo) pero tampoco fue canjeado: por eso existe la cuarta
-- cifra, en vez de dejar que esos cupos se evaporen del total.
--
-- `limite_usos` es NOT NULL con CHECK >= 1 desde la migración
-- 20260827000000, así que no hay que contemplar códigos ilimitados.
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
      case when activo and (fecha_vencimiento at time zone 'UTC') > now()
           then greatest(limite_usos - usados, 0) else 0 end
    ), 0)::bigint as disponibles,
    coalesce(sum(
      case when not activo or (fecha_vencimiento at time zone 'UTC') <= now()
           then greatest(limite_usos - usados, 0) else 0 end
    ), 0)::bigint as caducados
  from uso_codigos
),
-- Los administradores quedan fuera de TODAS las métricas de usuarios: el
-- panel mide invitados, no al equipo de UVA (docs §2.1). La tabla sí los
-- sigue listando, porque es desde donde se administran.
estudiantes as (
  select p.id
  from public.perfiles p
  where p.rol = 'ESTUDIANTE'::"RolPerfil"
),
-- Vigente = ACTIVA con la fecha de renovación todavía en pie, o PAST_DUE
-- dentro del periodo de gracia. Es la misma regla que decide si el usuario
-- entra al contenido —`private.suscripcion_da_acceso()` en
-- 038_vigencia_por_fecha.sql y `suscripcionDaAcceso()` en
-- src/lib/estadoAcceso.ts—, así que el panel no puede contradecir a la
-- aplicación. Va escrita aquí en vez de llamando a esa función porque la
-- vista se crea antes que ella (036 corre antes que 038).
--
-- La condición de fecha importa: nada mueve la fila a VENCIDA cuando el
-- periodo termina, así que sin ella el panel contaba como "acceso vigente"
-- a invitados que llevaban meses fuera.
--
-- Los 5 días son DURACION_GRACIA_DIAS en src/lib/gracia.ts. SQL no puede
-- importar esa constante: si cambia allí, hay que cambiarla aquí. Hay un
-- test que verifica que ambos lados coinciden (src/lib/gracia.test.ts).
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
            and (s.fecha_renovacion at time zone 'UTC') + interval '5 days' > now()
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
  -- otorgarMembresia() crea suscripciones manuales sin pasar por ningún
  -- código, así que no consumen cupo. Van como cifra propia: sumarlas a
  -- cupos_canjeados rompería la aritmética de arriba, y omitirlas dejaría
  -- invisibles a invitados que sí entraron (docs §1.4).
  (select count(*) from public.suscripciones s
    where s.acceso_manual = true and s.id_codigo_invitacion is null)::bigint
    as accesos_otorgados_admin,
  (select count(*) from acceso)::bigint                                    as usuarios_registrados,
  (select count(*) from acceso where vigente)::bigint                      as usuarios_acceso_vigente,
  (select count(*) from acceso where not vigente and tuvo_alguna)::bigint  as usuarios_acceso_vencido,
  (select count(*) from acceso where not tuvo_alguna)::bigint              as usuarios_sin_acceso,
  -- Actividad = avance real de contenido, derivado de progreso.actualizado_en
  -- (@updatedAt, se mueve con cada guardado del reproductor). NO es "último
  -- ingreso": quien entra, navega el catálogo y se va sin abrir un video no
  -- cuenta. La UI lo rotula "última actividad en contenido" para no prometer
  -- lo que no mide (docs §3).
  (select count(distinct pr.id_usuario)
     from public.progreso pr
     join estudiantes e on e.id = pr.id_usuario
    where pr.actualizado_en > now() - interval '7 days')::bigint
    as usuarios_activos_7d
from cupos;

-- ------------------------------------------------------------
-- avance_cursos
--
-- Promedio de porcentaje completado entre los PARTICIPANTES del curso.
--
-- Participante NO es sinónimo de fila en `inscripciones`: un estudiante con
-- membresía no tiene inscripción, porque el acceso por suscripción se valida
-- en caliente contra `suscripciones` y nunca se materializa una fila por
-- curso (ver tieneAccesoAlCurso en src/lib/leccion.ts, y el bloque que lo
-- compensa en src/lib/admin/usuarioDetalle.ts). Solo las cortesías dejan
-- fila. Por eso el universo es la UNIÓN de inscritos y de quienes tienen
-- progreso en alguna lección del curso.
--
-- El denominador de cada participante es TODAS las lecciones del curso, no
-- las que tocó: contar sobre las tocadas hace que quien completó 3 de 4
-- clases y nunca abrió la cuarta aparezca al 100%. Es el bug que ya
-- corrigieron usuarioDetalle.ts y cursoDetalle.ts; esta vista y la
-- reescritura de lib/admin/dashboard.ts lo cierran en el último sitio que
-- lo conservaba.
-- ------------------------------------------------------------
drop view if exists public.avance_cursos;

create view public.avance_cursos
with (security_invoker = true) as
with lecciones_por_curso as (
  select m.id_curso, count(l.id) as total
  from public.modulos m
  join public.lecciones l on l.id_modulo = m.id
  group by m.id_curso
),
participantes as (
  select i.id_curso, i.id_usuario
  from public.inscripciones i
  union
  select m.id_curso, pr.id_usuario
  from public.progreso pr
  join public.lecciones l on l.id = pr.id_leccion
  join public.modulos m on m.id = l.id_modulo
),
avance_por_participante as (
  select
    p.id_curso,
    p.id_usuario,
    (
      select count(*)
      from public.progreso pr2
      join public.lecciones l2 on l2.id = pr2.id_leccion
      join public.modulos m2 on m2.id = l2.id_modulo
      where pr2.id_usuario = p.id_usuario
        and m2.id_curso = p.id_curso
        and pr2.completado
    )::numeric / lpc.total as fraccion
  from participantes p
  join lecciones_por_curso lpc on lpc.id_curso = p.id_curso
  -- lpc.total > 0 siempre por el join (un curso sin lecciones no aparece en
  -- lecciones_por_curso), así que no hay división por cero.
)
select
  c.id                                              as curso_id,
  c.titulo,
  c.mostrado,
  lpc.total                                         as lecciones_total,
  count(a.id_usuario)::bigint                       as participantes,
  coalesce(round(avg(a.fraccion) * 100), 0)::int    as avance_promedio
from public.cursos c
join lecciones_por_curso lpc on lpc.id_curso = c.id
left join avance_por_participante a on a.id_curso = c.id
group by c.id, c.titulo, c.mostrado, lpc.total;

-- ------------------------------------------------------------
-- abandono_lecciones
--
-- Lecciones empezadas y no terminadas, con corte de antigüedad.
--
-- El corte de 14 días NO es un adorno: sin él la cifra incluye a quien está
-- viendo esa lección en este momento, y "abandonado" y "en curso" quedarían
-- sumados en el mismo número. Dos semanas dejan fuera el falso positivo más
-- común —alguien que tuvo una semana ocupada— sin tardar tanto en avisar que
-- la métrica deje de servir.
--
-- Es deliberadamente una ventana distinta de los 7 días de actividad: "sigue
-- activo" y "abandonó esta lección" no son la misma pregunta (docs §5).
-- ------------------------------------------------------------
drop view if exists public.abandono_lecciones;

create view public.abandono_lecciones
with (security_invoker = true) as
select
  l.id                        as leccion_id,
  l.titulo                    as leccion_titulo,
  m.id                        as modulo_id,
  m.titulo                    as modulo_titulo,
  c.id                        as curso_id,
  c.titulo                    as curso_titulo,
  count(*)::bigint            as abandonos
from public.progreso pr
join public.lecciones l on l.id = pr.id_leccion
join public.modulos m on m.id = l.id_modulo
join public.cursos c on c.id = m.id_curso
where pr.completado = false
  and pr.actualizado_en < now() - interval '14 days'
group by l.id, l.titulo, m.id, m.titulo, c.id, c.titulo;

grant select on public.metricas_panel_usuarios to authenticated;
grant select on public.avance_cursos to authenticated;
grant select on public.abandono_lecciones to authenticated;
