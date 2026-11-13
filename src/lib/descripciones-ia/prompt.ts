import { OBJETIVOS_MAXIMO, OBJETIVOS_MINIMO } from "./tipos";

/**
 * Prompts de las descripciones con IA. Agnósticos del proveedor, igual que el
 * del examen (src/lib/examenes/generacion/prompt.ts).
 */

const REGLAS_COMUNES = `
- Usa solo lo que aparece en el material que recibes. No inventes programas, valores, atajos, pasos ni resultados que no se mencionen.
- Las transcripciones son automáticas: corrige errores evidentes del reconocimiento de voz en nombres de programas y términos técnicos (por ejemplo, "b ray" → "V-Ray") solo cuando el contexto no deja dudas.
- Español neutro, tono claro y profesional, dirigido al estudiante. Sin frases publicitarias vacías ("increíble", "el mejor curso", "lleva tus habilidades al siguiente nivel").
- Texto plano: sin markdown, sin asteriscos, sin emojis.
- No hables del material en sí: nada de "la transcripción", "el instructor dice" ni "según el video".`.trim();

export function systemPromptContenidoLeccion(): string {
  return `Eres el editor de contenidos de UVA, una escuela en línea de arquitectura y construcción. Recibes la transcripción de una clase en video y escribes el texto que el estudiante lee junto al video, para saber qué va a ver o para repasarla.

Devuelve cuatro campos. La interfaz les pone los títulos; tú escribes solo el contenido:

- introduccion: uno o dos enunciados que digan de qué trata la clase y por qué importa en la práctica. Puede empezar con "En esta clase entenderás…", "En esta clase verás…" o similar.
  Ejemplo: En esta clase entenderás cómo se arma la tabla del presupuesto ítem por ítem, y por qué la forma en que mides y cobras cada actividad puede hacer la diferencia entre un proyecto controlable y uno imposible de rastrear.

- queVasAAprender: un párrafo con los conceptos, técnicas y criterios CONCRETOS que se explican, nombrándolos (si la clase enumera partes, columnas, pasos o parámetros, nómbralos). Usa "Verás…", "Entenderás…", "También aprenderás…".
  Ejemplo: Verás las columnas que componen un ítem de presupuesto (número, descripción, unidad de medida, cantidad, valor unitario y valor parcial) y entenderás la estructura completa que separa los costos directos de los costos indirectos. También aprenderás por qué cobrar "por global" es una mala práctica que impide medir avances reales.

- organizacion: uno o dos enunciados, en impersonal, sobre cómo se desarrolla la sesión: si se analiza un caso real, se hace un ejercicio paso a paso, se compara con errores comunes, etc.
  Ejemplo: Se analiza la estructura de un presupuesto real de un contrato ejecutado, explicando cada columna y cada sección, y se contrasta con errores comunes de quienes elaboran presupuestos sin experiencia.

- objetivos: entre ${OBJETIVOS_MINIMO} y ${OBJETIVOS_MAXIMO} cosas que el estudiante podrá hacer al terminar. Cada una empieza con un verbo en infinitivo (Estructurar, Diferenciar, Evitar, Reconocer, Configurar…) y es específica de esta clase.
  Ejemplo: Evitar cobrar actividades como "global" y en su lugar definir unidades de medida que permitan medir el avance real de obra

Los ejemplos muestran el tono y el nivel de detalle, no el tema: escribe sobre lo que dice ESTA transcripción.

Reglas:
${REGLAS_COMUNES}
- Nada de markdown ni viñetas dentro de los campos.`;
}

export function mensajeContenidoLeccion(datos: {
  tituloCurso: string;
  tituloModulo: string;
  tituloLeccion: string;
  leccionAnterior: string | null;
  leccionSiguiente: string | null;
  transcripcion: string;
}): string {
  const contexto = [
    `Curso: ${datos.tituloCurso}`,
    `Módulo: ${datos.tituloModulo}`,
    `Clase: ${datos.tituloLeccion}`,
    datos.leccionAnterior && `Clase anterior: ${datos.leccionAnterior}`,
    datos.leccionSiguiente && `Clase siguiente: ${datos.leccionSiguiente}`,
  ]
    .filter(Boolean)
    .join("\n");

  return `${contexto}

Transcripción de la clase:
"""
${datos.transcripcion}
"""`;
}

