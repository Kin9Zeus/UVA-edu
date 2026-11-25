/**
 * Lo que el lector de pantalla anuncia del tiempo del examen (P2-16,
 * AUDIT-2026-11-23). El reloj visible cambia cada segundo y no se anuncia:
 * con `aria-live` en el reloj, el lector cortaba la lectura de la pregunta 60
 * veces en el último minuto. Este texto solo cambia al cruzar un umbral, y
 * una región `aria-live` solo habla cuando su texto cambia: tres avisos en
 * total.
 */
export function avisoDeTiempo(segundosRestantes: number): string {
  if (segundosRestantes <= 10) return "Quedan 10 segundos.";
  if (segundosRestantes <= 60) return "Queda 1 minuto.";
  if (segundosRestantes <= 300) return "Quedan 5 minutos.";
  return "";
}
