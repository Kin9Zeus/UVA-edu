-- CreateEnum
CREATE TYPE "CategoriaComunidad" AS ENUM ('ANUNCIOS', 'PROYECTOS', 'PREGUNTAS', 'EMPLEO');

-- CreateTable
CREATE TABLE "configuracion_comunidad" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "fin_bootstrap" TIMESTAMPTZ NOT NULL,
    "actualizado_en" TIMESTAMPTZ NOT NULL,
    "actualizado_por" UUID,

    CONSTRAINT "configuracion_comunidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comunidad_posts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_usuario" UUID NOT NULL,
    "categoria" "CategoriaComunidad" NOT NULL,
    "titulo" TEXT NOT NULL,
    "contenido" TEXT NOT NULL,
    "eliminado" BOOLEAN NOT NULL DEFAULT false,
    "fijado" BOOLEAN NOT NULL DEFAULT false,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "comunidad_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comunidad_respuestas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_post" UUID NOT NULL,
    "id_usuario" UUID NOT NULL,
    "contenido" TEXT NOT NULL,
    "eliminado" BOOLEAN NOT NULL DEFAULT false,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "comunidad_respuestas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comunidad_reacciones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_post" UUID,
    "id_respuesta" UUID,
    "id_usuario" UUID NOT NULL,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comunidad_reacciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comunidad_moderacion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_post" UUID,
    "id_respuesta" UUID,
    "contenido_original" TEXT NOT NULL,
    "id_eliminado_por" UUID NOT NULL,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comunidad_moderacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "configuracion_comunidad_actualizado_por_idx" ON "configuracion_comunidad"("actualizado_por");

-- CreateIndex
CREATE INDEX "comunidad_posts_categoria_creado_en_idx" ON "comunidad_posts"("categoria", "creado_en");

-- CreateIndex
CREATE INDEX "comunidad_posts_id_usuario_idx" ON "comunidad_posts"("id_usuario");

-- CreateIndex
CREATE INDEX "comunidad_respuestas_id_post_creado_en_idx" ON "comunidad_respuestas"("id_post", "creado_en");

-- CreateIndex
CREATE INDEX "comunidad_respuestas_id_usuario_idx" ON "comunidad_respuestas"("id_usuario");

-- CreateIndex
CREATE INDEX "comunidad_reacciones_id_post_idx" ON "comunidad_reacciones"("id_post");

-- CreateIndex
CREATE INDEX "comunidad_reacciones_id_respuesta_idx" ON "comunidad_reacciones"("id_respuesta");

-- CreateIndex
CREATE INDEX "comunidad_reacciones_id_usuario_idx" ON "comunidad_reacciones"("id_usuario");

-- CreateIndex
CREATE INDEX "comunidad_moderacion_id_post_idx" ON "comunidad_moderacion"("id_post");

-- CreateIndex
CREATE INDEX "comunidad_moderacion_id_respuesta_idx" ON "comunidad_moderacion"("id_respuesta");

-- CreateIndex
CREATE INDEX "comunidad_moderacion_id_eliminado_por_idx" ON "comunidad_moderacion"("id_eliminado_por");

-- AddForeignKey
ALTER TABLE "configuracion_comunidad" ADD CONSTRAINT "configuracion_comunidad_actualizado_por_fkey" FOREIGN KEY ("actualizado_por") REFERENCES "perfiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comunidad_posts" ADD CONSTRAINT "comunidad_posts_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "perfiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comunidad_respuestas" ADD CONSTRAINT "comunidad_respuestas_id_post_fkey" FOREIGN KEY ("id_post") REFERENCES "comunidad_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comunidad_respuestas" ADD CONSTRAINT "comunidad_respuestas_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "perfiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comunidad_reacciones" ADD CONSTRAINT "comunidad_reacciones_id_post_fkey" FOREIGN KEY ("id_post") REFERENCES "comunidad_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comunidad_reacciones" ADD CONSTRAINT "comunidad_reacciones_id_respuesta_fkey" FOREIGN KEY ("id_respuesta") REFERENCES "comunidad_respuestas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comunidad_reacciones" ADD CONSTRAINT "comunidad_reacciones_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "perfiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comunidad_moderacion" ADD CONSTRAINT "comunidad_moderacion_id_post_fkey" FOREIGN KEY ("id_post") REFERENCES "comunidad_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comunidad_moderacion" ADD CONSTRAINT "comunidad_moderacion_id_respuesta_fkey" FOREIGN KEY ("id_respuesta") REFERENCES "comunidad_respuestas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comunidad_moderacion" ADD CONSTRAINT "comunidad_moderacion_id_eliminado_por_fkey" FOREIGN KEY ("id_eliminado_por") REFERENCES "perfiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

