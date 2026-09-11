-- ============================================================
-- 089 — Comunidad: quién eliminó (autor vs. admin) + motivo de moderación
-- ============================================================
-- Contexto: `comunidad_moderacion` ya guardaba el texto original y quién
-- lo borró, pero (a) esa tabla es solo-admin (RLS), así que ni el autor
-- afectado ni el feed podían saber si un "[respuesta eliminada]" fue el
-- propio autor o un admin moderando, y (b) no existía ningún motivo — el
-- admin borraba con un solo clic, sin justificar nada, ni ante el sistema
-- ni ante el usuario afectado.
--
-- `comunidad_posts.eliminado_por_admin` / `comunidad_respuestas.eliminado_por_admin`
-- (columnas agregadas en la migración de Prisma 20260911000000) resuelven
-- (a): son públicas via RLS normal (mismo `select` que ya existe), así que
-- la UI puede diferenciar el placeholder sin tocar `comunidad_moderacion`.
-- `comunidad_moderacion.motivo` resuelve (b): la Server Action exige un
-- motivo no vacío antes de dejar que un admin borre contenido ajeno (ver
-- eliminarPostComunidad/eliminarRespuestaComunidad), y ese motivo se le
-- envía al autor por correo (best-effort, mismo patrón que
-- enviarCorreoPasswordActualizada).

-- Capa 1 — privilegio por columna: agrega eliminado_por_admin a lo que la
-- app ya podía escribir (mismo criterio que 083).
revoke update on public.comunidad_posts from anon;
revoke update on public.comunidad_posts from authenticated;
grant update (eliminado, eliminado_por_admin, fijado, contenido, titulo) on public.comunidad_posts to authenticated;

revoke update on public.comunidad_respuestas from anon;
revoke update on public.comunidad_respuestas from authenticated;
grant update (eliminado, eliminado_por_admin, contenido) on public.comunidad_respuestas to authenticated;

-- Capa 2 — transiciones: eliminado_por_admin es de exclusivo resorte del
-- trigger, no de la app — se recalcula siempre a partir de quién ejecuta
-- el UPDATE, nunca se confía en lo que mande el cliente. Así, aunque
-- alguien manipulara el payload para mandar `eliminado_por_admin: false`
-- al borrar contenido ajeno, el trigger lo corrige.
--
-- OJO: esta función reemplaza la de 083 pasando por la de 087
-- (comunidad_editar_publicacion), que ya le había agregado la rama de
-- "el propio autor SÍ puede reescribir contenido/titulo mientras no esté
-- eliminada" — se parte de ESA versión, no de la de 083, para no
-- reintroducir la regresión de bloquear la edición del autor.
create or replace function private.comunidad_posts_transiciones_permitidas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.fijado is distinct from old.fijado and not private.es_administrador() then
    raise exception 'Fijar o desfijar una publicación requiere un administrador.'
      using errcode = 'check_violation';
  end if;

  if old.eliminado and not new.eliminado and not private.es_administrador() then
    raise exception 'Una publicación eliminada solo puede restaurarla un administrador.'
      using errcode = 'check_violation';
  end if;

  if new.contenido is distinct from old.contenido and new.contenido <> '' then
    if old.eliminado or new.eliminado or (select auth.uid()) <> old.id_usuario then
      raise exception 'El contenido de una publicación solo lo puede reescribir su propio autor, mientras no esté eliminada.'
        using errcode = 'check_violation';
    end if;
  end if;

  if new.titulo is distinct from old.titulo and new.titulo <> '' then
    if old.eliminado or new.eliminado or (select auth.uid()) <> old.id_usuario then
      raise exception 'El título de una publicación solo lo puede reescribir su propio autor, mientras no esté eliminada.'
        using errcode = 'check_violation';
    end if;
  end if;

  if not old.eliminado and new.eliminado then
    new.eliminado_por_admin := private.es_administrador() and (select auth.uid()) <> old.id_usuario;
  end if;

  return new;
end;
$$;

create or replace function private.comunidad_respuestas_transiciones_permitidas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.eliminado and not new.eliminado and not private.es_administrador() then
    raise exception 'Una respuesta eliminada solo puede restaurarla un administrador.'
      using errcode = 'check_violation';
  end if;

  if new.contenido is distinct from old.contenido and new.contenido <> '' then
    raise exception 'El contenido de una respuesta no se puede reescribir, solo vaciar al eliminarla.'
      using errcode = 'check_violation';
  end if;

  if not old.eliminado and new.eliminado then
    new.eliminado_por_admin := private.es_administrador() and (select auth.uid()) <> old.id_usuario;
  end if;

  return new;
end;
$$;

-- Los triggers ya existen (083) y disparan BEFORE UPDATE — reemplazar la
-- función alcanza, no hace falta recrearlos.
