import { diaEnColombia, sumarDias } from "@/lib/admin/bitacora";
import type { SemanaGrafica, SerieGrafica } from "@/lib/admin/grafica";

/** Cuántas semanas muestran las gráficas de Cupones y Planes. */
export const SEMANAS_GRAFICA = 12;
export const OTROS = "otros";
const MAX_SERIES = 4;

export function lunesDe(dia: string): string {
  const diaSemana = new Date(`${dia}T12:00:00Z`).getUTCDay();
  return sumarDias(dia, -((diaSemana + 6) % 7));
}

/** Las 12 semanas que terminan en la actual, vacías, en hora de Colombia. */
export function semanasRecientes(ahora: Date): { semanas: SemanaGrafica[]; primerLunes: string } {
  const primerLunes = sumarDias(lunesDe(diaEnColombia(ahora)), -7 * (SEMANAS_GRAFICA - 1));
  const semanas = Array.from({ length: SEMANAS_GRAFICA }, (_, i) => ({
    inicio: sumarDias(primerLunes, 7 * i),
    porSerie: {},
    total: 0,
  }));
  return { semanas, primerLunes };
}

/**
 * Hasta 4 series con nombre y, si sobra algo, "Otros". Entran las 4 de más
 * peso en la ventana, pero toman color según el orden de `entidades`, que
 * llega estable (cupones por antigüedad, planes por posición): así nadie
 * cambia de color porque otro lo pase en esta semana.
 */
export function elegirSeries(
  peso: Map<string, number>,
  entidades: { clave: string; nombre: string }[],
): { series: SerieGrafica[]; nombradas: Set<string> } {
  const posicion = new Map(entidades.map((entidad, i) => [entidad.clave, i]));
  const elegidas = [...peso.entries()]
    .filter(([clave, valor]) => posicion.has(clave) && valor > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_SERIES)
    .map(([clave]) => clave)
    .sort((a, b) => posicion.get(a)! - posicion.get(b)!);
  const nombradas = new Set(elegidas);
  const series: SerieGrafica[] = elegidas.map((clave, i) => ({
    clave,
    nombre: entidades[posicion.get(clave)!].nombre,
    color: `var(--uva-serie-${i + 1})`,
  }));
  if ([...peso.entries()].some(([clave, valor]) => valor > 0 && !nombradas.has(clave))) {
    series.push({ clave: OTROS, nombre: "Otros", color: "var(--uva-serie-5)" });
  }
  return { series, nombradas };
}
