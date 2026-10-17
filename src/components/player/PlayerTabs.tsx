"use client";

import type { ComentarioConRespuestas } from "@/lib/comentarios";
import type { DocumentoContenido } from "@/lib/editor/tipos";
import { RichTextRenderer } from "@/components/editor/RichTextRenderer";

/*
 * Piezas sueltas del reproductor anterior que siguen en uso: la vista previa
 * de administración (LeccionVistaPreviaContent) usa TabsHeader y ResumenTab;
 * la clase (LeccionMaqueta, ComentariosClase) usa comentariosVisibles y
 * contarComentarios.
 */

export type TabPlayer = "recursos" | "resumen" | "notas" | "comentarios";

const TAB_BASE =
  "flex cursor-pointer items-center gap-[7px] rounded-full border-0 px-4 py-[9px] text-[13px] font-semibold";

export function TabsHeader({
  tab,
  onTab,
  totalRecursos,
  totalComentarios,
  comentariosNoDisponibles = false,
  totalNotas,
  notasNoDisponibles = false,
}: {
  tab: TabPlayer;
  onTab: (tab: TabPlayer) => void;
  totalRecursos: number;
  /** Omitido en la vista previa sin sesión (LeccionVistaPreviaContent), que
   * no tiene comentarios: sin este dato la pestaña no se muestra. */
  totalComentarios?: number;
  /** Si la lectura falló, el contador se omite: un "0" diría que no hay comentarios. */
  comentariosNoDisponibles?: boolean;
  /** Omitido sin sesión (vista previa pública): las notas son de un
   * usuario, sin sesión no hay a quién pertenezcan. */
  totalNotas?: number;
  /** Igual que `comentariosNoDisponibles`, para las notas. */
  notasNoDisponibles?: boolean;
}) {
  const clase = (activo: boolean) =>
    `${TAB_BASE} ${activo ? "bg-uva-btn text-uva-on-accent" : "bg-transparent text-uva-muted"}`;

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
      {/* Comentarios y Notas, solo en mobile: en escritorio van en el panel
          de la derecha, junto al video, así que ahí estas pestañas sobrarían. */}
      {totalComentarios !== undefined && (
        <button
          type="button"
          onClick={() => onTab("comentarios")}
          className={`${clase(tab === "comentarios")} lg:hidden`}
        >
          Comentarios
          {!comentariosNoDisponibles && (
            <span className="font-mono text-[11px] opacity-65">{totalComentarios}</span>
          )}
        </button>
      )}
      {totalNotas !== undefined && (
        <button
          type="button"
          onClick={() => onTab("notas")}
          className={`${clase(tab === "notas")} lg:hidden`}
        >
          Notas
          {!notasNoDisponibles && <span className="font-mono text-[11px] opacity-65">{totalNotas}</span>}
        </button>
      )}
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
