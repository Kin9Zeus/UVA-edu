-- ------------------------------------------------------------
-- P2-7 (AUDIT-2026-09-04.md): la subida de material adicional pasa a subir
-- directo del navegador a Storage con una URL firmada (crearSubidaRecurso/
-- confirmarSubidaRecurso en actions/admin/cursos.ts) para poder bajar
-- bodySizeLimit global de Next de 52mb a 2mb sin romperla -- el archivo ya
-- no pasa por el body de la Server Action.
--
-- Efecto secundario: el chequeo de TAMANO_MAXIMO_RECURSO (50 MB) en
-- lib/admin/recurso.ts ya no corre ANTES de subir, corre después (en
-- confirmarSubidaRecurso, sobre el objeto ya en Storage). Sin este límite a
-- nivel de bucket, alguien con la URL firmada podría subir más de 50 MB
-- antes de que nuestro código llegue a rechazarlo. `file_size_limit` hace
-- que Storage mismo lo rechace en el momento de la subida, sin depender de
-- que nuestro paso de confirmación corra.
-- ------------------------------------------------------------
update storage.buckets
set file_size_limit = 50 * 1024 * 1024
where id = 'materiales-lecciones';

-- confirmarSubidaRecurso usa storage.move() para renombrar el objeto
-- pendiente a su ruta final (con la extensión real, detectada por magic
-- bytes) una vez validado. move() hace un UPDATE de storage.objects por
-- debajo, no un INSERT/DELETE -- sin esta policy, RLS lo bloquea aunque el
-- admin ya tenga insert/select/delete en 011_bucket_materiales_lecciones.sql.
drop policy if exists "materiales_admin_update" on storage.objects;
create policy "materiales_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'materiales-lecciones' and private.es_administrador())
  with check (bucket_id = 'materiales-lecciones' and private.es_administrador());
