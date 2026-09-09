import { createAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/log";
import { AREA_LOG, generateCourseExam } from "./generar";
import { persistirPreguntasGeneradas } from "./persistir";
import { obtenerVideosConTranscripcion } from "./transcripciones";
import { validarPreguntasGeneradas } from "./validar";
import {
  CursoSinVideosError,
  TranscripcionesFaltantesError,
  type DisparadorGeneracion,
} from "./tipos";

const SCOPE_LOG = "examenes:generacion";

export type ResultadoGeneracionCurso =
  | {
      estado: "completado";
      trabajoId: string;
      examenId: string;
      preguntasGuardadas: number;
      videosSinPreguntas: { videoId: string; title: string }[];
    }
  /** No había nada que hacer. No es un fallo: es la idempotencia funcionando. */
  | { estado: "omitido"; motivo: "ya_generado" | "ya_hay_uno_en_curso" }
  | {
      estado: "fallido";
      trabajoId: string | null;
      mensaje: string;
      /** Solo cuando el fallo es "faltan transcripciones": qué videos. */
      videosFaltantes?: { videoId: string; title: string }[];
    };

/**
 * ¿Hace falta generar el examen de este curso?
 *
 * Es la mitad "de producto" de la idempotencia. La otra mitad —que no corran
 * dos generaciones a la vez— la impone la base con el índice parcial único
 * `trabajos_generacion_examen_uno_pendiente`, porque dos clics simultáneos son
 * dos procesos que no se ven entre sí y ninguna comprobación en TypeScript los
 * puede coordinar.
 *
 * La regla:
 *
 *   ADMIN_MANUAL    siempre procede. El botón dice "generar/regenerar" y el
 *                   administrador ya sabe lo que hay; negarse porque el examen
 *                   existe convertiría el botón en un adorno justo cuando más
 *                   se necesita (el examen anterior salió mal).
 *   VIDEO_AGREGADO  se retira si el curso ya tiene preguntas generadas y
 *                   validadas. Regenerar por cada video que se sube gastaría
 *                   una llamada al modelo por clase y —peor— tiraría un examen
 *                   que un administrador ya revisó.
 *
 * Lo que esta función NO decide: el webhook de video. `video.asset.track.ready`
 * guarda la transcripción y sale; nunca llama acá.
 */
export async function puedeGenerarExamenCurso(
  courseId: string,
  disparadoPor: DisparadorGeneracion,
): Promise<{ procede: true } | { procede: false; motivo: "ya_generado" }> {
  if (disparadoPor === "ADMIN_MANUAL") {
    return { procede: true };
  }

  const admin = createAdminClient();

  // "Ya generado y validado" = existe al menos una pregunta con procedencia y
  // validada. Se mira `preguntas_examen` y no el estado del último trabajo a
  // propósito: un trabajo COMPLETADO que guardó cero preguntas no es un examen
  // generado, y el estado del trabajo no lo distingue.
  const { data: examen } = await admin
    .from("examenes")
    .select("id")
    .eq("id_curso", courseId)
    .maybeSingle();

  if (!examen) return { procede: true };

  const { count } = await admin
    .from("preguntas_examen")
    .select("id", { count: "exact", head: true })
    .eq("id_examen", examen.id)
    .eq("validada", true);

  return (count ?? 0) > 0 ? { procede: false, motivo: "ya_generado" } : { procede: true };
}

/**
 * Reclama el turno: inserta el trabajo en PENDIENTE ANTES de llamar al modelo.
 *
 * Insertar primero y trabajar después es lo que hace que el índice parcial
 * único sirva de cerrojo. Al revés —trabajar y registrar al final— las dos
 * corridas simultáneas terminarían las dos y la segunda pisaría a la primera.
 */
async function crearTrabajoGeneracion(
  courseId: string,
  disparadoPor: DisparadorGeneracion,
): Promise<{ trabajoId: string } | { ocupado: true } | { error: string }> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("trabajos_generacion_examen")
    .insert({ id_curso: courseId, disparado_por: disparadoPor })
    .select("id")
    .single();

  if (error) {
    // 23505 = unique_violation contra `trabajos_generacion_examen_uno_pendiente`:
    // ya hay una corrida PENDIENTE para este curso. No es un error que reportar,
    // es la respuesta correcta — igual que el 23505 de `registrarEvento()`.
    if (error.code === "23505") return { ocupado: true };
    return { error: error.message };
  }

  return { trabajoId: data.id };
}

