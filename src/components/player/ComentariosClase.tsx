"use client";

// Banderas del país de cada comentario (ver PerfilForm.tsx).
import "flag-icons/css/flag-icons.min.css";
import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Heart, Loader2, Reply } from "lucide-react";
import { AvisoErrorCarga } from "@/components/errores/AvisoErrorCarga";
import { ConfirmarEnLinea } from "@/components/ui/confirmar-en-linea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { comentariosVisibles } from "@/lib/comentarios-visibles";
import { crearComentario } from "@/actions/comentarios/crear";
import { eliminarComentario } from "@/actions/comentarios/eliminar";
import { darLikeComentario, quitarLikeComentario } from "@/actions/comentarios/like";
import type { ComentarioConRespuestas } from "@/lib/comentarios";
import {
  type FormatoId,
  BOTONES_FORMATO,
  COMANDO_FORMATO,
  alternarFormato,
  manejarEnterEnLista,
  renderizarTextoFormateado,
  serializarEditor,
} from "@/lib/formato-texto";
import { cn } from "@/lib/utils";

/** Cuántos comentarios raíz se ven antes de "Ver los N comentarios". */
const VISIBLES_AL_INICIO = 4;

type Orden = "recientes" | "relevantes" | "antiguos";

const ORDEN_LABEL: Record<Orden, string> = {
  recientes: "Más recientes",
  relevantes: "Más relevantes",
  antiguos: "Más antiguos",
};

/** Quién comenta: sin esto (visitante sin sesión) los comentarios solo se leen. */
export type SesionComentarios = {
  /** Ruta pública de la clase: las acciones revalidan esa página. */
  ruta: string;
  leccionId: string;
  usuarioActualId: string;
  esAdmin: boolean;
  /** El árbol vive en el servidor: tras publicar, borrar o dar "me gusta" se refresca. */
  onCambio: () => void;
};

/**
 * Comentarios de una clase con la dirección visual «Maqueta» (artboards
 * "leccion" y "leccion movil"). Con sesión: escribir, responder, "me gusta",
 * ordenar y borrar los propios (o cualquiera, si es administrador). Sin
 * sesión: se leen y, en lugar del cuadro para escribir, "Entra para comentar".
 *
 * El servidor los entrega del más antiguo al más reciente
 * (getComentariosDeLeccion); el orden por defecto es el inverso.
 */
