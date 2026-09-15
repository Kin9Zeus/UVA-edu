-- ============================================================
-- private.es_administrador() vuelve a evaluarse una vez por consulta en las
-- policies que se crearon DESPUÉS de 077, y en las de `storage.objects`, que
-- 077 nunca tocó. Cierra AUDIT-2026-09-15.md — P2-2.
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-104.
-- DESPUÉS de 104 no es opcional: 104 redefine
-- private.curso_calificaciones_transiciones_permitidas(), y este archivo no
-- la toca (ver "Qué NO arregla" abajo) justamente para no pisarla.
--
-- El problema es el mismo de 077, otra vez
-- ----------------------------------------
-- `private.es_administrador()` es STABLE, pero Postgres no la promueve a
-- InitPlan por su cuenta: la evalúa dentro del Filter, una vez por fila.
-- 077_es_administrador_initplan.sql aplicó el remedio —envolver en
-- subconsulta escalar— sobre las ~75 policies que existían entonces. Todo lo
-- que llegó después volvió a escribirla desnuda.
--
-- El alcance real, medido — no el que dice el audit
-- -------------------------------------------------
-- P2-2 habla de "5 apariciones" en 102_curso_calificaciones.sql, el archivo
-- más nuevo. Consultando `pg_policies` en la base real aparecen **27 policies
-- con 36 llamadas sin izar**, en dos grupos distintos:
--
--   · 18 policies en `public` — la regresión post-077 de verdad: Comunidad
--     (083/090/100/103), adjuntos (086), exámenes IA y transcripciones (088),
--     pagos (098) y calificaciones (102).
--   · 9 policies en `storage.objects` — NO son una regresión: 077 se generó
--     desde `pg_policies` acotado a `public`, así que los buckets
--     (011 materiales, 012 portadas, 049 certificados, 066, 086) nunca
--     entraron al lote. Llevan desnudas desde que se crearon.
--
-- Arreglar solo las 5 de 102 habría dejado 22 casos idénticos vivos, y el
-- gate que este mismo commit agrega (scripts/check-rls-initplan.ts) los
-- habría marcado en la primera corrida de CI.
--
-- Dos `auth.uid()` desnudos, de paso
-- -----------------------------------
-- `intentos_pago_select_propio` (098) y `certificados_pdf_select_propio`
-- (049) llaman `auth.uid()` sin envolver — el hueco equivalente de
-- 056_optimiza_auth_uid_rls.sql, del mismo modo que 077 se le escapó a estos
-- módulos. Se izan aquí porque son literalmente las mismas sentencias que
-- este archivo está reescribiendo; dejarlas desnudas en una policy que ya se
-- está tocando solo garantiza que vuelvan como hallazgo.
--
-- Qué NO arregla este archivo
-- ---------------------------
-- 1. Las llamadas dentro de funciones plpgsql (los triggers de transiciones
--    de 083/087/089/101/102/104). Ahí `es_administrador()` es una llamada
--    procedural que corre una vez por invocación del trigger, no un
--    predicado que el planificador evalúe por fila: envolverla en
--    `(select …)` no cambia nada y solo ensucia el código.
-- 2. `private.tiene_acceso_vigente_curso(c.id)`, por el mismo motivo que
--    documenta 077: recibe una columna de la fila, así que es una llamada
--    CORRELACIONADA. Envolverla no la iza a InitPlan, solo disfraza el mismo
--    trabajo. Es el error fácil de cometer al aplicar esta receta en masa.
-- 3. Las VISTAS que llaman `es_administrador()` en su WHERE
--    (061, 074, 076, 092, 093, 102). Tienen el mismo problema por fila y el
--    mismo remedio, pero exigen reescribir la definición completa de cada
--    vista, no una sustitución sobre el catálogo de policies. Queda anotado
--    como pendiente, no corregido — y el gate nuevo NO las mira, para no
--    afirmar en verde algo que no se revisó.
--
-- Cómo se generó
-- --------------
-- Igual que 077, y por la razón que su encabezado da con todas las letras:
-- transcribir policies a mano "habría sido la fuente de error más probable de
-- todo el lote, y cada error de esos es una regresión de seguridad, no un bug
-- de rendimiento". El bloque de abajo salió de `pg_policies` aplicando UNA
-- sustitución textual sobre las definiciones vigentes que devuelve el propio
-- catálogo, preservando `permissive`, `cmd` y `roles` tal cual.
--
-- Por eso las expresiones conservan el formato del catálogo (mayúsculas,
-- paréntesis redundantes, `( SELECT auth.uid() AS uid)`) en vez del estilo
-- del resto de la carpeta: son literalmente lo que la base tenía, con esa
-- única sustitución. Eso hace el diff verificable.
--
-- Cómo verificar
-- --------------
--   npm run db:check-rls-initplan   → 0 policies sin izar
--   npm run test:rls                → en verde: esto no cambia NINGUNA
--                                     semántica, solo cuándo se evalúa
-- ============================================================

