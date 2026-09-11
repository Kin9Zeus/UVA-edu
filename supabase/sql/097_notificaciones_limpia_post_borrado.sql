-- ============================================================
-- 097 — Borrar un post de Comunidad borra sus notificaciones
-- ============================================================
-- `notificaciones.entidad_id` no tiene FK (094: la pareja entidad_tipo +
-- entidad_id apunta a tablas distintas según el tipo), así que nada la
-- limpiaba cuando el post desaparecía de verdad. La app nunca borra un post
-- (eliminarPostComunidad es borrado lógico, `eliminado = true`), pero
-- scripts/rls-test.ts sí: corre contra el proyecto real, publica dos
-- anuncios de prueba —el trigger 095 se los notifica a TODOS los usuarios
-- con acceso a Comunidad— y en su limpieza borra esos posts con la service
-- role. Cada corrida dejaba notificaciones reales apuntando a un post
-- inexistente: sin post no hay slug, el enlace caía al UUID y la página de
-- detalle respondía 404. Medido al escribir esto: 29 notificaciones
-- huérfanas de 6 anuncios (tres corridas de test:rls).
--
-- Con este trigger el borrado físico arrastra sus notificaciones, venga de
-- donde venga. Un post con borrado lógico no se toca: sigue existiendo, su
-- enlace resuelve y la página muestra el 404 que corresponde.
-- ============================================================

create or replace function private.comunidad_posts_borra_notificaciones()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.notificaciones
  where entidad_tipo = 'comunidad_post'
    and entidad_id = old.id;

  return old;
end;
$$;

revoke execute on function private.comunidad_posts_borra_notificaciones() from public;

drop trigger if exists comunidad_posts_borra_notificaciones on public.comunidad_posts;
create trigger comunidad_posts_borra_notificaciones
  after delete on public.comunidad_posts
  for each row
  execute function private.comunidad_posts_borra_notificaciones();

-- Las que ya quedaron huérfanas antes del trigger. Idempotente: en una base
-- ya limpia no borra nada, así que puede correr en cada `db:rls`.
delete from public.notificaciones n
where n.entidad_tipo = 'comunidad_post'
  and not exists (select 1 from public.comunidad_posts p where p.id = n.entidad_id);
