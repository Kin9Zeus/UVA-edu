-- ============================================================
-- Corrige modulos.id_curso: era ON DELETE CASCADE, debe ser RESTRICT.
-- Ver revisión de la Fase 1 (checklist "Diseñar esquema Postgres",
-- requisito de ON DELETE explícito y pensado) — un curso con contenido
-- nunca debe perderse por accidente al borrarlo. Con CASCADE, borrar un
-- curso arrastraba en silencio todos sus módulos, lecciones y progreso.
--
-- eliminarCurso() (src/actions/admin/cursos.ts) ahora comprueba antes de
-- borrar si el curso tiene módulos y responde con un mensaje claro en vez
-- de dejar que esta restricción falle con un error genérico de FK.
--
-- Escrita a mano y aplicada con `prisma migrate deploy`, sin tocar el
-- schema `auth` — no aplica aquí el motivo de las migraciones anteriores
-- (P4002 por el FK de perfiles hacia auth.users), pero se mantiene el
-- mismo flujo por consistencia con el resto de la carpeta.
-- ============================================================

ALTER TABLE "modulos" DROP CONSTRAINT "modulos_id_curso_fkey";
ALTER TABLE "modulos" ADD CONSTRAINT "modulos_id_curso_fkey" FOREIGN KEY ("id_curso") REFERENCES "cursos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
