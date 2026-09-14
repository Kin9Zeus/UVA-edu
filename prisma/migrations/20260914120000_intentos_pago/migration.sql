-- CreateTable
CREATE TABLE "intentos_pago" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "referencia" TEXT NOT NULL,
    "id_usuario" UUID NOT NULL,
    "id_plan" UUID NOT NULL,
    "id_cupon" UUID,
    "monto_centavos" BIGINT NOT NULL,
    "moneda" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "id_transaccion_wompi" TEXT,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "intentos_pago_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "intentos_pago_referencia_key" ON "intentos_pago"("referencia");

-- CreateIndex
CREATE INDEX "intentos_pago_id_usuario_idx" ON "intentos_pago"("id_usuario");

-- CreateIndex
CREATE INDEX "intentos_pago_estado_idx" ON "intentos_pago"("estado");

-- CreateIndex
CREATE INDEX "intentos_pago_id_plan_idx" ON "intentos_pago"("id_plan");

-- CreateIndex
CREATE INDEX "intentos_pago_id_cupon_idx" ON "intentos_pago"("id_cupon");

-- AddForeignKey
ALTER TABLE "intentos_pago" ADD CONSTRAINT "intentos_pago_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "perfiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intentos_pago" ADD CONSTRAINT "intentos_pago_id_plan_fkey" FOREIGN KEY ("id_plan") REFERENCES "planes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intentos_pago" ADD CONSTRAINT "intentos_pago_id_cupon_fkey" FOREIGN KEY ("id_cupon") REFERENCES "cupones"("id") ON DELETE SET NULL ON UPDATE CASCADE;
