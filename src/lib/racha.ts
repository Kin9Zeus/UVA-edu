/**
 * Racha de días seguidos con avance en alguna clase (inicio del panel,
 * "Tu obra"). Los días salen de `actividad_diaria` (supabase/sql/119), ya en
 * fecha de America/Bogota, como "AAAA-MM-DD".
 *
 * Una racha sigue viva si el último día con avance fue hoy o ayer: quien
 * estudió ayer y todavía no estudia hoy no la perdió, solo no la ha sumado.
 */
export function calcularRacha(fechas: string[], hoy: string): number {
  const dias = new Set(fechas);
  let dia = dias.has(hoy) ? hoy : diaAnterior(hoy);
  let racha = 0;
  while (dias.has(dia)) {
    racha++;
    dia = diaAnterior(dia);
  }
  return racha;
}

/** Hoy en America/Bogota, como "AAAA-MM-DD" (la misma zona del trigger). */
export function hoyEnBogota(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(ahora);
}

function diaAnterior(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export type SemanaActividad = {
  /** Lunes de la semana, "AAAA-MM-DD". */
  inicio: string;
  /** Días con avance en esa semana (0 a 7). */
  dias: number;
  esActual: boolean;
};

/**
 * Las últimas `cuantas` semanas (de lunes a domingo, en America/Bogota) con
 * cuántos días hubo avance en cada una; la última es la semana actual.
 */
export function semanasDeActividad(fechas: string[], hoy: string, cuantas = 4): SemanaActividad[] {
  const dias = new Set(fechas);
  const d = new Date(`${hoy}T12:00:00Z`);
  // getUTCDay: 0 = domingo. Se lleva al lunes de la semana de hoy.
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  const lunesActual = d.toISOString().slice(0, 10);

  return Array.from({ length: cuantas }, (_, i) => {
    const inicio = sumarDias(lunesActual, -7 * (cuantas - 1 - i));
    let cuenta = 0;
    for (let k = 0; k < 7; k++) if (dias.has(sumarDias(inicio, k))) cuenta++;
    return { inicio, dias: cuenta, esActual: inicio === lunesActual };
  });
}

function sumarDias(fecha: string, n: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
