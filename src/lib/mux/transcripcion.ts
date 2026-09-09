import { mux } from "@/lib/mux/client";

/**
 * Descarga y normaliza la transcripción de un track de texto de Mux.
 *
 * Vive en src/lib/mux/ y no en examenes/generacion/ porque es conocimiento
 * sobre Mux (cómo se firma, dónde vive el VTT, qué forma tiene), no sobre
 * exámenes. El pipeline de exámenes nunca habla con Mux: lee de
 * `transcripciones_video`.
 */

/** Duración del token que firma la descarga del VTT. Corta a propósito: se usa
 * una sola vez, dentro del mismo webhook. */
const DURACION_TOKEN_TRANSCRIPCION = "10m";

/**
 * Convierte un WebVTT en texto plano corrido.
 *
 * Lo que hay que quitar, y por qué cada cosa:
 *
 *   - la cabecera `WEBVTT` y los bloques `NOTE`/`STYLE`.
 *   - las líneas de tiempo (`00:00:01.000 --> 00:00:04.000`) con sus ajustes
 *     de posición (`align:start position:0%`).
 *   - los identificadores numéricos de cue.
 *   - las etiquetas inline (`<v Locutor>`, `<c.amarillo>`, `<00:00:02.500>`)
 *     que Mux emite en subtítulos autogenerados.
 *
 * Y lo que hay que hacer además de quitar: DEDUPLICAR líneas consecutivas
 * repetidas. Los subtítulos con efecto rollup repiten la última línea del cue
 * anterior al principio del siguiente; sin deduplicar, la transcripción sale
 * con cada frase escrita dos veces y el modelo genera preguntas duplicadas
 * sobre ellas.
 */
export function vttATextoPlano(vtt: string): string {
  const lineas = vtt.replace(/\r\n?/g, "\n").split("\n");
  const salida: string[] = [];

  for (const cruda of lineas) {
    const linea = cruda.trim();

    if (linea === "") continue;
    if (linea === "WEBVTT" || linea.startsWith("WEBVTT ")) continue;
    if (linea.startsWith("NOTE") || linea.startsWith("STYLE") || linea.startsWith("REGION")) continue;
    if (linea.includes("-->")) continue;
    // Identificador de cue: una línea que es solo un número.
    if (/^\d+$/.test(linea)) continue;

    const limpia = linea
      // <v Locutor>, </v>, <c.clase>, <00:00:02.500>, <b>...
      .replace(/<[^>]*>/g, "")
      // &amp; &lt; &gt; &nbsp; — lo único que WebVTT escapa.
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (limpia === "") continue;
    // Rollup: la misma línea repetida en el cue siguiente.
    if (salida.length > 0 && salida[salida.length - 1] === limpia) continue;

    salida.push(limpia);
  }

  return salida.join(" ");
}

export type ResultadoTranscripcion =
  | { ok: true; texto: string }
  | { ok: false; error: string };

/**
 * Trae el texto de un track de subtítulos de un asset con playback firmado.
 *
 * El VTT de una pista de texto se sirve desde stream.mux.com bajo el MISMO
 * token de reproducción que el video (`type: "video"` → audiencia `v`), no
 * bajo uno propio: para Mux la pista es parte del playback. De ahí que se firme
 * igual que en `src/lib/video/reproduccion.ts`.
 *
 * Se pide `.vtt` y no `.txt` —que Mux también sirve— porque el VTT es el
 * formato que existe para toda pista lista, y porque parsearlo acá deja el
 * resultado bajo nuestro control y bajo test (`vttATextoPlano`), en vez de
 * depender de cómo Mux decida agrupar el texto plano.
 */
export async function descargarTranscripcionMux(
  playbackId: string,
  trackId: string,
): Promise<ResultadoTranscripcion> {
  let token: string;
  try {
    token = await mux.jwt.signPlaybackId(playbackId, {
      type: "video",
      expiration: DURACION_TOKEN_TRANSCRIPCION,
    });
  } catch (error) {
    return {
      ok: false,
      error: `no se pudo firmar el token de la transcripción: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }

  const url = `https://stream.mux.com/${playbackId}/text/${trackId}.vtt?token=${token}`;

  let respuesta: Response;
  try {
    respuesta = await fetch(url);
  } catch (error) {
    return {
      ok: false,
      error: `no se pudo descargar la transcripción: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }

  if (!respuesta.ok) {
    return { ok: false, error: `Mux respondió ${respuesta.status} al pedir la transcripción` };
  }

  const texto = vttATextoPlano(await respuesta.text());

  // Un VTT que existe pero no tiene ni una línea de diálogo es una pista vacía
  // (clase sin narración, audio mudo). Guardarlo como transcripción válida haría
  // que la generación pidiera preguntas sobre la nada; es mejor tratarlo como
  // ausente y que el administrador lo vea en la lista de "falta transcripción".
  if (texto.trim() === "") {
    return { ok: false, error: "la transcripción de Mux vino vacía" };
  }

  return { ok: true, texto };
}
