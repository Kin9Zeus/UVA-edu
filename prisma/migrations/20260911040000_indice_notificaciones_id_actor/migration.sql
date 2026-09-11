-- ============================================================
-- Índice de cobertura para notificaciones.id_actor, la FK que
-- 20260911030000_notificaciones creó sin índice. Lo detectó el paso
-- `db:check-fk-indexes` de CI (scripts/check-fk-indexes.ts) al llegar la
-- rama comunidad a master.
--
-- La FK es ON DELETE SET NULL hacia perfiles: al borrar un perfil, Postgres
-- busca las notificaciones con ese id_actor para ponerlas en null, y sin
-- este índice cada borrado es un seq scan completo de notificaciones. El
-- índice existente (id_usuario, leida, creado_en) no sirve: su columna
-- líder es id_usuario.
--
-- Escrita a mano y aplicada con `prisma migrate deploy`, mismo motivo que
-- 20260907010000_indices_fk_faltantes_p2_3: la shadow database de
-- `prisma migrate dev` no tiene el schema `auth`.
-- ============================================================

CREATE INDEX IF NOT EXISTS "notificaciones_id_actor_idx" ON "notificaciones"("id_actor");
