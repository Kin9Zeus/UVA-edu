import type { Bloque } from "@/lib/legal/bloques";
import type { SlugLegal } from "@/lib/legal/slugs";

/**
 * Textos legales de origen: la versión que se redacta, se revisa en un pull
 * request y se aprueba por escrito. La base de datos (`textos_legales`) guarda
 * la copia que se publica y es inmutable una vez publicada; esto es de donde
 * sale. `npm run legal:sembrar` copia cada texto de aquí a la base como
 * BORRADOR, y `npm run legal:publicar` lo publica con su fecha de vigencia.
 *
 * Para cambiar un texto ya publicado NO se edita la entrada existente (la
 * siembra se negaría): se agrega una entrada nueva con la versión siguiente.
 * Cada archivo `<slug>.<version>.ts` exporta un `TextoFuente`.
 *
 * Vacío a propósito por ahora: los cinco textos del documento "UVA: marco
 * legal de la plataforma y textos oficiales" se cargan aquí cuando tengan la
 * aprobación del abogado y del CEO. Lo que va entre corchetes es un dato que
 * solo UVA puede completar y se reemplaza antes de publicar (la publicación se
 * niega a continuar mientras quede alguno).
 */
export type TextoFuente = {
  slug: SlugLegal;
  /** "1.0", "1.1", "2.0"… único por slug. */
  version: string;
  titulo: string;
  bloques: Bloque[];
};

export const TEXTOS_LEGALES_FUENTE: TextoFuente[] = [];
