import { createAdminClient } from "@/lib/supabase/admin";
import type { DocumentoContenido } from "@/lib/editor/tipos";
import type { OpcionPregunta } from "@/lib/examenes/tipos";
import { ESPACIO_ORDEN } from "@/lib/orden";
import type { PreguntaValidada } from "./validar";

/**
 * Envuelve texto plano en el documento Tiptap mínimo que
 * `contenidoLeccionSchema` acepta (src/lib/editor/tipos.ts).
 *
 * El modelo devuelve `question` como texto plano a propósito —pedirle JSON de
 * ProseMirror es superficie extra para que se equivoque— y `preguntas_examen`
 * guarda `enunciado` como documento enriquecido. Esta es la traducción, y es
 * el único sitio donde ocurre.
 *
 * Un párrafo sin `content` es el documento vacío válido; un `text` con string
 * vacío NO lo es (Tiptap lo rechaza al cargar). De ahí la rama.
 */
export function textoADocumento(texto: string): DocumentoContenido {
  const limpio = texto.trim();
  return {
    type: "doc",
    content: [
      limpio === ""
        ? { type: "paragraph" }
        : { type: "paragraph", content: [{ type: "text", text: limpio }] },
    ],
  };
}

/**
 * Convierte `options` + `correctAnswerIndex` a la forma que guarda el CMS.
 *
 * Los ids se generan acá con `crypto.randomUUID()`, igual que cuando un
 * administrador crea una opción a mano: son lo que el estudiante manda como
 * respuesta y lo que se congela en el intento, así que tienen que ser estables
 * dentro de la pregunta y no derivados del texto (editar el texto de una
 * opción no puede cambiar su identidad).
 */
export function aOpcionesPregunta(
  options: string[],
  correctAnswerIndex: number,
): OpcionPregunta[] {
  return options.map((texto, indice) => ({
    id: crypto.randomUUID(),
    texto: texto.trim(),
    correcta: indice === correctAnswerIndex,
  }));
}

/**
 * Escribe en la base las preguntas ya validadas.
 *
 * Solo llegan acá las que superaron `validateFragment`: guardar una pregunta
 * sin validar sería guardar una pregunta que quizá inventa contenido, en una
 * tabla que decide quién obtiene certificado.
 *
 * Todas se guardan como OPCION_UNICA: es lo que produce el prompt (4 opciones,
 * una correcta) y es uno de los cuatro tipos que la v1 califica sola
 * (`TIPOS_IMPLEMENTADOS`). El resto de tipos se siguen creando a mano desde el
 * CMS.
 *
 * El examen queda con `publicado = false` — siempre, incluso al regenerar uno
 * que ya estaba publicado. Un examen generado por un modelo no se le pone
 * delante a un estudiante sin que un humano lo lea: mientras esté en borrador
 * no existe para nadie y no bloquea ninguna certificación (ver el comentario
 * de `Examenes.publicado` en el schema).
 */
export async function persistirPreguntasGeneradas(
  courseId: string,
  preguntas: PreguntaValidada[],
): Promise<{ examenId: string; guardadas: number }> {
  const admin = createAdminClient();

  const { data: curso, error: errorCurso } = await admin
    .from("cursos")
    .select("titulo")
    .eq("id", courseId)
    .single();

  if (errorCurso || !curso) {
    throw new Error(`No se pudo leer el curso ${courseId}: ${errorCurso?.message ?? "no existe"}`);
  }

  // `examenes.id_curso` es UNIQUE: el upsert sobre esa columna crea el examen
  // la primera vez y lo reutiliza al regenerar, sin carrera entre dos
  // corridas. No se tocan `titulo`, `nota_aprobatoria`, `intentos_maximos` ni
  // los demás ajustes si la fila ya existe — son decisiones del administrador
  // y regenerar preguntas no es motivo para pisarlas.
  const { data: existente } = await admin
    .from("examenes")
    .select("id")
    .eq("id_curso", courseId)
    .maybeSingle();

  let examenId: string;

  if (existente) {
    examenId = existente.id;
    const { error } = await admin
      .from("examenes")
      .update({ publicado: false })
      .eq("id", examenId);
    if (error) {
      throw new Error(`No se pudo despublicar el examen para regenerarlo: ${error.message}`);
    }
  } else {
    const { data: creado, error } = await admin
      .from("examenes")
      .insert({
        id_curso: courseId,
        titulo: `Examen final — ${curso.titulo}`,
        publicado: false,
      })
      .select("id")
      .single();

    if (error || !creado) {
      throw new Error(`No se pudo crear el examen del curso: ${error?.message ?? "sin fila"}`);
    }
    examenId = creado.id;
  }

  // Se borran SOLO las preguntas generadas por el pipeline (las que tienen
  // `id_leccion_origen`). Las que un administrador escribió a mano tienen esa
  // columna en null y sobreviven a una regeneración: regenerar es rehacer lo
  // que hizo el modelo, no borrar el trabajo de una persona.
  const { error: errorBorrado } = await admin
    .from("preguntas_examen")
    .delete()
    .eq("id_examen", examenId)
    .not("id_leccion_origen", "is", null);

  if (errorBorrado) {
    throw new Error(`No se pudieron limpiar las preguntas generadas anteriores: ${errorBorrado.message}`);
  }

  if (preguntas.length === 0) {
    return { examenId, guardadas: 0 };
  }

  // `orden` fraccionado con el mismo espaciado que usa el drag & drop del CMS
  // (src/lib/orden.ts), para que reordenar a mano después no obligue a
  // reespaciar toda la lista de entrada.
  const filas = preguntas.map((pregunta, indice) => ({
    id_examen: examenId,
    tipo: "OPCION_UNICA" as const,
    enunciado: textoADocumento(pregunta.question) as never,
    puntos: 1,
    orden: (indice + 1) * ESPACIO_ORDEN,
    opciones: aOpcionesPregunta(pregunta.options, pregunta.correctAnswerIndex) as never,
    respuestas_aceptadas: [],
    id_leccion_origen: pregunta.videoId,
    fragmento_origen: pregunta.sourceFragment,
    validada: true,
  }));

  const { error: errorInsercion } = await admin.from("preguntas_examen").insert(filas);

  if (errorInsercion) {
    throw new Error(`No se pudieron guardar las preguntas generadas: ${errorInsercion.message}`);
  }

  return { examenId, guardadas: filas.length };
}
