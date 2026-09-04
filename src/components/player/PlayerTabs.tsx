"use client";

import { useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import {
  Download,
  Loader2,
  BadgeCheck,
  User,
  Heart,
  Reply,
  Send,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
} from "lucide-react";
import { extensionArchivo, formatTamanoArchivo } from "@/lib/admin/format";
import { obtenerUrlRecurso } from "@/actions/cursos/recurso";
import { crearComentario } from "@/actions/comentarios/crear";
import { eliminarComentario } from "@/actions/comentarios/eliminar";
import { darLikeComentario, quitarLikeComentario } from "@/actions/comentarios/like";
import type { RecursoLeccion } from "@/lib/leccion";
import type { ComentarioConRespuestas } from "@/lib/comentarios";
import type { DocumentoContenido } from "@/lib/editor/tipos";
import { RichTextRenderer } from "@/components/editor/RichTextRenderer";

export type TabPlayer = "recursos" | "resumen" | "comentarios";

const TAB_BASE =
  "flex cursor-pointer items-center gap-[7px] rounded-full border-0 px-4 py-[9px] text-[13px] font-semibold";

export function TabsHeader({
  tab,
  onTab,
  totalRecursos,
  totalComentarios,
}: {
  tab: TabPlayer;
  onTab: (tab: TabPlayer) => void;
  totalRecursos: number;
  /** Omitido en la vista previa sin sesión (LeccionVistaPreviaContent), que
   * no tiene comentarios: sin este dato la pestaña no se muestra. */
  totalComentarios?: number;
}) {
  const clase = (activo: boolean) =>
    `${TAB_BASE} ${activo ? "bg-uva-accent text-uva-text" : "bg-transparent text-uva-muted"}`;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-uva-divider pb-3.5">
      <button type="button" onClick={() => onTab("recursos")} className={clase(tab === "recursos")}>
        Recursos
        <span className="font-mono text-[11px] opacity-65">{totalRecursos}</span>
      </button>
      <button type="button" onClick={() => onTab("resumen")} className={clase(tab === "resumen")}>
        Resumen
        <span className="font-mono text-[11px] opacity-65" />
      </button>
      {/* Solo en mobile: desktop ya muestra los comentarios en su propio
          panel fijo junto al video (PlayerContent.tsx), así que ahí esta
          pestaña sobraría. */}
      {totalComentarios !== undefined && (
        <button
          type="button"
          onClick={() => onTab("comentarios")}
          className={`${clase(tab === "comentarios")} lg:hidden`}
        >
          Comentarios
          <span className="font-mono text-[11px] opacity-65">{totalComentarios}</span>
        </button>
      )}
    </div>
  );
}

