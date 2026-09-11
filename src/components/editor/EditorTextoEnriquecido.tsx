"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ChangeEvent } from "react";
import { Paperclip } from "lucide-react";
import {
  type FormatoId,
  BOTONES_FORMATO,
  COMANDO_FORMATO,
  alternarFormato,
  manejarEnterEnLista,
  serializarEditor,
  insertarAdjuntoPendiente,
  marcadorAHtml,
} from "@/lib/formato-texto";
import { TAMANO_MAXIMO_ADJUNTO_COMUNIDAD, MAX_ADJUNTOS_COMUNIDAD } from "@/lib/comunidad-tipos";

export type EditorTextoEnriquecidoHandle = {
  obtenerTexto: () => string;
  /** Archivos elegidos en esta sesión de edición que todavía no se subieron
   * — la clave es el mismo token que quedó en el texto como
   * `[[adjunto:pendiente:<token>]]` (ver formato-texto.tsx), así que quien
   * publique puede subir cada uno y reemplazar su marcador por el id real. */
  obtenerAdjuntosPendientes: () => Map<string, File>;
  limpiar: () => void;
  enfocar: () => void;
};

const ACEPTA_ADJUNTO =
  "image/jpeg,image/png,image/webp,image/gif,application/pdf,.zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx";

/**
 * Editor `contenteditable` con toolbar de negrita/cursiva/subrayado/listas
 * — misma lógica de serialización que ya usan los comentarios de clase
 * (`src/lib/formato-texto.ts`, compartida a propósito para que nunca se
 * desincronicen), envuelta acá en un componente aparte porque la UI de
 * "píldora que se expande" de los comentarios (`NuevoComentarioForm` en
 * PlayerTabs.tsx) tiene su propio manejo de colapsado/avatar/envío que no
 * aplica a Comunidad — quien lo use decide cuándo montarlo/mostrarlo.
 *
 * El botón de clip inserta una imagen/archivo EN el punto del cursor (no
 * en una lista aparte debajo): el usuario ve un chip con el nombre del
 * archivo mientras escribe, no la imagen real todavía — la imagen de
 * verdad solo aparece al publicar, una vez que el archivo ya se subió y
 * tiene un id real (`ComunidadAdjuntoVista`, fuera de este editor). El
 * archivo en sí se guarda en `adjuntosPendientesRef`, nunca en el DOM.
 *
 * Expone un `ref` imperativo en vez de un valor controlado: un
 * `contenteditable` no tiene un "value" de React normal, y el texto real
 * solo hace falta al momento de publicar — replicando el mismo patrón que
 * ya usan los comentarios.
 */
export const EditorTextoEnriquecido = forwardRef<
  EditorTextoEnriquecidoHandle,
  {
    placeholder: string;
    autoFocus?: boolean;
    onCambiar?: (vacio: boolean) => void;
    onErrorAdjunto?: (mensaje: string) => void;
    alturaMinima?: string;
    /** Para editar una publicación existente: el texto ya guardado
     * (con sus marcadores) y una forma de resolver la etiqueta de cada
     * adjunto YA existente (su `nombre`, ver ComunidadAdjunto en
     * comunidad-tipos.ts) — los adjuntos nuevos que se agreguen durante la
     * edición sí pasan por `obtenerAdjuntosPendientes` como cualquier
     * publicación nueva. Se hidrata una sola vez, al montar. */
    contenidoInicial?: string;
    etiquetaAdjuntoExistente?: (id: string) => string;
  }
