"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { mux } from "@/lib/mux/client";
import { borrarAssetsEncolados, deshacerEncolado, encolarAssetsParaBorrar } from "@/lib/mux/limpieza";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { registrarBitacora } from "@/lib/admin/bitacora";
import { revalidarCursoAdmin, revalidarCursoPublico } from "@/lib/admin/revalidarCurso";
import { revalidarCatalogoPublico } from "@/lib/cache-catalogo";
import { logError } from "@/lib/log";
import type { AdminActionResult } from "@/actions/admin/categorias";

const idSchema = z.string().uuid();

/**
 * Los campos que dejan una lección "sin video": los mismos valores con los
 * que nace una lección recién creada (`SUBIENDO` sin `id_mux_upload_id` es
 * el estado "todavía no tiene video" que ya entiende el panel).
 * scripts/mux-sincronizar-assets.ts repite estos valores (no puede importar
 * un archivo "use server").
 */
const LECCION_SIN_VIDEO = {
  id_video_mux: null,
  id_mux_asset_id: null,
  id_mux_upload_id: null,
  duracion: null,
  estado_procesamiento: "SUBIENDO",
  error_procesamiento: null,
} as const;

/**
 * Excepción deliberada a `siteUrl()` (src/lib/site-url.ts) — el único sitio
 * del proyecto que sigue armando un origen con el header `Host`, y por eso
 * queda documentado acá en vez de leerse como un descuido.
 *
 * P1-1 (AUDIT-2026-09-04.md) movió a una constante de despliegue los otros
 * seis usos de este mismo patrón, porque todos terminaban en un enlace que
 * alguien recibía por correo o en el QR de un PDF. Este no: es `cors_origin`
 * de un Direct Upload de Mux, o sea el origen desde el que el NAVEGADOR del
 * administrador va a hacer el PUT del archivo. Tiene que coincidir con el
 * host por el que esa persona está navegando, y la app puede ser alcanzable
 * por más de uno a la vez (el `*.up.railway.app` del servicio y el dominio
 * propio) — fijarlo a `NEXT_PUBLIC_SITE_URL` rompería la subida desde el otro.
 *
 * Y no hay nada que ganar cerrándolo: la acción exige `requireAdmin()`, y un
 * `Host` falsificado solo produce un `cors_origin` que no coincide con el
 * origen real del atacante, con lo que su propia subida falla. El header no
 * viaja a ningún tercero ni queda escrito en ningún artefacto.
 */
