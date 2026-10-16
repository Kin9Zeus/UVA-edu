/**
 * Cookie de corta vida que deja `confirmarEnlace` al confirmar un correo de
 * registro, para que `/auth/confirm?estado=confirmada` pinte el carné con el
 * nombre y el correo sin ponerlos en la URL. Sin esta cookie la página no
 * muestra "¡Correo confirmado!" (nadie puede ver un éxito escribiendo la URL
 * a mano): redirige al login.
 */
export const COOKIE_CORREO_CONFIRMADO = "uva-correo-confirmado";

/** Diez minutos: lo que tarda alguien en leer la pantalla y pulsar "Iniciar sesión". */
export const DURACION_CORREO_CONFIRMADO_S = 600;

export interface CorreoConfirmado {
  nombre: string;
  correo: string;
}

/**
 * JSON codificado con `encodeURIComponent`: las comillas y las comas no son
 * válidas en el valor de una cookie (RFC 6265), y así no depende de cómo las
 * trate cada navegador.
 */
export function serializarCorreoConfirmado(datos: CorreoConfirmado): string {
  return encodeURIComponent(JSON.stringify({ nombre: datos.nombre, correo: datos.correo }));
}

/** `null` si falta, no es JSON o no trae un correo. */
export function leerCorreoConfirmado(valor: string | undefined): CorreoConfirmado | null {
  if (!valor) return null;
  try {
    const datos: unknown = JSON.parse(decodeURIComponent(valor));
    if (!datos || typeof datos !== "object") return null;
    const { nombre, correo } = datos as Record<string, unknown>;
    if (typeof correo !== "string" || !correo) return null;
    return { nombre: typeof nombre === "string" ? nombre : "", correo };
  } catch {
    return null;
  }
}

/** Tipos de enlace de Supabase que confirman un correo de registro. */
export function esEnlaceDeRegistro(tipo: string | null | undefined): boolean {
  return tipo === "signup" || tipo === "email";
}
