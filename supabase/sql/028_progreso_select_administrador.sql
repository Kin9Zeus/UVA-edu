-- ============================================================
-- progreso_select_propio: falta el acceso de administrador
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 019, cuya
-- policy de SELECT reemplaza.
--
-- Qué se arregla
-- --------------
-- `progreso_select_propio` (014_separa_politicas_for_all.sql) solo permite
-- `auth.uid() = id_usuario`. Todas las demás tablas de esta migración
-- (perfiles, suscripciones, pagos, certificados) agregan
-- `or private.es_administrador()`; progreso se quedó sin ese `or` por
-- descuido.
--
-- Consecuencia real: el panel admin (getCursoDetalle,
-- src/lib/admin/cursoDetalle.ts) consulta `progreso` con el cliente de
-- sesión del propio administrador — nunca con el service role — así que
-- RLS le devolvía siempre cero filas para el progreso de sus estudiantes.
-- La pestaña "Estudiantes" de un curso mostraba 0% para todos, sin
-- importar cuánto hubieran avanzado.
--
-- No se toca INSERT/UPDATE/DELETE: un administrador nunca debe generar ni
-- alterar el progreso de otra persona, solo leerlo (mismo criterio que
-- 019_cuenta_activa_rls.sql aplicó al no tocar ningún SELECT).
-- ============================================================

drop policy if exists "progreso_select_propio" on public.progreso;
create policy "progreso_select_propio" on public.progreso
  for select using (auth.uid() = id_usuario or private.es_administrador());
