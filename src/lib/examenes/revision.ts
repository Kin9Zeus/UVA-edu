import { calificarPregunta } from "@/lib/examenes/calificar";
import type { DocumentoContenido } from "@/lib/editor/tipos";
import type {
  PreguntaCongelada,
  RespuestaEstudiante,
  RespuestasIntento,
  TipoPreguntaImplementado,
} from "@/lib/examenes/tipos";

/**
 * Reconstrucción de un intento ya cerrado para la revisión del admin —
 * pregunta por pregunta, con lo que el estudiante marcó/escribió, cuál era
 * la respuesta correcta, y si acertó. Es exactamente lo que
 * `ResultadoIntentoVista` (src/lib/examen.ts) le NIEGA al estudiante a
 * propósito (nunca le muestra la respuesta correcta, para no regalarle el
 * siguiente intento) — acá es al revés: el admin necesita ver dónde está
 * fallando para poder ayudarlo, y ya tiene acceso a `preguntas_examen`
 * completa por su rol.
 *
 * Función pura (sin base de datos) para poder probarla sola — la arma
 * `getRevisionIntento` (src/actions/admin/examenes.ts) a partir de la fila
 * de `intentos_examen`.
 */

export type RevisionOpcion = {
  id: string;
  texto: string;
  correcta: boolean;
  marcadaPorEstudiante: boolean;
};

export type RevisionPregunta = {
  id: string;
  tipo: TipoPreguntaImplementado;
  enunciado: DocumentoContenido;
  puntos: number;
  acertada: boolean;
  /** Opciones para los tipos de opción; `null` en RELLENAR_ESPACIO. */
  opciones: RevisionOpcion[] | null;
  /** Lo que escribió el estudiante en RELLENAR_ESPACIO. `null` si no
   * respondió, o si la pregunta no es de ese tipo. */
  respuestaTexto: string | null;
  /** Solo RELLENAR_ESPACIO: las variantes que el admin guardó como válidas. */
  respuestasAceptadas: string[] | null;
};

function idsMarcados(respuesta: RespuestaEstudiante | undefined): Set<string> {
  if (respuesta === undefined) return new Set();
  return new Set(Array.isArray(respuesta) ? respuesta : [respuesta]);
}

export function construirRevision(
  preguntas: PreguntaCongelada[],
  respuestas: RespuestasIntento,
): RevisionPregunta[] {
  return preguntas.map((pregunta) => {
    const respuesta = respuestas[pregunta.id];
    const acertada = calificarPregunta(pregunta, respuesta);

    if (pregunta.tipo === "RELLENAR_ESPACIO") {
      return {
        id: pregunta.id,
        tipo: pregunta.tipo,
        enunciado: pregunta.enunciado,
        puntos: pregunta.puntos,
        acertada,
        opciones: null,
        respuestaTexto: typeof respuesta === "string" && respuesta.trim() !== "" ? respuesta : null,
        respuestasAceptadas: pregunta.respuestasAceptadas,
      };
    }

    const marcadas = idsMarcados(respuesta);
    return {
      id: pregunta.id,
      tipo: pregunta.tipo,
      enunciado: pregunta.enunciado,
      puntos: pregunta.puntos,
      acertada,
      opciones: (pregunta.opciones ?? []).map((opcion) => ({
        id: opcion.id,
        texto: opcion.texto,
        correcta: opcion.correcta,
        marcadaPorEstudiante: marcadas.has(opcion.id),
      })),
      respuestaTexto: null,
      respuestasAceptadas: null,
    };
  });
}
