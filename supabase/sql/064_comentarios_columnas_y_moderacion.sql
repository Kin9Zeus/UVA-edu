-- ============================================================
-- Acota el UPDATE de comentarios a lo que la app realmente necesita.
-- Ver AUDIT-2026-09-04.md, P2-1.
--
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de 000-063.
--
-- El problema
-- -----------
-- La policy vigente es `comentarios_update_propio_o_admin`, redefinida por
-- 056_optimiza_auth_uid_rls.sql (052 la creó; 056 la reescribió para envolver
-- auth.uid() en un subselect). Dice, en las dos versiones:
--
--     for update using  (auth.uid() = id_usuario or private.es_administrador())
--     with check        (auth.uid() = id_usuario or private.es_administrador())
--
-- RLS en Postgres decide qué FILAS, nunca qué COLUMNAS. "Puedes actualizar tu
-- propia fila" incluye todas sus columnas, y de ahí salen tres cosas que nadie
-- quiso autorizar:
--
--   1. Deshacer la moderación. Un administrador marca `eliminado = true`; el
--      autor manda PATCH /rest/v1/comentarios?id=eq.<suyo> con
--      {"eliminado": false} y su comentario vuelve. La moderación es hoy el
--      único control sobre contenido escrito por usuarios, y es reversible por
--      el moderado.
--   2. Mover el comentario. Cambiar `id_leccion` lo lleva al hilo de una clase
--      de un curso al que quien lo movió no tiene acceso.
--   3. Reescribir `contenido` después de publicado, sin rastro.
--
-- `id_usuario` no está en la lista: el `with check` ya lo compara contra
-- auth.uid(), así que apuntarlo a otra persona falla la policy.
--
-- Por qué dos capas y no una
-- --------------------------
-- El privilegio por columna resuelve (2) y (3) de forma declarativa, que es
-- justo la herramienta que Postgres sí tiene para "qué columnas". No resuelve
-- (1): el autor NECESITA escribir `eliminado` para borrar lo suyo, y un grant
-- no distingue direcciones. Lo que hay que prohibir en (1) no es la columna,
-- es una transición concreta —de true a false—, y eso solo lo puede expresar
-- un trigger.
--
-- Cuál es la superficie real que se está cerrando: el ÚNICO update sobre
-- `comentarios` en todo src/ es `{ eliminado: true }`
-- (src/actions/comentarios/eliminar.ts). No existe función de editar
-- comentario. O sea que la aplicación necesita exactamente una columna
-- escribible y hoy tiene las seis. Si algún día se añade la edición, el grant
-- de abajo la hace fallar en desarrollo con un error explícito, en vez de que
-- la columna estuviera abierta desde el principio "por si acaso".
-- ============================================================

-- ------------------------------------------------------------
-- Capa 1 — privilegio por columna
--
-- Supabase concede por defecto UPDATE sobre toda la tabla a `anon` y
-- `authenticated`, y deja que RLS sea lo único que restringe. Acá se revoca
-- ese permiso amplio y se devuelve solo el que se usa.
--
-- `anon` se revoca sin volver a conceder nada: ninguna policy le permite
-- actualizar comentarios, así que el grant nunca sirvió para nada — es
-- limpieza, no un cambio de comportamiento.
--
-- Ojo con el orden respecto a RLS: los privilegios de columna y las policies
-- se comprueban por separado y ambos tienen que pasar. Esto NO reemplaza la
-- policy, se suma a ella.
--
-- `service_role` no se toca: los scripts de servidor (src/lib/supabase/admin.ts)
-- lo usan y saltan RLS por diseño.
-- ------------------------------------------------------------

revoke update on public.comentarios from anon;
revoke update on public.comentarios from authenticated;

grant update (eliminado) on public.comentarios to authenticated;

-- ------------------------------------------------------------
-- Capa 2 — la transición de `eliminado`
--
-- Solo un administrador puede devolver un comentario eliminado a la vida. Se
-- le permite a propósito, en vez de prohibirlo a todo el mundo: puede haber
-- moderado por error y no debería necesitar SQL a mano para deshacerlo.
--
-- SECURITY DEFINER + search_path fijo, como el resto de funciones del
-- proyecto: `private.es_administrador()` (001/002) lee `perfiles`, que tiene su
-- propia RLS, y este trigger corre en la sesión de quien hace el UPDATE.
--
-- BEFORE UPDATE y no BEFORE UPDATE OF eliminado: la cláusula OF dispara cuando
-- la columna APARECE en el SET, aunque su valor no cambie, y no dispara si
-- alguien la modificara por otra vía. La comparación explícita
-- `old.eliminado and not new.eliminado` es más barata de razonar y no depende
-- de qué columnas mencione el UPDATE.
-- ------------------------------------------------------------

create or replace function private.comentarios_no_revive_eliminado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.eliminado and not new.eliminado and not private.es_administrador() then
    raise exception 'Un comentario eliminado solo puede restaurarlo un administrador.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists comentarios_no_revive_eliminado on public.comentarios;
create trigger comentarios_no_revive_eliminado
  before update on public.comentarios
  for each row execute function private.comentarios_no_revive_eliminado();
