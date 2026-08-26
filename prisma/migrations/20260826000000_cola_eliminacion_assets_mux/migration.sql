-- ============================================================
-- Cola de assets de Mux pendientes de eliminar tras un reemplazo de
-- video de una lección (docs/functional-spec.md, "Reemplazo de video
-- de una lección sin recrearla").
--
-- Al reemplazar el video, el asset viejo de Mux NUNCA se borra antes de
-- confirmar que el nuevo quedó listo (ver comentario en
-- id_video_mux, prisma/schema.prisma). El webhook (video.asset.ready,
-- src/app/api/webhooks/mux/route.ts) sobreescribe lecciones.id_mux_asset_id
-- con el del asset nuevo en ese mismo UPDATE — sin esta tabla, el id del
-- asset viejo se perdía ahí mismo y no quedaba ninguna forma de
-- encontrarlo después para limpiarlo, ni siquiera a mano desde el
-- dashboard de Mux.
--
-- El borrado real contra la API de Mux (mux.video.assets.delete) NO se
-- implementa todavía: queda pendiente hasta tener acceso al dominio de
-- Mux del equipo. Esta tabla solo encola qué hay que borrar y cuándo se
-- encoló; `eliminado`/`eliminado_en` los va a usar el job de limpieza
-- que se escriba en ese momento.
-- ============================================================

-- CreateTable
CREATE TABLE "mux_assets_pendientes_eliminacion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_leccion" UUID,
    "id_asset_mux" TEXT NOT NULL,
    "eliminado" BOOLEAN NOT NULL DEFAULT false,
    "eliminado_en" TIMESTAMPTZ,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "mux_assets_pendientes_eliminacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- Filtra rápido "qué falta borrar" cuando exista el job de limpieza.
CREATE INDEX "mux_assets_pendientes_eliminacion_eliminado_idx" ON "mux_assets_pendientes_eliminacion"("eliminado");

-- AddForeignKey
-- ON DELETE SET NULL: si la lección se borra después de encolar su
-- asset viejo, el registro de limpieza debe sobrevivir igual (el asset
-- huérfano en Mux sigue existiendo aunque ya no haya lección).
ALTER TABLE "mux_assets_pendientes_eliminacion" ADD CONSTRAINT "mux_assets_pendientes_eliminacion_id_leccion_fkey" FOREIGN KEY ("id_leccion") REFERENCES "lecciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;