async function getOrigin() {
  const headersList = await headers();
  const host = headersList.get("host");
  const proto =
    headersList.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export type EstadoProcesamiento = "SUBIENDO" | "PROCESANDO" | "LISTO" | "ERROR";

/**
 * Pide a Mux un Direct Upload nuevo y lo asocia a la lección. Se usa tanto
 * para la primera carga como para reemplazar/reintentar (Flujo 09 y 10,
 * functional-spec.md): cada llamada crea un `id_mux_upload_id` nuevo, nunca
 * reintenta el mismo upload_id de un intento anterior.
 *
 * `id_video_mux` (el playback ID del video anterior, si lo hay) no se toca
 * acá — sigue sirviendo mientras el nuevo procesa, y solo se reemplaza
 * cuando llega video.asset.ready (src/app/api/webhooks/mux/route.ts).
 */
export async function iniciarSubidaVideoLeccion(
  leccionId: string,
  cursoId: string,
): Promise<AdminActionResult & { uploadUrl?: string }> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const [{ data: leccion }, { data: curso }] = await Promise.all([
    admin.supabase.from("lecciones").select("id, titulo, id_mux_asset_id").eq("id", leccionId).maybeSingle(),
    admin.supabase.from("cursos").select("titulo").eq("id", cursoId).maybeSingle(),
  ]);
  if (!leccion) return { error: "La lección no existe." };
  // Si ya había un asset de Mux, esto es un reemplazo (no la primera
  // subida) — la bitácora y el mensaje de auditoría lo distinguen.
  const esReemplazo = leccion.id_mux_asset_id !== null;

  const origin = await getOrigin();

  let upload;
  try {
    upload = await mux.video.uploads.create({
      cors_origin: origin,
      new_asset_settings: {
        // CRÍTICO: nunca "public". Todo el modelo de negocio (suscripción)
        // depende de que solo se pueda reproducir con una URL firmada
        // (CLAUDE.md §3.3, docs/technical-spec.md §5, obtenerTokenReproduccion
        // en src/actions/video/reproduccion.ts).
        playback_policies: ["signed"],
        // Subtítulos autogenerados. Son dos cosas a la vez: accesibilidad para
        // el estudiante, y la MATERIA PRIMA del generador de exámenes con IA
        // (src/lib/examenes/generacion/) — sin esta pista no llega nunca el
        // webhook `video.asset.track.ready` y el curso se queda sin
        // transcripciones con las que generar preguntas.
        //
        // Para un direct upload, este primer input va SIN `url`: el archivo lo
        // aporta la propia subida (ver el comentario de `generated_subtitles`
        // en @mux/mux-node). La generación ocurre DESPUÉS del ingest, así que
        // la pista queda en `preparing` cuando el asset pasa a `ready` — por
        // eso `video.asset.track.ready` llega más tarde y por separado que
        // `video.asset.ready`.
        inputs: [
          {
            generated_subtitles: [{ language_code: "es", name: "Español (automático)" }],
          },
        ],
      },
    });
  } catch (error) {
    logError("admin:mux", "no se pudo crear el direct upload", error, {
      area: "webhook",
      leccionId,
    });
    return { error: "No pudimos conectar con Mux para iniciar la subida." };
  }

  if (!upload.url) {
    logError("admin:mux", "Mux no devolvió url de subida", null, { area: "webhook", leccionId, uploadId: upload.id });
    return { error: "Mux no devolvió una URL de subida." };
  }

  // `id_mux_asset_id` NO se limpia acá: es lo que `video.asset.ready` lee
  // para saber qué asset viejo borrar al confirmar un reemplazo. Antes se
  // ponía en null, así que esa limpieza nunca encontraba nada y cada
  // reemplazo dejaba el video anterior huérfano en Mux ocupando cupo (P2-7,
  // AUDIT-2026-09-22.md).
  const { error } = await admin.supabase
    .from("lecciones")
    .update({
      id_mux_upload_id: upload.id,
      estado_procesamiento: "SUBIENDO",
      error_procesamiento: null,
    })
    .eq("id", leccionId);

  if (error) return { error: "No pudimos registrar la subida en la lección." };

  // `idEntidadAfectada` apunta al CURSO, no a la lección: una lección no
  // tiene pantalla propia en el panel (se edita dentro de la pestaña de
  // contenido del curso), así que enlazar a la lección no llevaría a
  // ningún lado. El nombre del curso y de la lección quedan en `detalles`
  // para que la fila diga de dónde es, en vez de solo "una lección".
  const contexto = `${curso?.titulo ?? "curso desconocido"} — ${leccion.titulo ?? "sin título"}`;
  await registrarBitacora(admin.supabase, {
    idAdmin: admin.adminId,
    accion: esReemplazo ? "Inició el reemplazo del video de una lección" : "Inició la subida del video de una lección",
    entidadAfectada: "lecciones",
    idEntidadAfectada: cursoId,
    detalles: esReemplazo ? `${contexto} (asset anterior: ${leccion.id_mux_asset_id})` : contexto,
  });

  revalidarCursoAdmin();
  return { success: true, uploadUrl: upload.url };
}

export type EstadoProcesamientoResultado = {
  error?: string;
  estadoProcesamiento?: EstadoProcesamiento;
  errorProcesamiento?: string | null;
  duracion?: number | null;
  idVideoMux?: string | null;
};

/**
 * Lectura ligera para el polling del panel admin mientras Mux procesa el
 * video (no hay evento intermedio "processing": el estado real solo cambia
 * al llegar video.asset.ready/errored). Es de solo lectura pero pasa por
 * requireAdmin para no exponer error_procesamiento (puede traer detalle
 * interno del asset) a quien no sea administrador.
 */
export async function obtenerEstadoProcesamientoLeccion(
  leccionId: string,
): Promise<EstadoProcesamientoResultado> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const { data: leccion, error } = await admin.supabase
    .from("lecciones")
    .select("estado_procesamiento, error_procesamiento, duracion, id_video_mux")
    .eq("id", leccionId)
    .maybeSingle();

  if (error || !leccion) return { error: "No pudimos leer el estado de la lección." };

  return {
    estadoProcesamiento: leccion.estado_procesamiento,
    errorProcesamiento: leccion.error_procesamiento,
    duracion: leccion.duracion,
    idVideoMux: leccion.id_video_mux,
  };
}

export type ConteoProgresoResultado = { error?: string; total?: number };

