/**
 * "12 horas de teoría y práctica": la duración que imprime el certificado y
 * que muestra "Mis certificados", con la misma regla en los dos lados (suma
 * de las clases con video listo, redondeada a horas). `null` si da 0 horas:
 * sin duración registrada no se inventa una.
 */
export function duracionCertificadoTexto(totalSegundos: number): string | null {
  const horas = Math.round(totalSegundos / 3600);
  return horas > 0 ? `${horas} ${horas === 1 ? "hora" : "horas"} de teoría y práctica` : null;
}
