import { TEXTOS_LEGALES_FUENTE, type TextoFuente } from "@/content/legal";
import { SLUGS_LEGALES, type SlugLegal } from "@/lib/legal/slugs";

/**
 * Lectura de los textos legales (src/content/legal). Son parte del código:
 * no hay consulta que pueda fallar ni caché que invalidar.
 */
export type TextoLegal = TextoFuente;

/** Medianoche en Colombia (UTC-5, sin horario de verano) del día dado. */
function inicioDelDia(fechaIso: string): number {
  return Date.parse(`${fechaIso}T00:00:00-05:00`);
}

/**
 * La versión que rige hoy: la de `vigenteDesde` más reciente que ya llegó.
 * `null` = el texto todavía no existe (la página da 404 y no se enlaza).
 */
export function obtenerTextoVigente(
  slug: SlugLegal,
  ahora: Date = new Date(),
  textos: TextoFuente[] = TEXTOS_LEGALES_FUENTE,
): TextoLegal | null {
  let vigente: TextoLegal | null = null;
  for (const texto of textos) {
    if (texto.slug !== slug || inicioDelDia(texto.vigenteDesde) > ahora.getTime()) continue;
    if (!vigente || texto.vigenteDesde > vigente.vigenteDesde) vigente = texto;
  }
  return vigente;
}

/** Qué textos tienen una versión vigente, en el orden fijo de SLUGS_LEGALES. */
export function slugsConTextoVigente(ahora: Date = new Date()): SlugLegal[] {
  return SLUGS_LEGALES.filter((slug) => obtenerTextoVigente(slug, ahora) !== null);
}

/**
 * Las versiones de los textos que se aceptan al registrarse en este momento,
 * para la prueba del consentimiento (supabase/sql/140). Solo en el servidor:
 * el formulario no importa este archivo, así los textos no viajan al
 * navegador. null = aún no hay texto.
 */
export function versionesQueSeAceptan() {
  return {
    terminos: obtenerTextoVigente("terminos")?.version ?? null,
    "datos-personales": obtenerTextoVigente("datos-personales")?.version ?? null,
  };
}
