-- ============================================================
-- El administrador puede tomar notas y comentar en cualquier clase.
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-124.
-- Redefine `comentarios_insert_propio` (última versión: 076) y
-- `notas_leccion_insert_propio` (115).
--
-- Por qué
-- -------
-- La app trata al ADMINISTRADOR como alguien con acceso a todo el catálogo
-- sin suscripción propia (`obtenerAccesoAlCurso`, src/lib/accesoCurso.ts):
-- entra a cualquier clase y ve el video. Pero las dos policies de INSERT
-- solo aceptaban lección introductoria o `tiene_acceso_vigente_curso`, que
-- no cuenta al admin. Resultado: el admin veía la clase y al guardar una
-- nota recibía "No tienes acceso para guardar notas en esta clase"; el
-- comentario fallaba igual. La lectura de comentarios ya incluía al admin
-- (`comentarios_select_con_acceso`, 076), así que solo faltaba la escritura.
--
-- Por qué aquí y no en `tiene_acceso_vigente_curso`
-- -------------------------------------------------
-- Esa función decide también progreso, certificados, recursos y el examen.
-- Meter al admin ahí cambiaría todo eso (por ejemplo, certificados para el
-- admin). Este cambio solo abre la escritura de notas y comentarios.
--
-- Qué NO cambia
-- -------------
-- - Siempre a nombre propio: `auth.uid() = id_usuario` sigue en las dos.
-- - Notas: se siguen exigiendo correo verificado y cuenta activa, y el admin
--   sigue sin poder leer notas ajenas (docs/notas-leccion.md §3.1): la
--   policy de SELECT no se toca.
-- - El tope de notas por lección y `id_video_mux` los sigue fijando el
--   trigger de 115.
--
-- Idempotente: drop policy if exists + create.
-- ============================================================

drop policy if exists "comentarios_insert_propio" on public.comentarios;
create policy "comentarios_insert_propio" on public.comentarios
  for insert with check (
    (select auth.uid()) = id_usuario
    and (
      (select private.es_administrador())
      or exists (
        select 1 from public.lecciones l
        where l.id = comentarios.id_leccion and l.es_introductoria
      )
      or exists (
        select 1
        from public.lecciones l
        join public.modulos m on m.id = l.id_modulo
        where l.id = comentarios.id_leccion
          and private.tiene_acceso_vigente_curso(m.id_curso)
      )
    )
  );

drop policy if exists "notas_leccion_insert_propio" on public.notas_leccion;
create policy "notas_leccion_insert_propio" on public.notas_leccion
  for insert with check (
    (select auth.uid()) = id_usuario
    and (select private.correo_verificado())
    and (select private.cuenta_activa())
    and (
      (select private.es_administrador())
      or exists (
        select 1
        from public.lecciones l
        join public.modulos m on m.id = l.id_modulo
        where l.id = notas_leccion.id_leccion
          and (l.es_introductoria or private.tiene_acceso_vigente_curso(m.id_curso))
      )
    )
  );
