import type { CursoPublico } from "@/lib/curso";
import type { CalificacionesCurso } from "@/lib/curso-calificaciones";
import { esPortadaReal } from "@/lib/media";
import { SIN_INSTRUCTOR } from "@/lib/instructores";
import { referenciaOrganizacion } from "@/lib/seo/organizacion";
import { siteUrl } from "@/lib/site-url";

/**
 * `Course` de schema.org para la ficha pública de un curso.
 * Cierra AUDIT-2026-09-15.md — P2-5 (cero datos estructurados en el repo).
 *
 * Qué resuelve
 * ------------
 * La ficha ya dice en el HTML que el curso dura 3h20m y tiene 4.7 estrellas
 * sobre 12 reseñas, pero se lo dice a un humano: un rastreador tiene que
 * adivinar que "4.7" es una calificación y no un precio, y que "12" son
 * reseñas y no estudiantes. Esto se lo afirma sin ambigüedad. No cambia nada
 * de lo que se ve — es el MISMO contenido, en el formato que las máquinas
 * leen bien.
 *
 * Función pura, y por qué importa
 * --------------------------------
 * No toca la base ni `headers()`: recibe lo que la página ya cargó y
 * devuelve un objeto. Así se puede probar entero en vitest sin levantar
 * nada (mismo criterio que `calcularDesglose` en lib/pagos/descuento.ts), y
 * —más importante— no vuelve dinámica la página, que es justo lo que P2-4
 * está intentando arreglar.
 *
 * Lo que NO se emite, a propósito
 * --------------------------------
 * · `offers`. `Cursos` no tiene columna de precio: el acceso va por
 *   suscripción o por código de invitación, nunca por curso suelto. Un
 *   precio por curso sería una afirmación falsa, y el precio estructurado es
 *   de lo poco que Google contrasta contra la página y castiga con acción
 *   manual. Un `Course` sin `offers` es válido.
 * · `aggregateRating` cuando no hay reseñas. `getCalificacionesCurso`
 *   devuelve `promedio: null` y `total: 0` para un curso sin calificar;
 *   emitir `ratingValue: 0, ratingCount: 0` no es "un rating vacío", es
 *   structured data inválido. Se omite el nodo entero.
 * · `image` cuando la portada es el placeholder. Mismo criterio que ya usa
 *   `generateMetadata` para el `og:image` en esta misma página.
 * · El instructor cuando no hay ninguno asignado: `curso.instructores` viene
 *   vacío y el nombre visible es la constante `SIN_INSTRUCTOR`, que no es
 *   una persona.
 */

/** Segundos → duración ISO 8601 (`PT3H20M`), el formato que exige schema.org. */
export function duracionIso8601(segundos: number): string | null {
  if (!Number.isFinite(segundos) || segundos <= 0) return null;

  const horas = Math.floor(segundos / 3600);
  const minutos = Math.round((segundos % 3600) / 60);

  // 59m59s redondea a 60 minutos: sin esto saldría "PT60M", que es válido
  // pero se lee mal. Se normaliza a la hora siguiente.
  const horasFinales = minutos === 60 ? horas + 1 : horas;
  const minutosFinales = minutos === 60 ? 0 : minutos;

  if (horasFinales === 0 && minutosFinales === 0) return null;

  return `PT${horasFinales > 0 ? `${horasFinales}H` : ""}${minutosFinales > 0 ? `${minutosFinales}M` : ""}`;
}

/**
 * `curso.nivel` usa el enum de la base; schema.org espera texto libre en
 * `educationalLevel`. Se traduce al castellano porque el resto del contenido
 * del curso lo está: un `educationalLevel: "BASICO"` en mayúsculas de enum
 * es ruido de implementación filtrándose al dato público.
 */
const NIVEL_LEGIBLE: Record<CursoPublico["nivel"], string> = {
  BASICO: "Básico",
  INTERMEDIO: "Intermedio",
  AVANZADO: "Avanzado",
};

export function construirCursoJsonLd(
  curso: CursoPublico,
  calificaciones: CalificacionesCurso,
): Record<string, unknown> {
  // La MISMA url que el canonical de generateMetadata, y por el mismo
  // motivo: getCursoPublico resuelve por slug y por uuid, así que la ficha
  // vive en dos direcciones. Si el `url` del JSON-LD apuntara a la que pidió
  // el visitante, se estaría declarando la variante duplicada como canónica.
  const url = `${siteUrl()}/cursos/${curso.slug}`;

  const instructores = curso.instructores.filter((i) => i.nombre !== SIN_INSTRUCTOR);
  const duracion = duracionIso8601(curso.duracionTotalSegundos);

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Course",
    "@id": url,
    url,
    name: curso.titulo,
    description: curso.descripcion,
    inLanguage: "es",
    educationalLevel: NIVEL_LEGIBLE[curso.nivel],
    dateModified: curso.fechaEdicion,
    provider: referenciaOrganizacion(),
  };

  if (esPortadaReal(curso.imagenPortada)) {
    jsonLd.image = curso.imagenPortada;
  }

  if (curso.categorias.length > 0) {
    jsonLd.about = curso.categorias.map((c) => c.nombre);
  }

  if (instructores.length > 0) {
    jsonLd.instructor = instructores.map((i) => ({
      "@type": "Person",
      name: i.nombre,
      ...(i.especialidad ? { jobTitle: i.especialidad } : {}),
    }));
  }

  // Sin `hasCourseInstance` el curso solo califica para listados; con él
  // entra al rich result de Course Info, que es el que muestra modalidad y
  // duración bajo el resultado. `courseMode: "online"` es literal: no hay
  // presencialidad en la plataforma.
  jsonLd.hasCourseInstance = {
    "@type": "CourseInstance",
    courseMode: "online",
    ...(duracion ? { courseWorkload: duracion } : {}),
  };

  if (duracion) {
    jsonLd.timeRequired = duracion;
  }

  // Condicionado a que haya reseñas REALES: ver el encabezado. `promedio`
  // se comprueba aparte de `total` porque la vista
  // `curso_calificaciones_resumen` puede devolver total > 0 con promedio
  // null si todas las filas quedaran fuera del gate de visibilidad.
  if (calificaciones.total > 0 && calificaciones.promedio !== null) {
    jsonLd.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: calificaciones.promedio,
      ratingCount: calificaciones.total,
      bestRating: 5,
      worstRating: 1,
    };
  }

  return jsonLd;
}