export function RecursosTab({ recursos }: { recursos: RecursoLeccion[] }) {
  // Id del recurso que está pidiendo su URL firmada ahora mismo (P1-1,
  // AUDIT-2026-08-26.md): antes el href apuntaba directo a la ruta del
  // bucket privado y siempre daba 404. Ahora cada clic pide un enlace de
  // un solo uso recién firmado, después de que RLS confirme el acceso.
  const [descargando, setDescargando] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);

  async function descargar(recurso: RecursoLeccion) {
    setErrorId(null);
    setDescargando(recurso.id);
    const resultado = await obtenerUrlRecurso(recurso.id);
    setDescargando(null);
    if ("error" in resultado) {
      setErrorId(recurso.id);
      return;
    }
    window.open(resultado.url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex flex-col gap-3">
      {recursos.length === 0 ? (
        <div className="rounded-uva-md bg-[#27272A] px-[13px] py-[11px] text-[13px] text-uva-muted">
          Esta clase todavía no tiene recursos descargables.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {recursos.map((recurso) => (
            <button
              key={recurso.id}
              type="button"
              onClick={() => descargar(recurso)}
              disabled={descargando === recurso.id}
              className="flex w-full cursor-pointer items-center gap-[11px] rounded-uva-md border-0 bg-[#27272A] px-[13px] py-[11px] text-left disabled:cursor-wait disabled:opacity-70"
            >
              <span className="inline-flex items-center rounded-uva-xs bg-[#27272A] px-2.5 py-[3px] font-mono text-[11px] font-semibold tracking-[0.02em] text-uva-muted">
                {extensionArchivo(recurso.nombre)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold text-uva-text">
                  {recurso.nombre}
                </div>
                <div className="text-[11px] text-uva-muted">
                  {errorId === recurso.id
                    ? "No pudimos generar el enlace. Intenta de nuevo."
                    : formatTamanoArchivo(recurso.tamanoBytes)}
                </div>
              </div>
              {descargando === recurso.id ? (
                <Loader2 className="size-4 shrink-0 animate-spin text-uva-muted" strokeWidth={2.75} />
              ) : (
                <Download className="size-4 shrink-0 text-uva-muted" strokeWidth={2.75} />
              )}
            </button>
          ))}
        </div>
      )}
      <p className="m-0 text-[11.5px] text-uva-muted">
        Incluidos en tu plan. Se actualizan cuando el instructor revisa precios.
      </p>
    </div>
  );
}

export function ResumenTab({ contenido }: { contenido: DocumentoContenido | null }) {
  if (!contenido) {
    return (
      <div className="flex flex-col gap-3">
        <p className="m-0 max-w-[640px] text-[13.5px] text-uva-muted">
          El instructor todavía no publicó el resumen de esta clase.
        </p>
      </div>
    );
  }

  return <RichTextRenderer contenido={contenido} />;
}

/**
 * Filtra los comentarios eliminados que ya no aportan nada a la vista: una
 * respuesta borrada desaparece siempre (es una hoja), pero un comentario
 * raíz borrado se conserva como placeholder "[comentario eliminado]" si
 * todavía tiene alguna respuesta viva — quitarlo del todo dejaría esa
 * respuesta huérfana de contexto (ver el comentario en
 * actions/comentarios/eliminar.ts sobre por qué el borrado es lógico).
 */
export function comentariosVisibles(
  comentarios: ComentarioConRespuestas[],
): ComentarioConRespuestas[] {
  return comentarios
    .filter((comentario) => !comentario.eliminado || comentario.respuestas.some((r) => !r.eliminado))
    .map((comentario) =>
      comentario.respuestas.some((r) => r.eliminado)
        ? { ...comentario, respuestas: comentario.respuestas.filter((r) => !r.eliminado) }
        : comentario,
    );
}

/** Cuenta raíces + respuestas visibles, para el número junto a la pestaña "Comentarios". */
export function contarComentarios(comentarios: ComentarioConRespuestas[]): number {
  return comentariosVisibles(comentarios).reduce(
    (total, comentario) => total + 1 + comentario.respuestas.length,
    0,
  );
}

type FormatoId = "bold" | "italic" | "underline" | "list" | "list-ordered";

const BOTONES_FORMATO: { tipo: FormatoId; icono: typeof Bold; etiqueta: string }[] = [
  { tipo: "bold", icono: Bold, etiqueta: "Negrita" },
  { tipo: "italic", icono: Italic, etiqueta: "Cursiva" },
  { tipo: "underline", icono: Underline, etiqueta: "Subrayado" },
  { tipo: "list", icono: List, etiqueta: "Lista con viñetas" },
  { tipo: "list-ordered", icono: ListOrdered, etiqueta: "Lista numerada" },
];

/** Comando nativo de `execCommand` detrás de cada botón — el editor es un
 * `contenteditable`, así que negrita/cursiva/listas se aplican en vivo sobre
 * la selección, en vez de insertar marcadores de texto que el usuario
 * tendría que ver. La numeración/viñeta la sigue pintando el navegador
 * (por eso alcanza con CSS `list-decimal`/`list-disc` en el editor); la
 * continuación al dar Enter, en cambio, la controlamos a mano en
 * `manejarEnterEnLista` — el comportamiento nativo de Chrome para "Enter al
 * final de un `<li>`" resultó inconsistente en pruebas manuales (a veces
 * degradaba un `<ol>` de un solo item a un `<ul>` en vez de continuar la
 * numeración). */
const COMANDO_FORMATO: Record<FormatoId, string> = {
  bold: "bold",
  italic: "italic",
  underline: "underline",
  list: "insertUnorderedList",
  "list-ordered": "insertOrderedList",
};

function alternarFormato(editor: HTMLDivElement, tipo: FormatoId) {
  editor.focus();
  document.execCommand(COMANDO_FORMATO[tipo]);
}

function ubicarCursorAlInicio(nodo: Node) {
  const rango = document.createRange();
  rango.selectNodeContents(nodo);
  rango.collapse(true);
  const seleccion = window.getSelection();
  seleccion?.removeAllRanges();
  seleccion?.addRange(rango);
}

/**
 * Reemplaza el Enter nativo dentro de un `<li>`: en un item con contenido,
 * crea el siguiente `<li>` (el navegador solo se encarga de pintar el
 * número/viñeta vía CSS); en un item vacío, sale de la lista y vuelve a un
 * párrafo normal — el patrón estándar de "Enter, Enter para salir".
 */
function manejarEnterEnLista(evento: KeyboardEvent, editor: HTMLDivElement) {
  if (evento.key !== "Enter" || evento.shiftKey) return;
  const seleccion = window.getSelection();
  if (!seleccion || seleccion.rangeCount === 0) return;
  let nodo: Node | null = seleccion.anchorNode;
  let li: HTMLLIElement | null = null;
  while (nodo && nodo !== editor) {
    if (nodo instanceof HTMLLIElement) {
      li = nodo;
      break;
    }
    nodo = nodo.parentNode;
  }
  if (!li) return;

  evento.preventDefault();
  const lista = li.parentElement;
  if (!lista) return;

  if (li.textContent?.trim() === "") {
    const parrafo = document.createElement("div");
    parrafo.appendChild(document.createElement("br"));
    lista.after(parrafo);
    li.remove();
    if (lista.children.length === 0) lista.remove();
    ubicarCursorAlInicio(parrafo);
    return;
  }

  const nuevoLi = document.createElement("li");
  nuevoLi.appendChild(document.createElement("br"));
  li.after(nuevoLi);
  ubicarCursorAlInicio(nuevoLi);
}

/**
 * Convierte el HTML del editor `contenteditable` al texto plano que se
 * guarda en la base de datos, usando los mismos marcadores que interpreta
 * `renderizarComentario` más abajo (**negrita**, *cursiva*, ++subrayado++,
 * "- item" y "1. item"). Mantener ambas funciones en sincronía.
 */
function serializarEditor(raiz: HTMLElement): string {
  const lineas: string[] = [];

  function textoConEstilos(nodo: ChildNode): string {
    if (nodo.nodeType === Node.TEXT_NODE) return nodo.textContent ?? "";
    if (nodo.nodeType !== Node.ELEMENT_NODE) return "";
    const el = nodo as HTMLElement;
    const contenido = Array.from(el.childNodes).map(textoConEstilos).join("");
    switch (el.tagName) {
      case "B":
      case "STRONG":
        return `**${contenido}**`;
      case "I":
      case "EM":
        return `*${contenido}*`;
      case "U":
        return `++${contenido}++`;
      case "BR":
        return "\n";
      default:
        return contenido;
    }
  }

  function procesarBloque(nodo: ChildNode) {
    if (nodo.nodeType === Node.TEXT_NODE) {
      const texto = nodo.textContent ?? "";
      if (texto) lineas.push(texto);
      return;
    }
    if (nodo.nodeType !== Node.ELEMENT_NODE) return;
    const el = nodo as HTMLElement;
    if (el.tagName === "UL" || el.tagName === "OL") {
      Array.from(el.children).forEach((item, i) => {
        const contenido = Array.from(item.childNodes).map(textoConEstilos).join("");
        lineas.push(el.tagName === "UL" ? `- ${contenido}` : `${i + 1}. ${contenido}`);
      });
      return;
    }
    if (el.tagName === "BR") {
      lineas.push("");
      return;
    }
    if (el.tagName === "DIV" || el.tagName === "P") {
      lineas.push(Array.from(el.childNodes).map(textoConEstilos).join(""));
      return;
    }
    lineas.push(textoConEstilos(el));
  }

  Array.from(raiz.childNodes).forEach(procesarBloque);
  return lineas.join("\n").trim();
}

/** Interpreta negrita/cursiva/subrayado/código dentro de una línea. Formatos no anidables. */
function analizarLinea(linea: string): ReactNode[] {
  const patron = /`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*|\+\+([^+]+)\+\+/g;
  const partes: ReactNode[] = [];
  let ultimo = 0;
  let clave = 0;
  let match: RegExpExecArray | null;
  while ((match = patron.exec(linea))) {
    if (match.index > ultimo) partes.push(linea.slice(ultimo, match.index));
    if (match[1] !== undefined) {
      partes.push(
        <code key={clave++} className="rounded-uva-xs bg-[#27272A] px-1.5 py-0.5 font-mono text-[12px]">
          {match[1]}
        </code>,
      );
    } else if (match[2] !== undefined) {
      partes.push(<strong key={clave++}>{match[2]}</strong>);
    } else if (match[3] !== undefined) {
      partes.push(<em key={clave++}>{match[3]}</em>);
    } else {
      partes.push(
        <u key={clave++}>{match[4]}</u>,
      );
    }
    ultimo = patron.lastIndex;
  }
  if (ultimo < linea.length) partes.push(linea.slice(ultimo));
  return partes;
}

/** Convierte el texto plano guardado (con los marcadores de `aplicarFormato`) en JSX. */
function renderizarComentario(texto: string): ReactNode {
  const segmentos = texto.split(/```([\s\S]*?)```/);
  const bloques: ReactNode[] = [];

  segmentos.forEach((segmento, indiceSegmento) => {
    if (indiceSegmento % 2 === 1) {
      bloques.push(
        <pre
          key={`c${indiceSegmento}`}
          className="my-1.5 overflow-x-auto rounded-uva-md bg-[#27272A] p-2.5 font-mono text-[12px] text-uva-text"
        >
          <code>{segmento.trim()}</code>
        </pre>,
      );
      return;
    }

    const lineas = segmento.split("\n").filter((linea) => linea.trim() !== "");
    let i = 0;
    let clave = 0;
    while (i < lineas.length) {
      const linea = lineas[i];
      if (linea.startsWith("- ")) {
        const items: string[] = [];
        while (i < lineas.length && lineas[i].startsWith("- ")) {
          items.push(lineas[i].slice(2));
          i++;
        }
        bloques.push(
          <ul key={`u${indiceSegmento}-${clave++}`} className="my-1 list-disc space-y-0.5 pl-5">
            {items.map((item, j) => (
              <li key={j}>{analizarLinea(item)}</li>
            ))}
          </ul>,
        );
        continue;
      }
      if (/^\d+\.\s/.test(linea)) {
        const items: string[] = [];
        while (i < lineas.length && /^\d+\.\s/.test(lineas[i])) {
          items.push(lineas[i].replace(/^\d+\.\s/, ""));
          i++;
        }
        bloques.push(
          <ol key={`o${indiceSegmento}-${clave++}`} className="my-1 list-decimal space-y-0.5 pl-5">
            {items.map((item, j) => (
              <li key={j}>{analizarLinea(item)}</li>
            ))}
          </ol>,
        );
        continue;
      }
      bloques.push(
        <p key={`p${indiceSegmento}-${clave++}`} className="my-0.5">
          {analizarLinea(linea)}
        </p>,
      );
      i++;
    }
  });

  return bloques;
}

type OrdenComentarios = "relevantes" | "recientes" | "antiguos";

const ORDEN_LABEL: Record<OrdenComentarios, string> = {
  relevantes: "Más relevantes",
  recientes: "Más recientes",
  antiguos: "Más antiguos",
};

/**
 * Ordena solo los comentarios raíz — las respuestas se quedan en su orden
 * cronológico de siempre (son un hilo de conversación, no un ranking
 * propio). El servidor ya entrega `comentarios` de más antiguo a más
 * reciente (getComentariosDeLeccion, ORDER BY creado_en asc), así que
 * "antiguos" es simplemente ese orden sin tocar y "recientes" es
 * invertirlo. `Array.prototype.sort` es estable (ES2019): al ordenar por
 * likes con ese mismo array de entrada, un empate en likes se desempata
 * por el más antiguo primero, sin necesitar guardar el timestamp crudo.
 */
function ordenarComentarios(
  comentarios: ComentarioConRespuestas[],
  orden: OrdenComentarios,
): ComentarioConRespuestas[] {
  const copia = [...comentarios];
  if (orden === "relevantes") return copia.sort((a, b) => b.likes - a.likes);
  if (orden === "recientes") return copia.reverse();
  return copia;
}

export function ComentariosTab({
  ruta,
  leccionId,
  comentarios,
  puedeComentar,
  usuarioActualId,
  esAdmin,
  onCambio,
}: {
  /** Ruta pública de la clase (`/cursos/<slug-curso>/<slug-lección>`), para
   * que las acciones de comentarios (crear/eliminar/like) revaliden la
   * página real que Next.js cacheó — no sirve un path armado con los UUID
   * internos si la ruta pública ya vive en slugs (ver actions/comentarios). */
  ruta: string;
  leccionId: string;
  comentarios: ComentarioConRespuestas[];
  puedeComentar: boolean;
  usuarioActualId: string | null;
  esAdmin: boolean;
  /** El árbol vive en el servidor (RSC) — tras publicar/borrar/dar like se
   * refresca con `router.refresh()`, avisado acá en vez de duplicar estado. */
  onCambio: () => void;
}) {
  const visibles = useMemo(() => comentariosVisibles(comentarios), [comentarios]);
  const total = visibles.reduce((acc, comentario) => acc + 1 + comentario.respuestas.length, 0);
  const [orden, setOrden] = useState<OrdenComentarios>("recientes");
  const comentariosOrdenados = useMemo(
    () => ordenarComentarios(visibles, orden),
    [visibles, orden],
  );

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-2.5">
        <h4 className="m-0 flex items-baseline gap-1.5 font-heading text-[17px] font-bold text-uva-text">
          Comentarios
          <span className="font-mono text-[13px] font-normal text-uva-muted">{total}</span>
        </h4>
        {visibles.length > 1 && (
          <select
            aria-label="Ordenar comentarios"
            value={orden}
            onChange={(event) => setOrden(event.target.value as OrdenComentarios)}
            className="ml-auto cursor-pointer rounded-uva-md border border-uva-divider bg-uva-surface px-2 py-1 text-[12px] text-uva-muted outline-none hover:text-uva-text focus-visible:border-uva-accent"
          >
            {(Object.keys(ORDEN_LABEL) as OrdenComentarios[]).map((valor) => (
              <option key={valor} value={valor}>
                {ORDEN_LABEL[valor]}
              </option>
            ))}
          </select>
        )}
      </div>
      {total === 0 && (
        <p className="m-0 -mt-2 text-[12px] text-uva-muted">Sé el primero en comentar esta clase</p>
      )}

      {puedeComentar ? (
        <NuevoComentarioForm ruta={ruta} leccionId={leccionId} onPublicado={onCambio} />
      ) : (
        <p className="m-0 text-[12.5px] text-uva-muted">
          Inicia sesión para comentar en esta clase.
        </p>
      )}

      <div className="h-px bg-uva-divider" />

      <div className="-mr-2 flex max-h-[620px] flex-col divide-y divide-uva-divider overflow-y-auto pr-2">
        {comentariosOrdenados.map((comentario) => (
          <div key={comentario.id} className="py-4 first:pt-0 last:pb-0">
            <ComentarioItem
              ruta={ruta}
              leccionId={leccionId}
              comentario={comentario}
              puedeComentar={puedeComentar}
              usuarioActualId={usuarioActualId}
              esAdmin={esAdmin}
              onCambio={onCambio}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function NuevoComentarioForm({
  ruta,
  leccionId,
  idComentarioPadre = null,
  onPublicado,
  onCancelar,
  autoFocus = false,
}: {
  ruta: string;
  leccionId: string;
  idComentarioPadre?: string | null;
  onPublicado: () => void;
  onCancelar?: () => void;
  autoFocus?: boolean;
}) {
  const [vacio, setVacio] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  // Colapsado = la píldora de una línea (como Platzi en reposo); se expande
  // a la caja con toolbar recién al enfocar. Una respuesta nace ya expandida
  // porque `onCancelar` la desmonta del todo — no tiene un estado "píldora"
  // propio al que volver.
  const [expandido, setExpandido] = useState(autoFocus);
  // Qué botones de la toolbar están "encendidos" para el cursor actual —
  // se refresca en cada click/tecla/selección dentro del editor, para que
  // negrita/cursiva/etc. se vean activos igual que en cualquier editor de
  // texto (antes no había ninguna señal visual de qué formato estaba
  // aplicado en la posición del cursor).
  const [activos, setActivos] = useState<Record<FormatoId, boolean>>({
    bold: false,
    italic: false,
    underline: false,
    list: false,
    "list-ordered": false,
  });
  const editorRef = useRef<HTMLDivElement>(null);

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

  function expandir() {
    setExpandido(true);
    requestAnimationFrame(() => editorRef.current?.focus());
  }

  function limpiar() {
    if (editorRef.current) editorRef.current.innerHTML = "";
    setVacio(true);
    setError(null);
  }

  function cancelar() {
    limpiar();
    if (onCancelar) {
      onCancelar();
      return;
    }
    setExpandido(false);
  }

  function enviar() {
    const texto = editorRef.current ? serializarEditor(editorRef.current) : "";
    if (!texto) return;
    setError(null);
    startTransition(async () => {
      const resultado = await crearComentario(leccionId, texto, idComentarioPadre, ruta);
      if ("error" in resultado) {
        setError(resultado.error);
        return;
      }
      limpiar();
      // Colapsar/desmontar ANTES de onPublicado (que dispara router.refresh):
      // ese refresco reemplaza el árbol de Server Components y, si corre
      // primero, se traga el setExpandido(false) programado en la misma
      // transición — el formulario quedaba expandido tras publicar.
      if (onCancelar) onCancelar();
      else setExpandido(false);
      onPublicado();
    });
  }

  const placeholder = idComentarioPadre ? "Escribe tu respuesta…" : "Escribe tu comentario o aporte…";

  return (
    <div className="flex flex-col gap-1.5">
      <div
        onClick={!expandido ? expandir : undefined}
        className={`flex flex-col bg-uva-surface transition-[border-radius] ${
          expandido
            ? "rounded-uva-md border border-uva-divider focus-within:border-uva-accent"
            : "cursor-text rounded-full border border-uva-divider hover:border-uva-text/45"
        }`}
      >
        {expandido && (
          <div className="flex items-center gap-0.5 border-b border-uva-divider px-2 py-1.5">
            {BOTONES_FORMATO.map(({ tipo, icono: Icono, etiqueta }) => (
              <button
                key={tipo}
                type="button"
                title={etiqueta}
                aria-label={etiqueta}
                aria-pressed={activos[tipo]}
                // onMouseDown con preventDefault: si el click llegara a
                // disparar primero un blur del editor, se pierde la
                // selección de texto sobre la que debe actuar el comando.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  if (!editorRef.current) return;
                  alternarFormato(editorRef.current, tipo);
                  actualizarActivos();
                }}
                className={`grid size-7 shrink-0 cursor-pointer place-items-center rounded-uva-xs border-0 ${
                  activos[tipo]
                    ? "bg-uva-accent text-white"
                    : "bg-transparent text-uva-muted hover:bg-[#27272A] hover:text-uva-text"
                }`}
              >
                <Icono className="size-[15px]" strokeWidth={2.2} />
              </button>
            ))}
          </div>
        )}
        <div className={`flex items-end gap-2 ${expandido ? "px-2.5 py-2" : "px-4 py-2.5"}`}>
          {expandido && (
            <div className="mb-0.5 grid size-6 shrink-0 place-items-center overflow-hidden rounded-full bg-[#27272A] text-uva-muted">
              <User className="size-3.5" strokeWidth={2} />
            </div>
          )}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            autoFocus={autoFocus}
            role="textbox"
            aria-multiline="true"
            aria-label={placeholder}
            data-placeholder={placeholder}
            // No se refresca `activos` acá: recién enfocado y vacío, Chrome
            // a veces contesta `queryCommandState("bold")` en `true` sin que
            // haya ningún formato real todavía — se queda con el estado
            // inicial (todo apagado) hasta el primer click/tecla real.
            onFocus={expandir}
            onKeyDown={(event) => editorRef.current && manejarEnterEnLista(event.nativeEvent, editorRef.current)}
            onKeyUp={actualizarActivos}
            onMouseUp={actualizarActivos}
            onInput={() => {
              setVacio(!editorRef.current || editorRef.current.textContent?.trim() === "");
              actualizarActivos();
            }}
            className={
              (expandido
                ? "min-h-[96px] max-h-40 overflow-y-auto py-0.5"
                : "max-h-[22px] overflow-hidden whitespace-nowrap") +
              " flex-1 bg-transparent text-sm text-uva-text caret-uva-accent outline-none empty:before:text-uva-text-faint empty:before:content-[attr(data-placeholder)]" +
              " [&_ol]:list-decimal [&_ul]:list-disc [&_ol]:pl-5 [&_ul]:pl-5 [&_li]:my-0.5"
            }
          />
          {!expandido && (
            <Send className="size-4 shrink-0 text-uva-muted" strokeWidth={2.2} aria-hidden />
          )}
        </div>
        {expandido && (
          <div className="flex items-center justify-end gap-3 px-2.5 pb-2 pt-1">
            <button
              type="button"
              onClick={cancelar}
              className="cursor-pointer border-0 bg-transparent p-0 text-[12.5px] font-semibold text-uva-muted hover:text-uva-text"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={pendiente || vacio}
              onClick={enviar}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border-0 bg-uva-accent px-4 py-1.5 text-[12.5px] font-semibold text-white hover:bg-uva-accent-hover disabled:cursor-not-allowed disabled:bg-uva-text/15 disabled:text-uva-text-faint"
            >
              {pendiente ? "Publicando…" : idComentarioPadre ? "Responder" : "Publicar"}
              {pendiente ? (
                <Loader2 className="size-3.5 animate-spin" strokeWidth={2.5} />
              ) : (
                <Send className="size-3.5" strokeWidth={2.4} />
              )}
            </button>
          </div>
        )}
      </div>
      {error && <p className="m-0 text-[12px] text-uva-error-text">{error}</p>}
    </div>
  );
}

function ComentarioItem({
  ruta,
  leccionId,
  comentario,
  puedeComentar,
  usuarioActualId,
  esAdmin,
  onCambio,
  esRespuesta = false,
}: {
  ruta: string;
  /** Solo para reenviarlo a NuevoComentarioForm al responder — el like/borrar
   * de este comentario no lo necesita (van por comentarioId). */
  leccionId: string;
  comentario: ComentarioConRespuestas;
  puedeComentar: boolean;
  usuarioActualId: string | null;
  esAdmin: boolean;
  onCambio: () => void;
  esRespuesta?: boolean;
}) {
  const [respondiendo, setRespondiendo] = useState(false);
  const [verRespuestas, setVerRespuestas] = useState(false);
  const [likeOptimista, setLikeOptimista] = useState<{ meGusta: boolean; likes: number } | null>(
    null,
  );
  const [pendienteLike, startTransitionLike] = useTransition();
  const [pendienteBorrar, startTransitionBorrar] = useTransition();

  const meGusta = likeOptimista?.meGusta ?? comentario.meGusta;
  const likes = likeOptimista?.likes ?? comentario.likes;
  const puedeBorrar = !comentario.eliminado && (esAdmin || comentario.autorId === usuarioActualId);

  function toggleLike() {
    if (!usuarioActualId) return;
    const siguiente = { meGusta: !meGusta, likes: meGusta ? likes - 1 : likes + 1 };
    setLikeOptimista(siguiente);
    startTransitionLike(async () => {
      const resultado = siguiente.meGusta
        ? await darLikeComentario(comentario.id, ruta)
        : await quitarLikeComentario(comentario.id, ruta);
      if ("error" in resultado) {
        setLikeOptimista({ meGusta, likes });
        return;
      }
      onCambio();
    });
  }

  function borrar() {
    startTransitionBorrar(async () => {
      await eliminarComentario(comentario.id, ruta);
      onCambio();
    });
  }

  return (
    <div className="flex gap-[11px]">
      <div className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-[#27272A] text-uva-muted">
        <User className="size-[18px]" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-[7px]">
          <span className="inline-flex items-center gap-1.5 text-sm font-bold text-uva-text">
            {comentario.autor}
            {comentario.bandera && (
              <span
                aria-hidden
                className={`fi fi-${comentario.bandera} rounded-[2px]`}
              />
            )}
          </span>
          {comentario.esInstructor ? (
            <span className="inline-flex items-center gap-1 rounded-uva-xs bg-uva-accent-2-soft px-2.5 py-[3px] text-[11px] font-semibold tracking-[0.02em] text-uva-accent-2-text">
              <BadgeCheck className="size-3" strokeWidth={2.4} />
              Profesor
            </span>
          ) : (
            <span className="inline-flex items-center rounded-uva-xs bg-[#27272A] px-2.5 py-[3px] text-[11px] font-semibold tracking-[0.02em] text-uva-muted">
              Alumno
            </span>
          )}
        </div>
        <div className="mt-0.5 text-[12px] font-semibold text-uva-text opacity-45">
          {comentario.tiempo}
        </div>
        <div
          className={`mt-2 mb-2.5 text-sm leading-6 ${comentario.eliminado ? "text-uva-text-faint italic" : "text-uva-text opacity-90"}`}
        >
          {comentario.eliminado ? comentario.texto : renderizarComentario(comentario.texto)}
        </div>
        <div className="flex flex-wrap items-center gap-4 text-[12px] font-semibold text-uva-text opacity-60">
          <button
            type="button"
            disabled={!usuarioActualId || pendienteLike}
            onClick={toggleLike}
            className={`inline-flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 disabled:cursor-not-allowed ${meGusta ? "text-uva-accent opacity-100" : ""}`}
          >
            <Heart className="size-3.5" strokeWidth={2.4} fill={meGusta ? "currentColor" : "none"} />
            {likes}
          </button>
          {!esRespuesta && puedeComentar && !comentario.eliminado && (
            <button
              type="button"
              onClick={() => setRespondiendo((valor) => !valor)}
              className="inline-flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0"
            >
              <Reply className="size-3.5" strokeWidth={2.4} />
              Responder
            </button>
          )}
          {!esRespuesta && comentario.respuestas.length > 0 && (
            <button
              type="button"
              onClick={() => setVerRespuestas((valor) => !valor)}
              className="cursor-pointer border-0 bg-transparent p-0"
            >
              {verRespuestas ? "Ocultar" : "Ver"} {comentario.respuestas.length}{" "}
              {comentario.respuestas.length === 1 ? "respuesta" : "respuestas"}
            </button>
          )}
          {puedeBorrar && (
            <button
              type="button"
              disabled={pendienteBorrar}
              onClick={borrar}
              className="cursor-pointer border-0 bg-transparent p-0 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Eliminar
            </button>
          )}
        </div>

        {respondiendo && (
          <div className="mt-2.5">
            <NuevoComentarioForm
              ruta={ruta}
              leccionId={leccionId}
              idComentarioPadre={comentario.id}
              onPublicado={() => setVerRespuestas(true)}
              onCancelar={() => setRespondiendo(false)}
              autoFocus
            />
          </div>
        )}

        {verRespuestas && comentario.respuestas.length > 0 && (
          <div className="mt-3.5 flex flex-col gap-3.5 border-l border-uva-divider pl-3.5">
            {comentario.respuestas.map((respuesta) => (
              <ComentarioItem
                key={respuesta.id}
                ruta={ruta}
                leccionId={leccionId}
                comentario={respuesta}
                puedeComentar={puedeComentar}
                usuarioActualId={usuarioActualId}
                esAdmin={esAdmin}
                onCambio={onCambio}
                esRespuesta
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
