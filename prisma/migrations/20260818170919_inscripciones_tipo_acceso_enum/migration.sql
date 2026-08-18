-- CreateEnum
CREATE TYPE "TipoAcceso" AS ENUM ('MEMBRESIA', 'CORTESIA');

-- AlterTable
ALTER TABLE "inscripciones" DROP COLUMN "tipo_acceso",
ADD COLUMN     "tipo_acceso" "TipoAcceso" NOT NULL;
