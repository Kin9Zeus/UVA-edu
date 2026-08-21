-- ------------------------------------------------------------
-- BUCKET DE STORAGE: portadas-cursos
-- Guarda la imagen de portada/thumbnail de un curso (InfoTab.tsx en la
-- edición, CrearCursoForm.tsx en la creación). A diferencia de
-- materiales-lecciones (011), este bucket es PÚBLICO: la portada se
-- muestra en el catálogo público sin login, igual que cursos.titulo o
-- cursos.descripcion — no hay nada que proteger ahí.
--
-- "Público" solo afecta la LECTURA del archivo (el endpoint
-- /object/public/... no pasa por RLS). Insert/update/delete siguen
-- exigiendo private.es_administrador() como cualquier otra tabla.
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('portadas-cursos', 'portadas-cursos', true)
on conflict (id) do nothing;

drop policy if exists "portadas_admin_insert" on storage.objects;
create policy "portadas_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'portadas-cursos' and private.es_administrador());

drop policy if exists "portadas_admin_update" on storage.objects;
create policy "portadas_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'portadas-cursos' and private.es_administrador())
  with check (bucket_id = 'portadas-cursos' and private.es_administrador());

drop policy if exists "portadas_admin_delete" on storage.objects;
create policy "portadas_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'portadas-cursos' and private.es_administrador());

-- Sin policy de SELECT a propósito: bucket.public = true (línea 14) ya
-- sirve las lecturas por URL conocida vía /object/public/... sin pasar
-- por RLS. Una policy SELECT amplia en storage.objects solo habilitaría
-- .list() (enumerar todos los archivos del bucket), algo que ningún
-- componente del frontend necesita. Se había creado por costumbre y
-- Supabase la marcó como "Clients can list all files in this bucket";
-- se removió con el botón "Remove policy" del dashboard — este comentario
-- deja constancia para que el script, si se re-corre desde cero, no la
-- vuelva a crear.
drop policy if exists "portadas_select_publico" on storage.objects;
