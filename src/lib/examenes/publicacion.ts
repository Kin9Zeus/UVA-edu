import type { TipoPreguntaImplementado } from "@/lib/examenes/tipos";

/**
 * Lo mínimo que hay que saber de un examen para decidir si puede publicarse.
 * Forma reducida a propósito: la regla no depende de nada más, así que se
 * prueba sin base de datos — mismo patrón que motivosParaNoPublicar()
 * (src/lib/admin/publicacion.ts) para los cursos.
 */
export type ExamenParaPublicar = {
  titulo: string;
  preguntas: {
    tipo: TipoPreguntaImplementado;
    puntos: number;
    /**
     * true si la pregunta quedó sin completar (ej. una EMPAREJAR recién
     * creada, con la plantilla de pares vacíos que pone `crearPregunta` y
     * que nadie llegó a editar). `preguntaEntradaSchema` ya rechaza esto al
     * GUARDAR una pregunta, pero una recién creada nunca pasa por ahí — el
     * caller decide qué cuenta como "incompleta" según el tipo, esta
     * función solo cuenta cuántas hay.
     */
    incompleta?: boolean;
  }[];
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

  const incompletas = examen.preguntas.filter((pregunta) => pregunta.incompleta).length;
  if (incompletas > 0) {
    motivos.push(
      incompletas === 1
        ? "Hay una pregunta sin completar."
        : `Hay ${incompletas} preguntas sin completar.`,
    );
  }

  // Ya no hay nada que revisar sobre la "nota para aprobar": el examen se
  // aprueba respondiendo bien TODAS las preguntas antes de quedarse sin
  // vidas, así que el viejo aviso de "con este umbral tendría que acertarlas
  // todas" describía a partir de ahora el comportamiento normal.

  return motivos;
}

export function sePuedePublicarExamen(examen: ExamenParaPublicar): boolean {
  return motivosParaNoPublicarExamen(examen).length === 0;
}
