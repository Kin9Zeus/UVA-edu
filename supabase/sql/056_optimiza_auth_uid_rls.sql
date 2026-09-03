-- ============================================================
-- Performance Advisor: auth_rls_initplan en 15 policies
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-055.
-- Redefine, sin cambiar su lógica: perfiles_select_propio (002),
-- perfiles_update_propio (018), certificados_select_propio (002),
-- suscripciones_select_propio (003), pagos_select_propio (003),
-- inscripciones_select_propio (003),
-- recursos_select_con_acceso (039), progreso_select_propio (028),
-- progreso_insert_propio (019), progreso_update_propio (019),
-- progreso_delete_propio (014), comentarios_insert_propio (052),
-- comentarios_update_propio_o_admin (052), comentario_likes_propio (052),
-- comentario_likes_delete_propio (052).
--
-- El problema
-- -----------
-- Postgres re-evalúa `auth.uid()` fila por fila cuando aparece escrito
-- directamente en el USING/WITH CHECK de una policy, así esté marcada
-- STABLE -- el planner no puede subirlo a un InitPlan porque queda
-- referenciado dentro de la expresión por fila, no en una subquery propia.
-- Envuelto como `(select auth.uid())`, el planner sí lo trata como un
-- InitPlan: se evalúa una sola vez por sentencia, no una vez por fila.
-- Ver la nota de Supabase citada en el aviso del linter.
--
-- Por qué esto no cambia ningún resultado
-- ----------------------------------------
-- `(select auth.uid())` devuelve exactamente el mismo valor escalar que
-- `auth.uid()` -- es una reescritura de rendimiento, no de lógica. Cada
-- policy de abajo es una copia literal de su última versión, con esa única
-- sustitución mecánica.
--
-- Qué NO se toca aquí
-- --------------------
-- Las policies que solo llaman `private.es_administrador()` (sin
-- `auth.uid()` directo en su propio texto, p.ej. cursos_select_publicos,
-- modulos_select_curso_publico) no aparecieron en el aviso del linter y no
-- se tocan. Tampoco se toca `perfiles_admin_escritura` (005) --su
-- `auth.uid()` vive dentro de `private.es_administrador()`, no en la
-- policy misma-- ni el aviso separado de multiple_permissive_policies
-- sobre `perfiles` UPDATE, que es una decisión de diseño documentada en
-- 005_rls_categorias_y_perfiles_admin.sql (dos policies con OR a propósito)
-- y no se resuelve en esta migración.
--
-- `inscripciones_insert_propio` (003/019) NO se recrea aquí: el linter no
-- la marcó (ya no existe) -- 032_revoca_autoinscripcion_membresia.sql la
-- eliminó a propósito para cerrar P0-1 (auto-inscripción MEMBRESIA sin
-- revalidar la suscripción en cada lectura). Recrearla reabriría ese hueco.
-- Solo se toca `inscripciones_select_propio`, que sigue viva.
-- ============================================================

drop policy if exists "perfiles_select_propio" on public.perfiles;
create policy "perfiles_select_propio" on public.perfiles
  for select using ((select auth.uid()) = id or private.es_administrador());

drop policy if exists "perfiles_update_propio" on public.perfiles;
create policy "perfiles_update_propio" on public.perfiles
  for update using ((select auth.uid()) = id);

drop policy if exists "certificados_select_propio" on public.certificados;
create policy "certificados_select_propio" on public.certificados
  for select using ((select auth.uid()) = id_usuario or private.es_administrador());

drop policy if exists "suscripciones_select_propio" on public.suscripciones;
create policy "suscripciones_select_propio" on public.suscripciones
  for select using ((select auth.uid()) = id_usuario or private.es_administrador());

drop policy if exists "pagos_select_propio" on public.pagos;
create policy "pagos_select_propio" on public.pagos
  for select using (
    exists (
      select 1 from public.suscripciones
      where suscripciones.id = pagos.id_suscripcion
        and suscripciones.id_usuario = (select auth.uid())
    )
    or private.es_administrador()
  );

drop policy if exists "inscripciones_select_propio" on public.inscripciones;
create policy "inscripciones_select_propio" on public.inscripciones
  for select using ((select auth.uid()) = id_usuario or private.es_administrador());

drop policy if exists "recursos_select_con_acceso" on public.recursos_descargables;
create policy "recursos_select_con_acceso" on public.recursos_descargables
  for select using (
    private.es_administrador()
    or exists (
      select 1 from public.lecciones
      join public.modulos on modulos.id = lecciones.id_modulo
      join public.cursos on cursos.id = modulos.id_curso
      where lecciones.id = recursos_descargables.id_leccion
        and (
          exists (
            select 1 from public.inscripciones
            where inscripciones.id_usuario = (select auth.uid())
              and inscripciones.id_curso = cursos.id
              and inscripciones.tipo_acceso = 'CORTESIA'
              and inscripciones.activo = true
          )
          or private.suscripcion_da_acceso((select auth.uid()))
        )
    )
  );

drop policy if exists "progreso_select_propio" on public.progreso;
create policy "progreso_select_propio" on public.progreso
  for select using ((select auth.uid()) = id_usuario or private.es_administrador());

drop policy if exists "progreso_insert_propio" on public.progreso;
create policy "progreso_insert_propio" on public.progreso
  for insert with check (
    (select auth.uid()) = id_usuario
    and private.correo_verificado()
    and private.cuenta_activa()
  );

drop policy if exists "progreso_update_propio" on public.progreso;
create policy "progreso_update_propio" on public.progreso
  for update using ((select auth.uid()) = id_usuario)
  with check (
    (select auth.uid()) = id_usuario
    and private.correo_verificado()
    and private.cuenta_activa()
  );

drop policy if exists "progreso_delete_propio" on public.progreso;
create policy "progreso_delete_propio" on public.progreso
  for delete using ((select auth.uid()) = id_usuario);

drop policy if exists "comentarios_insert_propio" on public.comentarios;
create policy "comentarios_insert_propio" on public.comentarios
  for insert with check (
    (select auth.uid()) = id_usuario
    and (
      private.es_leccion_introductoria(id_leccion)
      or exists (
        select 1 from public.lecciones
        join public.modulos on modulos.id = lecciones.id_modulo
        where lecciones.id = comentarios.id_leccion
          and private.tiene_acceso_vigente_curso(modulos.id_curso)
      )
    )
  );

drop policy if exists "comentarios_update_propio_o_admin" on public.comentarios;
create policy "comentarios_update_propio_o_admin" on public.comentarios
  for update using ((select auth.uid()) = id_usuario or private.es_administrador())
  with check ((select auth.uid()) = id_usuario or private.es_administrador());

drop policy if exists "comentario_likes_propio" on public.comentario_likes;
create policy "comentario_likes_propio" on public.comentario_likes
  for insert with check ((select auth.uid()) = id_usuario);

drop policy if exists "comentario_likes_delete_propio" on public.comentario_likes;
create policy "comentario_likes_delete_propio" on public.comentario_likes
  for delete using ((select auth.uid()) = id_usuario);
