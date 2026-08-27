import { fileTypeFromBuffer } from "file-type";

/**
 * Igual al máximo que acepta Supabase Storage por archivo (plan actual).
 * Vive acá, y no en el Server Action, por el mismo motivo que
 * TAMANO_MAXIMO_PORTADA en lib/media.ts: ese módulo lleva "use server" a
 * nivel de archivo y solo puede exportar funciones async.
 */
export const TAMANO_MAXIMO_RECURSO = 50 * 1024 * 1024;

/**
 * Formatos que se aceptan como "material adicional" de una lección (PDF,
 * ZIP, Office, imágenes — docs/technical-spec.md "Tabla: Recursos
 * Descargables"), identificados por los magic bytes del archivo y no por
 * el `Content-Type` que declara el navegador ni por la extensión del
 * nombre subido. Mismo motivo que en lib/admin/portada.ts: un archivo
 * renombrado o un MIME falsificado no debe pasar. Deja fuera HTML/SVG/JS
 * en particular, que servidos desde Storage serían una vía de XSS.
 */
const FORMATOS_ACEPTADOS: Record<string, { extension: string; mime: string }> = {
  "application/pdf": { extension: "pdf", mime: "application/pdf" },
  "application/zip": { extension: "zip", mime: "application/zip" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    extension: "docx",
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
    extension: "xlsx",
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": {
    extension: "pptx",
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  },
  "image/png": { extension: "png", mime: "image/png" },
  "image/jpeg": { extension: "jpg", mime: "image/jpeg" },
  "image/webp": { extension: "webp", mime: "image/webp" },
};

export const ERROR_FORMATO_RECURSO =
  "Formato no permitido. Sube PDF, ZIP, Word, Excel, PowerPoint o una imagen (JPG, PNG, WebP).";
export const ERROR_TAMANO_RECURSO = `El archivo no puede superar los ${TAMANO_MAXIMO_RECURSO / 1024 / 1024} MB.`;

export type RecursoProcesado = {
  cuerpo: Buffer;
  contentType: string;
  extension: string;
};

/**
 * Valida el material adicional de una lección antes de subirlo a Storage.
 * A diferencia de la portada, acá no se re-codifica el archivo (un PDF o un
 * ZIP no se pueden "normalizar" como una imagen) — solo se confirma que los
 * bytes reales correspondan a uno de los formatos permitidos.
 */
export async function procesarRecurso(
  archivo: File,
): Promise<{ recurso: RecursoProcesado } | { error: string }> {
  if (archivo.size === 0) return { error: "Selecciona un archivo." };
  if (archivo.size > TAMANO_MAXIMO_RECURSO) return { error: ERROR_TAMANO_RECURSO };

  const cuerpo = Buffer.from(await archivo.arrayBuffer());

  const detectado = await fileTypeFromBuffer(cuerpo);
  const formato = detectado ? FORMATOS_ACEPTADOS[detectado.mime] : undefined;
  if (!formato) return { error: ERROR_FORMATO_RECURSO };

  return { recurso: { cuerpo, contentType: formato.mime, extension: formato.extension } };
}
