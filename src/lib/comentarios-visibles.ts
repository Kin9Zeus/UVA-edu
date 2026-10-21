import type { ComentarioConRespuestas } from "@/lib/comentarios";

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
