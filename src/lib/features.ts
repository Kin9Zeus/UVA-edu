/**
 * Bandera de la sección de precios. El MVP es gratuito y por invitación, así
 * que la sección de planes de la portada, el enlace "Precios" del menú y la
 * página pública /planes quedan ocultos. El código de los planes se conserva:
 * se reactiva con NEXT_PUBLIC_PRICING_ENABLED=true cuando entre el cobro.
 *
 * Es NEXT_PUBLIC_: Next la inlinea en el build, así que un cambio de valor
 * requiere un nuevo deploy (también para los componentes de cliente).
 */
export const PRECIOS_HABILITADOS =
  process.env.NEXT_PUBLIC_PRICING_ENABLED === "true";
