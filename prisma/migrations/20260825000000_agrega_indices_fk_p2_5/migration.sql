-- ============================================================
-- P2-5 (AUDIT-2026-08-24.md): claves foráneas sin índice en las tablas
-- que más van a crecer. `progreso`/`certificados`/`inscripciones` solo
-- tenían el índice compuesto de su `@@unique`, que solo sirve para
-- consultas que filtran por el prefijo (`id_usuario`) — filtrar solo por
-- la segunda columna (ej. "todo el progreso de una lección") hace
-- sequential scan. También cierra `suscripciones.id_cupon`/
-- `id_codigo_invitacion` (sin índice) y, de paso, las dos FKs de
-- "creado por admin" que el hallazgo señalaba sin cubrir en su lista de
-- cambios (Cursos/Categorias.id_admin_creador).
--
-- Escrita a mano y aplicada con `prisma migrate deploy`, mismo motivo que
-- las migraciones anteriores (P4002 por el FK de perfiles hacia
-- auth.users: la shadow database de `prisma migrate dev` no tiene el
-- schema `auth`, así que su diff automático no puede correr).
-- ============================================================

-- IF NOT EXISTS en todo: Supabase (session pooler) no envolvió el archivo
-- en una sola transacción, así que el primer intento aplicó estas
-- sentencias una por una y quedó a medio camino cuando
-- suscripciones_id_codigo_invitacion_idx resultó ya existir (creado antes
-- por fuera de Prisma — deriva del esquema, no algo que esta migración
-- causó). Reintentar el archivo debe poder completar lo que falta sin
-- fallar en lo que ya quedó aplicado.

-- ---------- progreso: "todo el progreso de una lección" ----------
CREATE INDEX IF NOT EXISTS "progreso_id_leccion_idx" ON "progreso"("id_leccion");

-- ---------- certificados: "todos los certificados de un curso" ----------
-- El índice viejo en solo id_usuario es redundante: ya es el prefijo de
-- certificados_id_usuario_id_curso_key (@@unique([id_usuario, id_curso])).
DROP INDEX IF EXISTS "certificados_id_usuario_idx";
CREATE INDEX IF NOT EXISTS "certificados_id_curso_idx" ON "certificados"("id_curso");

-- ---------- inscripciones: "todos los inscritos a un curso" ----------
CREATE INDEX IF NOT EXISTS "inscripciones_id_curso_idx" ON "inscripciones"("id_curso");

-- ---------- suscripciones: joins con cupón / código de invitación ----------
CREATE INDEX IF NOT EXISTS "suscripciones_id_cupon_idx" ON "suscripciones"("id_cupon");
CREATE INDEX IF NOT EXISTS "suscripciones_id_codigo_invitacion_idx" ON "suscripciones"("id_codigo_invitacion");

-- ---------- "creado por administrador" (panel de admin) ----------
CREATE INDEX IF NOT EXISTS "cursos_id_admin_creador_idx" ON "cursos"("id_admin_creador");
CREATE INDEX IF NOT EXISTS "categorias_id_admin_creador_idx" ON "categorias"("id_admin_creador");
