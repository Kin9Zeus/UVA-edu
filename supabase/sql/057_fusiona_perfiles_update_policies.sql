-- ============================================================
-- Performance Advisor: multiple_permissive_policies en perfiles UPDATE
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-056.
-- Fusiona "perfiles_update_propio" (056) y "perfiles_admin_escritura" (005)
-- en una sola policy.
--
-- El problema
-- -----------
-- `perfiles` tenía dos policies permisivas para UPDATE:
--   perfiles_update_propio:   using (auth.uid() = id)                  -- sin with check propio
--   perfiles_admin_escritura: using (es_administrador()) with check (es_administrador())
-- Postgres evalúa las dos en cada UPDATE y las combina con OR (semántica
-- de policies permisivas), así que ya se comportaban como una sola. Tener
-- dos separadas es trabajo repetido para el planner sin ganar nada: por
-- eso el linter las marca.
--
-- Por qué la fusión no cambia el resultado
-- -----------------------------------------
-- Cuando una policy de UPDATE no define WITH CHECK, Postgres reusa su
-- propio USING como WITH CHECK implícito. Es decir, el par de policies de
-- arriba se comportaba exactamente así:
--   USING:      (auth.uid() = id)        OR es_administrador()
--   WITH CHECK: (auth.uid() = id)        OR es_administrador()
-- que es carácter por carácter lo que queda como policy única abajo. No
-- se toca ninguna otra tabla ni el trigger
-- `perfiles_bloquea_autopromocion` (013) -- ese trigger corre BEFORE
-- UPDATE sin importarle cuántas policies de RLS se evaluaron ni sus
-- nombres, así que sigue bloqueando el cambio de `rol`/`estado` por
-- cuenta propia exactamente igual. Verificado con scripts/rls-test.ts
-- (casos "auto-promoverse a ADMINISTRADOR" y "SÍ puede editar su propio
-- nombre").
--
-- Se conserva el nombre "perfiles_update_propio": es el que aparece en
-- 001/013/018 y en el historial de la tabla; "perfiles_admin_escritura"
-- desaparece.
-- ============================================================

drop policy if exists "perfiles_admin_escritura" on public.perfiles;
drop policy if exists "perfiles_update_propio" on public.perfiles;
create policy "perfiles_update_propio" on public.perfiles
  for update using ((select auth.uid()) = id or private.es_administrador())
  with check ((select auth.uid()) = id or private.es_administrador());