async function cerrarTrabajo(
  trabajoId: string,
  campos: Record<string, unknown>,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("trabajos_generacion_examen")
    .update({ ...campos, finalizado_en: new Date().toISOString() })
    .eq("id", trabajoId);

  if (error) {
    // No se propaga: el trabajo de verdad (generar y guardar) ya terminó, y
    // tumbar la respuesta por no poder cerrar la bitácora sería peor. El coste
    // real es que la fila se queda en PENDIENTE y bloquea la siguiente corrida
    // hasta que alguien la cierre a mano — por eso se registra.
    logError(SCOPE_LOG, "no se pudo cerrar el trabajo de generación", error, {
      area: AREA_LOG,
      trabajoId,
    });
  }
}

export type ResultadoReclamo =
  | { estado: "reclamado"; trabajoId: string }
  | { estado: "omitido"; motivo: "ya_generado" | "ya_hay_uno_en_curso" }
  | { estado: "fallido"; mensaje: string };

/**
 * Primera mitad del pipeline: comprobar el permiso y RECLAMAR el turno.
 *
 * Separada de la segunda porque la generación tarda minutos y el Server Action
 * que la dispara no puede esperar tanto (el proxy corta la respuesta mucho
 * antes). El flujo real es: esta función responde en milisegundos con el
 * `trabajoId`, y `completarGeneracionExamenCurso()` corre después dentro de
 * `after()` de next/server.
 *
 * Que el reclamo sea síncrono es lo que hace honesta la respuesta al
 * administrador: cuando la pantalla dice «generando», la fila PENDIENTE ya
 * existe en la base y el índice parcial único ya está bloqueando cualquier
 * segunda corrida. Si el reclamo también fuera diferido, dos clics seguidos
 * pasarían los dos.
 */
export async function reclamarGeneracionExamenCurso(
  courseId: string,
  disparadoPor: DisparadorGeneracion,
): Promise<ResultadoReclamo> {
  const permiso = await puedeGenerarExamenCurso(courseId, disparadoPor);
  if (!permiso.procede) {
    return { estado: "omitido", motivo: permiso.motivo };
  }

  const turno = await crearTrabajoGeneracion(courseId, disparadoPor);

  if ("ocupado" in turno) {
    return { estado: "omitido", motivo: "ya_hay_uno_en_curso" };
  }
  if ("error" in turno) {
    logError(SCOPE_LOG, "no se pudo registrar el trabajo de generación", null, {
      area: AREA_LOG,
      courseId,
      mensaje: turno.error,
    });
    return { estado: "fallido", mensaje: turno.error };
  }

  return { estado: "reclamado", trabajoId: turno.trabajoId };
}

/**
 * Segunda mitad: el trabajo caro. Asume que el turno YA está reclamado.
 *
 * Pensada para correr dentro de `after()`, es decir con la respuesta HTTP ya
 * enviada y sin nadie escuchando: por eso nunca lanza y siempre cierra el
 * trabajo. Una excepción escapando de acá dejaría la fila en PENDIENTE para
 * siempre y el curso no podría volver a generarse nunca — el índice parcial
 * único, que es la defensa contra corridas dobles, se convertiría en un
 * candado permanente.
 */
