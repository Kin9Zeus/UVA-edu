/**
 * Normalización de texto a slug, compartida por el CMS (slug de categoría,
 * que va en la URL pública del catálogo) y por Storage (nombre de carpeta
 * de las portadas). Vive en un módulo sin "use server" para que puedan
 * importarla tanto los Server Actions como componentes cliente.
 */

/** Longitud máxima del slug generado; coincide con el `left(..., 60)` del
 * relleno inicial en la migración 20260825010000_agrega_slug_a_categorias. */
const LARGO_MAXIMO = 60;

const PATRON_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Distingue un UUID de un slug en un identificador de ruta. Compartido por
 * todos los `resolverX(identificador)` (categoría, curso, lección) que
 * aceptan ambos formatos — enlaces con el slug nuevo y enlaces viejos que
 * todavía circulan con el UUID crudo.
 */
export function esUuid(identificador: string): boolean {
  return PATRON_UUID.test(identificador);
}

/**
 * "Diseño Paramétrico  2" -> "diseno-parametrico-2".
 *
 * `normalize("NFD")` separa cada letra acentuada de su diacrítico, y el
 * rango U+0300–U+036F (marcas combinantes) los descarta — así "ñ" cae en
 * "n" y "é" en "e" sin enumerar el alfabeto. Lo que no sea `[a-z0-9]`
 * colapsa a un solo guion, y los guiones de los extremos se recortan.
 *
 * Devuelve `respaldo` si el texto no deja ningún carácter utilizable (por
 * ejemplo un nombre que es solo emoji o solo signos de puntuación).
 */
export function slugificar(texto: string, respaldo = "categoria"): string {
  return (
    texto
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, LARGO_MAXIMO) || respaldo
  );
}

/**
 * Primer slug libre a partir de `base`, dado el conjunto de los que ya
 * están tomados: "diseno", si no, "diseno-2", "diseno-3"…
 *
 * El sufijo es la garantía de que guardar nunca falla por un choque de
 * nombres; el UNIQUE de la base sigue siendo la red de seguridad real ante
 * dos administradores creando la misma categoría a la vez.
 */
export function slugDisponible(base: string, tomados: Iterable<string>): string {
  const ocupados = new Set(tomados);
  if (!ocupados.has(base)) return base;

  for (let sufijo = 2; ; sufijo += 1) {
    const candidato = `${base.slice(0, LARGO_MAXIMO - String(sufijo).length - 1)}-${sufijo}`;
    if (!ocupados.has(candidato)) return candidato;
  }
}
