"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, Clock, Pencil, Trash2 } from "lucide-react";
import {
  EditorTextoEnriquecido,
  type EditorTextoEnriquecidoHandle,
} from "@/components/editor/EditorTextoEnriquecido";
import { editarNota } from "@/actions/notas/editar";
import { eliminarNota } from "@/actions/notas/eliminar";
import type { NotaLeccion } from "@/lib/notas";
import { duracionIsoNota, formatearTiempoNota } from "@/lib/notas-validacion";
import { renderizarTextoFormateado } from "@/lib/formato-texto";

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
}: {
  nota: T;
  salto: SaltoNota;
  /** Solo dentro del reproductor: habilita "Usar el minuto actual". */
  obtenerSegundoActual?: () => number;
  onCambiarNotas: (actualizar: (notas: T[]) => T[]) => void;
  onAviso: (mensaje: string) => void;
  /** Para devolver el foco a un punto estable una vez que la nota desaparece. */
  onEliminada: () => void;
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
    "inline-flex min-h-7 cursor-pointer items-center gap-1.5 rounded-full border-0 bg-uva-accent-soft px-2.5 py-1 font-mono text-[12px] font-semibold text-uva-accent-text no-underline hover:bg-uva-accent/25";
  const contenidoMinuto = (
    <>
      <Clock className="size-3" strokeWidth={2.5} aria-hidden />
      <time dateTime={duracionIsoNota(nota.segundo)}>{tiempo}</time>
    </>
  );

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
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
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
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#27272A] px-2.5 py-1 font-mono text-[12px] text-uva-muted">
            <time dateTime={duracionIsoNota(nota.segundo)}>{tiempo}</time>
          </span>
        )}

        {!editando && !confirmandoBorrado && (
          <div className="ml-auto flex items-center gap-1">
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
              className="grid size-8 cursor-pointer place-items-center rounded-uva-md border-0 bg-transparent text-uva-muted hover:bg-[#27272A] hover:text-uva-text disabled:opacity-50"
            >
              <Pencil className="size-3.5" strokeWidth={2.2} />
            </button>
            <button
              type="button"
              onClick={() => setConfirmandoBorrado(true)}
              disabled={pendiente}
              aria-label={`Eliminar la nota del minuto ${tiempo}`}
              className="grid size-8 cursor-pointer place-items-center rounded-uva-md border-0 bg-transparent text-uva-muted hover:bg-[#27272A] hover:text-uva-text disabled:opacity-50"
            >
              <Trash2 className="size-3.5" strokeWidth={2.2} />
            </button>
          </div>
        )}
      </div>

      {editando ? (
        <div className="flex flex-col gap-2">
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
                className="inline-flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-[12.5px] font-semibold text-uva-muted hover:text-uva-text"
              >
                <Clock className="size-3.5" strokeWidth={2.4} />
                Usar el minuto actual
                {segundoEdicion !== nota.segundo && (
                  <span className="font-mono text-uva-accent-text">{formatearTiempoNota(segundoEdicion)}</span>
                )}
              </button>
            )}
            <div className="ml-auto flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setEditando(false);
                  requestAnimationFrame(() => botonEditarRef.current?.focus());
                }}
                className="cursor-pointer border-0 bg-transparent p-0 text-[12.5px] font-semibold text-uva-muted hover:text-uva-text"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={vacia}
                onClick={guardarEdicion}
                className="inline-flex cursor-pointer items-center rounded-uva-md border-0 bg-uva-accent px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-uva-accent-hover disabled:cursor-not-allowed disabled:bg-uva-text/15 disabled:text-uva-text-faint"
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
        <div className="min-w-0 text-sm leading-6 break-words text-uva-text opacity-90">
          {renderizarTextoFormateado(nota.contenido)}
        </div>
      )}

      {nota.videoCambio && (
        <p className="m-0 flex items-start gap-1.5 text-[12px] text-uva-muted">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" strokeWidth={2.2} aria-hidden />
          El video de esta clase se actualizó después de que escribiste esta nota; el minuto puede no coincidir.
        </p>
      )}

      {confirmandoBorrado && (
        <div role="group" aria-label="Confirmar eliminación" className="flex items-center gap-3 text-[12.5px]">
          <span className="text-uva-text">¿Eliminar esta nota?</span>
          <button
            type="button"
            autoFocus
            onClick={() => {
              setConfirmandoBorrado(false);
              borrar();
            }}
            className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-uva-danger-text hover:underline"
          >
            Sí, eliminar
          </button>
          <button
            type="button"
            onClick={() => setConfirmandoBorrado(false)}
            className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-uva-muted hover:text-uva-text"
          >
            No
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="m-0 text-[12px] text-uva-error-text">
          {error}
        </p>
      )}
    </div>
  );
}
