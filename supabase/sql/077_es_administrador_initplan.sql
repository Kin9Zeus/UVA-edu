-- ============================================================
-- private.es_administrador() se evalúa una vez por consulta, no por fila
-- Cierra AUDIT-2026-09-08-base-de-datos.md — D-3 (P1), segunda mitad.
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-076.
-- DESPUÉS de 076 no es opcional: 076 redefine las policies de `comentarios`
-- y `progreso`, y este archivo no las toca justamente para no pisarlas.
--
-- El problema
-- -----------
-- `private.es_administrador()` es STABLE, pero Postgres no promueve una
-- función STABLE a InitPlan por su cuenta: la evalúa dentro del Filter, una
-- vez por fila. 056_optimiza_auth_uid_rls.sql ya aplicó el remedio correcto
-- —envolver en subconsulta escalar— pero solo a `auth.uid()`. Las llamadas a
-- los helpers quedaron fuera.
--
-- El linter de Supabase tampoco lo ve: `auth_rls_initplan` reconoce
-- `auth.<fn>()` y `current_setting()` literales, así que reporta UN caso
-- (comentario_moderacion) y se le escapan las otras ~75 policies. Es un buen
-- recordatorio de que un linter en verde describe lo que el linter mira, no
-- lo que el sistema hace.
--
-- Se ve en el plan medido para la lista de comentarios:
--
--   Filter: ((mostrado OR private.es_administrador() OR ...)
--        AND (mostrado OR private.es_administrador() OR ...))
--
-- (sí, dos veces: el predicado aparece duplicado, así que eran dos
-- evaluaciones completas por fila).
--
-- Qué NO arregla este archivo
-- ---------------------------
-- `private.tiene_acceso_vigente_curso(cursos.id)` se queda como está, a
-- propósito. Recibe una columna de la fila, así que es una llamada
-- CORRELACIONADA: envolverla en (select ...) no la iza a InitPlan, solo
-- disfraza el mismo trabajo. Es un error fácil de cometer al aplicar esta
-- receta en masa.
--
-- El coste real de esa llamada está acotado por el orden de los términos:
-- `mostrado` se evalúa primero y corta para los cursos del catálogo, y
-- `es_administrador()` —ahora InitPlan— corta para el administrador. Solo
-- queda cara para un usuario autenticado mirando cursos despublicados, que
-- es un conjunto pequeño por definición.
--
-- Cómo se generó
-- --------------
-- No a mano. Este archivo se generó desde `pg_policies` aplicando UNA
-- sustitución textual —`private.es_administrador()` por
-- `(select private.es_administrador())`— sobre las definiciones vigentes que
-- devuelve el propio catálogo. Transcribir 75 policies a mano habría sido la
-- fuente de error más probable de todo el lote, y cada error de esos es una
-- regresión de seguridad, no un bug de rendimiento.
--
-- Por eso las expresiones conservan el formato del catálogo (mayúsculas,
-- paréntesis redundantes, `( SELECT auth.uid() AS uid)`) en vez del estilo
-- del resto de la carpeta: son literalmente lo que la base tenía, con esa
-- única sustitución. Eso hace el diff verificable.
--
-- Excluidas a propósito: progreso_insert_propio, progreso_update_propio,
-- comentarios_select_con_acceso y comentarios_insert_propio (las redefine
-- 076) e instructores_select_publico (la reemplaza 074).
--
-- Cómo verificar
-- --------------
--   EXPLAIN (ANALYZE, BUFFERS) select ... from public.comentarios ...
-- `es_administrador` debe aparecer como InitPlan, no dentro de un Filter por
-- fila. Y `npm run test:rls` en verde: esto no cambia ninguna semántica.
-- ============================================================

drop policy if exists bitacora_admin_insert on public.bitacora_administrativa;
create policy bitacora_admin_insert on public.bitacora_administrativa
  for insert
  with check (((select private.es_administrador()) AND (id_admin = ( SELECT auth.uid() AS uid))));

drop policy if exists bitacora_admin_select on public.bitacora_administrativa;
create policy bitacora_admin_select on public.bitacora_administrativa
  for select
  using ((select private.es_administrador()));

drop policy if exists categorias_admin_delete on public.categorias;
create policy categorias_admin_delete on public.categorias
  for delete
  using ((select private.es_administrador()));

drop policy if exists categorias_admin_insert on public.categorias;
create policy categorias_admin_insert on public.categorias
  for insert
  with check ((select private.es_administrador()));

