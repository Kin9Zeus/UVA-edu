-- CreateTable
CREATE TABLE "cursos_slugs_anteriores" (
    "slug" TEXT NOT NULL,
    "id_curso" UUID NOT NULL,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cursos_slugs_anteriores_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "categorias_slugs_anteriores" (
    "slug" TEXT NOT NULL,
    "id_categoria" UUID NOT NULL,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categorias_slugs_anteriores_pkey" PRIMARY KEY ("slug")
);

-- CreateIndex
CREATE INDEX "cursos_slugs_anteriores_id_curso_idx" ON "cursos_slugs_anteriores"("id_curso");

-- CreateIndex
CREATE INDEX "categorias_slugs_anteriores_id_categoria_idx" ON "categorias_slugs_anteriores"("id_categoria");

-- AddForeignKey
ALTER TABLE "cursos_slugs_anteriores" ADD CONSTRAINT "cursos_slugs_anteriores_id_curso_fkey" FOREIGN KEY ("id_curso") REFERENCES "cursos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorias_slugs_anteriores" ADD CONSTRAINT "categorias_slugs_anteriores_id_categoria_fkey" FOREIGN KEY ("id_categoria") REFERENCES "categorias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

