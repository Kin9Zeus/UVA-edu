import { createAdminClient } from "@/lib/supabase/admin";
import type { DocumentoContenido } from "@/lib/editor/tipos";
import type { OpcionPregunta, ParEmparejar } from "@/lib/examenes/tipos";
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
 * Convierte `options` + los índices correctos a la forma que guarda el CMS.
 * Sirve tanto para OPCION_UNICA (un solo índice) como para OPCION_MULTIPLE
 * (varios): al CMS le da igual cuántas `OpcionPregunta.correcta` haya en la
 * lista, es `preguntaEntradaSchema` quien decide qué combinación es válida
 * para cada `tipo` — acá solo se traduce la forma.
 *
 * Los ids se generan acá con `crypto.randomUUID()`, igual que cuando un
 * administrador crea una opción a mano: son lo que el estudiante manda como
 * respuesta y lo que se congela en el intento, así que tienen que ser estables
 * dentro de la pregunta y no derivados del texto (editar el texto de una
 * opción no puede cambiar su identidad).
 */
export function aOpcionesPregunta(
  options: string[],
  correctAnswerIndices: number[],
): OpcionPregunta[] {
  const correctas = new Set(correctAnswerIndices);
  return options.map((texto, indice) => ({
    id: crypto.randomUUID(),
    texto: texto.trim(),
    correcta: correctas.has(indice),
  }));
}

/**
 * VERDADERO_FALSO no llega con `options` del modelo (ver
 * `preguntaVerdaderoFalsoSchema`): solo con la afirmación y si es cierta. Las
 * dos opciones fijas ("Verdadero" / "Falso") nacen acá, en el mismo formato
 * que si un administrador las hubiera escrito a mano — es lo que
 * `preguntaEntradaSchema` exige para este tipo (exactamente dos opciones, una
 * correcta).
 */
export function aOpcionesVerdaderoFalso(correctAnswer: boolean): OpcionPregunta[] {
  return [
    { id: crypto.randomUUID(), texto: "Verdadero", correcta: correctAnswer },
    { id: crypto.randomUUID(), texto: "Falso", correcta: !correctAnswer },
  ];
}

/**
 * Convierte los `pairs` del modelo (`{ left, right }`, sin identidad) a
 * `ParEmparejar[]` (con `id` — ver el comentario de `ParEmparejar` en
 * src/lib/examenes/tipos.ts sobre por qué ese id nunca puede filtrarse al
 * estudiante como el id del elemento de la derecha).
 */
export function aParesEmparejar(pairs: { left: string; right: string }[]): ParEmparejar[] {
  return pairs.map(({ left, right }) => ({
    id: crypto.randomUUID(),
    izquierda: left.trim(),
    derecha: right.trim(),
  }));
}

/**
 * La fila que se inserta en `preguntas_examen`, ya traducida al `tipo` de
 * cada pregunta.
 *
 * Existe como función aparte —en vez de un `.map` con un `switch` inline—
 * porque cada rama toca una columna distinta (`opciones` o
 * `respuestas_aceptadas`) y mezclarlas en un solo objeto grande invitaría a
 * dejar la otra con el valor por defecto equivocado para ese tipo.
 */
function aFilaPregunta(
  pregunta: PreguntaValidada,
  examenId: string,
  orden: number,
): {
  id_examen: string;
  tipo: PreguntaValidada["tipo"];
  enunciado: unknown;
  puntos: number;
  orden: number;
  opciones: OpcionPregunta[] | ParEmparejar[] | null;
  respuestas_aceptadas: string[];
  id_leccion_origen: string;
  fragmento_origen: string;
  validada: true;
} {
  const base = {
    id_examen: examenId,
    enunciado: textoADocumento(pregunta.question) as never,
    puntos: 1,
    orden,
    id_leccion_origen: pregunta.videoId,
    fragmento_origen: pregunta.sourceFragment,
    validada: true as const,
  };

  switch (pregunta.tipo) {
    case "OPCION_UNICA":
      return {
        ...base,
        tipo: "OPCION_UNICA",
        opciones: aOpcionesPregunta(pregunta.options, [pregunta.correctAnswerIndex]),
        respuestas_aceptadas: [],
      };
    case "OPCION_MULTIPLE":
      return {
        ...base,
        tipo: "OPCION_MULTIPLE",
        opciones: aOpcionesPregunta(pregunta.options, pregunta.correctAnswerIndices),
        respuestas_aceptadas: [],
      };
    case "VERDADERO_FALSO":
      return {
        ...base,
        tipo: "VERDADERO_FALSO",
        opciones: aOpcionesVerdaderoFalso(pregunta.correctAnswer),
        respuestas_aceptadas: [],
      };
    case "RELLENAR_ESPACIO":
      return {
        ...base,
        tipo: "RELLENAR_ESPACIO",
        opciones: null,
        respuestas_aceptadas: pregunta.acceptedAnswers,
      };
    case "EMPAREJAR":
      return {
        ...base,
        tipo: "EMPAREJAR",
        opciones: aParesEmparejar(pregunta.pairs),
        respuestas_aceptadas: [],
      };
  }
}

/**
 * Escribe en la base las preguntas ya validadas.
 *
 * Solo llegan acá las que superaron `validateFragment`: guardar una pregunta
 * sin validar sería guardar una pregunta que quizá inventa contenido, en una
 * tabla que decide quién obtiene certificado.
 *
 * Cada pregunta se guarda con el `tipo` que el modelo eligió — uno de los
 * cinco de `TIPOS_GENERABLES` (los mismos que el CMS sabe calificar sola,
 * `TIPOS_IMPLEMENTADOS`) — traducido a la forma del CMS por `aFilaPregunta()`.
 * No hay un tipo por defecto: `preguntaGeneradaSchema` ya rechazó cualquier
 * pregunta sin uno de los cinco válidos antes de llegar acá.
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
  const filas = preguntas.map((pregunta, indice) =>
    aFilaPregunta(pregunta, examenId, (indice + 1) * ESPACIO_ORDEN),
  );

  const { error: errorInsercion } = await admin.from("preguntas_examen").insert(filas as never);

  if (errorInsercion) {
    throw new Error(`No se pudieron guardar las preguntas generadas: ${errorInsercion.message}`);
  }

  return { examenId, guardadas: filas.length };
}
