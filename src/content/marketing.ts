/**
 * Cifras y funciones que la plataforma anuncia en público (portada, login,
 * planes). Es el único lugar donde se escriben: antes estaban repetidas a
 * mano en cada página y quedaron desactualizadas ("12.400 alumnos",
 * "180+ cursos", "340 plantillas") frente a lo que la plataforma tenía de
 * verdad (Notion: "Front: corregir cifras y funciones anunciadas que no son
 * reales").
 *
 * Regla: nada de lo que está aquí puede prometer algo que el estudiante no
 * pueda usar hoy al entrar. Si una función todavía no existe, no se anuncia.
 */

/**
 * Las cifras que se cuentan desde la base (ver `getCifrasPublicas()` en
 * `src/lib/cifrasPublicas.ts`) solo se muestran desde este mínimo: "1 curso"
 * no le dice nada a quien llega a la portada. Por debajo, la cifra no
 * aparece, y si ninguna llega, el bloque completo tampoco.
 */
export const MINIMOS_CIFRAS = {
  cursosPublicados: 10,
  escuelasConCursos: 5,
} as const;

export type Cifra = { valor: string; etiqueta: string };

/**
 * Cifras verificables que no salen de la base, por ejemplo la trayectoria
 * de U.V.A. en redes o en los diplomados en vivo. Cada una necesita una
 * fuente que se pueda comprobar; anotarla en un comentario al lado.
 * Vacío hasta que Aleck las entregue (Notion: "Front: cifras públicas
 * reales de la plataforma").
 */
export const CIFRAS_VERIFICABLES: readonly Cifra[] = [];

/** Lo que el estudiante encuentra al entrar. Sección "producto" de la portada. */
export const FUNCIONES_PLATAFORMA = [
  {
    titulo: "Cursos en video",
    descripcion: "Clases para ver a tu ritmo, en el celular o en el computador.",
  },
  {
    titulo: "Tu avance queda guardado",
    descripcion: "Retoma cada curso en la clase donde lo dejaste, desde cualquier dispositivo.",
  },
  {
    titulo: "Certificado digital verificable",
    descripcion: "Al terminar un curso recibes un certificado que cualquiera puede comprobar con su código.",
  },
  {
    titulo: "Plantillas descargables",
    descripcion: "Archivos de trabajo que acompañan las clases, listos para tus proyectos.",
  },
] as const;

/**
 * Beneficios de los planes. Hoy no se ven: los precios están apagados
 * (`PRECIOS_HABILITADOS`). El orden importa: `BENEFICIOS_POR_NIVEL`
 * (src/lib/planes.ts) marca como incluidos los primeros N de esta lista.
 */
export const BENEFICIOS_PLAN = [
  "Catálogo completo",
  "Certificado digital verificable",
  "Plantillas descargables",
] as const;
