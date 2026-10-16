/**
 * Filtro por estado del catálogo del panel (`?estado=`). Vive aparte de
 * `lib/categoria.ts` porque lo usa también el componente de cliente del
 * catálogo, y `categoria.ts` arrastra código de servidor (`next/headers`).
 *
 * "Examen pendiente" cuenta como EN_PROGRESO: todavía no tiene certificado.
 */
export type FiltroEstado = "SIN_EMPEZAR" | "EN_PROGRESO" | "COMPLETADO";

const ESTADO_POR_PARAMETRO: Record<string, FiltroEstado> = {
  "sin-empezar": "SIN_EMPEZAR",
  "en-progreso": "EN_PROGRESO",
  completados: "COMPLETADO",
};

/** `?estado=` de la URL a un filtro conocido; cualquier otro valor es "Todos". */
export function filtroEstadoDeUrl(valor: string | undefined): FiltroEstado | undefined {
  // `Object.hasOwn`: con un índice directo, `?estado=toString` devolvía la
  // función heredada de Object en vez de "Todos".
  return valor && Object.hasOwn(ESTADO_POR_PARAMETRO, valor) ? ESTADO_POR_PARAMETRO[valor] : undefined;
}
