/**
 * Clases del campo de búsqueda, compartidas por `BuscadorInput` (el campo
 * con sugerencias) y el campo simple que `BuscadorHeaderInput` muestra
 * mientras carga aquel. Viven aparte para que el campo simple no arrastre la
 * librería del autocompletado: si las dos versiones no fueran idénticas, el
 * header saltaría al cambiar una por otra.
 */
// 44 px y 16 px en pantallas táctiles (también el iPad: con 14 px Safari hace
// zoom al enfocar); con mouse, 40 px y 14 px.
export const CLASE_CAMPO_BUSCADOR =
  "h-11 w-full min-w-0 rounded-uva-md border border-uva-line-strong bg-uva-surface py-2 pr-3 pl-9 text-base text-uva-text caret-uva-accent outline-hidden placeholder:text-uva-text-faint hover:border-uva-text-faint focus-visible:border-uva-accent focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-uva-accent sm:pointer-fine:h-10 sm:pointer-fine:text-sm";

/** Ícono de lupa dentro del campo, a la izquierda. */
export const CLASE_ICONO_BUSCADOR =
  "pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-uva-text-faint";
