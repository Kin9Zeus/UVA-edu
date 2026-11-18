-- Contenido propio de las páginas de escuela (SEO fase 14, tarea «páginas de
-- escuela como landings»). Solo agrega columnas: el código anterior no las
-- lee y sigue funcionando (docs/ops/plan-de-reversion.md).
-- AlterTable
ALTER TABLE "categorias" ADD COLUMN     "introduccion" TEXT,
ADD COLUMN     "preguntas_frecuentes" JSONB NOT NULL DEFAULT '[]';
