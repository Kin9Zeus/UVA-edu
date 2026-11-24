import type { Bloque } from "@/lib/legal/bloques";
import type { SlugLegal } from "@/lib/legal/slugs";

/**
 * Textos legales de la plataforma. Viven en el código: se redactan aquí, se
 * revisan en un pull request y git guarda el historial de cada versión. La
 * página /legal/<slug> muestra la versión vigente de cada uno y, apenas un
 * texto tenga una, aparece solo en el pie, el mapa del sitio y el aviso de
 * cookies (src/lib/legal/textos.ts).
 *
 * Cómo agregar o cambiar un texto
 * -------------------------------
 * - Un archivo por versión, `src/content/legal/<slug>.<version>.ts`, que
 *   exporta un `TextoFuente`; se importa y se agrega a la lista de abajo.
 * - Una versión que ya rigió NO se edita: quien se registró la aceptó tal
 *   cual (su consentimiento guarda el número de versión, supabase/sql/140).
 *   Se agrega una versión nueva con su `vigenteDesde`.
 * - `vigenteDesde` puede ser futura: hasta ese día se sigue mostrando la
 *   versión anterior.
 * - Nada entre corchetes: `textos.test.ts` falla si queda un dato por
 *   completar ("[NIT]", "[correo de contacto]").
 */
export type TextoFuente = {
  slug: SlugLegal;
  /** "1.0", "1.1", "2.0"… único por slug. */
  version: string;
  titulo: string;
  /** Fecha ISO (AAAA-MM-DD), hora de Colombia: desde ese día rige. */
  vigenteDesde: string;
  bloques: Bloque[];
};

export const TEXTOS_LEGALES_FUENTE: TextoFuente[] = [];
