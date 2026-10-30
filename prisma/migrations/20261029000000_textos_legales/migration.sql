-- CreateTable
CREATE TABLE "textos_legales" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "contenido" JSONB NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'BORRADOR',
    "vigente_desde" TIMESTAMPTZ,
    "publicado_en" TIMESTAMPTZ,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "textos_legales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "textos_legales_slug_estado_vigente_desde_idx" ON "textos_legales"("slug", "estado", "vigente_desde");

-- CreateIndex
CREATE UNIQUE INDEX "textos_legales_slug_version_key" ON "textos_legales"("slug", "version");
