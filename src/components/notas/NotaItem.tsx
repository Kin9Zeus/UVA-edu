"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, Clock, Pencil, Play, Trash2 } from "lucide-react";
import {
  EditorTextoEnriquecido,
  type EditorTextoEnriquecidoHandle,
} from "@/components/editor/EditorTextoEnriquecido";
import { editarNota } from "@/actions/notas/editar";
import { eliminarNota } from "@/actions/notas/eliminar";
import type { NotaLeccion } from "@/lib/notas";
import { duracionIsoNota, formatearTiempoNota } from "@/lib/notas-validacion";
import { renderizarTextoFormateado } from "@/lib/formato-texto";
import { cn } from "@/lib/utils";

/** Orden por segundo; `sort` es estable, así que a igual segundo se respeta el orden previo. */
export function ordenarNotas<T extends NotaLeccion>(notas: T[]): T[] {
  return [...notas].sort((a, b) => a.segundo - b.segundo);
}

/**
 * Qué hace el minuto de la nota al tocarlo:
 * · `onSaltar`: la nota es de la clase abierta — mueve el video ahí.
 * · `href`: la nota es de otra clase (o se ve desde "Mis notas") — navega a
 *   esa clase con `?t=` (docs/notas-leccion.md §6.4).
 * · null: sin acceso al curso o sin video — el minuto es solo texto.
 */
export type SaltoNota = { onSaltar: (segundo: number) => void } | { href: string } | null;

/**
 * Una nota privada: minuto, texto, editar y eliminar. Compartida por la
 * pestaña Notas del reproductor y la página "Mis notas".
 *
 * La lista vive en quien la usa (`onCambiarNotas`), y acá solo se aplican
 * cambios optimistas con reversión si el servidor los rechaza — mismo
 * criterio que los likes de comentarios.
 */