drop policy if exists "comunidad_adjuntos_delete_propio_o_admin" on public.comunidad_adjuntos;
create policy "comunidad_adjuntos_delete_propio_o_admin" on public.comunidad_adjuntos
  as permissive for delete to public
  using (((( SELECT auth.uid() AS uid) = id_usuario) OR ( SELECT private.es_administrador() AS es_administrador)));

drop policy if exists "comunidad_moderacion_insert_admin" on public.comunidad_moderacion;
create policy "comunidad_moderacion_insert_admin" on public.comunidad_moderacion
  as permissive for insert to public
  with check ((( SELECT private.es_administrador() AS es_administrador) AND (( SELECT auth.uid() AS uid) = id_eliminado_por)));

drop policy if exists "comunidad_moderacion_select_admin" on public.comunidad_moderacion;
create policy "comunidad_moderacion_select_admin" on public.comunidad_moderacion
  as permissive for select to public
  using (( SELECT private.es_administrador() AS es_administrador));

drop policy if exists "comunidad_posts_insert_propio" on public.comunidad_posts;
create policy "comunidad_posts_insert_propio" on public.comunidad_posts
  as permissive for insert to public
  with check (((( SELECT auth.uid() AS uid) = id_usuario) AND private.correo_verificado() AND private.cuenta_activa() AND comunidad_tiene_acceso() AND (fijado = false) AND ((categoria <> 'ANUNCIOS'::"CategoriaComunidad") OR ( SELECT private.es_administrador() AS es_administrador))));

drop policy if exists "comunidad_posts_update_propio_o_admin" on public.comunidad_posts;
create policy "comunidad_posts_update_propio_o_admin" on public.comunidad_posts
  as permissive for update to public
  using (((( SELECT auth.uid() AS uid) = id_usuario) OR ( SELECT private.es_administrador() AS es_administrador)))
  with check (((( SELECT auth.uid() AS uid) = id_usuario) OR ( SELECT private.es_administrador() AS es_administrador)));

drop policy if exists "comunidad_reportes_select_admin" on public.comunidad_reportes;
create policy "comunidad_reportes_select_admin" on public.comunidad_reportes
  as permissive for select to public
  using (( SELECT private.es_administrador() AS es_administrador));

drop policy if exists "comunidad_reportes_update_admin" on public.comunidad_reportes;
create policy "comunidad_reportes_update_admin" on public.comunidad_reportes
  as permissive for update to public
  using (( SELECT private.es_administrador() AS es_administrador))
  with check (( SELECT private.es_administrador() AS es_administrador));

drop policy if exists "comunidad_respuestas_update_propio_o_admin" on public.comunidad_respuestas;
create policy "comunidad_respuestas_update_propio_o_admin" on public.comunidad_respuestas
  as permissive for update to public
  using (((( SELECT auth.uid() AS uid) = id_usuario) OR ( SELECT private.es_administrador() AS es_administrador)))
  with check (((( SELECT auth.uid() AS uid) = id_usuario) OR ( SELECT private.es_administrador() AS es_administrador)));

