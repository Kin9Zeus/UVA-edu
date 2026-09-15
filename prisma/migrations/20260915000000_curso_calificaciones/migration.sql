-- CreateTable
CREATE TABLE "curso_calificaciones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_curso" UUID NOT NULL,
    "id_usuario" UUID NOT NULL,
    "puntuacion" INTEGER NOT NULL,
    "comentario" TEXT,
    "eliminado" BOOLEAN NOT NULL DEFAULT false,
    "eliminado_por_admin" BOOLEAN NOT NULL DEFAULT false,
    "id_eliminado_por" UUID,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "curso_calificaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curso_calificacion_reacciones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_calificacion" UUID NOT NULL,
    "id_usuario" UUID NOT NULL,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "curso_calificacion_reacciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "curso_calificaciones_id_curso_creado_en_idx" ON "curso_calificaciones"("id_curso", "creado_en");

-- CreateIndex
CREATE INDEX "curso_calificaciones_id_usuario_idx" ON "curso_calificaciones"("id_usuario");

-- CreateIndex
CREATE UNIQUE INDEX "curso_calificacion_reacciones_id_calificacion_id_usuario_key" ON "curso_calificacion_reacciones"("id_calificacion", "id_usuario");

-- CreateIndex
CREATE INDEX "curso_calificacion_reacciones_id_calificacion_idx" ON "curso_calificacion_reacciones"("id_calificacion");

-- CreateIndex
CREATE INDEX "curso_calificacion_reacciones_id_usuario_idx" ON "curso_calificacion_reacciones"("id_usuario");

-- AddForeignKey
ALTER TABLE "curso_calificaciones" ADD CONSTRAINT "curso_calificaciones_id_curso_fkey" FOREIGN KEY ("id_curso") REFERENCES "cursos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curso_calificaciones" ADD CONSTRAINT "curso_calificaciones_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "perfiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curso_calificaciones" ADD CONSTRAINT "curso_calificaciones_id_eliminado_por_fkey" FOREIGN KEY ("id_eliminado_por") REFERENCES "perfiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curso_calificacion_reacciones" ADD CONSTRAINT "curso_calificacion_reacciones_id_calificacion_fkey" FOREIGN KEY ("id_calificacion") REFERENCES "curso_calificaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curso_calificacion_reacciones" ADD CONSTRAINT "curso_calificacion_reacciones_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "perfiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
