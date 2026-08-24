-- ============================================================
-- Reconciliación: dos arreglos independientes para la misma
-- vulnerabilidad en `perfiles`
--
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de 000-017.
--
-- Contexto: la auditoría de RLS encontró que "perfiles_update_propio"
-- (001_rls_policies.sql) no restringía qué columnas podía cambiar el
-- dueño de la fila, permitiendo que un estudiante se auto-promoviera a
-- ADMINISTRADOR vía UPDATE directo a la API. Se cerró con un trigger
-- BEFORE UPDATE (013_perfiles_bloquea_autopromocion.sql).
--
-- De forma independiente, otro desarrollador encontró el mismo hueco y
-- lo cerró con un enfoque distinto: agregó un `with check` a
-- "perfiles_update_propio" que compara `rol`/`estado` contra su valor
-- anterior vía subquery (commit 3173b95, archivo
-- supabase/sql/013_fix_perfiles_update_propio.sql, corrido contra esta
-- misma base de datos). Ese archivo no sobrevivió el merge hacia esta
-- rama (se resolvió a favor del trigger), pero su SQL sí había quedado
-- aplicado en la base — dejando las dos protecciones apiladas.
--
-- Decisión (confirmada explícitamente): se conserva solo el trigger,
-- por ser más general — protege la fila sin importar qué política la
-- deja pasar, no solo esta. Este script revierte
-- "perfiles_update_propio" a su forma original de 001_rls_policies.sql
-- (sin with check propio), para que la base compartida vuelva a
-- coincidir exactamente con lo que producen los archivos de este
-- directorio corridos en orden desde cero. La protección real sigue
-- viva en el trigger — este cambio no reabre el hueco, verificado por
-- scripts/rls-test.ts.
-- ============================================================

drop policy if exists "perfiles_update_propio" on public.perfiles;
create policy "perfiles_update_propio" on public.perfiles
  for update using (auth.uid() = id);
