import { z } from "zod";

/**
 * Forma mínima de un documento Tiptap/ProseMirror que este proyecto acepta
 * guardar en `lecciones.contenido` (JSONB). Es deliberadamente más estricta
 * que "cualquier JSON de Tiptap": solo enumera los nodos y marcas que
 * RichTextEditor expone en su toolbar (ver PlayerTabs/RichTextToolbar). Un
 * nodo o marca fuera de esta lista nunca debería poder generarse desde el
 * editor, pero si algo pegado o un cliente manual lo produce, la validación
 * del lado servidor lo rechaza antes de tocar la base — no basta con confiar
 * en que el editor "no lo deja hacer".
 */
export type NodoContenido = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: NodoContenido[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
};

export type DocumentoContenido = {
  type: "doc";
  content?: NodoContenido[];
};

const MARCA_SIMPLE = z.object({ type: z.enum(["bold", "italic", "underline", "strike", "code"]) });

const MARCA_LINK = z.object({
  type: z.literal("link"),
  attrs: z.object({
    href: z.string().max(2048),
    target: z.string().nullish(),
    rel: z.string().nullish(),
    class: z.string().nullish(),
  }),
});

const marcaSchema = z.union([MARCA_SIMPLE, MARCA_LINK]);

const NODO_HOJA = z.enum(["horizontalRule", "hardBreak"]);
const NODO_CONTENEDOR = z.enum([
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "taskList",
  "taskItem",
  "blockquote",
  "codeBlock",
]);

const textoSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
  marks: z.array(marcaSchema).optional(),
});

const nodoSchema: z.ZodType<NodoContenido> = z.lazy(() =>
  z.union([
    textoSchema,
    z.object({
      type: NODO_HOJA,
      attrs: z.record(z.string(), z.unknown()).optional(),
    }),
    z.object({
      type: NODO_CONTENEDOR,
      attrs: z.record(z.string(), z.unknown()).optional(),
      content: z.array(nodoSchema).optional(),
    }),
  ]),
);

export const contenidoLeccionSchema: z.ZodType<DocumentoContenido> = z.object({
  type: z.literal("doc"),
  content: z.array(nodoSchema).optional(),
});

/** Igual límite que tenía `resumen` (2000) multiplicado por el overhead
 * propio de guardar estructura además de texto — un resumen razonable de
 * varios párrafos con formato no debería acercarse a esto. */
export const TAMANO_MAXIMO_CONTENIDO = 20_000;

/** `null`, `undefined`, o un doc sin ningún nodo con texto real (p. ej. el
 * editor recién abierto: `{type:"doc",content:[{type:"paragraph"}]}`). Se
 * usa para decidir si mostrar el placeholder "el instructor todavía no
 * publicó el resumen" y para no guardar un documento vacío como si fuera
 * contenido real. */
export function contenidoEstaVacio(doc: unknown): boolean {
  if (!doc || typeof doc !== "object") return true;
  const nodo = doc as NodoContenido;

  function tieneTexto(n: NodoContenido): boolean {
    if (n.type === "text" && n.text && n.text.trim() !== "") return true;
    if (n.type === "horizontalRule") return true;
    return (n.content ?? []).some(tieneTexto);
  }

  return !tieneTexto(nodo);
}

/**
 * Convierte el `resumen` legado (texto plano, posibles párrafos separados
 * por línea en blanco) en un documento Tiptap equivalente, para que el
 * instructor lo vea ya cargado en el editor enriquecido la primera vez que
 * abre una lección sembrada antes de que existiera `contenido`. Ver
 * comentario de `resumen` en schema.prisma.
 */
export function resumenLegadoComoContenido(resumen: string): DocumentoContenido {
  const parrafos = resumen
    .split(/\n{2,}/)
    .map((parrafo) => parrafo.trim())
    .filter(Boolean);

  if (parrafos.length === 0) return { type: "doc", content: [{ type: "paragraph" }] };

  return {
    type: "doc",
    content: parrafos.map((parrafo) => ({
      type: "paragraph",
      content: [{ type: "text", text: parrafo }],
    })),
  };
}

/** `contenido` propio si existe; si no, el `resumen` legado convertido; si
 * tampoco hay resumen, `null`. Centraliza la regla de "qué se le muestra a
 * quien lee la lección" para que admin, jugador y vista previa coincidan. */
export function resolverContenidoLeccion(
  contenido: unknown | null,
  resumen: string | null,
): DocumentoContenido | null {
  if (contenido && !contenidoEstaVacio(contenido)) return contenido as DocumentoContenido;
  if (resumen && resumen.trim() !== "") return resumenLegadoComoContenido(resumen);
  return null;
}
