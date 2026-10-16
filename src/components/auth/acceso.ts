/**
 * Clases del login rediseñado (Login lab 7, "Nivel plano técnico"),
 * compartidas por AuthFlow y LoginForm para que el correo y la contraseña
 * se vean iguales. El tablero del diseño es de 1440×900 con campos de 52 px;
 * aquí bajan a 48 px para que la tarjeta quepa en un portátil. La letra del
 * campo se queda en 16 px (si es menor, el iPhone hace zoom al tocar) y el
 * borde es `uva-muted-2`, que sí llega a 3:1 contra la tarjeta en los dos
 * temas; `uva-divider` no.
 */
export const ACCESO_LABEL = "mb-1.5 text-uva-detalle font-semibold text-uva-text bajo:mb-1";

export const ACCESO_INPUT =
  "h-12 border-[1.5px] border-uva-muted-2 px-3.5 text-base font-medium hover:border-uva-text sm:text-base bajo:h-11 aria-invalid:border-2 aria-invalid:border-uva-danger-text aria-invalid:ring-0";

export const ACCESO_BOTON = "h-12 text-uva-cuerpo bajo:h-11";

/** Enlaces y botones de texto: "Crear cuenta", "Cambiar", "¿Olvidaste…?". */
export const ACCESO_ENLACE =
  "inline-flex min-h-11 items-center px-1 text-uva-detalle font-semibold text-uva-accent-ink underline underline-offset-4";

/**
 * Título de cada paso (login y registro): la escala fluida de la dirección
 * visual (globals.css), que crece con el ancho; en una pantalla baja baja un
 * escalón para que todo quepa sin scroll.
 */
export const ACCESO_TITULO =
  "text-uva-titulo-3 text-balance text-uva-text focus:outline-none bajo:text-uva-titulo-4";

export const ACCESO_SUBTITULO = "text-uva-cuerpo text-uva-text-muted";

/** Notas de ayuda bajo una acción ("¿No te llegó?…"). */
export const ACCESO_NOTA = "text-uva-detalle text-uva-text-muted";
