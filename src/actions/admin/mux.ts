"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { mux } from "@/lib/mux/client";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { registrarBitacora } from "@/lib/admin/bitacora";
import { logError } from "@/lib/log";
import type { AdminActionResult } from "@/actions/admin/categorias";

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
    .select("id")
    .eq("id", leccionId)
    .maybeSingle();
  if (!leccion) return { error: "La lección no existe." };

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
    accion: "Inició la subida de un video",
    entidadAfectada: "lecciones",
    idEntidadAfectada: leccionId,
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