export async function completarGeneracionExamenCurso(
  trabajoId: string,
  courseId: string,
  questionsPerVideo: number,
): Promise<ResultadoGeneracionCurso> {
  try {
    // Se leen las transcripciones dos veces —acá y dentro de
    // generateCourseExam— y es a propósito: esa función es el contrato público
    // pedido (`courseId`, `questionsPerVideo`) y tiene que poder llamarse sola.
    // La segunda lectura es una consulta indexada por `id_curso` contra una
    // tabla que se escribe una vez por video; el precio es despreciable frente
    // a enredar la firma para ahorrarla.
    const videos = await obtenerVideosConTranscripcion(courseId);
    const generadas = await generateCourseExam(courseId, questionsPerVideo);

    const { validadas, videosSinPreguntas, descartadas } = validarPreguntasGeneradas(
      generadas,
      videos,
      courseId,
    );

    const { examenId, guardadas } = await persistirPreguntasGeneradas(courseId, validadas);

    await cerrarTrabajo(trabajoId, {
      estado: "COMPLETADO",
      preguntas_recibidas: generadas.length,
      preguntas_validadas: guardadas,
      videos_sin_preguntas: videosSinPreguntas.map((video) => video.videoId),
    });

    if (descartadas > 0) {
      logError(SCOPE_LOG, "preguntas descartadas por fragmento no validado", null, {
        area: AREA_LOG,
        courseId,
        descartadas,
        recibidas: generadas.length,
      });
    }

    return {
      estado: "completado",
      trabajoId,
      examenId,
      preguntasGuardadas: guardadas,
      videosSinPreguntas,
    };
  } catch (error) {
    const mensaje =
      error instanceof Error ? error.message : "Error desconocido al generar el examen.";

    await cerrarTrabajo(trabajoId, { estado: "FALLIDO", error: mensaje });

    // Faltar transcripciones es el estado normal de un curso al que se le acaba
    // de subir un video: no es un fallo del sistema y no merece llegar a
    // Sentry. Se devuelve la lista para que la interfaz diga qué falta.
    if (error instanceof TranscripcionesFaltantesError) {
      return {
        estado: "fallido",
        trabajoId,
        mensaje,
        videosFaltantes: error.videosFaltantes,
      };
    }

    if (error instanceof CursoSinVideosError) {
      return { estado: "fallido", trabajoId, mensaje };
    }

    logError(SCOPE_LOG, "falló la generación del examen del curso", error, {
      area: AREA_LOG,
      courseId,
      trabajoId,
    });

    return { estado: "fallido", trabajoId, mensaje };
  }
}

/**
 * Las dos mitades seguidas, esperando el resultado.
 *
 * NO la use el Server Action del panel: espera los minutos que tarda el modelo
 * y el proxy corta la respuesta antes. Existe para los llamadores que sí pueden
 * esperar —un script de `scripts/`, una prueba de integración, un cron— y para
 * que el pipeline completo siga teniendo un único punto de entrada legible.
 */
export async function ejecutarGeneracionExamenCurso(
  courseId: string,
  questionsPerVideo: number,
  disparadoPor: DisparadorGeneracion,
): Promise<ResultadoGeneracionCurso> {
  const reclamo = await reclamarGeneracionExamenCurso(courseId, disparadoPor);

  if (reclamo.estado === "omitido") {
    return { estado: "omitido", motivo: reclamo.motivo };
  }
  if (reclamo.estado === "fallido") {
    return { estado: "fallido", trabajoId: null, mensaje: reclamo.mensaje };
  }

  return completarGeneracionExamenCurso(reclamo.trabajoId, courseId, questionsPerVideo);
}

export type EstadoTrabajoGeneracion = {
  trabajoId: string;
  estado: "PENDIENTE" | "COMPLETADO" | "FALLIDO";
  preguntasValidadas: number;
  preguntasRecibidas: number;
  videosSinPreguntas: string[];
  error: string | null;
  creadoEn: string;
  finalizadoEn: string | null;
};

/**
 * Último trabajo de generación de un curso — lo que sondea la pantalla mientras
 * dice «generando».
 *
 * Devuelve el más reciente por `creado_en` y no el PENDIENTE: cuando la corrida
 * termina ya no hay ninguno pendiente, y el sondeo tiene que poder ver el
 * resultado (COMPLETADO con sus cifras, o FALLIDO con su mensaje) en la misma
 * consulta con la que venía preguntando. Filtrar por PENDIENTE haría que la
 * última vuelta del sondeo no encontrara nada y la pantalla no supiera si el
 * trabajo salió bien o se perdió.
 */
export async function obtenerUltimoTrabajoGeneracion(
  courseId: string,
): Promise<EstadoTrabajoGeneracion | null> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("trabajos_generacion_examen")
    .select(
      "id, estado, preguntas_validadas, preguntas_recibidas, videos_sin_preguntas, error, creado_en, finalizado_en",
    )
    .eq("id_curso", courseId)
    .order("creado_en", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  return {
    trabajoId: data.id,
    estado: data.estado,
    preguntasValidadas: data.preguntas_validadas,
    preguntasRecibidas: data.preguntas_recibidas,
    videosSinPreguntas: data.videos_sin_preguntas ?? [],
    error: data.error,
    creadoEn: data.creado_en,
    finalizadoEn: data.finalizado_en,
  };
}