export function ComentariosClase({
  comentarios,
  noDisponibles,
  onReintentar,
  sesion,
  rutaEntrar,
}: {
  comentarios: ComentarioConRespuestas[];
  /** La lectura falló: se avisa con Reintentar, no con "todavía no hay comentarios". */
  noDisponibles: boolean;
  onReintentar: () => void;
  sesion: SesionComentarios | null;
  /** Sin sesión: adónde lleva "Entra para comentar". */
  rutaEntrar: string;
}) {
  const visibles = useMemo(() => comentariosVisibles(comentarios), [comentarios]);
  const [orden, setOrden] = useState<Orden>("recientes");
  const ordenados = useMemo(() => {
    const copia = [...visibles];
    if (orden === "recientes") return copia.reverse();
    // `sort` es estable: un empate en "me gusta" queda del más antiguo al más reciente.
    if (orden === "relevantes") return copia.sort((a, b) => b.likes - a.likes);
    return copia;
  }, [visibles, orden]);
  const [verTodos, setVerTodos] = useState(false);
  const total = visibles.reduce((suma, comentario) => suma + 1 + comentario.respuestas.length, 0);
  const mostrados = verTodos ? ordenados : ordenados.slice(0, VISIBLES_AL_INICIO);

  return (
    <div className="flex flex-col gap-3.5">
      {sesion ? (
        <NuevoComentario sesion={sesion} />
      ) : (
        <div className="flex flex-col items-start gap-3 rounded-uva-md border-[1.5px] border-dashed border-uva-line-strong p-4">
          <p className="m-0 text-uva-detalle text-uva-text-muted">
            Con tu cuenta puedes comentar y preguntarle al instructor sobre esta clase.
          </p>
          <Link
            href={rutaEntrar}
            className="inline-flex min-h-11 items-center rounded-uva-md bg-uva-btn px-4.5 text-uva-detalle font-semibold text-uva-on-accent hover:bg-uva-btn-hover hover:no-underline"
          >
            Entra para comentar
          </Link>
        </div>
      )}

      {noDisponibles ? (
        <AvisoErrorCarga texto="No pudimos cargar los comentarios de esta clase." onReintentar={onReintentar} />
      ) : total === 0 ? (
        <p className="m-0 text-uva-detalle text-uva-text-muted">
          {sesion ? "Todavía nadie comenta esta clase. Sé quien abre la conversación." : "Todavía nadie comenta esta clase."}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="m-0 text-uva-detalle text-uva-text-muted">
              {total === 1 ? "1 comentario" : `${total} comentarios`}
            </p>
            {visibles.length > 1 && (
              <Select items={ORDEN_LABEL} value={orden} onValueChange={(valor) => valor && setOrden(valor as Orden)}>
                <SelectTrigger
                  aria-label="Ordenar comentarios"
                  className="text-base sm:pointer-fine:text-uva-detalle"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ORDEN_LABEL) as Orden[]).map((valor) => (
                    <SelectItem key={valor} value={valor}>
                      {ORDEN_LABEL[valor]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <ul className="m-0 flex list-none flex-col p-0">
            {mostrados.map((comentario) => (
              <li key={comentario.id} className="border-t border-uva-divider py-3.5">
                <Comentario comentario={comentario} sesion={sesion} />
              </li>
            ))}
          </ul>
          {visibles.length > VISIBLES_AL_INICIO && (
            <button
              type="button"
              onClick={() => setVerTodos((valor) => !valor)}
              aria-expanded={verTodos}
              className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-uva-md border-[1.5px] border-uva-line-strong bg-transparent px-5 text-uva-detalle font-semibold text-uva-text hover:border-uva-text"
            >
              {verTodos ? "Ver menos comentarios" : `Ver los ${total} comentarios`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function Comentario({
  comentario,
  sesion,
  esRespuesta = false,
}: {
  comentario: ComentarioConRespuestas;
  sesion: SesionComentarios | null;
  esRespuesta?: boolean;
}) {
  const [verRespuestas, setVerRespuestas] = useState(false);
  const [respondiendo, setRespondiendo] = useState(false);
  const [likeOptimista, setLikeOptimista] = useState<{ meGusta: boolean; likes: number } | null>(null);
  const [pendienteLike, startLike] = useTransition();
  const [pendienteBorrar, startBorrar] = useTransition();
  const respuestas = comentario.respuestas.length;
  const meGusta = likeOptimista?.meGusta ?? comentario.meGusta;
  const likes = likeOptimista?.likes ?? comentario.likes;
  const puedeBorrar =
    !!sesion && !comentario.eliminado && (sesion.esAdmin || comentario.autorId === sesion.usuarioActualId);

  function alternarLike() {
    if (!sesion) return;
    const siguiente = { meGusta: !meGusta, likes: meGusta ? likes - 1 : likes + 1 };
    setLikeOptimista(siguiente);
    startLike(async () => {
      const resultado = siguiente.meGusta
        ? await darLikeComentario(comentario.id, sesion.ruta)
        : await quitarLikeComentario(comentario.id, sesion.ruta);
      if ("error" in resultado) {
        setLikeOptimista({ meGusta, likes });
        return;
      }
      sesion.onCambio();
    });
  }

  function borrar() {
    if (!sesion) return;
    startBorrar(async () => {
      await eliminarComentario(comentario.id, sesion.ruta);
      sesion.onCambio();
    });
  }

  const accion =
    "inline-flex min-h-11 cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-uva-detalle font-bold disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div className="flex gap-3">
      <Avatar comentario={comentario} />
      <div className="min-w-0 flex-1">
        {/* Un comentario borrado se queda como lápida si tiene respuestas
            vivas (comentariosVisibles), pero sin nombre ni rol. */}
        {comentario.eliminado ? (
          <p className="m-0 text-uva-detalle font-bold text-uva-text-faint">Comentario eliminado</p>
        ) : (
          <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-uva-detalle">
            <b className="font-bold text-uva-text">{comentario.autor}</b>
            {comentario.bandera && (
              <span aria-hidden className={`fi fi-${comentario.bandera} rounded-[2px]`} />
            )}
            {comentario.esInstructor && (
              <span className="rounded-full bg-uva-accent-2 px-2 text-uva-detalle font-bold text-uva-on-bright">
                Instructor
              </span>
            )}
            <span className="text-uva-text-muted">{comentario.tiempo}</span>
          </p>
        )}
        <div
          className={cn(
            "mt-1 text-uva-detalle leading-relaxed [overflow-wrap:anywhere]",
            comentario.eliminado ? "text-uva-text-faint italic" : "text-uva-text",
          )}
        >
          {comentario.eliminado ? comentario.texto : renderizarTextoFormateado(comentario.texto)}
        </div>

        <div className="mt-0.5 flex flex-wrap items-center gap-x-4">
          {sesion && !comentario.eliminado && (
            <button
              type="button"
              onClick={alternarLike}
              disabled={pendienteLike}
              aria-pressed={meGusta}
              aria-label={`Me gusta, ${likes}`}
              className={cn(accion, meGusta ? "text-uva-accent-ink" : "text-uva-text-muted hover:text-uva-text")}
            >
              <Heart className="size-4" strokeWidth={2.2} fill={meGusta ? "currentColor" : "none"} aria-hidden />
              {likes}
            </button>
          )}
          {!sesion && likes > 0 && (
            <span className="inline-flex min-h-11 items-center gap-1.5 text-uva-detalle text-uva-text-muted">
              <Heart className="size-4" strokeWidth={2.2} aria-hidden />
              <span className="sr-only">Me gusta:</span>
              {likes}
            </span>
          )}
          {sesion && !esRespuesta && !comentario.eliminado && (
            <button
              type="button"
              onClick={() => setRespondiendo((valor) => !valor)}
              aria-expanded={respondiendo}
              className={cn(accion, "text-uva-accent-ink")}
            >
              <Reply className="size-4" strokeWidth={2.2} aria-hidden />
              Responder
            </button>
          )}
          {!esRespuesta && respuestas > 0 && (
            <button
              type="button"
              onClick={() => setVerRespuestas((valor) => !valor)}
              aria-expanded={verRespuestas}
              className={cn(accion, "text-uva-accent-ink")}
            >
              {verRespuestas ? "Ocultar" : "Ver"} {respuestas === 1 ? "1 respuesta" : `${respuestas} respuestas`}
            </button>
          )}
          {puedeBorrar && (
            <ConfirmarEnLinea
              etiqueta="Eliminar"
              pregunta={esRespuesta ? "¿Eliminar esta respuesta?" : "¿Eliminar este comentario?"}
              onConfirmar={borrar}
              disabled={pendienteBorrar}
              className={cn(accion, "text-uva-text-muted hover:text-uva-text")}
            />
          )}
        </div>

        {respondiendo && sesion && (
          <div className="mt-2">
            <NuevoComentario
              sesion={sesion}
              idComentarioPadre={comentario.id}
              onPublicado={() => setVerRespuestas(true)}
              onCancelar={() => setRespondiendo(false)}
            />
          </div>
        )}

        {verRespuestas && respuestas > 0 && (
          <ul className="m-0 mt-2 flex list-none flex-col gap-3.5 border-l border-uva-divider p-0 pl-3.5">
            {comentario.respuestas.map((respuesta) => (
              <li key={respuesta.id}>
                <Comentario comentario={respuesta} sesion={sesion} esRespuesta />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Foto del autor o sus iniciales; el instructor, en el amarillo de marca. */
function Avatar({ comentario }: { comentario: ComentarioConRespuestas }) {
  const base =
    "grid size-9 shrink-0 place-items-center overflow-hidden rounded-full border border-uva-divider text-uva-detalle font-extrabold";
  if (comentario.eliminado) return <span aria-hidden className={cn(base, "bg-uva-surface-2")} />;
  if (comentario.autorFotoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- avatar chico servido desde Storage, mismo criterio que AvatarImage (ui/avatar.tsx)
      <img src={comentario.autorFotoUrl} alt="" loading="lazy" className={cn(base, "object-cover")} />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        base,
        comentario.esInstructor ? "bg-uva-accent-2 text-uva-on-bright" : "bg-uva-surface-2 text-uva-text",
      )}
    >
      {comentario.iniciales}
    </span>
  );
}

/**
 * Cuadro para escribir un comentario o una respuesta. Es un `contenteditable`
 * con negrita, cursiva, subrayado y listas (lib/formato-texto): lo que se
 * guarda sigue siendo texto plano con marcadores, sin HTML.
 */
function NuevoComentario({
  sesion,
  idComentarioPadre = null,
  onPublicado,
  onCancelar,
}: {
  sesion: SesionComentarios;
  idComentarioPadre?: string | null;
  onPublicado?: () => void;
  /** Solo en una respuesta: la cierra del todo. */
  onCancelar?: () => void;
}) {
  const esRespuesta = idComentarioPadre !== null;
  const [vacio, setVacio] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startPublicar] = useTransition();
  // La barra de formato y los botones aparecen al enfocar; una respuesta
  // nace abierta.
  const [abierto, setAbierto] = useState(esRespuesta);
  const [activos, setActivos] = useState<Record<FormatoId, boolean>>({
    bold: false,
    italic: false,
    underline: false,
    list: false,
    "list-ordered": false,
  });
  const editorRef = useRef<HTMLDivElement>(null);
  const placeholder = esRespuesta ? "Escribe tu respuesta" : "Escribe un comentario o una pregunta sobre la clase";

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

  function limpiar() {
    if (editorRef.current) editorRef.current.innerHTML = "";
    setVacio(true);
    setError(null);
  }

  function cancelar() {
    limpiar();
    if (onCancelar) onCancelar();
    else setAbierto(false);
  }

  function publicar() {
    const texto = editorRef.current ? serializarEditor(editorRef.current) : "";
    if (!texto) return;
    setError(null);
    startPublicar(async () => {
      const resultado = await crearComentario(sesion.leccionId, texto, idComentarioPadre, sesion.ruta);
      if ("error" in resultado) {
        setError(resultado.error);
        return;
      }
      limpiar();
      // Cerrar ANTES de refrescar: router.refresh reemplaza el árbol y, si
      // corre primero, se traga el cierre programado en la misma transición.
      if (onCancelar) onCancelar();
      else setAbierto(false);
      onPublicado?.();
      sesion.onCambio();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col rounded-uva-md border-[1.5px] border-uva-line-strong bg-uva-surface focus-within:border-uva-accent">
        {abierto && (
          <div className="flex items-center gap-0.5 border-b border-uva-divider px-1.5 py-1">
            {BOTONES_FORMATO.map(({ tipo, icono: Icono, etiqueta }) => (
              <button
                key={tipo}
                type="button"
                aria-label={etiqueta}
                title={etiqueta}
                aria-pressed={activos[tipo]}
                // preventDefault en mousedown: si el editor pierde el foco
                // antes del clic, se pierde la selección sobre la que actúa.
                onMouseDown={(evento) => evento.preventDefault()}
                onClick={() => {
                  if (!editorRef.current) return;
                  alternarFormato(editorRef.current, tipo);
                  actualizarActivos();
                }}
                className={cn(
                  "grid size-9 shrink-0 cursor-pointer place-items-center rounded-uva-sm border-0",
                  activos[tipo]
                    ? "bg-uva-btn text-uva-on-accent"
                    : "bg-transparent text-uva-text-muted hover:bg-uva-chip hover:text-uva-text",
                )}
              >
                <Icono className="size-4" strokeWidth={2.2} aria-hidden />
              </button>
            ))}
          </div>
        )}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          autoFocus={esRespuesta}
          role="textbox"
          aria-multiline="true"
          aria-label={placeholder}
          data-placeholder={placeholder}
          onFocus={() => setAbierto(true)}
          onKeyDown={(evento) => editorRef.current && manejarEnterEnLista(evento.nativeEvent, editorRef.current)}
          onKeyUp={actualizarActivos}
          onMouseUp={actualizarActivos}
          onInput={() => {
            setVacio(!editorRef.current || editorRef.current.textContent?.trim() === "");
            actualizarActivos();
          }}
          className={cn(
            "max-h-48 overflow-y-auto px-3.5 py-3 text-base text-uva-text caret-uva-accent outline-none empty:before:text-uva-text-muted empty:before:content-[attr(data-placeholder)]",
            "[&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5",
            abierto ? "min-h-24" : "min-h-12",
          )}
        />
      </div>
      {abierto && (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={cancelar}
            className="inline-flex min-h-11 cursor-pointer items-center border-0 bg-transparent px-3 text-uva-detalle font-semibold text-uva-text-muted hover:text-uva-text"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={publicar}
            disabled={pendiente || vacio}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-uva-md border-0 bg-uva-btn px-4.5 text-uva-detalle font-semibold text-uva-on-accent hover:bg-uva-btn-hover disabled:cursor-not-allowed disabled:bg-uva-chip disabled:text-uva-text-muted"
          >
            {pendiente && <Loader2 className="size-4 animate-spin" strokeWidth={2.5} aria-hidden />}
            {pendiente ? "Publicando…" : esRespuesta ? "Responder" : "Publicar"}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="m-0 text-uva-detalle text-uva-error-text">
          {error}
        </p>
      )}
    </div>
  );
}
