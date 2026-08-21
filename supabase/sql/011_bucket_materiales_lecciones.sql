-- ------------------------------------------------------------
-- BUCKET DE STORAGE: materiales-lecciones
-- Guarda los archivos físicos de "Material adicional" que un admin sube
-- desde el editor de lección (panel admin, pestaña Contenido). La fila de
-- metadatos (nombre, tipo, tamaño) vive en public.recursos_descargables,
-- que ya tiene RLS desde 003_rls_membresia_y_gestion.sql — este script solo
-- resuelve el almacenamiento del archivo en sí.
--
-- Privado (public = false) y con policies admin-only en las 3 operaciones:
-- todavía no existe la pantalla de lección del lado estudiante que debería
-- consumir estos archivos, así que no se define aquí ningún criterio de
-- lectura para inscripción/suscripción vigente (el mismo criterio que ya
-- protege la fila en recursos_descargables). Cuando esa pantalla exista, se
-- agrega una policy de SELECT para authenticated con la misma condición que
-- "recursos_select_con_acceso", en vez de ampliar esta.
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('materiales-lecciones', 'materiales-lecciones', false)
on conflict (id) do nothing;

drop policy if exists "materiales_admin_insert" on storage.objects;
create policy "materiales_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'materiales-lecciones' and private.es_administrador());

drop policy if exists "materiales_admin_select" on storage.objects;
create policy "materiales_admin_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'materiales-lecciones' and private.es_administrador());

drop policy if exists "materiales_admin_delete" on storage.objects;
create policy "materiales_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'materiales-lecciones' and private.es_administrador());
