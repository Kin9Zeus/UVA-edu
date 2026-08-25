/** Fila de `curso_categorias`: su propio id y el curso al que pertenece. */
export type FilaPuente = { id: string; idCurso: string };

export type PlanReasignacion = {
  /**
   * Filas a borrar: son de cursos que YA están en la categoría de destino.
   * Moverlas crearía una segunda fila (curso, destino) y chocaría contra el
   * UNIQUE (id_curso, id_categoria) de la puente. Borrarlas no le quita
   * nada al curso: la categoría de destino ya la tiene.
   */
  soltar: string[];
  /** Filas a repuntar hacia el destino: cursos que aún no lo tienen. */
  mover: string[];
};

/**
 * Decide qué hacer con cada fila de la categoría que se va a eliminar.
 *
 * Es la regla de "un curso nunca queda dos veces en la misma categoría":
 * si un curso estaba en {A, B} y se elimina A reasignando a B, el resultado
 * es {B} — no {B, B}. Vive aparte del Server Action para poder probarse sin
 * base de datos; `reasignarYEliminarCategoria` solo la ejecuta.
 */
export function planificarReasignacion(
  filasOrigen: FilaPuente[],
  cursosEnDestino: Iterable<string>,
): PlanReasignacion {
  const yaEnDestino = new Set(cursosEnDestino);
  const soltar: string[] = [];
  const mover: string[] = [];

  for (const fila of filasOrigen) {
    (yaEnDestino.has(fila.idCurso) ? soltar : mover).push(fila.id);
  }

  return { soltar, mover };
}
