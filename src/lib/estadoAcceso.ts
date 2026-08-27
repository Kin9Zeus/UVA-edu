import type { SuscripcionActual } from "@/lib/suscripcion";

/** A partir de cuántos días restantes se muestra el aviso de vencimiento próximo. */
const UMBRAL_AVISO_DIAS = 7;

/**
 * OTORGADO_ADMIN (no "CORTESIA": esa palabra ya la usa
 * `Inscripciones.tipo_acceso` para el acceso a UN curso puntual otorgado
 * vía `ofrecerCortesia` — un concepto distinto a una suscripción completa
 * otorgada manualmente. Mismo nombre para dos cosas distintas confundía
 * tanto en el código como en la UI del admin).
 */
export type TipoAccesoGratuito = "INVITACION" | "OTORGADO_ADMIN";

/**
 * Clasifica un acceso manual (Fase 4: cupos gratuitos) para mostrarlo tanto
 * en el perfil del estudiante como en la ficha de usuario del admin — única
 * fuente de verdad para que ambos lados usen la misma etiqueta. `null` si la
 * suscripción es de pago (Stripe/Wompi) — esa vista vive en
 * `SuscripcionContent`, no aquí.
 *
 * INVITACION: el propio estudiante canjeó un código (`id_codigo_invitacion`
 * no nulo, ver `canjear_codigo_invitacion`, 017_canjear_codigo_invitacion.sql).
 * OTORGADO_ADMIN: un administrador lo otorgó directo (`otorgarMembresia`,
 * src/actions/admin/usuarios.ts), sin código de por medio.
 */
export function tipoAccesoGratuito(
  suscripcion: Pick<SuscripcionActual, "accesoManual" | "tieneCodigoInvitacion">,
): TipoAccesoGratuito | null {
  if (!suscripcion.accesoManual) return null;
  return suscripcion.tieneCodigoInvitacion ? "INVITACION" : "OTORGADO_ADMIN";
}

/**
 * Días restantes hasta `fechaRenovacion`, o `null` sin fecha límite.
 * `ahora` es inyectable para no invocar `Date.now()` en un componente
 * (react-hooks/purity), mismo criterio que `calcularDiasGracia` en gracia.ts.
 */
export function calcularDiasVigencia(
  fechaRenovacion: string | null,
  ahora: Date = new Date(),
): number | null {
  if (!fechaRenovacion) return null;
  const ms = new Date(fechaRenovacion).getTime() - ahora.getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

/** true si faltan pocos días y conviene mostrar el aviso de vencimiento próximo. */
export function proximoAVencer(diasRestantes: number | null): boolean {
  return diasRestantes !== null && diasRestantes <= UMBRAL_AVISO_DIAS;
}
