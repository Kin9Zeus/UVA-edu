-- CreateTable
CREATE TABLE "actividad_diaria" (
    "id_usuario" UUID NOT NULL,
    "fecha" DATE NOT NULL,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "actividad_diaria_pkey" PRIMARY KEY ("id_usuario","fecha")
);

-- AddForeignKey
ALTER TABLE "actividad_diaria" ADD CONSTRAINT "actividad_diaria_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "perfiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
