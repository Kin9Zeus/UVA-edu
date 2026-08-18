-- CreateEnum
CREATE TYPE "TipoDescuento" AS ENUM ('PORCENTAJE', 'MONTO_FIJO');

-- DropForeignKey
ALTER TABLE "inscripciones" DROP CONSTRAINT "inscripciones_id_curso_fkey";

-- AlterTable
ALTER TABLE "cupones" DROP COLUMN "tipo_descuento",
ADD COLUMN     "tipo_descuento" "TipoDescuento" NOT NULL;

-- AlterTable
ALTER TABLE "inscripciones" ALTER COLUMN "id_curso" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "certificados_id_usuario_id_curso_key" ON "certificados"("id_usuario", "id_curso");

-- AddForeignKey
ALTER TABLE "inscripciones" ADD CONSTRAINT "inscripciones_id_curso_fkey" FOREIGN KEY ("id_curso") REFERENCES "cursos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
