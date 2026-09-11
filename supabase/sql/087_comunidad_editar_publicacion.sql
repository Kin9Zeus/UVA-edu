-- ============================================================
-- Permite que el propio autor edite el título/contenido de su publicación
-- (pedido explícito del usuario: "que el creador de una publicación pueda
-- editarla"). Hasta acá, 083_comunidad.sql solo dejaba REESCRIBIR
-- contenido/titulo con el string vacío (al eliminar) — cualquier otro
-- valor no vacío quedaba bloqueado sin distinguir "estoy editando" de
-- "estoy intentando vaciarlo con otra cosa".
--
-- No se toca la policy de RLS (comunidad_posts_update_propio_o_admin ya
-- deja tocar la fila al autor o a un admin) ni los GRANT de columna
-- (084/083 ya incluyen contenido/titulo) — el único cambio es el trigger,
-- que agrega una tercera transición válida además de "vaciar al eliminar"
-- y "sin cambios":
--
--   · Reescribir a un valor NO vacío es válido SOLO si:
--     1) el post no estaba eliminado y sigue sin estarlo en la misma
--        transacción (no se puede "editar" lo que se está borrando ni lo
--        que ya está borrado), y
--     2) quien firma la sesión es el PROPIO autor — nunca un admin. Un
--        admin moderando solo puede vaciar (rama ya existente), nunca
--        sustituir el texto por otras palabras: eso sería indistinguible
--        de que el admin hablara por el usuario.
-- ============================================================

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

  return new;
end;
$$;
