-- ============================================================
-- Revierte 046: codigos_invitacion sale de supabase_realtime
-- Cierra AUDIT-2026-09-08-base-de-datos.md — D-13 (P3).
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-079.
--
-- Qué medía D-13
-- --------------
-- `pg_stat_statements` situaba el decodificador de WAL de Realtime como la
-- segunda consulta más cara de todo el proyecto:
--
--   74 792 llamadas / 357 974 ms acumulados
--
-- con prácticamente 0 usuarios reales conectados en ese momento. Es el
-- mayor costo atribuible a la aplicación, y ocurre EN REPOSO: cada
-- INSERT/UPDATE/DELETE sobre la tabla se decodifica del WAL y se reevalúa
-- contra RLS por cada suscriptor conectado, sin importar si alguien está
-- mirando la pantalla. `crear_lote_codigos_invitacion` (045) puede insertar
-- hasta 500 filas de una sola llamada (MAX_LOTE en
-- src/actions/admin/lotesCodigosInvitacion.ts), y cada una de esas 500 es
-- un evento propio.
--
-- Por qué se retira en vez de optimizarse
-- ----------------------------------------
-- Es la ÚNICA pantalla de todo el panel admin que usa Realtime — el resto
-- (usuarios, cursos, comentarios, suscripciones) se refresca con el patrón
-- estándar de Next.js: `revalidatePath` tras la propia Server Action. La
-- excepción cubría un caso genuino pero estrecho: un administrador con
-- `/admin/codigos` abierta se enteraba al instante si un ESTUDIANTE
-- canjeaba un código desde otra sesión, o si OTRO administrador creaba o
-- desactivaba un código en otra pestaña. Sin ese caso, la pantalla se
-- comporta exactamente como el resto del panel: al día en cuanto el propio
-- admin actúa, y hay que recargar para ver lo que hicieron otros — un
-- costo de UX menor frente al costo medido de mantener el canal abierto.
--
-- El lado del código
-- -------------------
-- src/components/admin/codigos/useCodigosRealtime.ts se borró.
-- CodigosPanel.tsx ya no lo importa ni lo monta.
--
-- Idempotente: `DROP TABLE` sobre una tabla que no está en la publicación
-- lanza "is not a member of publication", así que se comprueba antes —
-- mismo patrón que el `IF NOT EXISTS` de 046.
-- ============================================================

do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'codigos_invitacion'
  ) then
    alter publication supabase_realtime drop table public.codigos_invitacion;
  end if;
end $$;
