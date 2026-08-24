-- ============================================================
-- Bloque 3 de la auditoría de esquema: curso↔categoría pasa de FK
-- directa (1 curso -> 1 categoría) a tabla puente muchos-a-muchos.
--
-- El CMS sigue asignando una sola categoría por curso (no se tocó el
-- formulario ni el resto de la UI, a pedido explícito) — pero el
-- esquema ya soporta varias, sin necesidad de otra migración
-- estructural si el negocio lo pide más adelante.
--
-- Escrita a mano y aplicada con `prisma migrate deploy`, mismo motivo
-- que las migraciones anteriores (P4002 por el FK de perfiles hacia
-- auth.users).
-- ============================================================

CREATE TABLE "curso_categorias" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_curso" UUID NOT NULL,
    "id_categoria" UUID NOT NULL,
    "creado_en" timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT "curso_categorias_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "curso_categorias_id_curso_id_categoria_key" ON "curso_categorias"("id_curso", "id_categoria");
CREATE INDEX "curso_categorias_id_categoria_idx" ON "curso_categorias"("id_categoria");

ALTER TABLE "curso_categorias" ADD CONSTRAINT "curso_categorias_id_curso_fkey"
    FOREIGN KEY ("id_curso") REFERENCES "cursos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "curso_categorias" ADD CONSTRAINT "curso_categorias_id_categoria_fkey"
    FOREIGN KEY ("id_categoria") REFERENCES "categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Migra cada curso existente a su fila equivalente en la puente.
INSERT INTO "curso_categorias" ("id_curso", "id_categoria")
SELECT "id", "id_categoria" FROM "cursos";

-- Quita la FK, el índice y la columna vieja de cursos.
ALTER TABLE "cursos" DROP CONSTRAINT "cursos_id_categoria_fkey";
DROP INDEX IF EXISTS "cursos_id_categoria_idx";
ALTER TABLE "cursos" DROP COLUMN "id_categoria";
