import { createClient } from "@/lib/supabase/server";
import { tiempoRelativo } from "@/lib/admin/format";

export type ComentarioConRespuestas = {
  id: string;
  autor: string;
  iniciales: string;
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
 * Una sola consulta con embedding (mismo criterio que getLeccionPlayer):
 * RLS decide qué filas devuelve — comentarios_select_con_acceso
 * (052_comentarios.sql) ya filtra por acceso al curso o vista previa
 * pública, así que esta función no repite esa regla.
 */
export async function getComentariosDeLeccion(
  leccionId: string,
  usuarioId: string | null,
): Promise<ComentarioConRespuestas[]> {
  const supabase = await createClient();

  const { data: filas } = await supabase
    .from("comentarios")
    .select(
      `id, id_comentario_padre, contenido, eliminado, creado_en, id_usuario,
       usuario:perfiles(nombre, rol),
       comentario_likes(id_usuario)`,
    )
    .eq("id_leccion", leccionId)
    .order("creado_en", { ascending: true });

  const planas = (filas ?? []).map((fila) => {
    const usuario = Array.isArray(fila.usuario) ? fila.usuario[0] : fila.usuario;
    const likes = fila.comentario_likes ?? [];
    return {
      id: fila.id as string,
      idPadre: fila.id_comentario_padre as string | null,
      autor: usuario?.nombre ?? "Usuario",
      iniciales: iniciales(usuario?.nombre ?? "?"),
      esInstructor: usuario?.rol === "PROFESOR",
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
