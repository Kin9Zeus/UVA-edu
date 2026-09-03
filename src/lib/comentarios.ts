import { createClient } from "@/lib/supabase/server";
import { tiempoRelativo } from "@/lib/admin/format";
import { logError } from "@/lib/log";
import { banderaDePais } from "@/lib/paises";

export type ComentarioConRespuestas = {
  id: string;
  autor: string;
  iniciales: string;
  /** null si el autor no tiene país guardado en su perfil. */
  bandera: string | null;
  /** Check de verificado: el autor tiene rol PROFESOR — no un snapshot, se
   * deriva del rol actual (ver comentario en el modelo `Comentarios`). */
  esInstructor: boolean;
  tiempo: string;
  texto: string;
  eliminado: boolean;
  likes: number;
  meGusta: boolean;
  autorId: string;
  respuestas: ComentarioConRespuestas[];
};

function iniciales(nombre: string) {
  return nombre
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase())
    .join("");
}

/**
 * Árbol de comentarios de una lección (raíces + un nivel de respuestas),
 * con conteo de likes y si el usuario actual ya dio like a cada uno.
 *
 * Dos consultas, no un embed a `perfiles`: `perfiles_select_propio`
 * (002/056) solo deja leer la fila propia o siendo administrador, así que
 * `perfiles!comentarios_id_usuario_fkey(...)` siempre volvía null para el
 * comentario de cualquier otro usuario (el nombre del autor nunca se veía
 * en producción, tapado por el fallback "Usuario" de abajo). Los datos
 * públicos del autor (nombre, rol, país) salen de la vista
 * `comentarios_autor_publico` (061_comentarios_autor_publico.sql), que
 * expone esas tres columnas nada más — nunca correo ni celular — con su
 * propio control de acceso calcado de comentarios_select_con_acceso.
 */
export async function getComentariosDeLeccion(
  leccionId: string,
  usuarioId: string | null,
): Promise<ComentarioConRespuestas[]> {
  const supabase = await createClient();

  const { data: filas, error } = await supabase
    .from("comentarios")
    .select(
      `id, id_comentario_padre, contenido, eliminado, creado_en, id_usuario,
       comentario_likes(id_usuario)`,
    )
    .eq("id_leccion", leccionId)
    .order("creado_en", { ascending: true });

  if (error) {
    logError("comentarios:listar", "no se pudieron leer los comentarios de la lección", error, {
      leccionId,
    });
    return [];
  }

  const autorIds = [...new Set((filas ?? []).map((fila) => fila.id_usuario as string))];
  const { data: autores } = autorIds.length
    ? await supabase.from("comentarios_autor_publico").select("id, nombre, rol, pais").in("id", autorIds)
    : { data: [] };
  const autoresPorId = new Map((autores ?? []).map((autor) => [autor.id as string, autor]));

  const planas = (filas ?? []).map((fila) => {
    const autor = autoresPorId.get(fila.id_usuario as string);
    const likes = fila.comentario_likes ?? [];
    return {
      id: fila.id as string,
      idPadre: fila.id_comentario_padre as string | null,
      autor: autor?.nombre ?? "Usuario",
      iniciales: iniciales(autor?.nombre ?? "?"),
      bandera: banderaDePais((autor?.pais as string | null) ?? null),
      esInstructor: autor?.rol === "PROFESOR",
      tiempo: tiempoRelativo(fila.creado_en as string),
      texto: fila.eliminado ? "[comentario eliminado]" : (fila.contenido as string),
      eliminado: fila.eliminado as boolean,
      likes: likes.length,
      meGusta: usuarioId ? likes.some((like) => like.id_usuario === usuarioId) : false,
      autorId: fila.id_usuario as string,
      respuestas: [] as ComentarioConRespuestas[],
    };
  });

  const porId = new Map(planas.map((comentario) => [comentario.id, comentario]));
  const raices: ComentarioConRespuestas[] = [];
  for (const comentario of planas) {
    if (comentario.idPadre && porId.has(comentario.idPadre)) {
      porId.get(comentario.idPadre)!.respuestas.push(comentario);
    } else {
      raices.push(comentario);
    }
  }
  return raices;
}
