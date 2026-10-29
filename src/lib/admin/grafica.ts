/**
 * Un segmento de barra apilada que nace en `y` (su base) y sube `alto` px.
 * Solo el de arriba (`esTope`) lleva las esquinas redondeadas; la base queda
 * recta sobre el eje. La compartan las gráficas del panel para que todas
 * dibujen las barras igual.
 */
export function caminoSegmento(x: number, y: number, grosor: number, alto: number, esTope: boolean): string {
  if (!esTope) return `M${x} ${y}V${y - alto}H${x + grosor}V${y}Z`;
  const r = Math.min(4, grosor / 2, alto);
  return `M${x} ${y}V${y - alto + r}Q${x} ${y - alto} ${x + r} ${y - alto}H${x + grosor - r}Q${x + grosor} ${y - alto} ${x + grosor} ${y - alto + r}V${y}Z`;
}

/** Una serie de una gráfica apilada: su clave, el nombre de la leyenda y su color. */
export type SerieGrafica = { clave: string; nombre: string; color: string };

export type SemanaGrafica = {
  /** Lunes de la semana, "YYYY-MM-DD" en hora de Colombia. */
  inicio: string;
  porSerie: Record<string, number>;
  total: number;
};
