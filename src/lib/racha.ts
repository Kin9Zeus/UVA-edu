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
