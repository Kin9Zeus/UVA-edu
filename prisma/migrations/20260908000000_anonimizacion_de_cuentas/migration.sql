-- AlterTable
ALTER TABLE "perfiles" ADD COLUMN "anonimizado_en" TIMESTAMPTZ;

-- CreateIndex
-- Parcial: la inmensa mayoría de las filas tiene NULL y nunca se consultan
-- por esta columna. Solo interesa el conjunto pequeño de cuentas suprimidas.
CREATE INDEX "perfiles_anonimizado_en_idx" ON "perfiles" ("anonimizado_en") WHERE "anonimizado_en" IS NOT NULL;
