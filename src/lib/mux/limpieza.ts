import { NotFoundError } from "@mux/mux-node";
import type { SupabaseClient } from "@supabase/supabase-js";
import { mux } from "@/lib/mux/client";
import { logError } from "@/lib/log";

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

export type AssetPorBorrar = { idLeccion: string | null; idAsset: string };

/**
 * Paso 1 de borrar videos de Mux: dejar constancia en
 * `mux_assets_pendientes_eliminacion` ANTES de tocar nada más. Así un fallo
 * posterior (red, rate limit, el proceso que muere) nunca pierde el id del
 * asset: `npm run mux:limpiar` lo reintenta. Mismo orden que el reemplazo en
 * el webhook (P1-5, AUDIT-2026-08-26.md).
 *
 * Devuelve los ids de las filas encoladas (para `deshacerEncolado` y
 * `borrarAssetsEncolados`), o `null` si no se pudo encolar — y entonces quien
 * llama NO debe seguir: borrar la lección sin la fila en cola deja el asset
 * huérfano en Mux sin nadie que lo recuerde.
 *
 * `servicio` es el cliente de Service Role: la cola no tiene policy de
 * escritura (supabase/sql/031), solo el backend escribe en ella.
 */
export async function encolarAssetsParaBorrar(
  servicio: SupabaseClient,
  assets: AssetPorBorrar[],
): Promise<string[] | null> {
  if (assets.length === 0) return [];
  const { data, error } = await servicio
    .from("mux_assets_pendientes_eliminacion")
    .insert(assets.map((asset) => ({ id_leccion: asset.idLeccion, id_asset_mux: asset.idAsset })))
    .select("id");
  if (error || !data) {
    logError("mux:limpieza", "no se pudieron encolar assets para borrar", error, { area: "webhook" });
    return null;
  }
  return data.map((fila) => fila.id as string);
}

/**
 * Compensación: si lo que venía después del encolado falló (el DELETE de la
 * lección, el UPDATE que le quita el video), el asset SIGUE EN USO y su fila
 * no puede quedar en la cola — `mux:limpiar` no comprueba si el asset se usa
 * y borraría un video vivo.
 */
export async function deshacerEncolado(servicio: SupabaseClient, idsCola: string[]): Promise<void> {
  if (idsCola.length === 0) return;
  const { error } = await servicio.from("mux_assets_pendientes_eliminacion").delete().in("id", idsCola);
  if (error) {
    logError("mux:limpieza", "no se pudo deshacer el encolado; revisar la cola antes de mux:limpiar", error, {
      area: "webhook",
      idsCola,
    });
  }
}

/**
 * Paso final: borrar contra la API de Mux lo ya encolado y marcar cada fila.
 * Solo se llama cuando ninguna lección apunta ya al asset. Un fallo acá no se
 * propaga: la fila queda con `eliminado = false` y la reintenta
 * `npm run mux:limpiar` — para quien llama, el video ya no existe.
 */
export async function borrarAssetsEncolados(
  servicio: SupabaseClient,
  assets: AssetPorBorrar[],
  idsCola: string[],
  borrar?: (id: string) => Promise<unknown>,
): Promise<void> {
  await Promise.all(
    assets.map(async (asset, i) => {
      const resultado = await eliminarAssetMux(asset.idAsset, borrar);
      if (!resultado.ok) {
        logError("mux:limpieza", "no se pudo borrar el asset de Mux; queda en cola", resultado.error, {
          area: "webhook",
          idAsset: asset.idAsset,
          idLeccion: asset.idLeccion,
        });
        return;
      }
      await servicio
        .from("mux_assets_pendientes_eliminacion")
        .update({ eliminado: true, eliminado_en: new Date().toISOString() })
        .eq("id", idsCola[i]);
    }),
  );
}
