"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { mux } from "@/lib/mux/client";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { registrarBitacora } from "@/lib/admin/bitacora";
import { logError } from "@/lib/log";
import type { AdminActionResult } from "@/actions/admin/categorias";

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

  const { data: leccion } = await admin.supabase
    .from("lecciones")
    .select("id, id_mux_asset_id")
    .eq("id", leccionId)
    .maybeSingle();
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

  const { error } = await admin.supabase
    .from("lecciones")
    .update({
      id_mux_upload_id: upload.id,
      id_mux_asset_id: null,
      estado_procesamiento: "SUBIENDO",
      error_procesamiento: null,
    })
    .eq("id", leccionId);

  if (error) return { error: "No pudimos registrar la subida en la lección." };

  await registrarBitacora(admin.supabase, {
    idAdmin: admin.adminId,
    accion: esReemplazo ? "Inició el reemplazo del video de una lección" : "Inició la subida del video de una lección",
    entidadAfectada: "lecciones",
    idEntidadAfectada: leccionId,
    detalles: esReemplazo ? `Asset de Mux anterior: ${leccion.id_mux_asset_id}` : undefined,
  });

  revalidatePath(`/admin/cursos/${cursoId}`);
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