drop policy if exists categorias_admin_update on public.categorias;
create policy categorias_admin_update on public.categorias
  for update
  using ((select private.es_administrador()))
  with check ((select private.es_administrador()));

drop policy if exists categorias_select_publico on public.categorias;
create policy categorias_select_publico on public.categorias
  for select
  using (((activo = true) OR (select private.es_administrador())));

drop policy if exists certificados_select_propio on public.certificados;
create policy certificados_select_propio on public.certificados
  for select
  using (((( SELECT auth.uid() AS uid) = id_usuario) OR (select private.es_administrador())));

drop policy if exists codigos_invitacion_admin_delete on public.codigos_invitacion;
create policy codigos_invitacion_admin_delete on public.codigos_invitacion
  for delete
  using ((select private.es_administrador()));

drop policy if exists codigos_invitacion_admin_insert on public.codigos_invitacion;
create policy codigos_invitacion_admin_insert on public.codigos_invitacion
  for insert
  with check ((select private.es_administrador()));

drop policy if exists codigos_invitacion_admin_select on public.codigos_invitacion;
create policy codigos_invitacion_admin_select on public.codigos_invitacion
  for select
  using ((select private.es_administrador()));

drop policy if exists codigos_invitacion_admin_update on public.codigos_invitacion;
create policy codigos_invitacion_admin_update on public.codigos_invitacion
  for update
  using ((select private.es_administrador()))
  with check ((select private.es_administrador()));

-- Este es el único caso que el linter de Supabase SÍ detectaba
-- (auth_rls_initplan sobre comentario_moderacion): tenía `auth.uid()` sin
-- envolver, además de es_administrador(). Se arreglan los dos.
drop policy if exists comentario_moderacion_insert_admin on public.comentario_moderacion;
create policy comentario_moderacion_insert_admin on public.comentario_moderacion
  for insert
  with check (((select private.es_administrador()) AND ((select auth.uid()) = id_eliminado_por)));

drop policy if exists comentario_moderacion_select_admin on public.comentario_moderacion;
create policy comentario_moderacion_select_admin on public.comentario_moderacion
  for select
  using ((select private.es_administrador()));

drop policy if exists comentarios_update_propio_o_admin on public.comentarios;
create policy comentarios_update_propio_o_admin on public.comentarios
  for update
  using (((( SELECT auth.uid() AS uid) = id_usuario) OR (select private.es_administrador())))
  with check (((( SELECT auth.uid() AS uid) = id_usuario) OR (select private.es_administrador())));

drop policy if exists cupones_admin_delete on public.cupones;
create policy cupones_admin_delete on public.cupones
  for delete
  using ((select private.es_administrador()));

drop policy if exists cupones_admin_insert on public.cupones;
create policy cupones_admin_insert on public.cupones
  for insert
  with check ((select private.es_administrador()));

drop policy if exists cupones_admin_select on public.cupones;
create policy cupones_admin_select on public.cupones
  for select
  using ((select private.es_administrador()));

drop policy if exists cupones_admin_update on public.cupones;
create policy cupones_admin_update on public.cupones
  for update
  using ((select private.es_administrador()))
  with check ((select private.es_administrador()));

drop policy if exists curso_categorias_admin_delete on public.curso_categorias;
create policy curso_categorias_admin_delete on public.curso_categorias
  for delete
  using ((select private.es_administrador()));

drop policy if exists curso_categorias_admin_insert on public.curso_categorias;
create policy curso_categorias_admin_insert on public.curso_categorias
  for insert
  with check ((select private.es_administrador()));

drop policy if exists curso_categorias_admin_update on public.curso_categorias;
create policy curso_categorias_admin_update on public.curso_categorias
  for update
  using ((select private.es_administrador()))
  with check ((select private.es_administrador()));

drop policy if exists curso_categorias_select_publico on public.curso_categorias;
create policy curso_categorias_select_publico on public.curso_categorias
  for select
  using ((EXISTS ( SELECT 1
   FROM cursos
  WHERE ((cursos.id = curso_categorias.id_curso) AND ((cursos.mostrado = true) OR (select private.es_administrador()) OR private.tiene_acceso_vigente_curso(cursos.id))))));

drop policy if exists curso_instructores_admin_delete on public.curso_instructores;
create policy curso_instructores_admin_delete on public.curso_instructores
  for delete
  using ((select private.es_administrador()));

drop policy if exists curso_instructores_admin_insert on public.curso_instructores;
create policy curso_instructores_admin_insert on public.curso_instructores
  for insert
  with check ((select private.es_administrador()));

