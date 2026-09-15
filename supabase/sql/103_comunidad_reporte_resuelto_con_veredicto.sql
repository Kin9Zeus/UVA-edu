-- ============================================================
-- 131 — Comunidad: la notificación de reporte resuelto ahora dice el
-- veredicto, no solo "se revisó"
-- ============================================================
-- Hasta acá (110), "tu reporte fue revisado" no distinguía si el admin
-- eliminó el contenido o lo revisó y decidió que no ameritaba — un
-- reportante no tenía forma de saber si de verdad se actuó sobre su
-- reporte o si simplemente lo descartaron sin más. Se reemplaza el tipo
-- único 'COMUNIDAD_REPORTE_RESUELTO' por dos:
--   - COMUNIDAD_REPORTE_ELIMINADO: el contenido reportado terminó eliminado.
--   - COMUNIDAD_REPORTE_DESCARTADO: se revisó y se decidió NO eliminarlo.
--
-- Cómo se distingue sin tocar ninguna Server Action: para cuando
-- `comunidad_reportes.revisado` pasa a true (el único momento en que este
-- trigger corre), el contenido reportado YA quedó en su estado final —
-- `eliminarPostComunidad`/`eliminarRespuestaComunidad` marcan `eliminado`
-- ANTES de marcar el reporte como revisado (llamadas secuenciales dentro
-- de la misma Server Action, ver eliminar.ts), y `descartarReporteComunidad`
-- nunca toca `eliminado`. El trigger solo necesita leer ese estado en el
-- momento en que se dispara — ninguna de las 3 rutas que hoy marcan
-- `revisado = true` (eliminar post, eliminar respuesta, descartar) necesita
-- cambiar.
-- ============================================================

-- Paso 1: ampliar el CHECK para admitir TANTO el tipo viejo como los dos
-- nuevos a la vez — ni el backfill de abajo (que escribe los tipos nuevos)
-- ni las filas viejas que todavía no se reclasificaron (tipo viejo) pueden
-- violarlo mientras conviven en la misma transacción.
alter table public.notificaciones drop constraint if exists notificaciones_tipo_valido;
do $$
begin
  alter table public.notificaciones
    add constraint notificaciones_tipo_valido
    check (tipo in (
      'COMUNIDAD_RESPUESTA',
      'COMUNIDAD_ANUNCIO',
      'COMUNIDAD_MODERACION',
      'COMUNIDAD_REPORTE_RESUELTO',
      'COMUNIDAD_REPORTE_ELIMINADO',
      'COMUNIDAD_REPORTE_DESCARTADO'
    ));
exception
  when duplicate_object then null;
  -- Ver el comentario equivalente en 094/095/110: mismo motivo, por si un
  -- archivo futuro suma otro tipo antes de que este vuelva a correr.
  when check_violation then null;
end;
$$;

-- Paso 2: backfill — reclasifica las notificaciones ya emitidas con el tipo
-- viejo según el estado ACTUAL del post reportado (entidad_id ya apunta al
-- post, sea que lo reportado haya sido el post o una respuesta suya — ver
-- 110). No es retroactivamente perfecto (si el post se eliminó DESPUÉS de
-- emitida la notificación, por una vía distinta al reporte, quedaría
-- reclasificado como "eliminado" aunque en el momento del reporte no lo
-- estuviera), pero es la mejor aproximación posible sin haber guardado el
-- veredicto en la propia notificación desde el principio, y el volumen de
-- filas viejas es mínimo.
update public.notificaciones n
set tipo = case
  when exists (select 1 from public.comunidad_posts p where p.id = n.entidad_id and p.eliminado)
    then 'COMUNIDAD_REPORTE_ELIMINADO'
  else 'COMUNIDAD_REPORTE_DESCARTADO'
end
where n.tipo = 'COMUNIDAD_REPORTE_RESUELTO';

-- Paso 3: ya reclasificadas todas, se cierra el CHECK a la lista final —
-- ninguna fila nueva debe volver a usar el tipo viejo.
alter table public.notificaciones drop constraint if exists notificaciones_tipo_valido;
do $$
begin
  alter table public.notificaciones
    add constraint notificaciones_tipo_valido
    check (tipo in (
      'COMUNIDAD_RESPUESTA',
      'COMUNIDAD_ANUNCIO',
      'COMUNIDAD_MODERACION',
      'COMUNIDAD_REPORTE_ELIMINADO',
      'COMUNIDAD_REPORTE_DESCARTADO'
    ));
exception
  when duplicate_object then null;
  when check_violation then null;
end;
$$;

create or replace function private.comunidad_notificar_reporte_resuelto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id_post uuid;
  v_eliminado boolean;
  v_tipo text;
begin
  if new.id_post is not null then
    v_id_post := new.id_post;
    select eliminado into v_eliminado from public.comunidad_posts where id = new.id_post;
  else
    select r.id_post, r.eliminado into v_id_post, v_eliminado
      from public.comunidad_respuestas r where r.id = new.id_respuesta;
  end if;

  if v_id_post is null then
    return new;
  end if;

  v_tipo := case when coalesce(v_eliminado, false)
    then 'COMUNIDAD_REPORTE_ELIMINADO'
    else 'COMUNIDAD_REPORTE_DESCARTADO'
  end;

  insert into public.notificaciones (id_usuario, tipo, id_actor, entidad_tipo, entidad_id)
  values (new.id_reportante, v_tipo, null, 'comunidad_post', v_id_post);

  return new;
end;
$$;
