-- ============================================================
-- Realtime: codigos_invitacion
--
-- Orden de aplicación: después de 016 (RLS de la tabla ya existe).
--
-- rev.md exige ver "en tiempo real" cuántos códigos se han canjeado. Hoy
-- `/admin/codigos` solo se refresca vía `revalidatePath` cuando el propio
-- administrador hace una acción — si un estudiante canjea un código desde
-- otra sesión, la tabla abierta no se entera hasta recargar. Esto agrega la
-- tabla a la publicación `supabase_realtime` para que el panel pueda
-- suscribirse a los UPDATE de `veces_usado` (ver
-- src/components/admin/codigos/useCodigosRealtime.ts).
--
-- Seguridad: Supabase Realtime evalúa las policies de RLS de la tabla
-- contra el rol del cliente que se suscribe (mismo motor que un SELECT
-- normal). Como `codigos_invitacion_admin_select` (016) exige
-- `private.es_administrador()`, un estudiante autenticado no recibe estos
-- eventos aunque intente suscribirse al canal — no hace falta una política
-- aparte para Realtime.
--
-- Idempotente: `ADD TABLE` sobre una tabla ya publicada lanza
-- "already member of publication", así que se comprueba antes.
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'codigos_invitacion'
  ) then
    alter publication supabase_realtime add table public.codigos_invitacion;
  end if;
end $$;