/** Largo máximo de la primera frase: es la que muestran Google y las tarjetas
 * al compartir (ver recortarDescripcion en lib/seo/descripciones.ts). */
export const PRIMERA_FRASE_MAXIMO = 150;

export function systemPromptDescripcionCurso(): string {
  return `Eres el editor de contenidos de UVA, una escuela en línea de arquitectura y construcción. Escribes la descripción de un curso. El mismo texto se usa en cuatro lugares, y por eso tiene reglas precisas:
1. La página del curso, completo.
2. El catálogo, recortado a dos líneas.
3. Google y las tarjetas al compartir el enlace, que muestran solo los primeros ${PRIMERA_FRASE_MAXIMO} caracteres.
4. Los asistentes de IA (ChatGPT, Gemini, Perplexity), que leen el texto completo y citan frases sueltas cuando alguien pregunta dónde aprender algo.

Devuelve descripcion: un solo párrafo de entre 60 y 100 palabras.

La primera frase es la más importante:
- Máximo ${PRIMERA_FRASE_MAXIMO} caracteres. Tiene que entenderse sola, sin el resto del párrafo.
- Empieza por lo que se aprende, con el nombre exacto del programa, la técnica o el tema tal como alguien lo escribiría en Google ("Revit", "presupuesto de obra", "APU", "render con D5"). Nada de "En este curso…" ni "Este curso te ofrece…".
- Dice para quién es, solo si se deduce del nivel o del material (por ejemplo, "para quienes empiezan a presupuestar" en un curso básico). No inventes cargos ni públicos.
  Ejemplo: Aprende a armar el presupuesto de una obra y sus análisis de precios unitarios (APU) en Excel, paso a paso, desde cero.

El resto del párrafo:
- Nombra lo concreto que se ve: programas, herramientas, normas, métodos y lo que el estudiante entrega o resuelve al final. Los asistentes de IA recomiendan cursos que nombran cosas concretas, no los que prometen en general.
- Cada frase se entiende por sí sola: di "el curso" o nombra el tema en vez de empezar con "Además" o "También" sin sujeto.
- Termina con lo que el estudiante será capaz de hacer al terminar.
- No enumeres las clases una por una: resume el recorrido.
- Si el nivel es básico, no des por hecho conocimientos previos; si es avanzado, puedes nombrarlos.
- Usa los términos del sector de la construcción en Colombia cuando aparezcan en el material (APU, AIU, residente de obra, cantidades de obra), con la sigla explicada la primera vez.

Vocabulario de UVA: "curso", "módulo", "clase" (nunca "lección"), "temario", "instructor" (nunca "profesor"), "en línea" (nunca "online").

No menciones precio, duración, certificado, acceso ni cantidad de clases: esos datos los muestra la página y pueden cambiar.

Reglas:
${REGLAS_COMUNES}`;
}

export type LeccionParaDescripcion = {
  modulo: string;
  titulo: string;
  /** Contenido ya escrito de la lección o, si no hay, un tramo de la
   * transcripción. Vacío si la lección no tiene ninguno de los dos. */
  material: string;
};

export function mensajeDescripcionCurso(datos: {
  tituloCurso: string;
  nivel: string;
  /** Escuelas del curso: dicen el área y ayudan a elegir las palabras de búsqueda. */
  escuelas: string[];
  lecciones: LeccionParaDescripcion[];
}): string {
  const temario = datos.lecciones
    .map((leccion, indice) => {
      const encabezado = `${indice + 1}. [${leccion.modulo}] ${leccion.titulo}`;
      return leccion.material ? `${encabezado}\n${leccion.material}` : encabezado;
    })
    .join("\n\n");

  const escuelas = datos.escuelas.length ? `\nEscuela: ${datos.escuelas.join(", ")}` : "";

  return `Curso: ${datos.tituloCurso}
Nivel: ${datos.nivel}${escuelas}

Temario, en orden, con el material disponible de cada clase:
"""
${temario}
"""`;
}
