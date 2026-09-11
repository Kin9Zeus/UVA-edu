import sharp from "sharp";
import { fileTypeFromBuffer } from "file-type";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logError } from "@/lib/log";
import { TAMANO_MAXIMO_ADJUNTO_COMUNIDAD } from "@/lib/comunidad-tipos";

export const BUCKET_ADJUNTOS_COMUNIDAD = "comunidad-adjuntos";

/** Lado más largo tras redimensionar (nunca se agranda una imagen ya
 * chica). Suficiente para verse nítida en la columna del feed a densidad
 * 2x, sin servir el original tal cual pese lo que pese la foto. */
const LADO_MAXIMO_IMAGEN = 1600;

/** Igual criterio que FORMATOS_ACEPTADOS en lib/admin/portada.ts: por lo
 * que `sharp` reconoce en los magic bytes, no por lo que declare el
 * archivo. Deja fuera SVG (es un documento con scripts, no un mapa de
 * bits — servido desde Storage sería XSS). */
const FORMATOS_IMAGEN = new Set(["jpeg", "png", "webp", "gif"]);

/** Documentos aceptados además de imagen — mismo catálogo que
 * FORMATOS_ACEPTADOS en lib/admin/recurso.ts (material de lección), para no
 * inventar una segunda lista de "qué es un documento seguro" en la app. */
const FORMATOS_DOCUMENTO: Record<string, { extension: string; mime: string }> = {
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
};

export const ERROR_FORMATO_ADJUNTO_COMUNIDAD =
  "Formato no permitido. Sube una imagen (JPG, PNG, WebP, GIF) o un archivo PDF, ZIP, Word, Excel o PowerPoint.";
export const ERROR_TAMANO_ADJUNTO_COMUNIDAD = `El archivo no puede superar los ${TAMANO_MAXIMO_ADJUNTO_COMUNIDAD / 1024 / 1024} MB.`;

export type AdjuntoComunidadProcesado = {
  cuerpo: Buffer;
  contentType: string;
  extension: string;
  esImagen: boolean;
  ancho: number | null;
  alto: number | null;
};

/**
 * Valida un adjunto de Comunidad (post o respuesta) y, si es una imagen, la
 * normaliza — igual que procesarPortada (lib/admin/portada.ts): siempre
 * sale como WebP y nunca más grande que LADO_MAXIMO_IMAGEN, pese lo que
 * pese o mida el original. A diferencia de la portada, acá NO se recorta a
 * una relación de aspecto fija (`fit: "inside"`, no "cover") — el post
 * conserva la proporción real de la foto, el feed solo la limita en ancho
 * (ver ComunidadPostCard).
 *
 * `.rotate()` aplica la orientación EXIF (fotos de celular) y la descarta
 * del archivo final, para que el ancho/alto que se guardan sean los
 * mismos con los que el navegador la va a pintar.
 *
 * Si no es una imagen que sharp reconozca, se intenta como documento por
 * magic bytes (mismo mecanismo que procesarRecurso, lib/admin/recurso.ts) —
 * sin re-codificar: un PDF o un ZIP no se pueden "normalizar".
 */
