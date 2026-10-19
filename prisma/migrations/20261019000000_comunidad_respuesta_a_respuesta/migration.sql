-- AlterTable
ALTER TABLE "comunidad_respuestas" ADD COLUMN     "id_respuesta_padre" UUID;

-- CreateIndex
CREATE INDEX "comunidad_respuestas_id_respuesta_padre_idx" ON "comunidad_respuestas"("id_respuesta_padre");

-- AddForeignKey
ALTER TABLE "comunidad_respuestas" ADD CONSTRAINT "comunidad_respuestas_id_respuesta_padre_fkey" FOREIGN KEY ("id_respuesta_padre") REFERENCES "comunidad_respuestas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
