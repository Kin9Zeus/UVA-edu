/**
 * Sesión de «recuperar contraseña».
 *
 * En Supabase, abrir el enlace de recuperación INICIA SESIÓN: deja una sesión
 * normal en las cookies. Antes, quien abría el enlace y en vez de cambiar la
 * contraseña tocaba el logo quedaba dentro de su cuenta sin haberla cambiado,
 * y `actualizarPassword` aceptaba cualquier sesión (P2-1, AUDIT-2026-11-23).
 *
 * `confirmarEnlace` deja esta cookie al canjear un enlace de recuperación.
 * Mientras exista, el proxy solo deja usar las rutas del cambio de contraseña;
 * cualquier otra cierra la sesión. `actualizarPassword` la exige y la borra al
 * terminar.
 */
export const COOKIE_RECUPERACION = "uva_recuperacion";

/** Lo que dura el enlace de Supabase (OTP) basta para escribir la contraseña. */
export const DURACION_RECUPERACION_S = 15 * 60;

export const RUTA_CAMBIO_CONTRASENA = "/actualizar-password";

export const OPCIONES_COOKIE_RECUPERACION = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: DURACION_RECUPERACION_S,
  // En todo el sitio: el proxy la lee en cualquier ruta para saber cuándo cerrar.
  path: "/",
} as const;

/**
 * Rutas que sí son parte del cambio de contraseña: el formulario, el código
 * del segundo factor (los administradores lo escriben antes), el canje del
 * enlace y las técnicas (/api no usa la sesión de la persona).
 */
function rutaPermitida(pathname: string): boolean {
  return (
    pathname === RUTA_CAMBIO_CONTRASENA ||
    pathname === "/seguridad/verificar" ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/api/")
  );
}

/**
 *   seguir             no interviene.
 *   rechazar-precarga  Next precarga los enlaces visibles (el logo): eso no es
 *                      que la persona se haya ido, así que no se cierra nada;
 *                      solo no se le entrega la página.
 *   cerrar             se fue a otra parte: cerrar la sesión de recuperación.
 */
export function decidirRecuperacion(entrada: {
  pathname: string;
  tieneSesion: boolean;
  enRecuperacion: boolean;
  esPrecarga: boolean;
}): "seguir" | "rechazar-precarga" | "cerrar" {
  if (!entrada.tieneSesion || !entrada.enRecuperacion || rutaPermitida(entrada.pathname)) return "seguir";
  return entrada.esPrecarga ? "rechazar-precarga" : "cerrar";
}
