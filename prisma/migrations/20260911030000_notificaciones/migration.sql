-- CreateTable
CREATE TABLE "notificaciones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_usuario" UUID NOT NULL,
    "tipo" TEXT NOT NULL,
    "id_actor" UUID,
    "entidad_tipo" TEXT NOT NULL,
    "entidad_id" UUID NOT NULL,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notificaciones_id_usuario_leida_creado_en_idx" ON "notificaciones"("id_usuario", "leida", "creado_en");

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "perfiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_id_actor_fkey" FOREIGN KEY ("id_actor") REFERENCES "perfiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
