import sharp from "sharp";
import {
  ALTO_PORTADA,
  ANCHO_PORTADA,
  ERROR_FORMATO_PORTADA,
  ERROR_TAMANO_PORTADA,
  TAMANO_MAXIMO_PORTADA,
} from "@/lib/media";

/**
 * Formatos que se aceptan, por lo que la imagen ES y no por lo que el
 * cliente dice que es. `sharp` los identifica por los magic bytes del
 * archivo, así que un `.png` renombrado o un `Content-Type` falsificado no
 * pasan. Deja fuera, en particular, SVG — que es un documento con scripts,
 * no un mapa de bits, y servido desde Storage sería un XSS.
 */
const FORMATOS_ACEPTADOS = new Set(["jpeg", "png", "webp"]);

export type PortadaProcesada = {
  cuerpo: Buffer;
  contentType: string;
  extension: string;
};

/**
 * Valida y normaliza la portada de un curso.
 *
 * Todo lo que sale de acá es un WebP de 1280×720 (16:9) recortado al
 * centro, pese la imagen original lo que pese: servir el archivo tal cual
 * en una grilla de catálogo es lo que arruina el tiempo de carga, y
 * normalizar la relación de aspecto es lo que evita que la grilla se vea
 * disparejo. Se recorta (`fit: "cover"`), nunca se estira, así que la
 * imagen no sale deformada.
 *
 * El recorte es centrado a propósito: es exactamente lo que hace el
 * `object-cover` de la vista previa, así que el administrador confirma lo
 * mismo que va a quedar guardado.
 */
export async function procesarPortada(
  archivo: File,
): Promise<{ portada: PortadaProcesada } | { error: string }> {
  if (archivo.size === 0) return { error: "Selecciona una imagen." };
  if (archivo.size > TAMANO_MAXIMO_PORTADA) return { error: ERROR_TAMANO_PORTADA };

  const entrada = Buffer.from(await archivo.arrayBuffer());

  try {
    // `metadata()` decodifica solo la cabecera. Si el archivo no es una
    // imagen que sharp entienda, lanza — y cae en el catch de abajo.
    const { format } = await sharp(entrada).metadata();
    if (!format || !FORMATOS_ACEPTADOS.has(format)) {
      return { error: ERROR_FORMATO_PORTADA };
    }

    const cuerpo = await sharp(entrada)
      .resize(ANCHO_PORTADA, ALTO_PORTADA, { fit: "cover", position: "centre" })
      .webp({ quality: 82 })
      .toBuffer();

    return { portada: { cuerpo, contentType: "image/webp", extension: "webp" } };
  } catch {
    // Un archivo corrupto o que no es imagen llega acá; para el
    // administrador es el mismo problema que un formato no soportado.
    return { error: ERROR_FORMATO_PORTADA };
  }
}
