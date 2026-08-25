-- ============================================================
-- Mux Direct Upload para lecciones (subida de video desde el panel
-- admin, docs/functional-spec.md Flujo 09/10).
--
-- Agrega el estado ERROR: el enum solo contemplaba el camino feliz
-- SUBIENDO → PROCESANDO → LISTO y video.asset.errored/video.upload.cancelled
-- no tenían a dónde caer.
--
-- Agrega dos columnas para poder correlacionar el webhook de Mux con la
-- lección: id_mux_upload_id se guarda al pedir el Direct Upload, antes de
-- que exista el asset — es lo único que el webhook puede usar para
-- encontrar la fila en video.asset.ready/errored y video.upload.cancelled.
-- id_mux_asset_id queda para operaciones futuras sobre el asset ya creado.
-- id_video_mux (ya existente, es el playback_id) no se toca hasta que el
-- nuevo asset esté listo, así un reemplazo de video no deja sin
-- reproducción al estudiante mientras Mux procesa el nuevo.
--
-- Escrita a mano y aplicada con `prisma migrate deploy` (mismo criterio
-- que el resto de esta carpeta, ver prisma/migrations/20260825000000_*).
-- ============================================================

-- AlterEnum
ALTER TYPE "EstadoProcesamientoLeccion" ADD VALUE 'ERROR';

-- AlterTable
ALTER TABLE "lecciones"
  ADD COLUMN "id_mux_upload_id" TEXT,
  ADD COLUMN "id_mux_asset_id" TEXT,
  ADD COLUMN "error_procesamiento" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "lecciones_id_mux_upload_id_key" ON "lecciones"("id_mux_upload_id");
