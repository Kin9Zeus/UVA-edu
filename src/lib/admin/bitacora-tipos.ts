/**
 * Cómo se agrupan las acciones de la bitácora en la pantalla del panel.
 * No se guarda en la base: sale de `entidad_afectada` y del verbo de la
 * acción, que ya se guardan, así que también clasifica las filas viejas.
 */

export const TIPOS_BITACORA = [
  { clave: "contenido", nombre: "Contenido" },
  { clave: "moderacion", nombre: "Moderación" },
  { clave: "personas", nombre: "Personas y accesos" },
  { clave: "invitaciones", nombre: "Invitaciones y cobros" },
  { clave: "datos", nombre: "Datos" },
] as const;

export type TipoBitacora = (typeof TIPOS_BITACORA)[number]["clave"];

/** La bitácora filtrada en Moderación: las decisiones anteriores de Comunidad. */
export const RUTA_DECISIONES_COMUNIDAD = "/admin/bitacora?tipo=moderacion";

/** Color de cada tipo en la gráfica y la lista: las series validadas de globals.css, en orden. */
export const COLOR_TIPO: Record<TipoBitacora, string> = {
  contenido: "var(--uva-serie-1)",
  moderacion: "var(--uva-serie-2)",
  personas: "var(--uva-serie-3)",
  invitaciones: "var(--uva-serie-4)",
  datos: "var(--uva-serie-5)",
};

const TIPO_POR_ENTIDAD: Record<string, TipoBitacora> = {
  cursos: "contenido",
  modulos: "contenido",
  lecciones: "contenido",
  examenes: "contenido",
  categorias: "contenido",
  trabajos_generacion_examen: "contenido",
  comunidad_posts: "moderacion",
  comunidad_reportes: "moderacion",
  curso_calificaciones: "moderacion",
  perfiles: "personas",
  suscripciones: "personas",
  inscripciones: "personas",
  intentos_examen: "personas",
  instructores: "personas",
  codigos_invitacion: "invitaciones",
  lotes_codigos_invitacion: "invitaciones",
  cupones: "invitaciones",
  planes: "invitaciones",
  bitacora_administrativa: "datos",
};

/** Sacar datos personales de la plataforma o borrarlos: va a "Datos" sin importar la tabla. */
const ACCION_DE_DATOS = /^(Exportó|Suprimió los datos)/;

export function tipoDeAccion(accion: string, entidad: string): TipoBitacora {
  if (ACCION_DE_DATOS.test(accion)) return "datos";
  return TIPO_POR_ENTIDAD[entidad] ?? "contenido";
}

/**
 * Acciones que no se deshacen o que sacan datos: borrar, cortar un acceso,
 * exportar. Son las que conviene mirar si algo raro pasó en el panel.
 */
export function esSensible(accion: string): boolean {
  return /^(Eliminó|Suspendió|Revocó|Quitó|Exportó|Suprimió)/.test(accion);
}

/** Filas guardadas antes de usar frases (la bitácora no se reescribe). */
const ACCIONES_LEGADAS: Record<string, string> = {
  GENERAR_EXAMEN_IA: "Generó el examen final con IA",
};

/** La acción en minúscula inicial, para leerla después del nombre: "Andrés Escobar publicó un curso". */
export function accionEnFrase(accion: string): string {
  const texto = ACCIONES_LEGADAS[accion] ?? accion;
  return texto.charAt(0).toLocaleLowerCase("es") + texto.slice(1);
}
