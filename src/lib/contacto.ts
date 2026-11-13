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

/**
 * Buzón de ayuda: lo citan los correos y es el "responder a" de todos los
 * envíos (si alguien contesta un correo, llega aquí y no a una dirección
 * que nadie lee). También para peticiones de datos personales (Habeas
 * Data). Recibe por Cloudflare Email Routing, que lo reenvía al correo del
 * equipo (docs/ops/correos.md).
 *
 * Antes las plantillas citaban un buzón en el dominio uva.edu, que es de la
 * Universidad de Virginia, no de U.V.A. `contacto.test.ts` falla si vuelve.
 */
export const CORREO_SOPORTE = "soporte@uvarq.com";

/**
 * Perfiles oficiales en redes. Los enlaza el pie de página y los declara el
 * `sameAs` de la organización (lib/seo/organizacion.ts): una sola lista para
 * que no se contradigan.
 */
export const REDES = {
  youtube: "https://www.youtube.com/@uvarq",
  instagram: "https://www.instagram.com/uvarq",
  spotify: "https://open.spotify.com/show/0JGnY0rLz1CJHhQ4gYeRva",
  tiktok: "https://www.tiktok.com/@uvarq",
} as const;

/** Para reportar vulnerabilidades: lo publica /.well-known/security.txt. */
export const CORREO_SEGURIDAD = "seguridad@uvarq.com";