drop policy if exists "configuracion_comunidad_select_admin" on public.configuracion_comunidad;
create policy "configuracion_comunidad_select_admin" on public.configuracion_comunidad
  as permissive for select to public
  using (( SELECT private.es_administrador() AS es_administrador));

drop policy if exists "configuracion_comunidad_update_admin" on public.configuracion_comunidad;
create policy "configuracion_comunidad_update_admin" on public.configuracion_comunidad
  as permissive for update to public
  using (( SELECT private.es_administrador() AS es_administrador))
  with check ((( SELECT private.es_administrador() AS es_administrador) AND (( SELECT auth.uid() AS uid) = actualizado_por)));

drop policy if exists "curso_calificacion_reacciones_insert_propio" on public.curso_calificacion_reacciones;
create policy "curso_calificacion_reacciones_insert_propio" on public.curso_calificacion_reacciones
  as permissive for insert to public
  with check (((( SELECT auth.uid() AS uid) = id_usuario) AND private.correo_verificado() AND private.cuenta_activa() AND (EXISTS ( SELECT 1
   FROM (curso_calificaciones cc
     JOIN cursos c ON ((c.id = cc.id_curso)))
  WHERE ((cc.id = curso_calificacion_reacciones.id_calificacion) AND (NOT cc.eliminado) AND ((c.mostrado = true) OR ( SELECT private.es_administrador() AS es_administrador) OR private.tiene_acceso_vigente_curso(c.id)))))));

drop policy if exists "curso_calificacion_reacciones_select_publico" on public.curso_calificacion_reacciones;
create policy "curso_calificacion_reacciones_select_publico" on public.curso_calificacion_reacciones
  as permissive for select to public
  using ((EXISTS ( SELECT 1
   FROM (curso_calificaciones cc
     JOIN cursos c ON ((c.id = cc.id_curso)))
  WHERE ((cc.id = curso_calificacion_reacciones.id_calificacion) AND (NOT cc.eliminado) AND ((c.mostrado = true) OR ( SELECT private.es_administrador() AS es_administrador) OR private.tiene_acceso_vigente_curso(c.id))))));

drop policy if exists "curso_calificaciones_select_publico" on public.curso_calificaciones;
create policy "curso_calificaciones_select_publico" on public.curso_calificaciones
  as permissive for select to public
  using ((((NOT eliminado) OR ( SELECT private.es_administrador() AS es_administrador) OR (( SELECT auth.uid() AS uid) = id_usuario)) AND (EXISTS ( SELECT 1
   FROM cursos
  WHERE ((cursos.id = curso_calificaciones.id_curso) AND ((cursos.mostrado = true) OR ( SELECT private.es_administrador() AS es_administrador) OR private.tiene_acceso_vigente_curso(cursos.id)))))));

drop policy if exists "curso_calificaciones_update_propio_o_admin" on public.curso_calificaciones;
create policy "curso_calificaciones_update_propio_o_admin" on public.curso_calificaciones
  as permissive for update to public
  using (((( SELECT auth.uid() AS uid) = id_usuario) OR ( SELECT private.es_administrador() AS es_administrador)))
  with check (((( SELECT auth.uid() AS uid) = id_usuario) OR ( SELECT private.es_administrador() AS es_administrador)));

drop policy if exists "intentos_pago_admin_gestiona" on public.intentos_pago;
create policy "intentos_pago_admin_gestiona" on public.intentos_pago
  as permissive for all to public
  using (( SELECT private.es_administrador() AS es_administrador))
  with check (( SELECT private.es_administrador() AS es_administrador));

