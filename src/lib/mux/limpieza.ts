import { NotFoundError } from "@mux/mux-node";
import { mux } from "@/lib/mux/client";

export type ResultadoEliminarAsset = { ok: true } | { ok: false; error: unknown };

/**
 * Borra un asset de Mux. Un 404 (el asset ya no existe) cuenta como éxito:
 * es lo que hace idempotente al consumidor de la cola
 * `mux_assets_pendientes_eliminacion` — reintentar un asset que ya se borró
 * en una corrida anterior no debe registrarse como fallo.
 *
 * `borrar` es inyectable para probar la lógica de "404 cuenta como éxito"
 * sin llamar a la API real de Mux (mismo criterio que `ahora` en
 * calcularDiasGracia, src/lib/gracia.ts).
 */
export async function eliminarAssetMux(
  assetId: string,
  borrar: (id: string) => Promise<unknown> = (id) => mux.video.assets.delete(id),
): Promise<ResultadoEliminarAsset> {
  try {
    await borrar(assetId);
    return { ok: true };
  } catch (error) {
    if (error instanceof NotFoundError) return { ok: true };
    return { ok: false, error };
  }
}
