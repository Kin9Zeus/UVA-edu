/**
 * Descripciones para buscadores y tarjetas al compartir (SEO fase 14, tarea
 * de metadatos en Notion): de 140 a 155 caracteres y únicas por página.
 * Google corta lo que pasa de unos 155; menos de 140 desperdicia espacio.
 *
 * Viven aquí, y no en cada página, para que `descripciones.test.ts` mida
 * su largo sin cargar las páginas.
 */
export const DESCRIPCION_MINIMA = 140;
export const DESCRIPCION_MAXIMA = 155;

/**
 * Define la entidad (qué es UVA, dónde y de qué): es lo que leen los
 * asistentes de IA para no confundir a UVA con la fruta o con otra
 * institución (docs/seo/08-informe.md, riesgos). Las áreas son las del Hero.
 */
export const DESCRIPCION_META_PORTADA =
  "UVA es una escuela en línea de arquitectura y construcción en Colombia, con cursos de diseño, modelado, presupuesto, contratación y gestión de obra.";

/** Provisional: se revisa cuando estén los volúmenes de búsqueda (docs/seo/02-datos-palabras-clave.md). */
export const DESCRIPCION_META_CATALOGO =
  "Cursos en línea de arquitectura, obra, presupuesto y BIM, ordenados por escuela y nivel. Explora el catálogo completo de UVA y elige por dónde empezar.";

export const DESCRIPCION_META_SOPORTE =
  "Respuestas a las dudas frecuentes sobre tu cuenta, el acceso por invitación y los certificados de UVA, y cómo escribirnos si necesitas ayuda.";

/**
 * Respaldo de una escuela sin descripción propia en el admin. El nombre
 * cambia el largo, así que se agrega la frase de cierre más larga que quepa.
 */
export function descripcionEscuela(nombre: string): string {
  const base = `Cursos en línea de ${nombre} en UVA, formación técnica para el oficio de la construcción.`;
  const cierres = [" Revisa los cursos de esta escuela por nivel y elige el tuyo.", " Elige tu curso por nivel."];
  const cierre = cierres.find((c) => (base + c).length <= DESCRIPCION_MAXIMA) ?? "";
  return base + cierre;
}

/**
 * Recorta un texto largo (la descripción completa de un curso) a 155
 * caracteres en un límite de palabra, con «…». Provisional hasta el campo
 * SEO del admin de la Fase 15.
 */
export function recortarDescripcion(texto: string, maximo = DESCRIPCION_MAXIMA): string {
  const limpio = texto.replace(/\s+/g, " ").trim();
  if (limpio.length <= maximo) return limpio;
  const corte = limpio.slice(0, maximo).lastIndexOf(" ");
  const base = limpio.slice(0, corte > 0 ? corte : maximo - 1).replace(/[\s,;:.—-]+$/, "");
  return `${base}…`;
}
