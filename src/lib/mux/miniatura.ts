import { mux } from "@/lib/mux/client";
import { logError } from "@/lib/log";

// Igual que el playback ID: el playback policy es "signed", así que la URL
// de la miniatura necesita su propio JWT (`type: "thumbnail"`, distinto del
// que firma la reproducción) — sin token, image.mux.com devuelve 403 para
// un playback ID firmado. Vida más larga que el token de video (15m,
// lib/video/reproduccion.ts) porque esto es una imagen que el navegador
// puede cachear mientras dura la sesión de estudio, no un stream que haya
// que revalidar a cada rato.
const DURACION_TOKEN = "6h";

/**
 * URL de un frame del video ya procesado, para el cuadro de miniatura del
 * Temario (Revcurso: "algún frame del video publicado en esa lección").
 * `null` si no se pudo firmar — el llamador debe tratarlo igual que "sin
 * miniatura" (el cuadro oscuro de siempre), nunca como error fatal.
 */
export async function getMiniaturaUrl(
  playbackId: string,
  /**
   * Segundo exacto del video que se quiere como imagen. Sin él, Mux devuelve
   * el frame por defecto del asset.
   *
   * Va DENTRO del token, no como parámetro suelto de la URL: para un
   * playback ID firmado, image.mux.com exige que cada parámetro de la
   * petición esté también en el JWT — uno pegado solo al query string se
   * ignora o da 403. Por eso viaja en `params`.
   */
  segundo?: number,
): Promise<string | null> {
  try {
    const enSegundos =
      segundo !== undefined && Number.isFinite(segundo) && segundo > 0
        ? Math.floor(segundo)
        : undefined;

    const token = await mux.jwt.signPlaybackId(playbackId, {
      type: "thumbnail",
      expiration: DURACION_TOKEN,
      ...(enSegundos !== undefined ? { params: { time: String(enSegundos) } } : {}),
    });
    return `https://image.mux.com/${playbackId}/thumbnail.jpg?token=${token}`;
  } catch (error) {
    logError("mux:miniatura", "no se pudo firmar el token de miniatura", error, {
      area: "webhook",
      playbackId,
    });
    return null;
  }
}
