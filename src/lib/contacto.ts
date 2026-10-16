/** Número de WhatsApp de U.V.A. — único canal de contacto público hoy. */
const WHATSAPP_TELEFONO = "%2B573234260022";

/** El mismo número, como se muestra (tarjeta de contacto de /soporte). */
export const WHATSAPP_VISIBLE = "+57 323 426 0022";

/** Horario en que el equipo responde por WhatsApp (confirmado con el equipo). */
// Con espacios que no se cortan: "8 a. m." no se parte en dos líneas.
export const HORARIO_ATENCION = "L a V, 8 a. m. a 6 p. m.";

/**
 * Enlace a WhatsApp con un mensaje opcional ya escrito. Sin mensaje, abre el
 * chat vacío (mismo enlace que el botón flotante y el pie de página).
 */
export function urlWhatsapp(mensaje?: string): string {
  const texto = mensaje ? encodeURIComponent(mensaje) : "";
  return `https://api.whatsapp.com/send/?phone=${WHATSAPP_TELEFONO}&text=${texto}&type=phone_number&app_absent=0`;
}
