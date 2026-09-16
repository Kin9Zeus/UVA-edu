import type { SupabaseClient } from "@supabase/supabase-js";

export const BUCKET_AVATARES = "avatares";

/**
 * De la URL pública guardada en `perfiles.foto_url` a la ruta relativa que
 * pide `storage.remove()`. Compartido entre `actions/perfil/foto.ts` (subir/
 * quitar la propia foto) y la limpieza de Storage antes de anonimizar una
 * cuenta (admin y autoservicio): los tres necesitan el mismo recorte.
 */
export function extraerRutaAvatar(url: string | null) {
  if (!url) return null;
  const marcador = `/object/public/${BUCKET_AVATARES}/`;
  const indice = url.indexOf(marcador);
  return indice === -1 ? null : url.slice(indice + marcador.length);
}

/**
 * Borra el archivo de Storage de la foto de perfil, si existe. Best-effort a
 * propósito (no lanza): igual que `borrarAdjuntoComunidad`, un archivo que no
 * se pudo borrar no debe bloquear el resto de una supresión de cuenta — la
 * fila en `perfiles` es lo que importa suprimir primero.
 */
export async function borrarFotoPerfil(
  supabase: Pick<SupabaseClient, "storage">,
  fotoUrl: string | null,
): Promise<void> {
  const ruta = extraerRutaAvatar(fotoUrl);
  if (!ruta) return;
  await supabase.storage.from(BUCKET_AVATARES).remove([ruta]);
}
