/**
 * Valor por defecto de `cursos.imagen_portada` mientras no se sube una
 * portada real (crearCurso, actions/admin/cursos.ts). Vive en un módulo sin
 * "use server" porque tanto el server action como componentes cliente
 * (admin y público) necesitan la misma constante para distinguir un curso
 * con portada real de uno que todavía muestra el placeholder.
 */
export const IMAGEN_PORTADA_PLACEHOLDER = "placeholder://curso-sin-portada";

export function esPortadaReal(url: string | null | undefined): url is string {
  return !!url && url !== IMAGEN_PORTADA_PLACEHOLDER;
}

/**
 * Límites de la portada de un curso. Están acá, y no en el Server Action,
 * porque ese módulo lleva "use server" a nivel de archivo y solo puede
 * exportar funciones async — antes cada formulario del admin repetía el
 * número a mano con un comentario pidiendo mantenerlos sincronizados.
 *
 * El chequeo del cliente solo sirve para dar el error de inmediato sin
 * gastar una subida; el que manda es el del servidor (validarPortada en
 * lib/admin/portada.ts), que además verifica el formato real decodificando
 * la imagen en vez de creerle al `type` que declara el navegador.
 */
export const TAMANO_MAXIMO_PORTADA = 2 * 1024 * 1024;

/** Formatos aceptados, en el orden en que se le muestran al administrador. */
export const FORMATOS_PORTADA = ["JPG", "PNG", "WebP"] as const;

/** Valor del `accept` del input de archivo. Coincide con FORMATOS_PORTADA. */
export const ACCEPT_PORTADA = "image/jpeg,image/png,image/webp";

/**
 * Dimensiones a las que el servidor normaliza toda portada: 16:9, la
 * relación de aspecto del catálogo. El recorte es centrado, igual que el
 * `object-cover` de la vista previa, para que lo que el administrador ve
 * antes de confirmar sea lo que queda guardado.
 */
export const ANCHO_PORTADA = 1280;
export const ALTO_PORTADA = 720;

/** Mensaje único de error de tipo, compartido por cliente y servidor. */
export const ERROR_FORMATO_PORTADA = `La imagen debe ser ${FORMATOS_PORTADA.join(", ")}.`;

/** Mensaje único de error de tamaño, compartido por cliente y servidor. */
export const ERROR_TAMANO_PORTADA = `La imagen no puede superar los ${TAMANO_MAXIMO_PORTADA / 1024 / 1024} MB.`;
