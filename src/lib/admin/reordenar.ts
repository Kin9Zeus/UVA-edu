/**
 * Mueve el elemento `id` a la posición `destino` (0..N-1) y devuelve la lista
 * nueva con los vecinos que quedaron a su lado, que es lo que piden
 * moverModulo, moverLeccion y moverPregunta. Lo usan tanto el arrastre como
 * los botones subir/bajar, para que los dos caminos guarden lo mismo.
 *
 * null si no hay nada que mover (id inexistente, destino fuera de la lista o
 * igual al origen).
 */
export function moverA<T extends { id: string }>(
  lista: T[],
  id: string,
  destino: number,
): { lista: T[]; destino: number; idAnterior: string | null; idSiguiente: string | null } | null {
  const origen = lista.findIndex((elemento) => elemento.id === id);
  if (origen === -1 || destino < 0 || destino >= lista.length || destino === origen) return null;

  const nueva = [...lista];
  const [movido] = nueva.splice(origen, 1);
  nueva.splice(destino, 0, movido);

  return {
    lista: nueva,
    destino,
    idAnterior: nueva[destino - 1]?.id ?? null,
    idSiguiente: nueva[destino + 1]?.id ?? null,
  };
}