>(function EditorTextoEnriquecido(
  { placeholder, autoFocus, onCambiar, onErrorAdjunto, alturaMinima = "min-h-24", contenidoInicial, etiquetaAdjuntoExistente },
  ref,
) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const adjuntosPendientesRef = useRef(new Map<string, File>());
  const [activos, setActivos] = useState<Record<FormatoId, boolean>>({
    bold: false,
    italic: false,
    underline: false,
    list: false,
    "list-ordered": false,
  });

  useEffect(() => {
    if (editorRef.current && contenidoInicial) {
      editorRef.current.innerHTML = marcadorAHtml(contenidoInicial, (token) => etiquetaAdjuntoExistente?.(token) ?? "archivo");
    }
    // Solo al montar: es la hidratación inicial de un editor de edición, no
    // algo que deba reaccionar si `contenidoInicial` cambiara después.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function actualizarActivos() {
    const estado = (comando: string) => {
      try {
        return document.queryCommandState(comando);
      } catch {
        return false;
      }
    };
    setActivos({
      bold: estado(COMANDO_FORMATO.bold),
      italic: estado(COMANDO_FORMATO.italic),
      underline: estado(COMANDO_FORMATO.underline),
      list: estado(COMANDO_FORMATO.list),
      "list-ordered": estado(COMANDO_FORMATO["list-ordered"]),
    });
  }

  function totalAdjuntos() {
    return editorRef.current?.querySelectorAll("[data-comunidad-adjunto]").length ?? 0;
  }

  function elegirArchivos(event: ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!editorRef.current || archivos.length === 0) return;

    for (const archivo of archivos) {
      if (totalAdjuntos() >= MAX_ADJUNTOS_COMUNIDAD) {
        onErrorAdjunto?.(`No puedes adjuntar más de ${MAX_ADJUNTOS_COMUNIDAD} archivos por publicación.`);
        break;
      }
      if (archivo.size > TAMANO_MAXIMO_ADJUNTO_COMUNIDAD) {
        onErrorAdjunto?.(`"${archivo.name}" supera los ${TAMANO_MAXIMO_ADJUNTO_COMUNIDAD / 1024 / 1024} MB.`);
        continue;
      }
      const token = `pendiente:${crypto.randomUUID()}`;
      adjuntosPendientesRef.current.set(token, archivo);
      insertarAdjuntoPendiente(editorRef.current, token, archivo.name);
    }
    onCambiar?.(!editorRef.current.textContent || editorRef.current.textContent.trim() === "");
  }

  useImperativeHandle(ref, () => ({
    obtenerTexto: () => (editorRef.current ? serializarEditor(editorRef.current) : ""),
    obtenerAdjuntosPendientes: () => adjuntosPendientesRef.current,
    limpiar: () => {
      if (editorRef.current) editorRef.current.innerHTML = "";
      adjuntosPendientesRef.current.clear();
    },
    enfocar: () => editorRef.current?.focus(),
  }));

  return (
    <div className="flex flex-col rounded-uva-md border border-uva-divider bg-uva-bg focus-within:border-uva-accent">
      <div className="flex items-center gap-0.5 border-b border-uva-divider px-2 py-1.5">
        {BOTONES_FORMATO.map(({ tipo, icono: Icono, etiqueta }) => (
          <button
            key={tipo}
            type="button"
            title={etiqueta}
            aria-label={etiqueta}
            aria-pressed={activos[tipo]}
            // preventDefault en onMouseDown: si el click llegara a disparar
            // primero un blur del editor, se pierde la selección de texto
            // sobre la que debe actuar el comando.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              if (!editorRef.current) return;
              alternarFormato(editorRef.current, tipo);
              actualizarActivos();
            }}
            className={`grid size-7 shrink-0 cursor-pointer place-items-center rounded-uva-xs border-0 ${
              activos[tipo]
                ? "bg-uva-accent text-white"
                : "bg-transparent text-uva-text-faint hover:bg-uva-hover hover:text-uva-text"
            }`}
          >
            <Icono className="size-[15px]" strokeWidth={2.2} />
          </button>
        ))}
        <div className="mx-1 h-5 w-px bg-uva-divider" />
        <button
          type="button"
          title="Adjuntar imagen o archivo"
          aria-label="Adjuntar imagen o archivo"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-uva-xs border-0 bg-transparent text-uva-text-faint hover:bg-uva-hover hover:text-uva-text"
        >
          <Paperclip className="size-[15px]" strokeWidth={2.2} />
        </button>
        <input ref={fileInputRef} type="file" accept={ACEPTA_ADJUNTO} multiple className="hidden" onChange={elegirArchivos} />
      </div>
      {/* `text-base sm:text-sm`, como `ui/input`: con 14 px, iOS Safari hace
          zoom al enfocar el editor (lo hace con cualquier campo de menos de
          16 px) y no lo deshace al salir. */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        autoFocus={autoFocus}
        role="textbox"
        aria-multiline="true"
        aria-label={placeholder}
        data-placeholder={placeholder}
        onKeyDown={(event) => editorRef.current && manejarEnterEnLista(event.nativeEvent, editorRef.current)}
        onKeyUp={actualizarActivos}
        onMouseUp={actualizarActivos}
        onInput={() => {
          actualizarActivos();
          onCambiar?.(!editorRef.current || editorRef.current.textContent?.trim() === "");
        }}
        className={`${alturaMinima} max-h-64 overflow-y-auto px-3 py-2 text-base text-uva-text caret-uva-accent sm:text-sm outline-none empty:before:text-uva-text-faint empty:before:content-[attr(data-placeholder)] [&_ol]:list-decimal [&_ul]:list-disc [&_ol]:pl-5 [&_ul]:pl-5 [&_li]:my-0.5`}
      />
    </div>
  );
});
