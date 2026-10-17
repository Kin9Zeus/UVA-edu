"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AvisoErrorCarga } from "@/components/errores/AvisoErrorCarga";
import { comentariosVisibles } from "@/components/player/PlayerTabs";
import type { ComentarioConRespuestas } from "@/lib/comentarios";
import { renderizarTextoFormateado } from "@/lib/formato-texto";
import { cn } from "@/lib/utils";

/** Cuántos comentarios raíz se ven antes de "Ver los N comentarios". */
const VISIBLES_AL_INICIO = 4;

/**
 * Comentarios de una clase para quien no inició sesión (artboards "leccion" y
 * "leccion movil"): se leen, no se escriben. En lugar del cuadro para
 * comentar va "Entra para comentar", que vuelve a esta misma clase; sin
 * "me gusta" ni "Responder", que también piden cuenta.
 *
 * Los más recientes primero: el servidor los entrega del más antiguo al más
 * reciente (getComentariosDeLeccion), así que basta con invertirlos.
 */
export function ComentariosLectura({
  comentarios,
  noDisponibles,
  rutaEntrar,
  onReintentar,
}: {
  comentarios: ComentarioConRespuestas[];
  /** La lectura falló: se avisa con Reintentar, no con "todavía no hay comentarios". */
  noDisponibles: boolean;
  rutaEntrar: string;
  onReintentar: () => void;
}) {
  const visibles = useMemo(() => comentariosVisibles(comentarios).reverse(), [comentarios]);
  const [verTodos, setVerTodos] = useState(false);
  const total = visibles.reduce((suma, comentario) => suma + 1 + comentario.respuestas.length, 0);
  const mostrados = verTodos ? visibles : visibles.slice(0, VISIBLES_AL_INICIO);

  return (
    <div className="flex flex-col gap-3.5">
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

      {noDisponibles ? (
        <AvisoErrorCarga texto="No pudimos cargar los comentarios de esta clase." onReintentar={onReintentar} />
      ) : total === 0 ? (
        <p className="m-0 text-uva-detalle text-uva-text-muted">Todavía nadie comenta esta clase.</p>
      ) : (
        <>
          <p className="m-0 text-uva-detalle text-uva-text-muted">
            {total === 1 ? "1 comentario" : `${total} comentarios`}, los más recientes primero
          </p>
          <ul className="m-0 flex list-none flex-col p-0">
            {mostrados.map((comentario) => (
              <li key={comentario.id} className="border-t border-uva-divider py-3.5">
                <Comentario comentario={comentario} />
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
  esRespuesta = false,
}: {
  comentario: ComentarioConRespuestas;
  esRespuesta?: boolean;
}) {
  const [verRespuestas, setVerRespuestas] = useState(false);
  const respuestas = comentario.respuestas.length;

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
        {!esRespuesta && respuestas > 0 && (
          <button
            type="button"
            onClick={() => setVerRespuestas((valor) => !valor)}
            aria-expanded={verRespuestas}
            className="mt-1 inline-flex min-h-11 cursor-pointer items-center border-0 bg-transparent p-0 text-uva-detalle font-bold text-uva-accent-ink"
          >
            {verRespuestas ? "Ocultar" : "Ver"} {respuestas === 1 ? "1 respuesta" : `${respuestas} respuestas`}
          </button>
        )}
        {verRespuestas && (
          <ul className="m-0 mt-2 flex list-none flex-col gap-3.5 border-l border-uva-divider p-0 pl-3.5">
            {comentario.respuestas.map((respuesta) => (
              <li key={respuesta.id}>
                <Comentario comentario={respuesta} esRespuesta />
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
  const base = "grid size-9 shrink-0 place-items-center overflow-hidden rounded-full border border-uva-divider text-uva-detalle font-extrabold";
  if (comentario.eliminado) return <span aria-hidden className={cn(base, "bg-uva-surface-2")} />;
  if (comentario.autorFotoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- avatar chico servido desde Storage, mismo criterio que ComentarioItem (PlayerTabs.tsx)
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
