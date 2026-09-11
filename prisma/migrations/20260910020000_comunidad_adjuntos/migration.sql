-- CreateTable
CREATE TABLE "comunidad_adjuntos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_post" UUID,
    "id_respuesta" UUID,
    "id_usuario" UUID NOT NULL,
    "ruta_storage" TEXT NOT NULL,
    "nombre_original" TEXT NOT NULL,
    "tipo_archivo" TEXT NOT NULL,
    "es_imagen" BOOLEAN NOT NULL,
    "ancho" INTEGER,
    "alto" INTEGER,
    "tamano_bytes" INTEGER NOT NULL,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comunidad_adjuntos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "comunidad_adjuntos_id_post_idx" ON "comunidad_adjuntos"("id_post");

-- CreateIndex
CREATE INDEX "comunidad_adjuntos_id_respuesta_idx" ON "comunidad_adjuntos"("id_respuesta");

-- CreateIndex
CREATE INDEX "comunidad_adjuntos_id_usuario_idx" ON "comunidad_adjuntos"("id_usuario");

-- AddForeignKey
ALTER TABLE "comunidad_adjuntos" ADD CONSTRAINT "comunidad_adjuntos_id_post_fkey" FOREIGN KEY ("id_post") REFERENCES "comunidad_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comunidad_adjuntos" ADD CONSTRAINT "comunidad_adjuntos_id_respuesta_fkey" FOREIGN KEY ("id_respuesta") REFERENCES "comunidad_respuestas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comunidad_adjuntos" ADD CONSTRAINT "comunidad_adjuntos_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "perfiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
