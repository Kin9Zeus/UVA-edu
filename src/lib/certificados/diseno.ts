/**
 * Piezas del diseño del certificado («curvas de nivel») que comparten el PDF
 * (`pdf.ts`) y su miniatura en pantalla (`MiniaturaCertificado`): si cambian
 * aquí, cambian en los dos y la vista previa nunca se aparta de lo que se
 * descarga. Medidas en unidades del diseño (1123 × 794, A4 apaisado).
 */

/** Logo U.V.A. de trazo, viewBox 0 0 128 48, trazo 3.2. */
export const LOGO_CERTIFICADO =
  "M2.4 5.6H12.6M41.6 5.6H31.8M3.8 4V26A18.6 17.4 0 0 0 41 26V4M2.2 23.6H42.6M50.2 4V43.4M50.2 42.4L88.6 4.6M64.2 42.6L89.6 17.2M86.6 42L122.8 5.2M124.2 4V43.6M85.6 42.4H125.8M86.6 30.4H125.8";

/** Firmas: trazo de cada una (viewBox 0 0 150 44), nombre y cargo. */
export const FIRMAS_CERTIFICADO = [
  {
    trazo: "M4 34c10-22 18-30 22-24s-8 26-2 24 14-26 20-22-6 20 0 18 10-14 16-14 4 10 10 8 12-10 20-8",
    nombre: "Sebastián Arias",
    cargo: "CEO",
  },
  {
    trazo: "M4 30c8-6 12-26 20-24s-10 28-4 26 10-18 16-16-2 14 4 12 8-10 14-9 6 8 12 6 10-6 18-6",
    nombre: "Felipe Cuartas",
    cargo: "CEO",
  },
] as const;

/** Textos fijos del certificado. */
export const TEXTOS_CERTIFICADO = {
  institucion: "Unidad Vectorial de Arquitectura",
  tipo: "Certificado de aprobación",
  antesDelNombre: "U.V.A. certifica que",
  antesDelCurso: "llegó a la cota más alta del curso",
} as const;

/** "18 de septiembre de 2026", en hora de Colombia, como el PDF. */
export function fechaCertificado(fecha: Date): string {
  return fecha.toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Bogota",
  });
}

/** Línea de datos bajo el curso: "18 de septiembre de 2026, 12 horas de teoría y práctica". */
export function lineaDatosCertificado(fecha: Date, duracionTexto: string | null): string {
  const fechaTexto = fechaCertificado(fecha);
  return duracionTexto ? `${fechaTexto}, ${duracionTexto}` : fechaTexto;
}

/** Dirección que va impresa junto al QR (sin protocolo) y la que codifica el QR. */
export function urlsVerificacion(origen: string, codigo: string): { impresa: string; qr: string } {
  const qr = `${origen}/verificar-certificado/${codigo}`;
  return { qr, impresa: qr.replace(/^https?:\/\//, "") };
}
