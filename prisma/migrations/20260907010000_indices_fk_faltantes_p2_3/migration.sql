-- ============================================================
-- Índices de cobertura para toda FK de una columna en `public` que no
-- tenía ninguna. Ver AUDIT-2026-09-04.md, P2-3 -- tercera aparición del
-- mismo patrón (P2-5 el 24 de agosto, P2-3 el 26 de agosto, ambos
-- cerrados por 20260825000000_agrega_indices_fk_p2_5).
--
-- Esta vez se agrega además un paso de CI (scripts/check-fk-indexes.ts,
-- job `rls` de ci.yml) para que la cuarta aparición falle sola en vez de
-- esperar a la próxima auditoría. Esa misma consulta, corrida contra la
-- base real mientras se escribía este archivo, encontró las 12 columnas
-- de abajo -- solo 2 de ellas (comentarios.id_usuario,
-- comentario_likes.id_usuario) eran las que el hallazgo nombraba
-- explícitamente. Las otras 10 -- incluida comentario_moderacion, una
-- tabla que llegó el mismo día por otra rama -- confirman que el problema
-- de fondo era la ausencia del gate, no falta de cuidado puntual en cada
-- migración por separado.
--
-- Escrita a mano y aplicada con `prisma migrate deploy`, mismo motivo que
-- 20260825000000: la shadow database de `prisma migrate dev` no tiene el
-- schema `auth`, y perfiles.id -> auth.users(id) hace fallar cualquier
-- diff automático con P4002.
-- ============================================================

-- ---------- comentarios: hallazgo original de P2-3 ----------

-- comentarios_autor_publico (supabase/sql/061) hace join
-- c.id_usuario = p.id por cada fila de perfiles -- sin este índice, cada
-- carga de un hilo de comentarios es un seq scan completo de comentarios.
CREATE INDEX IF NOT EXISTS "comentarios_id_usuario_idx" ON "comentarios"("id_usuario");

-- La PK compuesta (id_comentario, id_usuario) solo sirve como índice para
-- consultas que filtran por id_comentario (o por ambas columnas) --
-- Postgres no puede usar el sufijo de un índice compuesto para buscar
-- solo por la segunda columna. "todos los likes de un usuario" haría seq
-- scan sin esto.
CREATE INDEX IF NOT EXISTS "comentario_likes_id_usuario_idx" ON "comentario_likes"("id_usuario");

-- comentario_moderacion (20260907000000_comentario_moderacion) ya indexa
-- id_comentario, pero no id_eliminado_por -- "todo lo que moderó este
-- administrador" haría seq scan sin esto.
CREATE INDEX IF NOT EXISTS "comentario_moderacion_id_eliminado_por_idx" ON "comentario_moderacion"("id_eliminado_por");

-- ---------- el resto, encontrado por check-fk-indexes.ts ----------

-- suscripciones: "otorgamientos/revocaciones de este administrador"
-- (bitácora, panel de usuarios) hacía seq scan sin esto.
CREATE INDEX IF NOT EXISTS "suscripciones_otorgado_por_idx" ON "suscripciones"("otorgado_por");
CREATE INDEX IF NOT EXISTS "suscripciones_cancelado_por_idx" ON "suscripciones"("cancelado_por");

-- inscripciones: mismo patrón que suscripciones, otra tabla de acceso
-- manual con las mismas dos columnas de auditoría.
CREATE INDEX IF NOT EXISTS "inscripciones_otorgado_por_idx" ON "inscripciones"("otorgado_por");
CREATE INDEX IF NOT EXISTS "inscripciones_revocado_por_idx" ON "inscripciones"("revocado_por");

-- instructores/codigos_invitacion/tokens_vista_previa/lotes_codigos_invitacion:
-- las cuatro comparten la misma columna "creado por qué administrador",
-- sin índice en ninguna.
CREATE INDEX IF NOT EXISTS "instructores_id_admin_creador_idx" ON "instructores"("id_admin_creador");
CREATE INDEX IF NOT EXISTS "codigos_invitacion_id_admin_creador_idx" ON "codigos_invitacion"("id_admin_creador");
CREATE INDEX IF NOT EXISTS "tokens_vista_previa_id_admin_creador_idx" ON "tokens_vista_previa"("id_admin_creador");
CREATE INDEX IF NOT EXISTS "lotes_codigos_invitacion_id_admin_creador_idx" ON "lotes_codigos_invitacion"("id_admin_creador");

-- mux_assets_pendientes_eliminacion: mux:verificar-atascados busca por
-- id_leccion además de eliminado -- solo esa segunda columna tenía índice.
CREATE INDEX IF NOT EXISTS "mux_assets_pendientes_eliminacion_id_leccion_idx" ON "mux_assets_pendientes_eliminacion"("id_leccion");
