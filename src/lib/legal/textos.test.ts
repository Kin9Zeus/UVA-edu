import { describe, expect, it } from "vitest";
import { TEXTOS_LEGALES_FUENTE, type TextoFuente } from "@/content/legal";
import { corchetesSinResolver, parsearBloques } from "@/lib/legal/bloques";
import { obtenerTextoVigente } from "@/lib/legal/textos";

const texto = (version: string, vigenteDesde: string, slug: TextoFuente["slug"] = "terminos"): TextoFuente => ({
  slug,
  version,
  titulo: `Términos ${version}`,
  vigenteDesde,
  bloques: [{ tipo: "parrafo", contenido: "Texto." }],
});

const TEXTOS = [texto("1.0", "2026-12-01"), texto("2.0", "2027-03-01"), texto("1.0", "2026-12-01", "cookies")];

describe("obtenerTextoVigente", () => {
  it("sin ninguna versión que ya rija devuelve null (la página da 404 y no se enlaza)", () => {
    expect(obtenerTextoVigente("terminos", new Date("2026-11-30T12:00:00-05:00"), TEXTOS)).toBeNull();
    expect(obtenerTextoVigente("privacidad", new Date("2030-01-01"), TEXTOS)).toBeNull();
  });

  it("rige desde la medianoche de Colombia del día indicado", () => {
    expect(obtenerTextoVigente("terminos", new Date("2026-11-30T23:59:00-05:00"), TEXTOS)).toBeNull();
    expect(obtenerTextoVigente("terminos", new Date("2026-12-01T00:00:00-05:00"), TEXTOS)?.version).toBe("1.0");
  });

  it("una versión futura no reemplaza a la vigente hasta su día", () => {
    expect(obtenerTextoVigente("terminos", new Date("2027-02-28T12:00:00-05:00"), TEXTOS)?.version).toBe("1.0");
    expect(obtenerTextoVigente("terminos", new Date("2027-03-01T12:00:00-05:00"), TEXTOS)?.version).toBe("2.0");
  });
});

/**
 * Lo que antes revisaba el script de publicación, ahora sobre los archivos de
 * src/content/legal: un texto mal formado o a medias no llega a producción.
 */
describe("src/content/legal", () => {
  it.each(TEXTOS_LEGALES_FUENTE.map((t) => [`${t.slug} ${t.version}`, t] as const))(
    "%s: bloques válidos, fecha válida y sin datos entre corchetes",
    (_nombre, fuente) => {
      expect(parsearBloques(fuente.bloques)).toEqual(fuente.bloques);
      expect(fuente.vigenteDesde).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(fuente.vigenteDesde))).toBe(false);
      expect(corchetesSinResolver(fuente.bloques, fuente.titulo)).toEqual([]);
    },
  );

  it("cada versión aparece una sola vez por texto", () => {
    const claves = TEXTOS_LEGALES_FUENTE.map((t) => `${t.slug}@${t.version}`);
    expect(new Set(claves).size).toBe(claves.length);
  });
});
