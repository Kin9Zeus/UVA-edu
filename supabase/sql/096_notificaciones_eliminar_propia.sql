-- ============================================================
-- 096 — Permite quitar (borrar) una notificación propia
-- ============================================================
-- 094 cerraba DELETE del todo a propósito: en ese momento no había ninguna
-- razón legítima para borrar una notificación, solo para insertarla (el
-- trigger) o marcarla leída. Ahora sí la hay — el botón "×" del
-- desplegable — así que se abre, pero solo sobre la fila propia. A
-- diferencia del INSERT (que sigue cerrado del todo: nadie borra la
-- notificación de otro, ni un admin).
drop policy if exists "notificaciones_delete_propio" on public.notificaciones;
create policy "notificaciones_delete_propio" on public.notificaciones
  for delete using ((select auth.uid()) = id_usuario);

grant delete on public.notificaciones to authenticated;