export function NotaItem<T extends NotaLeccion>({
  nota,
  salto,
  obtenerSegundoActual,
  onCambiarNotas,
  onAviso,
  onEliminada,
  cuaderno = false,
}: {
  nota: T;
  salto: SaltoNota;
  /** Solo dentro del reproductor: habilita "Usar el minuto actual". */
  obtenerSegundoActual?: () => number;
  onCambiarNotas: (actualizar: (notas: T[]) => T[]) => void;
  onAviso: (mensaje: string) => void;
  /** Para devolver el foco a un punto estable una vez que la nota desaparece. */
  onEliminada: () => void;
  /** "Mis notas": desde 760 px de contenedor, minuto a la izquierda, texto
   *  al centro y acciones a la derecha (necesita un `@container` arriba). */
  cuaderno?: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  // Segundo propuesto durante la edición ("Usar el minuto actual").
  const [segundoEdicion, setSegundoEdicion] = useState(nota.segundo);
  const [vacia, setVacia] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const editorRef = useRef<EditorTextoEnriquecidoHandle>(null);
  const botonEditarRef = useRef<HTMLButtonElement>(null);

  const tiempo = formatearTiempoNota(nota.segundo);
  const claseMinuto =
    "inline-flex min-h-11 cursor-pointer items-center gap-1.5 justify-self-start rounded-full border border-uva-line-strong bg-uva-surface px-3.5 font-mono text-uva-cuerpo font-bold whitespace-nowrap text-uva-accent-ink no-underline hover:border-uva-accent-ink";
  const contenidoMinuto = (
    <>
      <Play className="size-3.5 fill-current" strokeWidth={0} aria-hidden />
      <time dateTime={duracionIsoNota(nota.segundo)}>{tiempo}</time>
    </>
  );
  const claseIcono =
    "grid size-11 cursor-pointer place-items-center rounded-uva-md border-0 bg-transparent text-uva-text-muted hover:bg-uva-surface-2 hover:text-uva-text disabled:opacity-50";
  // En el cuaderno, todo lo que no es la cabecera va en la columna central.
  const columnaTexto = cuaderno ? "@min-[760px]:col-start-2" : "";

  function guardarEdicion() {
    const texto = editorRef.current?.obtenerTexto() ?? "";
    if (!texto) return;
    const anterior = nota;
    const cambioSegundo = segundoEdicion !== nota.segundo;
    setError(null);
    onCambiarNotas((actuales) =>
      ordenarNotas(
        actuales.map((n) => (n.id === nota.id ? { ...n, contenido: texto, segundo: segundoEdicion } : n)),
      ),
    );
    setEditando(false);
    startTransition(async () => {
      const resultado = await editarNota(nota.id, texto, cambioSegundo ? segundoEdicion : undefined);
      if ("error" in resultado) {
        onCambiarNotas((actuales) => ordenarNotas(actuales.map((n) => (n.id === anterior.id ? anterior : n))));
        setError(resultado.error);
        return;
      }
      onAviso("Nota actualizada.");
      requestAnimationFrame(() => botonEditarRef.current?.focus());
    });
  }

  function borrar() {
    const anterior = nota;
    onCambiarNotas((actuales) => actuales.filter((n) => n.id !== nota.id));
    onEliminada();
    startTransition(async () => {
      const resultado = await eliminarNota(nota.id);
      if ("error" in resultado) {
        onCambiarNotas((actuales) => ordenarNotas([...actuales, anterior]));
        onAviso(resultado.error);
        return;
      }
      onAviso("Nota eliminada.");
    });
  }

  return (
    <div
      className={cn(
        "grid gap-2",
        cuaderno && "@min-[760px]:grid-cols-[110px_minmax(0,1fr)_auto] @min-[760px]:items-start @min-[760px]:gap-x-4 @min-[760px]:gap-y-1",
      )}
    >
      <div className={cn("flex items-center gap-2", cuaderno && "@min-[760px]:contents")}>
        {salto && "onSaltar" in salto ? (
          <button
            type="button"
            onClick={() => salto.onSaltar(nota.segundo)}
            aria-label={`Ir al minuto ${tiempo}`}
            className={claseMinuto}
          >
            {contenidoMinuto}
          </button>
        ) : salto && "href" in salto ? (
          <Link href={salto.href} aria-label={`Ver la clase en el minuto ${tiempo}`} className={claseMinuto}>
            {contenidoMinuto}
          </Link>
        ) : (
          <span className="inline-flex min-h-11 items-center justify-self-start rounded-full border border-uva-line-strong bg-uva-surface px-3.5 font-mono text-uva-cuerpo font-bold text-uva-text-muted">
            <time dateTime={duracionIsoNota(nota.segundo)}>{tiempo}</time>
          </span>
        )}

        {!editando && !confirmandoBorrado && (
          <div className={cn("ml-auto flex items-center gap-0.5", cuaderno && "@min-[760px]:col-start-3 @min-[760px]:row-start-1")}>
            <button
              ref={botonEditarRef}
              type="button"
              onClick={() => {
                setSegundoEdicion(nota.segundo);
                setError(null);
                setEditando(true);
              }}
              disabled={pendiente}
              aria-label={`Editar la nota del minuto ${tiempo}`}
              className={claseIcono}
            >
              <Pencil className="size-[18px]" strokeWidth={2} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setConfirmandoBorrado(true)}
              disabled={pendiente}
              aria-label={`Eliminar la nota del minuto ${tiempo}`}
              className={claseIcono}
            >
              <Trash2 className="size-[18px]" strokeWidth={2} aria-hidden />
            </button>
          </div>
        )}
      </div>

      {editando ? (
        <div className={cn("flex flex-col gap-2", cuaderno && "@min-[760px]:col-start-2 @min-[760px]:row-start-1")}>
          <EditorTextoEnriquecido
            ref={editorRef}
            placeholder="Escribe tu nota…"
            autoFocus
            sinAdjuntos
            contenidoInicial={nota.contenido}
            onCambiar={setVacia}
          />
          <div className="flex flex-wrap items-center gap-3">
            {obtenerSegundoActual && (
              <button
                type="button"
                onClick={() => setSegundoEdicion(Math.floor(obtenerSegundoActual()))}
                className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-uva-detalle font-semibold text-uva-text-muted hover:text-uva-text"
              >
                <Clock className="size-4" strokeWidth={2.2} aria-hidden />
                Usar el minuto actual
                {segundoEdicion !== nota.segundo && (
                  <span className="font-mono text-uva-accent-ink">{formatearTiempoNota(segundoEdicion)}</span>
                )}
              </button>
            )}
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditando(false);
                  requestAnimationFrame(() => botonEditarRef.current?.focus());
                }}
                className="min-h-11 cursor-pointer rounded-uva-md border-0 bg-transparent px-4 text-uva-detalle font-semibold text-uva-text-muted hover:text-uva-text"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={vacia}
                onClick={guardarEdicion}
                className="inline-flex min-h-11 cursor-pointer items-center rounded-uva-md border-0 bg-uva-btn px-4 text-uva-detalle font-semibold text-uva-on-accent hover:bg-uva-btn-hover disabled:cursor-not-allowed disabled:bg-uva-text/15 disabled:text-uva-text-faint"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      ) : (
        // `break-words`: una nota larga sin espacios (una URL pegada, por
        // ejemplo) se corta dentro del recuadro en vez de desbordarlo —
        // pasaba tanto en "Mis notas" como en "Todo el curso" del
        // reproductor porque los dos comparten este componente.
        <div
          className={cn(
            "min-w-0 text-uva-cuerpo leading-relaxed break-words text-uva-text",
            cuaderno && "@min-[760px]:col-start-2 @min-[760px]:row-start-1 @min-[760px]:pt-[9px]",
          )}
        >
          {renderizarTextoFormateado(nota.contenido)}
        </div>
      )}

      {nota.videoCambio && (
        <p className={cn("m-0 flex items-start gap-2 text-uva-detalle text-uva-text-muted", columnaTexto)}>
          <AlertTriangle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden />
          El video de esta clase se actualizó después de que escribiste esta nota; el minuto puede no coincidir.
        </p>
      )}

      {confirmandoBorrado && (
        <div
          role="group"
          aria-label="Confirmar eliminación"
          className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 text-uva-detalle", columnaTexto)}
        >
          <span className="text-uva-text">¿Eliminar esta nota?</span>
          <button
            type="button"
            autoFocus
            onClick={() => {
              setConfirmandoBorrado(false);
              borrar();
            }}
            className="min-h-11 cursor-pointer rounded-uva-md border-[1.5px] border-uva-danger-text bg-transparent px-3.5 font-bold text-uva-danger-text"
          >
            Sí, eliminar
          </button>
          <button
            type="button"
            onClick={() => setConfirmandoBorrado(false)}
            className="min-h-11 cursor-pointer rounded-uva-md border-0 bg-transparent px-3.5 font-bold text-uva-text-muted hover:text-uva-text"
          >
            No
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className={cn("m-0 text-uva-detalle text-uva-error-text", columnaTexto)}>
          {error}
        </p>
      )}
    </div>
  );
}
