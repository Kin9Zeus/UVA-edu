import { crearClienteGemini } from "@/lib/gemini/client";
import { pedirConCadenaDeModelos } from "@/lib/examenes/generacion/generar";
import { obtenerTranscripcionDeVideo } from "@/lib/examenes/generacion/transcripciones";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolverContenidoLeccion, type DocumentoContenido } from "@/lib/editor/tipos";
import { logError } from "@/lib/log";
import {
  mensajeContenidoLeccion,
  mensajeDescripcionCurso,
  systemPromptContenidoLeccion,
  systemPromptDescripcionCurso,
  type LeccionParaDescripcion,
} from "./prompt";
import {
  ESQUEMA_CONTENIDO_LECCION,
  ESQUEMA_DESCRIPCION_CURSO,
  contenidoLeccionComoDocumento,
  contenidoLeccionGeneradoSchema,
  descripcionCursoGeneradaSchema,
  textoPlanoDeContenido,
} from "./tipos";

const AREA_LOG = "descripciones-ia";
const SCOPE_LOG = "descripciones-ia";

/**
 * Límite por modelo. El del examen (5 min) está pensado para un trabajo en
 * segundo plano; acá el administrador espera con la pantalla abierta, y un
 * resumen de una clase tarda segundos. Con la cadena de 3 modelos, el peor
 * caso queda en unos 4 minutos y medio.
 */
const TIEMPO_LIMITE_MS = 90_000;

/** Cuánto material de cada lección se manda para la descripción del curso.
 * Con 20 clases, ~30 000 caracteres: suficiente para saber de qué trata cada
 * una sin mandar horas de transcripción para escribir un párrafo. */
const MATERIAL_POR_LECCION = 1_500;

const NIVELES: Record<string, string> = {
  BASICO: "Básico",
  INTERMEDIO: "Intermedio",
  AVANZADO: "Avanzado",
};

/** Error con un mensaje que se le puede mostrar tal cual al administrador. */
export class GeneracionDescripcionError extends Error {}

async function pedirJson(
  mensaje: string,
  systemPrompt: string,
  esquema: object,
  cursoId: string,
): Promise<unknown> {
  const texto = await pedirConCadenaDeModelos(
    crearClienteGemini({ tiempoLimiteMs: TIEMPO_LIMITE_MS }),
    mensaje,
    systemPrompt,
    cursoId,
    { esquema, area: AREA_LOG, scope: SCOPE_LOG },
  );

  try {
    return JSON.parse(texto);
  } catch {
    throw new Error("El modelo no devolvió JSON válido.");
  }
}

function recortar(texto: string, maximo: number): string {
  const limpio = texto.replace(/\s+/g, " ").trim();
  return limpio.length <= maximo ? limpio : `${limpio.slice(0, maximo)}…`;
}

type LeccionDelTemario = {
  id: string;
  titulo: string;
  orden: number;
  contenido: unknown;
  resumen: string | null;
  modulo: string;
  ordenModulo: number;
};

/** Lecciones del curso en el orden del temario (módulo, luego lección).
 * PostgREST no ordena por una columna de la tabla embebida, así que el orden
 * se arma acá, igual que en revisarTranscripcionesCurso(). */
async function leccionesDelCurso(cursoId: string): Promise<LeccionDelTemario[]> {
  const { data, error } = await createAdminClient()
    .from("lecciones")
    .select("id, titulo, orden, contenido, resumen, modulo:modulos!inner(titulo, orden, id_curso)")
    .eq("modulo.id_curso", cursoId);

  if (error) throw new Error(`No se pudieron leer las lecciones del curso: ${error.message}`);

  return (data ?? [])
    .map((leccion) => {
      const modulo = Array.isArray(leccion.modulo) ? leccion.modulo[0] : leccion.modulo;
      return {
        id: leccion.id as string,
        titulo: leccion.titulo as string,
        orden: (leccion.orden as number | undefined) ?? 0,
        contenido: leccion.contenido,
        resumen: leccion.resumen as string | null,
        modulo: (modulo?.titulo as string | undefined) ?? "",
        ordenModulo: (modulo?.orden as number | undefined) ?? 0,
      };
    })
    .sort((a, b) => a.ordenModulo - b.ordenModulo || a.orden - b.orden);
}

/**
 * Propuesta de contenido para una lección: un resumen en prosa, con contexto,
 * a partir de la transcripción de su video. Se le pasan también el módulo y
 * las clases vecinas para que pueda situarla en el curso. No guarda nada.
 */
