"use client";

import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { Placeholder } from "@tiptap/extension-placeholder";
import type { DocumentoContenido } from "@/lib/editor/tipos";
import { esUrlSegura } from "@/lib/editor/seguridad";
import { cn } from "@/lib/utils";
import { RichTextToolbar } from "./RichTextToolbar";

const DOC_VACIO: DocumentoContenido = { type: "doc", content: [{ type: "paragraph" }] };

/** Clases del contenido editable — deliberadamente calcadas de las que usa
 * RichTextRenderer (mismos tamaños/colores) para que lo que el instructor ve
 * mientras escribe sea, nodo por nodo, lo que va a ver el estudiante. */
const CLASES_CONTENIDO =
  "min-h-[160px] max-h-[420px] overflow-y-auto px-3.5 py-3 text-sm text-uva-text outline-none " +
  "[&_p]:my-1.5 [&_p]:text-[13.5px] [&_p]:leading-relaxed " +
  "[&_h1]:my-2 [&_h1]:text-[19px] [&_h1]:font-heading [&_h1]:font-bold [&_h1]:tracking-[-0.02em] " +
  "[&_h2]:my-2 [&_h2]:text-[16.5px] [&_h2]:font-heading [&_h2]:font-bold [&_h2]:tracking-[-0.02em] " +
  "[&_h3]:my-1.5 [&_h3]:text-[14.5px] [&_h3]:font-heading [&_h3]:font-bold [&_h3]:tracking-[-0.02em] " +
  "[&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-[13.5px] " +
  "[&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:text-[13.5px] " +
  "[&_li]:my-0.5 [&_li[data-checked]]:list-none " +
  "[&_ul[data-type='taskList']]:list-none [&_ul[data-type='taskList']]:pl-0 " +
  "[&_ul[data-type='taskList']_li]:flex [&_ul[data-type='taskList']_li]:items-start [&_ul[data-type='taskList']_li]:gap-2 " +
  "[&_ul[data-type='taskList']_input]:mt-[3px] [&_ul[data-type='taskList']_input]:accent-uva-accent " +
  "[&_blockquote]:my-1.5 [&_blockquote]:border-l-2 [&_blockquote]:border-uva-accent [&_blockquote]:pl-3.5 [&_blockquote]:text-[13.5px] [&_blockquote]:text-uva-muted [&_blockquote]:italic " +
  "[&_pre]:my-1.5 [&_pre]:overflow-x-auto [&_pre]:rounded-uva-md [&_pre]:bg-[#27272A] [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-[12px] " +
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0 " +
  "[&_code]:rounded-uva-xs [&_code]:bg-[#27272A] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12px] " +
  "[&_hr]:my-3 [&_hr]:border-uva-divider " +
  "[&_a]:text-uva-accent [&_a]:underline [&_a]:underline-offset-2 " +
  "empty:before:pointer-events-none empty:before:float-left empty:before:h-0 empty:before:text-uva-text-faint empty:before:content-[attr(data-placeholder)] " +
  "[&_.is-editor-empty:first-child::before]:pointer-events-none [&_.is-editor-empty:first-child::before]:float-left [&_.is-editor-empty:first-child::before]:h-0 [&_.is-editor-empty:first-child::before]:text-uva-text-faint [&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]";

/**
 * Editor de contenido enriquecido para el resumen/teoría de una lección.
 * Fuente de verdad: el documento JSON de Tiptap/ProseMirror que produce
 * (ver `DocumentoContenido` en `src/lib/editor/tipos.ts`), nunca HTML.
 *
 * Reutilizable: no sabe nada de lecciones — quien lo usa decide qué hacer
 * con `onChange` (LeccionEditorPanel lo integra al mismo flujo de "Guardar
 * cambios" que ya tenía título/resumen).
 */
export function RichTextEditor({
  initialContent,
  onChange,
  editable = true,
  placeholder = "Escribe el contenido de la clase…",
  disabled = false,
  contentClassName,
  onReady,
}: {
  initialContent: DocumentoContenido | null;
  onChange?: (contenido: DocumentoContenido) => void;
  editable?: boolean;
  placeholder?: string;
  disabled?: boolean;
  /** Sobreescribe el alto (min/max) del área editable de CLASES_CONTENIDO
   * — p. ej. LeccionEditorPanel la usa para que el resumen ocupe el alto
   * disponible del panel ancho en vez del bloque bajo de 160-420px pensado
   * para la columna angosta original. */
  contentClassName?: string;
  /**
   * Se llama una única vez, apenas Tiptap termina de montar, con el JSON que
   * normalizó a partir de `initialContent` (ProseMirror completa `attrs` por
   * defecto en cada nodo aunque el documento guardado no los traiga, así que
   * el JSON recién montado no siempre es idéntico byte a byte al que se le
   * pasó). Quien compara "¿hay cambios sin guardar?" debe usar este valor
   * como referencia en vez de `initialContent` crudo — si no, esa
   * normalización del montaje se lee como una edición que el usuario nunca
   * hizo.
   */
  onReady?: (contenido: DocumentoContenido) => void;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: {
          protocols: ["http", "https", "mailto"],
          validate: esUrlSegura,
          HTMLAttributes: { rel: "noopener noreferrer nofollow ugc", target: "_blank" },
        },
      }),
      TaskList,
      TaskItem.configure({ nested: false }),
      Placeholder.configure({ placeholder }),
    ],
    content: initialContent ?? DOC_VACIO,
    editable: editable && !disabled,
    immediatelyRender: false,
    // `JSON.parse(JSON.stringify(...))` en vez de pasar `editor.getJSON()`
    // directo: ProseMirror comparte/congela los objetos `attrs` de los nodos
    // (p. ej. el de un heading), y ese objeto no cruza limpio la frontera de
    // un Server Action — el servidor termina recibiendo `attrs` como
    // función en vez de como el objeto plano `{ level: 2 }`, y la
    // validación de contenidoLeccionSchema lo rechaza. Clonar a JSON puro
    // antes de guardarlo en estado garantiza que lo que llega al server
    // action sea siempre serializable.
    onUpdate: ({ editor }) => onChange?.(JSON.parse(JSON.stringify(editor.getJSON())) as DocumentoContenido),
    onCreate: ({ editor }) => onReady?.(JSON.parse(JSON.stringify(editor.getJSON())) as DocumentoContenido),
    editorProps: { attributes: { class: cn(CLASES_CONTENIDO, contentClassName) } },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editable && !disabled);
  }, [editor, editable, disabled]);

  if (!editor) return null;

  return (
    <div className="flex flex-col overflow-hidden rounded-uva-md border border-uva-divider bg-uva-bg focus-within:border-uva-accent">
      {editable && !disabled && <RichTextToolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}
