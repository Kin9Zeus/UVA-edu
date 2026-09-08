import { NOTA_APROBATORIA_MINIMA, type TipoPreguntaImplementado } from "@/lib/examenes/tipos";

/**
 * Lo mínimo que hay que saber de un examen para decidir si puede publicarse.
 * Forma reducida a propósito: la regla no depende de nada más, así que se
 * prueba sin base de datos — mismo patrón que motivosParaNoPublicar()
 * (src/lib/admin/publicacion.ts) para los cursos.
 */
export type ExamenParaPublicar = {
  titulo: string;
  notaAprobatoria: number;
  preguntas: { tipo: TipoPreguntaImplementado; puntos: number }[];
};

/**
 * Motivos por los que un examen NO puede publicarse todavía. Lista vacía = se
 * puede publicar.
 *
 * Importa más que en un curso: publicar un examen incompleto no deja "una
 * página fea", deja a estudiantes que ya terminaron todas las lecciones sin
 * poder certificarse hasta que alguien lo note. Por eso el interruptor de
 * publicar está bloqueado hasta que la lista quede vacía.
 *
 * Se devuelven todos los motivos que fallan, no el primero — mismo criterio
 * que en la publicación de cursos.
 */
export function motivosParaNoPublicarExamen(examen: ExamenParaPublicar): string[] {
  const motivos: string[] = [];

  if (examen.titulo.trim() === "") {
    motivos.push("El examen necesita un título.");
  }

  if (examen.preguntas.length === 0) {
    motivos.push("El examen necesita al menos una pregunta.");
  }

  if (examen.notaAprobatoria < NOTA_APROBATORIA_MINIMA) {
    motivos.push(`La nota para aprobar no puede bajar de ${NOTA_APROBATORIA_MINIMA}%.`);
  }

  // Con menos preguntas que el umbral, la nota mínima se vuelve más exigente
  // de lo que el admin cree: con 3 preguntas de 1 punto, el 75% obliga a
  // acertarlas TODAS (2/3 = 66,7%). No es un error —puede ser justo lo que se
  // quiere— pero sí algo que hay que decirle antes de publicar, no después de
  // que el primer estudiante repruebe por un solo fallo.
  const puntosTotales = examen.preguntas.reduce((suma, pregunta) => suma + pregunta.puntos, 0);
  if (puntosTotales > 0 && examen.preguntas.length > 0) {
    const puntosMinimos = Math.ceil((examen.notaAprobatoria / 100) * puntosTotales);
    const margen = puntosTotales - puntosMinimos;
    if (margen === 0 && examen.preguntas.length > 1) {
      motivos.push(
        `Con ${examen.preguntas.length} preguntas y ${examen.notaAprobatoria}% para aprobar, el estudiante tendría que acertarlas todas. Agrega preguntas o baja la exigencia.`,
      );
    }
  }

  return motivos;
}

export function sePuedePublicarExamen(examen: ExamenParaPublicar): boolean {
  return motivosParaNoPublicarExamen(examen).length === 0;
}
