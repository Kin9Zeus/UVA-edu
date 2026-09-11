-- CreateTable
CREATE TABLE "comunidad_reportes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_post" UUID,
    "id_respuesta" UUID,
    "id_reportante" UUID NOT NULL,
    "motivo" TEXT NOT NULL,
    "revisado" BOOLEAN NOT NULL DEFAULT false,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comunidad_reportes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "comunidad_reportes_id_post_idx" ON "comunidad_reportes"("id_post");

-- CreateIndex
CREATE INDEX "comunidad_reportes_id_respuesta_idx" ON "comunidad_reportes"("id_respuesta");

-- CreateIndex
CREATE INDEX "comunidad_reportes_id_reportante_idx" ON "comunidad_reportes"("id_reportante");

-- CreateIndex
CREATE INDEX "comunidad_reportes_revisado_creado_en_idx" ON "comunidad_reportes"("revisado", "creado_en");

-- AddForeignKey
ALTER TABLE "comunidad_reportes" ADD CONSTRAINT "comunidad_reportes_id_post_fkey" FOREIGN KEY ("id_post") REFERENCES "comunidad_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comunidad_reportes" ADD CONSTRAINT "comunidad_reportes_id_respuesta_fkey" FOREIGN KEY ("id_respuesta") REFERENCES "comunidad_respuestas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comunidad_reportes" ADD CONSTRAINT "comunidad_reportes_id_reportante_fkey" FOREIGN KEY ("id_reportante") REFERENCES "perfiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
