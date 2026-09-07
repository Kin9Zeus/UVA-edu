-- ============================================================
-- Row Level Security (RLS): comentario_moderacion
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-063, y
-- después de correr la migración de Prisma que crea la tabla
-- (prisma/migrations/20260907000000_comentario_moderacion).
--
-- Guarda el texto original de un comentario que un ADMINISTRADOR borró por
-- moderación, antes de que `eliminarComentario` vacíe
-- `comentarios.contenido` (ver el comentario en ese Server Action). Es
-- evidencia sensible — el motivo por el que se borró un comentario abusivo
-- puede incluir lenguaje que no se quiere reexponer — así que queda
-- cerrada a nadie salvo administradores, ni siquiera al autor del
-- comentario original.
--
-- · SELECT: solo administradores.
-- · INSERT: solo administradores, y con `id_eliminado_por = auth.uid()`
--   (mismo cinturón de seguridad que el resto de las policies de INSERT:
--   el Server Action ya lo fuerza, esto no confía en lo que mande el
--   cliente).
-- · UPDATE / DELETE: nadie — es un registro de auditoría, no se edita ni
--   se borra.
-- ============================================================

alter table public.comentario_moderacion enable row level security;

drop policy if exists "comentario_moderacion_select_admin" on public.comentario_moderacion;
create policy "comentario_moderacion_select_admin" on public.comentario_moderacion
  for select using (private.es_administrador());

drop policy if exists "comentario_moderacion_insert_admin" on public.comentario_moderacion;
create policy "comentario_moderacion_insert_admin" on public.comentario_moderacion
  for insert with check (
    private.es_administrador() and auth.uid() = id_eliminado_por
  );

-- ============================================================
-- Habilita vaciar `contenido` al borrar, sin reabrir P2-1
--
-- 064_comentarios_columnas_y_moderacion.sql (llegó de otra rama mientras se
-- escribía este archivo — mismo día, mismo hallazgo de fondo) le cerró a
-- `authenticated` el UPDATE de columna en `comentarios` a solo `eliminado`,
-- justo para que nadie pudiera reescribir `contenido` después de publicado.
-- eliminarComentario ahora necesita escribir esa columna de todos modos —no
-- para reescribirla con texto nuevo, sino para vaciarla al borrar (ver el
-- comentario en ese Server Action: RLS protege filas, no columnas, así que
-- dejar el texto de un comentario "eliminado" en la fila lo hacía legible
-- igual con acceso directo a PostgREST). Sin ampliar el grant, ESE UPDATE
-- vuelve a chocar con "permission denied for table comentarios".
--
-- La solución no es deshacer 064 (reabriría exactamente lo que cerró), es
-- calcarle el patrón: el grant de columna resuelve QUÉ columna, pero no
-- distingue "vaciar" de "reescribir" — eso exige un trigger que solo
-- autorice la transición concreta que la app necesita. Aquí la única
-- transición legítima es contenido -> '' (vacío); cualquier otro valor
-- nuevo se rechaza, autor o administrador por igual — ni siquiera un
-- administrador debería poder reescribir el texto de un comentario ajeno,
-- solo borrarlo (para eso está `comentario_moderacion`, arriba).
--
-- Este archivo corre después de 064 (65 > 64): si se aplicara antes, el
-- `revoke update ... from authenticated` de 064 anularía el `grant` de acá.
grant update (contenido) on public.comentarios to authenticated;

create or replace function private.comentarios_contenido_solo_se_vacia()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.contenido is distinct from old.contenido and new.contenido <> '' then
    raise exception 'El contenido de un comentario no se puede reescribir, solo vaciar al eliminarlo.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists comentarios_contenido_solo_se_vacia on public.comentarios;
create trigger comentarios_contenido_solo_se_vacia
  before update on public.comentarios
  for each row execute function private.comentarios_contenido_solo_se_vacia();
