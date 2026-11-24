-- CreateTable
CREATE TABLE "consentimientos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_usuario" UUID NOT NULL,
    "tipo" TEXT NOT NULL,
    "version_texto" TEXT,
    "origen" TEXT NOT NULL,
    "aceptado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consentimientos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consentimientos_id_usuario_idx" ON "consentimientos"("id_usuario");

-- CreateIndex
CREATE UNIQUE INDEX "consentimientos_id_usuario_tipo_version_texto_key" ON "consentimientos"("id_usuario", "tipo", "version_texto");

-- AddForeignKey
ALTER TABLE "consentimientos" ADD CONSTRAINT "consentimientos_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "perfiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
