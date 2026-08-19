-- CreateEnum
CREATE TYPE "NivelCurso" AS ENUM ('BASICO', 'INTERMEDIO', 'AVANZADO');

-- AlterTable
ALTER TABLE "categorias" ADD COLUMN     "activo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "id_admin_creador" UUID;

-- AlterTable
ALTER TABLE "cursos" ADD COLUMN     "destacado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nivel" "NivelCurso" NOT NULL DEFAULT 'BASICO',
ADD COLUMN     "orden_visualizacion" INTEGER NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_id_admin_creador_fkey" FOREIGN KEY ("id_admin_creador") REFERENCES "perfiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
