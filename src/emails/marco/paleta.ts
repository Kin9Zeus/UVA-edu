/**
 * Colores y letras de los correos.
 *
 * Los clientes de correo no entienden variables CSS, así que aquí los colores
 * van escritos (es la excepción a la regla de tokens de CLAUDE.md 3.3). Son los
 * mismos valores de src/app/globals.css.
 *
 * Los correos son OSCUROS siempre, igual que el tema por defecto de la
 * plataforma, también para quien tiene el teléfono en modo claro (decisión
 * del 2026-10-20: la versión clara que respetaba `prefers-color-scheme` hacía
 * que Outlook los mostrara blancos).
 *
 * src/emails/correos.test.ts mide cada par de texto/fondo con la misma regla AA de la app.
 */

export const OSCURO = {
  pagina: "#09090B",
  tarjeta: "#18181B",
  /** Texto principal y bordes fuertes (marco de carné, rótulo, banda). */
  tinta: "#FAFAFA",
  /** Texto secundario y etiquetas. */
  suave: "#B4B4BB",
  /** Bordes finos de fichas y recuadros, y separadores. */
  linea: "#27272A",
  /** Fondo de bloques apartados (motivo, foto del carné). */
  fondoSuave: "#0D0D10",
  enlace: "#FF7AB8",
} as const;

/** Lo que va en los estilos en línea. */
export const BASE = OSCURO;

/** Iguales siempre. */
export const FIJOS = {
  /** Relleno del botón principal: el `--uva-btn` de la app (blanco encima, 5,5:1). */
  boton: "#CC006D",
  sobreBoton: "#FFFFFF",
  /** Amarillo de marca: banda, sellos y cifras destacadas. */
  amarillo: "#FFC400",
  sobreAmarillo: "#09090B",
  /** Magenta puro: solo bordes (sello pendiente, ícono de alerta), nunca texto. */
  magenta: "#FF007A",
} as const;

export const LETRA = "'Plus Jakarta Sans',Arial,Helvetica,sans-serif";
export const LETRA_CODIGO = "'JetBrains Mono','Courier New',monospace";

/**
 * Buzón de ayuda que citan los correos. Es el mismo que usaban las plantillas
 * anteriores; el sitio no lo publica en ningún otro lugar.
 */
export const CORREO_SOPORTE = "soporte@uva.edu";