-- `auth.uid()` también izado aquí: ver "Dos `auth.uid()` desnudos" arriba.
drop policy if exists "intentos_pago_select_propio" on public.intentos_pago;
create policy "intentos_pago_select_propio" on public.intentos_pago
  as permissive for select to public
  using (((( SELECT auth.uid() AS uid) = id_usuario) OR ( SELECT private.es_administrador() AS es_administrador)));

drop policy if exists "trabajos_generacion_examen_admin_select" on public.trabajos_generacion_examen;
create policy "trabajos_generacion_examen_admin_select" on public.trabajos_generacion_examen
  as permissive for select to public
  using (( SELECT private.es_administrador() AS es_administrador));

drop policy if exists "transcripciones_video_admin_select" on public.transcripciones_video;
create policy "transcripciones_video_admin_select" on public.transcripciones_video
  as permissive for select to public
  using (( SELECT private.es_administrador() AS es_administrador));

-- ------------------------------------------------------------
-- storage.objects — nunca entraron al lote de 077 (ver encabezado).
-- ------------------------------------------------------------

-- `auth.uid()` también izado aquí: ver "Dos `auth.uid()` desnudos" arriba.
drop policy if exists "certificados_pdf_select_propio" on storage.objects;
create policy "certificados_pdf_select_propio" on storage.objects
  as permissive for select to authenticated
  using (((bucket_id = 'certificados'::text) AND (((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) OR ( SELECT private.es_administrador() AS es_administrador))));

drop policy if exists "comunidad_adjuntos_delete_propio_o_admin" on storage.objects;
create policy "comunidad_adjuntos_delete_propio_o_admin" on storage.objects
  as permissive for delete to authenticated
  using (((bucket_id = 'comunidad-adjuntos'::text) AND (((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) OR ( SELECT private.es_administrador() AS es_administrador))));

drop policy if exists "materiales_admin_delete" on storage.objects;
create policy "materiales_admin_delete" on storage.objects
  as permissive for delete to authenticated
  using (((bucket_id = 'materiales-lecciones'::text) AND ( SELECT private.es_administrador() AS es_administrador)));

drop policy if exists "materiales_admin_insert" on storage.objects;
create policy "materiales_admin_insert" on storage.objects
  as permissive for insert to authenticated
  with check (((bucket_id = 'materiales-lecciones'::text) AND ( SELECT private.es_administrador() AS es_administrador)));

drop policy if exists "materiales_admin_select" on storage.objects;
create policy "materiales_admin_select" on storage.objects
  as permissive for select to authenticated
  using (((bucket_id = 'materiales-lecciones'::text) AND ( SELECT private.es_administrador() AS es_administrador)));

drop policy if exists "materiales_admin_update" on storage.objects;
create policy "materiales_admin_update" on storage.objects
  as permissive for update to authenticated
  using (((bucket_id = 'materiales-lecciones'::text) AND ( SELECT private.es_administrador() AS es_administrador)))
  with check (((bucket_id = 'materiales-lecciones'::text) AND ( SELECT private.es_administrador() AS es_administrador)));

drop policy if exists "portadas_admin_delete" on storage.objects;
create policy "portadas_admin_delete" on storage.objects
  as permissive for delete to authenticated
  using (((bucket_id = 'portadas-cursos'::text) AND ( SELECT private.es_administrador() AS es_administrador)));

drop policy if exists "portadas_admin_insert" on storage.objects;
create policy "portadas_admin_insert" on storage.objects
  as permissive for insert to authenticated
  with check (((bucket_id = 'portadas-cursos'::text) AND ( SELECT private.es_administrador() AS es_administrador)));

drop policy if exists "portadas_admin_update" on storage.objects;
create policy "portadas_admin_update" on storage.objects
  as permissive for update to authenticated
  using (((bucket_id = 'portadas-cursos'::text) AND ( SELECT private.es_administrador() AS es_administrador)))
  with check (((bucket_id = 'portadas-cursos'::text) AND ( SELECT private.es_administrador() AS es_administrador)));