drop policy if exists curso_instructores_admin_update on public.curso_instructores;
create policy curso_instructores_admin_update on public.curso_instructores
  for update
  using ((select private.es_administrador()))
  with check ((select private.es_administrador()));

drop policy if exists curso_instructores_select_publico on public.curso_instructores;
create policy curso_instructores_select_publico on public.curso_instructores
  for select
  using ((EXISTS ( SELECT 1
   FROM cursos
  WHERE ((cursos.id = curso_instructores.id_curso) AND ((cursos.mostrado = true) OR (select private.es_administrador()) OR private.tiene_acceso_vigente_curso(cursos.id))))));

drop policy if exists cursos_admin_delete on public.cursos;
create policy cursos_admin_delete on public.cursos
  for delete
  using ((select private.es_administrador()));

drop policy if exists cursos_admin_insert on public.cursos;
create policy cursos_admin_insert on public.cursos
  for insert
  with check ((select private.es_administrador()));

drop policy if exists cursos_admin_update on public.cursos;
create policy cursos_admin_update on public.cursos
  for update
  using ((select private.es_administrador()))
  with check ((select private.es_administrador()));

drop policy if exists cursos_select_publicos on public.cursos;
create policy cursos_select_publicos on public.cursos
  for select
  using (((mostrado = true) OR (select private.es_administrador()) OR private.tiene_acceso_vigente_curso(id)));

drop policy if exists examenes_admin_delete on public.examenes;
create policy examenes_admin_delete on public.examenes
  for delete
  using ((select private.es_administrador()));

drop policy if exists examenes_admin_insert on public.examenes;
create policy examenes_admin_insert on public.examenes
  for insert
  with check ((select private.es_administrador()));

drop policy if exists examenes_admin_update on public.examenes;
create policy examenes_admin_update on public.examenes
  for update
  using ((select private.es_administrador()))
  with check ((select private.es_administrador()));

drop policy if exists examenes_select_publicado_con_acceso on public.examenes;
create policy examenes_select_publicado_con_acceso on public.examenes
  for select
  using (((select private.es_administrador()) OR ((publicado = true) AND private.tiene_acceso_vigente_curso(id_curso))));

drop policy if exists inscripciones_admin_delete on public.inscripciones;
create policy inscripciones_admin_delete on public.inscripciones
  for delete
  using ((select private.es_administrador()));

drop policy if exists inscripciones_admin_insert on public.inscripciones;
create policy inscripciones_admin_insert on public.inscripciones
  for insert
  with check ((select private.es_administrador()));

drop policy if exists inscripciones_admin_update on public.inscripciones;
create policy inscripciones_admin_update on public.inscripciones
  for update
  using ((select private.es_administrador()))
  with check ((select private.es_administrador()));

drop policy if exists inscripciones_select_propio on public.inscripciones;
create policy inscripciones_select_propio on public.inscripciones
  for select
  using (((( SELECT auth.uid() AS uid) = id_usuario) OR (select private.es_administrador())));

drop policy if exists instructores_admin_delete on public.instructores;
create policy instructores_admin_delete on public.instructores
  for delete
  using ((select private.es_administrador()));

drop policy if exists instructores_admin_insert on public.instructores;
create policy instructores_admin_insert on public.instructores
  for insert
  with check ((select private.es_administrador()));

drop policy if exists instructores_admin_update on public.instructores;
create policy instructores_admin_update on public.instructores
  for update
  using ((select private.es_administrador()))
  with check ((select private.es_administrador()));

drop policy if exists intentos_examen_select_propio_o_admin on public.intentos_examen;
create policy intentos_examen_select_propio_o_admin on public.intentos_examen
  for select
  using (((( SELECT auth.uid() AS uid) = id_usuario) OR (select private.es_administrador())));

drop policy if exists lecciones_admin_delete on public.lecciones;
create policy lecciones_admin_delete on public.lecciones
  for delete
  using ((select private.es_administrador()));

drop policy if exists lecciones_admin_insert on public.lecciones;
create policy lecciones_admin_insert on public.lecciones
  for insert
  with check ((select private.es_administrador()));

drop policy if exists lecciones_admin_update on public.lecciones;
create policy lecciones_admin_update on public.lecciones
  for update
  using ((select private.es_administrador()))
  with check ((select private.es_administrador()));

