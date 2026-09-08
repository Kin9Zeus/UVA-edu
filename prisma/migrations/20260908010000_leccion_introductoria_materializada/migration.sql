-- AlterTable
ALTER TABLE "lecciones" ADD COLUMN "es_introductoria" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
-- Parcial: como mucho una lección por curso la tiene en true, así que el
-- índice sobre el subconjunto es diminuto comparado con uno completo.
CREATE INDEX "lecciones_es_introductoria_idx" ON "lecciones" ("id_modulo") WHERE "es_introductoria";
