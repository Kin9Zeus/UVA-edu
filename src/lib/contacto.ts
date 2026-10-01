/** Número de WhatsApp de U.V.A. — único canal de contacto público hoy. */
const WHATSAPP_TELEFONO = "%2B573234260022";

/**
 * Enlace a WhatsApp con un mensaje opcional ya escrito. Sin mensaje, abre el
 * chat vacío (mismo enlace que el botón flotante y el pie de página).
 */
export function urlWhatsapp(mensaje?: string): string {
  const texto = mensaje ? encodeURIComponent(mensaje) : "";
  return `https://api.whatsapp.com/send/?phone=${WHATSAPP_TELEFONO}&text=${texto}&type=phone_number&app_absent=0`;
}