/**
 * Cuántos estudiantes tienen progreso registrado en esta lección — se usa
 * para advertir antes de reemplazar el video ("Reemplazo de video de una
 * lección sin recrearla", requisito de UI). No distingue completada/en
 * curso: cualquier fila en `progreso` implica un segundo de reanudación
 * que el reemplazo va a reiniciar (ver video.asset.ready en
 * src/app/api/webhooks/mux/route.ts).
 */
export async function contarProgresoLeccion(leccionId: string): Promise<ConteoProgresoResultado> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const { count, error } = await admin.supabase
    .from("progreso")
    .select("id", { count: "exact", head: true })
    .eq("id_leccion", leccionId);

  if (error) return { error: "No pudimos comprobar el progreso de los estudiantes." };
  return { total: count ?? 0 };
}

/**
 * "Quitar video" del editor de lecciones (P2-7, AUDIT-2026-09-22.md).
 *
 * Antes no existía: la única salida para liberar un cupo del plan de Mux era
 * borrar el asset desde el panel de Mux, y la lección quedaba en LISTO
 * apuntando a un video inexistente (reproductor que no carga, miniatura
 * rota). Ahora la lección vuelve al estado "sin video" y el asset se borra
 * de Mux en el mismo paso.
 *
 * Orden, para que ningún fallo deje un video vivo en la cola ni un asset
 * huérfano sin registro:
 *   1. encolar el asset en `mux_assets_pendientes_eliminacion`;
 *   2. quitarle el video a la lección — si falla, se deshace el encolado
 *      (el asset sigue en uso);
 *   3. recién entonces borrarlo de Mux. Si eso falla, queda en cola para
 *      `npm run mux:limpiar`; la lección ya está sin video igual.
 *
 * Un upload todavía en curso (sin asset) no se encola: al limpiar
 * `id_mux_upload_id`, el `video.asset.ready` que llegue después no encuentra
 * lección y el webhook borra ese asset huérfano.
 *
 * Como en un reemplazo, el segundo de reanudación de los estudiantes vuelve a
 * 0 y la marca de completada se conserva. La transcripción se borra: describe
 * un video que ya no existe, y el generador de exámenes la usaría.
 */
export async function quitarVideoLeccion(leccionId: string, cursoId: string): Promise<AdminActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };
  if (!idSchema.safeParse(leccionId).success || !idSchema.safeParse(cursoId).success) {
    return { error: "Lección inválida." };
  }

  const [{ data: leccion }, { data: curso }] = await Promise.all([
    admin.supabase
      .from("lecciones")
      .select("id, titulo, id_mux_asset_id, id_mux_upload_id")
      .eq("id", leccionId)
      .maybeSingle(),
    admin.supabase.from("cursos").select("titulo").eq("id", cursoId).maybeSingle(),
  ]);
  if (!leccion) return { error: "La lección no existe." };
  if (!leccion.id_mux_asset_id && !leccion.id_mux_upload_id) {
    return { error: "Esta lección no tiene video." };
  }

  const servicio = createAdminClient();
  const assets = leccion.id_mux_asset_id ? [{ idLeccion: leccionId, idAsset: leccion.id_mux_asset_id }] : [];
  const idsCola = await encolarAssetsParaBorrar(servicio, assets);
  if (!idsCola) return { error: "No pudimos preparar el borrado del video. Intenta de nuevo." };

  const { error } = await admin.supabase.from("lecciones").update(LECCION_SIN_VIDEO).eq("id", leccionId);
  if (error) {
    await deshacerEncolado(servicio, idsCola);
    return { error: "No pudimos quitar el video de la lección." };
  }

  // Service Role: son filas de otros usuarios, y el admin no tiene policy
  // de escritura sobre `progreso` ni sobre `transcripciones_video`.
  await Promise.all([
    servicio.from("progreso").update({ segundo_actual: 0 }).eq("id_leccion", leccionId),
    servicio.from("transcripciones_video").delete().eq("id_leccion", leccionId),
  ]);

  await borrarAssetsEncolados(servicio, assets, idsCola);

  await registrarBitacora(admin.supabase, {
    idAdmin: admin.adminId,
    accion: "Quitó el video de una lección",
    entidadAfectada: "lecciones",
    idEntidadAfectada: cursoId,
    detalles: `${curso?.titulo ?? "curso desconocido"} — ${leccion.titulo ?? "sin título"}${
      leccion.id_mux_asset_id ? ` (asset: ${leccion.id_mux_asset_id})` : " (subida en curso)"
    }`,
  });

  revalidarCursoAdmin();
  revalidarCursoPublico();
  revalidarCatalogoPublico();
  return { success: true };
}
