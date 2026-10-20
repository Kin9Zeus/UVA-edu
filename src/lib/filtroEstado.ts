/**
 * Filtros del catálogo que viven en la URL (`?q=&categoria=&nivel=&estado=`).
 * Aparte de `lib/categoria.ts` porque los usan también los componentes de
 * cliente del catálogo, y `categoria.ts` arrastra código de servidor
 * (`next/headers`).
 *
 * Estado (`?estado=`, solo en el panel): "Examen pendiente" cuenta como
 * EN_PROGRESO, todavía no tiene certificado.
 */
import { numeroDePagina, parametroUnico, textoDeBusqueda, type ParametroUrl } from "@/lib/parametros-url";

export type FiltroEstado = "SIN_EMPEZAR" | "EN_PROGRESO" | "COMPLETADO";

export type FiltroNivel = "BASICO" | "INTERMEDIO" | "AVANZADO";

export const NIVELES: FiltroNivel[] = ["BASICO", "INTERMEDIO", "AVANZADO"];

export const PARAMETRO_DE_ESTADO: Record<FiltroEstado, string> = {
  SIN_EMPEZAR: "sin-empezar",
  EN_PROGRESO: "en-progreso",
  COMPLETADO: "completados",
};

export const PARAMETRO_DE_NIVEL: Record<FiltroNivel, string> = {
  BASICO: "basico",
  INTERMEDIO: "intermedio",
  AVANZADO: "avanzado",
};

/** Busca `valor` entre los valores de `mapa` y devuelve su clave. */
function claveDe<K extends string>(mapa: Record<K, string>, valor: string | undefined): K | undefined {
  // Recorre las entradas propias: con un índice directo, `?estado=toString`
  // devolvía la función heredada de Object en vez de "Todos".
  return valor ? (Object.entries(mapa) as [K, string][]).find(([, v]) => v === valor)?.[0] : undefined;
}

/** `?estado=` de la URL a un filtro conocido; cualquier otro valor es "Todos". */
export function filtroEstadoDeUrl(valor: string | undefined): FiltroEstado | undefined {
  return claveDe(PARAMETRO_DE_ESTADO, valor);
}

/** `?nivel=` de la URL a un nivel conocido; cualquier otro valor es "Todos". */
export function filtroNivelDeUrl(valor: string | undefined): FiltroNivel | undefined {
  return claveDe(PARAMETRO_DE_NIVEL, valor);
}

/** Lo que el catálogo muestra hoy, ya normalizado desde la URL. */
export type FiltrosCatalogo = {
  q?: string;
  categoria?: string;
  nivel?: FiltroNivel;
  estado?: FiltroEstado;
  pagina: number;
};

/** Parámetros de la URL del catálogo tal como llegan (un parámetro repetido llega como arreglo). */
export type ParametrosCatalogo = {
  q?: ParametroUrl;
  categoria?: ParametroUrl;
  nivel?: ParametroUrl;
  estado?: ParametroUrl;
  page?: ParametroUrl;
};

/** Los filtros del catálogo desde los parámetros de la URL, normalizados (ver lib/parametros-url.ts). */
export function filtrosDeUrl(parametros: ParametrosCatalogo): FiltrosCatalogo {
  return {
    q: textoDeBusqueda(parametros.q),
    categoria: parametroUnico(parametros.categoria),
    nivel: filtroNivelDeUrl(parametroUnico(parametros.nivel)),
    estado: filtroEstadoDeUrl(parametroUnico(parametros.estado)),
    pagina: numeroDePagina(parametros.page),
  };
}

/**
 * Dirección del catálogo con los filtros de hoy más `cambios`. Cambiar
 * cualquier filtro vuelve a los primeros cursos (sin `page`), salvo que el
 * cambio sea la página misma ("Cargar más").
 */
export function hrefCatalogo(
  ruta: string,
  filtros: FiltrosCatalogo,
  cambios: Partial<Omit<FiltrosCatalogo, "pagina">> & { pagina?: number } = {},
): string {
  const f = { ...filtros, pagina: 1, ...cambios };
  const params = new URLSearchParams();
  if (f.q) params.set("q", f.q);
  if (f.categoria) params.set("categoria", f.categoria);
  if (f.nivel) params.set("nivel", PARAMETRO_DE_NIVEL[f.nivel]);
  if (f.estado) params.set("estado", PARAMETRO_DE_ESTADO[f.estado]);
  if (f.pagina > 1) params.set("page", String(f.pagina));
  return params.size > 0 ? `${ruta}?${params.toString()}` : ruta;
}
