-- ============================================================
-- BUCKET DE STORAGE: certificados
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 047/048.
--
-- Guarda el PDF ya generado de cada certificado (Certificado.md: "generar
-- bajo demanda y cachear... no regenerar en cada descarga"), en la ruta
-- `{id_usuario}/{id_certificado}.pdf` (descargarCertificadoPdf,
-- src/actions/certificados/descargar.ts).
--
-- Privado (public = false): a diferencia de portadas-cursos (012), un
-- certificado en PDF trae el nombre real del estudiante — no es un asset de
-- catálogo que deba poder verse sin autenticar. La verificación pública
-- (verificar_certificado, 015/050) nunca sirve el PDF, solo confirma
-- nombre/curso/fecha desde la tabla; el archivo en sí solo lo baja su
-- dueño (o un admin) ya logueado.
--
-- Mismo patrón de policies por prefijo de carpeta que otros buckets
-- privados por dueño (storage.foldername(name)[1] = auth.uid()::text): el
-- Server Action sube/lee con la sesión propia del estudiante (RLS-scoped),
-- nunca con la Service Role Key, así que necesita policies reales — no
-- basta con que exista el bucket.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('certificados', 'certificados', false)
on conflict (id) do nothing;

drop policy if exists "certificados_pdf_select_propio" on storage.objects;
create policy "certificados_pdf_select_propio" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'certificados'
    and ((storage.foldername(name))[1] = auth.uid()::text or private.es_administrador())
  );

drop policy if exists "certificados_pdf_insert_propio" on storage.objects;
create policy "certificados_pdf_insert_propio" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'certificados'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- `upsert: true` en el upload (regenerar/recachear el mismo archivo) hace un
-- UPDATE de metadatos por debajo, no solo un INSERT — sin esta policy, la
-- segunda subida del mismo path fallaría por RLS.
drop policy if exists "certificados_pdf_update_propio" on storage.objects;
create policy "certificados_pdf_update_propio" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'certificados'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'certificados'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