drop policy if exists lecciones_select_curso_publico on public.lecciones;
create policy lecciones_select_curso_publico on public.lecciones
  for select
  using ((EXISTS ( SELECT 1
   FROM (modulos
     JOIN cursos ON ((cursos.id = modulos.id_curso)))
  WHERE ((modulos.id = lecciones.id_modulo) AND ((cursos.mostrado = true) OR (select private.es_administrador()) OR private.tiene_acceso_vigente_curso(cursos.id))))));

drop policy if exists lotes_codigos_invitacion_admin_select on public.lotes_codigos_invitacion;
create policy lotes_codigos_invitacion_admin_select on public.lotes_codigos_invitacion
  for select
  using ((select private.es_administrador()));

drop policy if exists modulos_admin_delete on public.modulos;
create policy modulos_admin_delete on public.modulos
  for delete
  using ((select private.es_administrador()));

drop policy if exists modulos_admin_insert on public.modulos;
create policy modulos_admin_insert on public.modulos
  for insert
  with check ((select private.es_administrador()));

drop policy if exists modulos_admin_update on public.modulos;
create policy modulos_admin_update on public.modulos
  for update
  using ((select private.es_administrador()))
  with check ((select private.es_administrador()));

drop policy if exists modulos_select_curso_publico on public.modulos;
create policy modulos_select_curso_publico on public.modulos
  for select
  using ((EXISTS ( SELECT 1
   FROM cursos
  WHERE ((cursos.id = modulos.id_curso) AND ((cursos.mostrado = true) OR (select private.es_administrador()) OR private.tiene_acceso_vigente_curso(cursos.id))))));

drop policy if exists mux_assets_pendientes_eliminacion_admin_select on public.mux_assets_pendientes_eliminacion;
create policy mux_assets_pendientes_eliminacion_admin_select on public.mux_assets_pendientes_eliminacion
  for select
  using ((select private.es_administrador()));

drop policy if exists pagos_admin_delete on public.pagos;
create policy pagos_admin_delete on public.pagos
  for delete
  using ((select private.es_administrador()));

drop policy if exists pagos_admin_insert on public.pagos;
create policy pagos_admin_insert on public.pagos
  for insert
  with check ((select private.es_administrador()));

drop policy if exists pagos_admin_update on public.pagos;
create policy pagos_admin_update on public.pagos
  for update
  using ((select private.es_administrador()))
  with check ((select private.es_administrador()));

drop policy if exists pagos_select_propio on public.pagos;
create policy pagos_select_propio on public.pagos
  for select
  using (((EXISTS ( SELECT 1
   FROM suscripciones
  WHERE ((suscripciones.id = pagos.id_suscripcion) AND (suscripciones.id_usuario = ( SELECT auth.uid() AS uid))))) OR (select private.es_administrador())));

drop policy if exists perfiles_select_propio on public.perfiles;
create policy perfiles_select_propio on public.perfiles
  for select
  using (((( SELECT auth.uid() AS uid) = id) OR (select private.es_administrador())));

drop policy if exists perfiles_update_propio on public.perfiles;
create policy perfiles_update_propio on public.perfiles
  for update
  using (((( SELECT auth.uid() AS uid) = id) OR (select private.es_administrador())))
  with check (((( SELECT auth.uid() AS uid) = id) OR (select private.es_administrador())));

drop policy if exists planes_admin_delete on public.planes;
create policy planes_admin_delete on public.planes
  for delete
  using ((select private.es_administrador()));

drop policy if exists planes_admin_insert on public.planes;
create policy planes_admin_insert on public.planes
  for insert
  with check ((select private.es_administrador()));

drop policy if exists planes_admin_update on public.planes;
create policy planes_admin_update on public.planes
  for update
  using ((select private.es_administrador()))
  with check ((select private.es_administrador()));

drop policy if exists planes_select_publico on public.planes;
create policy planes_select_publico on public.planes
  for select
  using (((activo = true) OR (select private.es_administrador())));

drop policy if exists planes_precios_admin_delete on public.planes_precios;
create policy planes_precios_admin_delete on public.planes_precios
  for delete
  using ((select private.es_administrador()));

drop policy if exists planes_precios_admin_insert on public.planes_precios;
create policy planes_precios_admin_insert on public.planes_precios
  for insert
  with check ((select private.es_administrador()));

drop policy if exists planes_precios_admin_update on public.planes_precios;
create policy planes_precios_admin_update on public.planes_precios
  for update
  using ((select private.es_administrador()))
  with check ((select private.es_administrador()));

