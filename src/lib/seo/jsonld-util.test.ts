import { describe, expect, it } from "vitest";
import { camposVacios, sinVacios } from "@/lib/seo/jsonld-util";

describe("sinVacios", () => {
  it("quita undefined, null, cadenas en blanco y arreglos u objetos vacíos", () => {
    expect(
      sinVacios({
        name: "UVA",
        description: "",
        alternateName: "   ",
        logo: undefined,
        address: null,
        sameAs: [],
        contactPoint: {},
      }),
    ).toEqual({ name: "UVA" });
  });

  it("limpia en profundidad y quita lo que queda vacío después", () => {
    expect(
      sinVacios({
        instructor: [{ "@type": "Person", name: "", jobTitle: null }],
        provider: { "@id": "https://uva.test/#organizacion", url: "" },
      }),
    ).toEqual({
      // La persona sin nombre ni cargo conserva solo su @type: no está vacía,
      // y decidir si un nodo sin nombre se publica es trabajo del generador.
      instructor: [{ "@type": "Person" }],
      provider: { "@id": "https://uva.test/#organizacion" },
    });
  });

  it("conserva 0 y false: son valores, no ausencias", () => {
    expect(sinVacios({ position: 0, isAccessibleForFree: false })).toEqual({
      position: 0,
      isAccessibleForFree: false,
    });
  });

  it("no modifica el objeto original", () => {
    const original = { name: "UVA", description: "" };
    sinVacios(original);
    expect(original).toEqual({ name: "UVA", description: "" });
  });
});

describe("camposVacios", () => {
  it("devuelve la ruta de cada campo vacío", () => {
    expect(camposVacios({ a: "", b: { c: null }, d: [1, []] })).toEqual(["$.a", "$.b.c", "$.d[1]"]);
  });

  it("un objeto limpio no tiene campos vacíos", () => {
    expect(camposVacios({ a: "x", b: [{ c: 1 }] })).toEqual([]);
  });
});
