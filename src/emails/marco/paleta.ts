/**
 * Colores y letras de los correos.
 *
 * Los clientes de correo no entienden variables CSS, así que aquí los colores
 * van escritos (es la excepción a la regla de tokens de CLAUDE.md 3.3). Son los
 * mismos valores de src/app/globals.css: claro como base, en estilos en línea,
 * y oscuro solo donde el cliente respeta `prefers-color-scheme` (Apple Mail,
 * Outlook nuevo), vía las clases de estilos.ts. Gmail ignora esa media query
 * y muestra el claro.
 *
 * paleta.test.ts mide cada par de texto/fondo con la misma regla AA de la app.
 */

export const CLARO = {
  pagina: "#F4F4F5",
  tarjeta: "#FFFFFF",
  /** Texto principal y bordes fuertes (marco de carné, rótulo, banda). */
  tinta: "#18181B",
  /** Texto secundario y etiquetas. */
  suave: "#52525B",
  /** Bordes finos de fichas y recuadros, y separadores. */
  linea: "#E4E4E7",
  /** Fondo de bloques apartados (motivo, foto del carné). */
  fondoSuave: "#F4F4F5",
  enlace: "#C2005B",
} as const;

export const OSCURO = {
  pagina: "#09090B",
  tarjeta: "#18181B",
  tinta: "#FAFAFA",
  suave: "#B4B4BB",
  linea: "#27272A",
  fondoSuave: "#0D0D10",
  enlace: "#FF7AB8",
} as const;

/** Iguales en los dos temas. */
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
