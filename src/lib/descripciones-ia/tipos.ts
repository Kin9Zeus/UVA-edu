import { z } from "zod";
import {
  contenidoLeccionSchema,
  type DocumentoContenido,
  type NodoContenido,
} from "@/lib/editor/tipos";

/**
 * Textos de curso y de lección propuestos por la IA.
 *
 * Nada de esto se guarda solo: el Server Action devuelve la propuesta, el
 * panel la carga en el campo sin guardar y es el administrador quien la revisa
 * y pulsa "Guardar cambios". Por eso no hay tabla de trabajos ni `after()` como
 * en el examen: es una llamada corta que la pantalla espera.
 *
 * Igual que en el examen, dos puertas: el esquema de Gemini fuerza la FORMA y
 * Zod comprueba los límites.
 */

/** Límite del campo al guardar (`descripcion` en actions/admin/cursos.ts). */
const DESCRIPCION_CURSO_MAXIMO = 5000;

export const OBJETIVOS_MINIMO = 3;
export const OBJETIVOS_MAXIMO = 5;

export const ESQUEMA_CONTENIDO_LECCION = {
  type: "OBJECT",
  properties: {
    introduccion: {
      type: "STRING",
      description: "Un párrafo de entrada: de qué trata la clase y por qué importa.",
    },
    queVasAAprender: {
      type: "STRING",
      description: "Un párrafo con los conceptos, técnicas y criterios concretos de la clase.",
    },
    organizacion: {
      type: "STRING",
      description: "Un párrafo corto sobre cómo se desarrolla la sesión.",
    },
    objetivos: {
      type: "ARRAY",
      items: { type: "STRING" },
      minItems: OBJETIVOS_MINIMO,
      maxItems: OBJETIVOS_MAXIMO,
      description: `Entre ${OBJETIVOS_MINIMO} y ${OBJETIVOS_MAXIMO} objetivos que empiezan con un verbo en infinitivo, sin viñetas ni numeración.`,
    },
  },
  required: ["introduccion", "queVasAAprender", "organizacion", "objetivos"],
} as const;

export const ESQUEMA_DESCRIPCION_CURSO = {
  type: "OBJECT",
  properties: {
    descripcion: { type: "STRING", description: "Un solo párrafo en texto plano." },
  },
  required: ["descripcion"],
} as const;

/** Quita la viñeta o el número que el modelo a veces antepone pese al prompt:
 * en una lista de Tiptap saldría duplicado ("• • Estructurar…"). */
function sinVineta(texto: string): string {
  return texto.replace(/^\s*(?:[-*•·]|\d+[.)])\s+/, "").trim();
}

/** Un párrafo: los saltos de línea que el modelo meta dentro se vuelven espacios. */
const parrafoSchema = z
  .string()
  .transform((texto) => texto.replace(/\s+/g, " ").trim())
  .pipe(z.string().min(30).max(1500));

export const contenidoLeccionGeneradoSchema = z.object({
  introduccion: parrafoSchema,
  queVasAAprender: parrafoSchema,
  organizacion: parrafoSchema,
  objetivos: z
    .array(z.string().transform(sinVineta).pipe(z.string().min(5).max(300)))
    .min(OBJETIVOS_MINIMO)
    .max(OBJETIVOS_MAXIMO),
});

export const descripcionCursoGeneradaSchema = z.object({
  // Un solo párrafo: la página del curso lo pinta dentro de un <p>, donde un
  // salto de línea no se ve y dos párrafos quedarían pegados.
  descripcion: z
    .string()
    .transform((texto) => texto.replace(/\s+/g, " ").trim())
    .pipe(z.string().min(40).max(DESCRIPCION_CURSO_MAXIMO)),
});

export type ContenidoLeccionGenerado = z.infer<typeof contenidoLeccionGeneradoSchema>;

function parrafo(texto: string): NodoContenido {
  return { type: "paragraph", content: [{ type: "text", text: texto }] };
}

function titulo(texto: string): NodoContenido {
  return { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: texto }] };
}

/**
 * Pasa la respuesta del modelo al documento Tiptap que guarda
 * `lecciones.contenido`, siempre con la misma forma: entrada, "¿Qué vas a
 * aprender?", "¿Cómo está organizada la sesión?" y los objetivos en lista.
 * Se valida contra `contenidoLeccionSchema`, el mismo que usa
 * `actualizarLeccion()`, para que lo propuesto siempre se pueda guardar.
 */
export function contenidoLeccionComoDocumento(
  generado: ContenidoLeccionGenerado,
): DocumentoContenido {
  const documento: DocumentoContenido = {
    type: "doc",
    content: [
      parrafo(generado.introduccion),
      titulo("¿Qué vas a aprender?"),
      parrafo(generado.queVasAAprender),
      titulo("¿Cómo está organizada la sesión?"),
      parrafo(generado.organizacion),
      parrafo("Al finalizar esta sesión vas a poder:"),
      {
        type: "bulletList",
        content: generado.objetivos.map((objetivo) => ({
          type: "listItem",
          content: [parrafo(objetivo)],
        })),
      },
    ],
  };

  return contenidoLeccionSchema.parse(documento);
}

/** Texto plano de un documento Tiptap, un bloque por línea. Para darle al
 * modelo el contenido ya escrito de una lección como contexto del curso. */
export function textoPlanoDeContenido(documento: unknown): string {
  const lineas: string[] = [];

  function recorrer(nodo: NodoContenido): string {
    if (nodo.type === "text") return nodo.text ?? "";
    if (nodo.type === "hardBreak") return " ";
    return (nodo.content ?? []).map(recorrer).join("");
  }

  function bloques(nodo: NodoContenido) {
    const hijos = nodo.content ?? [];
    const soloTexto = hijos.every((hijo) => hijo.type === "text" || hijo.type === "hardBreak");
    if (nodo.type !== "doc" && soloTexto) {
      const texto = recorrer(nodo).trim();
      if (texto) lineas.push(texto);
      return;
    }
    hijos.forEach(bloques);
  }

  if (documento && typeof documento === "object") bloques(documento as NodoContenido);
  return lineas.join("\n");
}
