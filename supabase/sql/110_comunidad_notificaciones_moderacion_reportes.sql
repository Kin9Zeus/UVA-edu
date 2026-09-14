-- ============================================================
-- 110 — Notificaciones: moderación in-app y cierre de reportes
-- ============================================================
-- Mismo criterio que 094/095: un trigger SECURITY DEFINER sobre la tabla de
-- origen decide él mismo a quién avisar, nunca la app. Dos disparadores
-- nuevos, cada uno sobre una tabla que YA existe y YA recibe exactamente la
-- fila que necesitamos — ninguna Server Action se toca:
--
-- 1) comunidad_moderacion recibe una fila exactamente cuando un admin borra
--    el post/respuesta de OTRA persona (eliminarPostComunidad/
--    eliminarRespuestaComunidad, src/actions/comunidad/eliminar.ts) — el
--    autor real hoy solo se entera por correo (enviarCorreoComunidadModerada).
--    Un trigger AFTER INSERT ahí resuelve el autor leyendo
--    comunidad_posts.id_usuario o comunidad_respuestas.id_usuario (ninguna
--    de las dos se toca en el UPDATE que sigue a este INSERT dentro de la
--    misma Server Action, así que en el momento del trigger el valor real
--    todavía está ahí) y le inserta la notificación.
--
-- 2) comunidad_reportes.revisado pasa de false a true por 3 caminos hoy
--    (descartarReporteComunidad, el auto-resuelto de
--    getReportesComunidadPendientes cuando el contenido ya no existe, y el
--    UPDATE dentro de eliminarPostComunidad/eliminarRespuestaComunidad) —
--    un trigger AFTER UPDATE con WHEN (new.revisado and not old.revisado)
--    cubre los 3 sin duplicar lógica en cada uno, notificando siempre a
--    id_reportante que su reporte se resolvió.
--
-- En ambos casos entidad_tipo sigue siendo 'comunidad_post' con entidad_id
-- apuntando al POST (el propio, o el padre si lo afectado fue una
-- respuesta) — mismo criterio que ya usa registrarBitacora en eliminar.ts
-- y getReportesComunidadPendientes en TypeScript. Si lo moderado fue el
-- post mismo, el link ya resuelto por urlNotificacion (sin cambios) apunta
-- a una página que ahora da 404 — aceptado a propósito, mismo trade-off
-- que ya documenta BitacoraTable.tsx (resolverRutaBitacora): la app ya
-- tiene una pantalla de 404 diseñada y el mensaje de la notificación ya
-- deja claro qué pasó sin depender de que el link sirva.
-- ============================================================

-- El CHECK de 095 solo permitía 'COMUNIDAD_RESPUESTA'/'COMUNIDAD_ANUNCIO';
-- Postgres no deja "ALTER CHECK", así que se reemplaza por la lista
-- ampliada (mismo patrón que 095 hizo sobre 094).
alter table public.notificaciones drop constraint if exists notificaciones_tipo_valido;
do $$
begin
  alter table public.notificaciones
    add constraint notificaciones_tipo_valido
    check (tipo in ('COMUNIDAD_RESPUESTA', 'COMUNIDAD_ANUNCIO', 'COMUNIDAD_MODERACION', 'COMUNIDAD_REPORTE_RESUELTO'));
exception
  when duplicate_object then null;
end;
$$;

-- ------------------------------------------------------------
-- 1) Moderación
-- ------------------------------------------------------------
create or replace function private.comunidad_notificar_moderacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_autor uuid;
  v_id_post uuid;
begin
  if new.id_post is not null then
    select id_usuario into v_autor from public.comunidad_posts where id = new.id_post;
    v_id_post := new.id_post;
  else
    select id_usuario, id_post into v_autor, v_id_post
      from public.comunidad_respuestas where id = new.id_respuesta;
  end if;

  -- Sin autor resuelto (no debería pasar, las FK lo garantizan): no hay a
  -- quién avisar. A diferencia de comunidad_notificar_respuesta, acá SIEMPRE
  -- se notifica aunque el autor sea el mismo admin que moderó — un admin no
  -- se elimina contenido propio por esta vía (eliminarPostComunidad borra
  -- sin pedir motivo cuando esAutor), así que ese caso no ocurre en la
  -- práctica, pero no hay razón de negocio para excluirlo si pasara.
  if v_autor is null then
    return new;
  end if;

  insert into public.notificaciones (id_usuario, tipo, id_actor, entidad_tipo, entidad_id)
  values (v_autor, 'COMUNIDAD_MODERACION', new.id_eliminado_por, 'comunidad_post', v_id_post);

  return new;
end;
$$;

drop trigger if exists comunidad_moderacion_notifica_autor on public.comunidad_moderacion;
create trigger comunidad_moderacion_notifica_autor
  after insert on public.comunidad_moderacion
  for each row
  execute function private.comunidad_notificar_moderacion();

-- ------------------------------------------------------------
-- 2) Cierre de reportes
-- ------------------------------------------------------------
create or replace function private.comunidad_notificar_reporte_resuelto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id_post uuid;
begin
  if new.id_post is not null then
    v_id_post := new.id_post;
  else
    select id_post into v_id_post from public.comunidad_respuestas where id = new.id_respuesta;
  end if;

  if v_id_post is null then
    return new;
  end if;

  insert into public.notificaciones (id_usuario, tipo, id_actor, entidad_tipo, entidad_id)
  values (new.id_reportante, 'COMUNIDAD_REPORTE_RESUELTO', null, 'comunidad_post', v_id_post);

  return new;
end;
$$;

drop trigger if exists comunidad_reportes_notifica_resuelto on public.comunidad_reportes;
create trigger comunidad_reportes_notifica_resuelto
  after update on public.comunidad_reportes
  for each row
  when (new.revisado and not old.revisado)
  execute function private.comunidad_notificar_reporte_resuelto();
