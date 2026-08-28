import { suscripcionDaAcceso } from "@/lib/estadoAcceso";
import type { SuscripcionActual } from "@/lib/suscripcion";

/**
 * Regla de autorización para firmar URLs de reproducción de Mux
 * (docs/technical-spec.md §5): solo si el usuario tiene una suscripción
 * VIGENTE —estado y fecha, ver `suscripcionDaAcceso`— o una CORTESÍA a ese
 * curso puntual otorgada por un administrador.
 *
 * Dos cosas que antes abrían el candado y ya no:
 *
 * 1. Una suscripción `ACTIVA` con la fecha de renovación ya pasada. Nada
 *    mueve la fila a VENCIDA al terminar el periodo, así que una invitación
 *    de 30 días reproducía video para siempre. La fecha se comprueba aquí,
 *    en cada lectura, no una sola vez al escribir la fila.
 *
 * 2. Cualquier fila de `inscripciones`. Una MEMBRESIA no es un permiso
 *    propio: es el registro de haber entrado al curso bajo una suscripción,
 *    y sobrevivía a su vencimiento (P0-1 de AUDIT-2026-08-26.md; la policy
 *    que las creaba se eliminó en 032, pero las filas viejas siguen ahí).
 *    Solo CORTESIA es un permiso independiente.
 *
 * `inscripciones` todavía no tiene columna de vencimiento (Flujo 11 de
 * functional-spec.md la pide), así que una cortesía sigue siendo indefinida.
 * Ajustar aquí el día que se agregue.
 */
export function tieneAccesoVigente(
  suscripcion: Pick<SuscripcionActual, "estado" | "fechaRenovacion"> | null,
  tieneCortesia: boolean,
  ahora: Date = new Date(),
): boolean {
  return suscripcionDaAcceso(suscripcion, ahora) || tieneCortesia;
}
