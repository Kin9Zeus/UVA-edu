-- CreateTable
CREATE TABLE "notas_leccion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_usuario" UUID NOT NULL,
    "id_leccion" UUID NOT NULL,
    "segundo" INTEGER NOT NULL,
    "contenido" TEXT NOT NULL,
    "id_video_mux" TEXT,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "notas_leccion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notas_leccion_id_usuario_id_leccion_segundo_idx" ON "notas_leccion"("id_usuario", "id_leccion", "segundo");

-- CreateIndex
CREATE INDEX "notas_leccion_id_leccion_idx" ON "notas_leccion"("id_leccion");

-- AddForeignKey
ALTER TABLE "notas_leccion" ADD CONSTRAINT "notas_leccion_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "perfiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_leccion" ADD CONSTRAINT "notas_leccion_id_leccion_fkey" FOREIGN KEY ("id_leccion") REFERENCES "lecciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