export async function generarContenidoLeccion(
  leccionId: string,
  cursoId: string,
): Promise<DocumentoContenido> {
  const admin = createAdminClient();

  const [{ data: curso }, lecciones] = await Promise.all([
    admin.from("cursos").select("titulo").eq("id", cursoId).maybeSingle(),
    leccionesDelCurso(cursoId),
  ]);

  const posicion = lecciones.findIndex((leccion) => leccion.id === leccionId);
  if (!curso || posicion === -1) {
    throw new GeneracionDescripcionError("No encontramos la lección.");
  }
  const leccion = lecciones[posicion];

  const transcripcion = await obtenerTranscripcionDeVideo(leccionId);
  if (!transcripcion || transcripcion.trim() === "") {
    throw new GeneracionDescripcionError(
      "Esta lección todavía no tiene transcripción. Aparece unos minutos después de que el video termina de procesarse.",
    );
  }

  const crudo = await pedirJson(
    mensajeContenidoLeccion({
      tituloCurso: curso.titulo as string,
      tituloModulo: leccion.modulo,
      tituloLeccion: leccion.titulo,
      leccionAnterior: lecciones[posicion - 1]?.titulo ?? null,
      leccionSiguiente: lecciones[posicion + 1]?.titulo ?? null,
      transcripcion,
    }),
    systemPromptContenidoLeccion(),
    ESQUEMA_CONTENIDO_LECCION,
    cursoId,
  );

  const parseado = contenidoLeccionGeneradoSchema.safeParse(crudo);
  if (!parseado.success) {
    logError(SCOPE_LOG, "el contenido de lección generado no pasó la validación", null, {
      area: AREA_LOG,
      cursoId,
      leccionId,
      problemas: parseado.error.issues.slice(0, 5).map((issue) => issue.message),
    });
    throw new Error("El modelo no devolvió un contenido con la forma esperada.");
  }

  return contenidoLeccionComoDocumento(parseado.data);
}

/**
 * Propuesta de descripción del curso, a partir del temario y de lo que haya de
 * cada lección: su contenido escrito si lo tiene (ya resumido y revisado por
 * una persona) o, si no, el principio de su transcripción. No guarda nada.
 */
export async function generarDescripcionCurso(cursoId: string): Promise<string> {
  const admin = createAdminClient();

  const { data: curso } = await admin
    .from("cursos")
    .select("titulo, nivel")
    .eq("id", cursoId)
    .maybeSingle();
  if (!curso) throw new GeneracionDescripcionError("No encontramos el curso.");

  const [lecciones, { data: transcripciones }] = await Promise.all([
    leccionesDelCurso(cursoId),
    admin.from("transcripciones_video").select("id_leccion, transcripcion").eq("id_curso", cursoId),
  ]);

  if (lecciones.length === 0) {
    throw new GeneracionDescripcionError(
      "El curso todavía no tiene lecciones. Agrega el temario antes de generar la descripción.",
    );
  }

  const porLeccion = new Map(
    (transcripciones ?? []).map((fila) => [fila.id_leccion as string, fila.transcripcion as string]),
  );

  const ordenadas: LeccionParaDescripcion[] = lecciones.map((leccion) => {
    const contenido = textoPlanoDeContenido(
      resolverContenidoLeccion(leccion.contenido, leccion.resumen),
    );
    const material = contenido || porLeccion.get(leccion.id) || "";
    return {
      modulo: leccion.modulo,
      titulo: leccion.titulo,
      material: material ? recortar(material, MATERIAL_POR_LECCION) : "",
    };
  });

  if (ordenadas.every((leccion) => leccion.material === "")) {
    throw new GeneracionDescripcionError(
      "Ninguna lección tiene todavía contenido ni transcripción. Sube al menos un video y espera a que se procese.",
    );
  }

  const crudo = await pedirJson(
    mensajeDescripcionCurso({
      tituloCurso: curso.titulo as string,
      nivel: NIVELES[curso.nivel as string] ?? (curso.nivel as string),
      lecciones: ordenadas,
    }),
    systemPromptDescripcionCurso(),
    ESQUEMA_DESCRIPCION_CURSO,
    cursoId,
  );

  const parseado = descripcionCursoGeneradaSchema.safeParse(crudo);
  if (!parseado.success) {
    logError(SCOPE_LOG, "la descripción de curso generada no pasó la validación", null, {
      area: AREA_LOG,
      cursoId,
      problemas: parseado.error.issues.slice(0, 5).map((issue) => issue.message),
    });
    throw new Error("El modelo no devolvió una descripción con la forma esperada.");
  }

  return parseado.data.descripcion;
}
