-- ============================================================
-- `lecciones.contenido`: documento JSON de Tiptap/ProseMirror con el
-- contenido enriquecido de la lección (texto con formato, encabezados,
-- listas, citas, bloques de código, etc.). Reemplaza a `resumen` (texto
-- plano) como lo que edita el instructor y lo que ve el estudiante — ver
-- comentario en el modelo Lecciones de schema.prisma.
--
-- `resumen` NO se toca: se conserva como respaldo de lo ya sembrado/escrito
-- antes de este campo. La app (getCursoDetalle, getLeccionPlayer,
-- getLeccionVistaPrevia) lo usa como valor inicial de `contenido` — un
-- único párrafo — cuando la lección todavía no tiene JSON propio, así
-- ningún resumen ya publicado desaparece.
--
-- Escrita a mano y aplicada con `prisma migrate deploy`, mismo motivo que
-- las migraciones anteriores (P4002 por el FK de perfiles hacia auth.users
-- — ver 20260825010000_agrega_slug_a_categorias/migration.sql).
-- ============================================================

ALTER TABLE "lecciones" ADD COLUMN "contenido" JSONB;