export async function procesarAdjuntoComunidad(
  archivo: File,
): Promise<{ adjunto: AdjuntoComunidadProcesado } | { error: string }> {
  if (archivo.size === 0) return { error: "Selecciona un archivo." };
  if (archivo.size > TAMANO_MAXIMO_ADJUNTO_COMUNIDAD) return { error: ERROR_TAMANO_ADJUNTO_COMUNIDAD };

  const entrada = Buffer.from(await archivo.arrayBuffer());

  try {
    const metadata = await sharp(entrada).metadata();
    if (metadata.format && FORMATOS_IMAGEN.has(metadata.format)) {
      const cuerpo = await sharp(entrada)
        .rotate()
        .resize(LADO_MAXIMO_IMAGEN, LADO_MAXIMO_IMAGEN, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();
      const final = await sharp(cuerpo).metadata();

      return {
        adjunto: {
          cuerpo,
          contentType: "image/webp",
          extension: "webp",
          esImagen: true,
          ancho: final.width ?? null,
          alto: final.height ?? null,
        },
      };
    }
  } catch {
    // No era una imagen que sharp reconozca -- se intenta como documento.
  }

  const detectado = await fileTypeFromBuffer(entrada);
  const formato = detectado ? FORMATOS_DOCUMENTO[detectado.mime] : undefined;
  if (!formato) return { error: ERROR_FORMATO_ADJUNTO_COMUNIDAD };

  return {
    adjunto: {
      cuerpo: entrada,
      contentType: formato.mime,
      extension: formato.extension,
      esImagen: false,
      ancho: null,
      alto: null,
    },
  };
}

export type AdjuntoNuevoProcesado = { id: string; nombreOriginal: string; adjunto: AdjuntoComunidadProcesado };

/**
 * Reconstruye los pares token/archivo desde el `FormData` que arma el
 * composer (`ComunidadComposer`/`ComunidadRespuestaComposer`/
 * `ComunidadPostEditor`) — dos campos repetidos ("token" y "archivo") en el
 * mismo orden, `FormData` garantiza ese orden entre entradas del mismo
 * nombre.
 *
 * Por qué FormData y no un array de `{token, archivo}` pasado directo como
 * argumento del Server Action: un `File` ANIDADO dentro de un objeto dentro
 * de un array no sobrevive el viaje al servidor (se probó en vivo: llegaba
 * un archivo que `sharp`/`file-type` ya no podían leer, aunque el mismo
 * archivo fuera válido localmente) — el único caso de `File` como argumento
 * de Server Action que de verdad está probado en este proyecto es
 * `FormData` en el nivel superior (mismo mecanismo que `subirPortadaCurso`,
 * src/actions/admin/cursos.ts).
 */
function extraerAdjuntosPendientes(formData: FormData): { token: string; archivo: File }[] {
  const tokens = formData.getAll("token");
  const archivos = formData.getAll("archivo");
  const pares: { token: string; archivo: File }[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const archivo = archivos[i];
    if (typeof token === "string" && archivo instanceof File) pares.push({ token, archivo });
  }
  return pares;
}

/**
 * Valida cada archivo nuevo elegido en el editor y le asigna su id real de
 * una vez, sustituyendo su token pendiente (`[[adjunto:pendiente:...]]`)
 * por ese id directo en el texto — ANTES de tocar la base de datos. Así el
 * post/respuesta se crea (o edita) en un solo INSERT/UPDATE con el
 * contenido ya final, sin un segundo UPDATE después para "arreglar" los
 * marcadores una vez subidos los archivos: `comunidad_respuestas` ni
 * siquiera permite reescribir su contenido una vez creada (083), así que
 * ese segundo paso no era una opción para respuestas con adjunto.
 *
 * Todo o nada: si un archivo no pasa validación, no se sustituye ninguno y
 * se corta ahí — nunca una publicación a medio adjuntar. Las filas de
 * `comunidad_adjuntos` en sí se crean después, ya con el post/respuesta
 * existiendo (`subirAdjuntosProcesados`) — el id ya está decidido acá, pero
 * el INSERT real tiene que esperar a que exista la fila padre (el FK de
 * `id_post`/`id_respuesta` lo exige).
 */
export async function prepararAdjuntosNuevos(
  contenido: string,
  adjuntosFormData: FormData,
): Promise<{ contenido: string; procesados: AdjuntoNuevoProcesado[] } | { error: string }> {
  let contenidoFinal = contenido;
  const procesados: AdjuntoNuevoProcesado[] = [];

  for (const { token, archivo } of extraerAdjuntosPendientes(adjuntosFormData)) {
    const resultado = await procesarAdjuntoComunidad(archivo);
    if ("error" in resultado) return { error: resultado.error };

    const id = crypto.randomUUID();
    contenidoFinal = contenidoFinal.replaceAll(`[[adjunto:${token}]]`, `[[adjunto:${id}]]`);
    procesados.push({ id, nombreOriginal: archivo.name, adjunto: resultado.adjunto });
  }

  return { contenido: contenidoFinal, procesados };
}

/**
 * Sube y registra cada adjunto ya procesado y con id decidido
 * (`prepararAdjuntosNuevos`) — se llama DESPUÉS de que el post/respuesta ya
 * existe con ESE id en su contenido, para que el FK de `comunidad_adjuntos`
 * apunte a una fila que ya está ahí.
 *
 * Best-effort por archivo, igual que el resto de este módulo: si uno falla
 * acá (Storage caído, por ejemplo), el post ya se publicó con un marcador
 * que apunta a un adjunto que nunca se terminó de crear —
 * `renderizarTextoFormateado` ya lo cubre (sin fila en `comunidad_adjuntos`,
 * el resolver de `ComunidadPostCard`/`ComunidadRespuestaItem` no encuentra
 * nada para ese id y omite la línea, no revienta la publicación entera).
 */
export async function subirAdjuntosProcesados(
  supabase: SupabaseClient,
  procesados: AdjuntoNuevoProcesado[],
  destino: { idPost?: string; idRespuesta?: string; idUsuario: string },
) {
  const objetivoId = destino.idPost ?? destino.idRespuesta;

  for (const item of procesados) {
    const ruta = `${destino.idUsuario}/${objetivoId}/${item.id}.${item.adjunto.extension}`;

    const { error: errorSubida } = await supabase.storage
      .from(BUCKET_ADJUNTOS_COMUNIDAD)
      .upload(ruta, item.adjunto.cuerpo, { contentType: item.adjunto.contentType });
    if (errorSubida) {
      logError("comunidad:adjunto", "no se pudo subir el adjunto", errorSubida, { ruta });
      continue;
    }

    const { error: errorInsert } = await supabase.from("comunidad_adjuntos").insert({
      id: item.id,
      id_post: destino.idPost ?? null,
      id_respuesta: destino.idRespuesta ?? null,
      id_usuario: destino.idUsuario,
      ruta_storage: ruta,
      nombre_original: item.nombreOriginal,
      tipo_archivo: item.adjunto.contentType,
      es_imagen: item.adjunto.esImagen,
      ancho: item.adjunto.ancho,
      alto: item.adjunto.alto,
      tamano_bytes: item.adjunto.cuerpo.byteLength,
    });
    if (errorInsert) {
      logError("comunidad:adjunto", "no se pudo registrar el adjunto", errorInsert, { ruta });
      await supabase.storage.from(BUCKET_ADJUNTOS_COMUNIDAD).remove([ruta]);
    }
  }
}

/** Borra un adjunto ya conocido (storage + fila) — usado tanto al eliminar
 * un post/respuesta completo (src/actions/comunidad/eliminar.ts, todos sus
 * adjuntos) como al editar uno y quitar alguno de los que ya tenía
 * (src/actions/comunidad/editar.ts, solo los que ya no aparecen en el texto
 * nuevo). Best-effort: un fallo acá no debe tumbar la operación principal
 * (borrar el post, guardar la edición), solo queda en el log. */
export async function borrarAdjuntoComunidad(supabase: SupabaseClient, adjuntoId: string, rutaStorage: string) {
  const { error: errorStorage } = await supabase.storage.from(BUCKET_ADJUNTOS_COMUNIDAD).remove([rutaStorage]);
  if (errorStorage) {
    logError("comunidad:adjunto", "no se pudo borrar el archivo del adjunto", errorStorage, { adjuntoId });
  }

  const { error: errorFila } = await supabase.from("comunidad_adjuntos").delete().eq("id", adjuntoId);
  if (errorFila) {
    logError("comunidad:adjunto", "no se pudo borrar la fila del adjunto", errorFila, { adjuntoId });
  }
}