drop policy if exists planes_precios_select_publico on public.planes_precios;
create policy planes_precios_select_publico on public.planes_precios
  for select
  using (((activo = true) OR (select private.es_administrador())));

drop policy if exists preguntas_examen_admin_delete on public.preguntas_examen;
create policy preguntas_examen_admin_delete on public.preguntas_examen
  for delete
  using ((select private.es_administrador()));

drop policy if exists preguntas_examen_admin_insert on public.preguntas_examen;
create policy preguntas_examen_admin_insert on public.preguntas_examen
  for insert
  with check ((select private.es_administrador()));

drop policy if exists preguntas_examen_admin_select on public.preguntas_examen;
create policy preguntas_examen_admin_select on public.preguntas_examen
  for select
  using ((select private.es_administrador()));

drop policy if exists preguntas_examen_admin_update on public.preguntas_examen;
create policy preguntas_examen_admin_update on public.preguntas_examen
  for update
  using ((select private.es_administrador()))
  with check ((select private.es_administrador()));

drop policy if exists progreso_select_propio on public.progreso;
create policy progreso_select_propio on public.progreso
  for select
  using (((( SELECT auth.uid() AS uid) = id_usuario) OR (select private.es_administrador())));

drop policy if exists recursos_admin_delete on public.recursos_descargables;
create policy recursos_admin_delete on public.recursos_descargables
  for delete
  using ((select private.es_administrador()));

drop policy if exists recursos_admin_insert on public.recursos_descargables;
create policy recursos_admin_insert on public.recursos_descargables
  for insert
  with check ((select private.es_administrador()));

drop policy if exists recursos_admin_update on public.recursos_descargables;
create policy recursos_admin_update on public.recursos_descargables
  for update
  using ((select private.es_administrador()))
  with check ((select private.es_administrador()));

-- `private.suscripcion_da_acceso((select auth.uid()))` también podría izarse
-- —su argumento no depende de la fila— pero se deja como está: esta tabla
-- tiene 3 filas y no está en ningún camino caliente. Una sustitución
-- mecánica y una excepción hecha a mano en el mismo archivo es cómo se
-- cuelan los errores.
drop policy if exists recursos_select_con_acceso on public.recursos_descargables;
create policy recursos_select_con_acceso on public.recursos_descargables
  for select
  using (((select private.es_administrador()) OR (EXISTS ( SELECT 1
   FROM ((lecciones
     JOIN modulos ON ((modulos.id = lecciones.id_modulo)))
     JOIN cursos ON ((cursos.id = modulos.id_curso)))
  WHERE ((lecciones.id = recursos_descargables.id_leccion) AND ((EXISTS ( SELECT 1
           FROM inscripciones
          WHERE ((inscripciones.id_usuario = ( SELECT auth.uid() AS uid)) AND (inscripciones.id_curso = cursos.id) AND (inscripciones.tipo_acceso = 'CORTESIA'::"TipoAcceso") AND (inscripciones.activo = true)))) OR private.suscripcion_da_acceso(( SELECT auth.uid() AS uid))))))));

drop policy if exists suscripciones_admin_delete on public.suscripciones;
create policy suscripciones_admin_delete on public.suscripciones
  for delete
  using ((select private.es_administrador()));

drop policy if exists suscripciones_admin_insert on public.suscripciones;
create policy suscripciones_admin_insert on public.suscripciones
  for insert
  with check ((select private.es_administrador()));

drop policy if exists suscripciones_admin_update on public.suscripciones;
create policy suscripciones_admin_update on public.suscripciones
  for update
  using ((select private.es_administrador()))
  with check ((select private.es_administrador()));

drop policy if exists suscripciones_select_propio on public.suscripciones;
create policy suscripciones_select_propio on public.suscripciones
  for select
  using (((( SELECT auth.uid() AS uid) = id_usuario) OR (select private.es_administrador())));

drop policy if exists tokens_vista_previa_admin_insert on public.tokens_vista_previa;
create policy tokens_vista_previa_admin_insert on public.tokens_vista_previa
  for insert
  with check ((select private.es_administrador()));

drop policy if exists tokens_vista_previa_admin_select on public.tokens_vista_previa;
create policy tokens_vista_previa_admin_select on public.tokens_vista_previa
  for select
  using ((select private.es_administrador()));

drop policy if exists tokens_vista_previa_admin_update on public.tokens_vista_previa;
create policy tokens_vista_previa_admin_update on public.tokens_vista_previa
  for update
  using ((select private.es_administrador()))
  with check ((select private.es_administrador()));
