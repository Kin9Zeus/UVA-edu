"use server";

import { after } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { registrarBitacora } from "@/lib/admin/bitacora";
import { logError } from "@/lib/log";
import {
  completarGeneracionExamenCurso,
  obtenerUltimoTrabajoGeneracion,
  reclamarGeneracionExamenCurso,
  type EstadoTrabajoGeneracion,
} from "@/lib/examenes/generacion/trabajo";
import { revisarTranscripcionesCurso } from "@/lib/examenes/generacion/transcripciones";
import { AREA_LOG } from "@/lib/examenes/generacion/generar";
import {
  TOTAL_PREGUNTAS_MAXIMO,
  TOTAL_PREGUNTAS_MINIMO,
} from "@/lib/examenes/generacion/tipos";
import type { AdminActionResult } from "@/actions/admin/categorias";

/**
 * Punto de entrada del botón "Generar / regenerar examen del curso".
 *
 * Es la única costura entre el pipeline de datos y la interfaz: la UI no debe
 * llamar a `generateCourseExam()` ni a `persistirPreguntasGeneradas()` por su
 * cuenta — se saltaría el registro del trabajo, y con él la idempotencia.
 *
 * Server Action y no Route Handler, según CLAUDE.md §3.1: es una mutación
 * interna disparada por un administrador desde el panel, no un webhook.
 */

export type GenerarExamenResultado = AdminActionResult & {
  /** Id del trabajo recién reclamado. La pantalla sondea con él. */
  trabajoId?: string;
  /** Se omitió porque ya había un examen generado o una corrida en curso. */
  omitido?: "ya_generado" | "ya_hay_uno_en_curso";
};

/**
 * Dispara la generación y vuelve enseguida. NO espera al modelo.
 *
 * Una llamada al modelo con las transcripciones de 20 clases tarda minutos, muy
 * por encima de lo que aguanta el proxy: esperarla acá le mostraría un error al
 * administrador mientras la generación sigue corriendo por dentro, y el examen
 * aparecería «solo» un rato después. Por eso el trabajo va en `after()`, que
 * corre con la respuesta ya enviada (Railway mantiene el proceso vivo, así que
 * la continuación llega hasta el final).
 *
 * Lo que SÍ es síncrono es reclamar el turno: cuando esta función responde, la
 * fila PENDIENTE ya existe y el índice parcial único ya bloquea un segundo
 * clic. Diferir también el reclamo dejaría pasar dos corridas simultáneas.
 */
export async function generarExamenDelCurso(
  cursoId: string,
  totalPreguntas: number,
): Promise<GenerarExamenResultado> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  if (
    !Number.isInteger(totalPreguntas) ||
    totalPreguntas < TOTAL_PREGUNTAS_MINIMO ||
    totalPreguntas > TOTAL_PREGUNTAS_MAXIMO
  ) {
    return {
      error: `Elige entre ${TOTAL_PREGUNTAS_MINIMO} y ${TOTAL_PREGUNTAS_MAXIMO} preguntas para el examen.`,
    };
  }

  // ADMIN_MANUAL siempre procede, incluso sobre un examen ya generado: el
  // botón dice "regenerar" y es exactamente lo que la persona pidió.
  const reclamo = await reclamarGeneracionExamenCurso(cursoId, "ADMIN_MANUAL");

  if (reclamo.estado === "omitido") {
    return {
      omitido: reclamo.motivo,
      error:
        reclamo.motivo === "ya_hay_uno_en_curso"
          ? "Ya hay una generación en curso para este curso. Espera a que termine."
          : "Este curso ya tiene un examen generado.",
    };
  }

  if (reclamo.estado === "fallido") {
    return { error: reclamo.mensaje };
  }

  const { trabajoId } = reclamo;
  const idAdmin = admin.adminId;

  // La bitácora se escribe ACÁ, con el disparo, y no al terminar: es la acción
  // administrativa —quién pidió regenerar el examen y cuándo— y tiene que
  // quedar registrada aunque la generación falle después. El resultado vive en
  // `trabajos_generacion_examen`, que es su propia bitácora.
  await registrarBitacora(admin.supabase, {
    idAdmin,
    accion: "GENERAR_EXAMEN_IA",
    entidadAfectada: "trabajos_generacion_examen",
    idEntidadAfectada: trabajoId,
    detalles: `Generación disparada para el curso ${cursoId} (${totalPreguntas} preguntas en total).`,
  });

  after(async () => {
    // `completarGeneracionExamenCurso` nunca lanza y siempre cierra el trabajo;
    // el try es la red de seguridad para lo que ocurra fuera de ella. Un
    // trabajo que se quedara en PENDIENTE convertiría el cerrojo de
    // idempotencia en un candado permanente: ese curso no se podría volver a
    // generar nunca.
    try {
      await completarGeneracionExamenCurso(trabajoId, cursoId, totalPreguntas);
    } catch (error) {
      logError("admin:generacionExamen", "la continuación de la generación se cayó", error, {
        area: AREA_LOG,
        cursoId,
        trabajoId,
      });
    }
  });

  return { success: true, trabajoId };
}

/**
 * Sondeo del panel mientras la pantalla dice «generando».
 *
 * Devuelve el último trabajo del curso, terminado o no — ver el comentario de
 * `obtenerUltimoTrabajoGeneracion`. Cuando el estado deja de ser PENDIENTE, la
 * pantalla corta el sondeo y hace `router.refresh()` para traer las preguntas
 * nuevas.
 */
export async function consultarGeneracionDelCurso(
  cursoId: string,
): Promise<AdminActionResult & { trabajo?: EstadoTrabajoGeneracion | null }> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  return { trabajo: await obtenerUltimoTrabajoGeneracion(cursoId) };
}

export type EstadoTranscripcionesCurso = {
  /** Total de lecciones con video LISTO. */
  totalVideos: number;
  listos: number;
  faltantes: { videoId: string; title: string }[];
  /** ¿Se puede pulsar el botón de generar? */
  puedeGenerar: boolean;
};

/**
 * Estado de las transcripciones de un curso, para que el panel pueda decir
 * "faltan 3 de 12" ANTES de que alguien pulse el botón y se lleve un error.
 *
 * Solo lectura: no registra trabajo ni gasta una llamada al modelo.
 */
export async function obtenerEstadoTranscripciones(
  cursoId: string,
): Promise<AdminActionResult & { estado?: EstadoTranscripcionesCurso }> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  try {
    const { videos, faltantes, totalVideos } = await revisarTranscripcionesCurso(cursoId);
    return {
      estado: {
        totalVideos,
        listos: videos.length,
        faltantes,
        // Un curso sin videos tampoco puede generar: no hay de qué preguntar.
        puedeGenerar: totalVideos > 0 && faltantes.length === 0,
      },
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "No pudimos leer el estado del curso.",
    };
  }
}
