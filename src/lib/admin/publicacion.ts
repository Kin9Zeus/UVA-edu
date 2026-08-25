import { esPortadaReal } from "@/lib/media";

/**
 * Lo mínimo que hay que saber de un curso para decidir si puede publicarse.
 * Es una forma reducida a propósito: la regla no depende de nada más, así
 * que se puede probar sin base de datos.
 */
export type CursoParaPublicar = {
  titulo: string;
  imagenPortada: string | null;
  modulos: {
    lecciones: { estadoProcesamiento: "SUBIENDO" | "PROCESANDO" | "LISTO" }[];
  }[];
};

/**
 * Motivos por los que un curso NO puede publicarse todavía. Lista vacía =
 * se puede publicar.
 *
 * Se devuelven TODOS los que fallan, no el primero: si al administrador le
 * faltan la portada y dos videos, quiere enterarse de las tres cosas de una
 * vez y no descubrirlas una por una a base de reintentos.
 *
 * El criterio sale de Revcurso: "el curso tiene título, portada, al menos un
 * módulo, y todas las lecciones tienen video en estado listo. Publicar un
 * curso a medias es peor que no publicarlo".
 */
export function motivosParaNoPublicar(curso: CursoParaPublicar): string[] {
  const motivos: string[] = [];

  if (curso.titulo.trim() === "") {
    motivos.push("El curso necesita un título.");
  }

  if (!esPortadaReal(curso.imagenPortada)) {
    motivos.push("El curso necesita una portada.");
  }

  if (curso.modulos.length === 0) {
    motivos.push("El curso necesita al menos un módulo.");
  }

  const lecciones = curso.modulos.flatMap((modulo) => modulo.lecciones);

  // Un módulo vacío no aporta nada al estudiante: cuenta como contenido a
  // medias igual que una lección sin video.
  if (curso.modulos.length > 0 && lecciones.length === 0) {
    motivos.push("El curso necesita al menos una lección.");
  }

  const sinVideoListo = lecciones.filter(
    (leccion) => leccion.estadoProcesamiento !== "LISTO",
  ).length;

  if (sinVideoListo > 0) {
    motivos.push(
      sinVideoListo === 1
        ? "Hay 1 lección cuyo video todavía no está listo."
        : `Hay ${sinVideoListo} lecciones cuyo video todavía no está listo.`,
    );
  }

  return motivos;
}

/** Azúcar para los sitios que solo necesitan el sí/no. */
export function sePuedePublicar(curso: CursoParaPublicar): boolean {
  return motivosParaNoPublicar(curso).length === 0;
}
