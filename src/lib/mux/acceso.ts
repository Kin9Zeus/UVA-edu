/**
 * Regla de autorización para firmar URLs de reproducción de Mux
 * (docs/technical-spec.md §5): solo si el usuario tiene una Suscripción
 * ACTIVA/PAST_DUE (acceso global) o una Inscripción al curso puntual
 * (membresía dada de alta al entrar por primera vez, o cortesía).
 *
 * `inscripciones` hoy no tiene columna de fecha de vencimiento (ver
 * prisma/schema.prisma) aunque el Flujo 11 de functional-spec.md pide una
 * fecha de expiración obligatoria para cortesías — esa columna todavía no
 * existe en el esquema, así que cualquier fila de Inscripciones cuenta como
 * acceso vigente. Ajustar aquí el día que se agregue.
 */
export function tieneAccesoVigente(
  suscripcion: { estado: "ACTIVA" | "PAST_DUE" | "VENCIDA" | "CANCELADA" } | null,
  tieneInscripcion: boolean,
): boolean {
  if (suscripcion?.estado === "ACTIVA" || suscripcion?.estado === "PAST_DUE") return true;
  return tieneInscripcion;
}
