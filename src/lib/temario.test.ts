import { describe, expect, it } from "vitest";
import { temarioListo } from "@/lib/temario";

const leccion = (slug: string, orden: number, estado = "LISTO") => ({ slug, orden, estado_procesamiento: estado });

describe("temarioListo", () => {
  it("ordena módulos y clases por su orden, no por cómo llegan", () => {
    const temario = temarioListo([
      { orden: 2, titulo: "B", lecciones: [leccion("b2", 2), leccion("b1", 1)] },
      { orden: 1, titulo: "A", lecciones: [leccion("a1", 1)] },
    ]);
    expect(temario.map((t) => t.leccion.slug)).toEqual(["a1", "b1", "b2"]);
    expect(temario[1].modulo.titulo).toBe("B");
  });

  it("deja fuera las clases sin video listo", () => {
    const temario = temarioListo([
      { orden: 1, lecciones: [leccion("lista", 1), leccion("procesando", 2, "PROCESANDO"), leccion("borrador", 3, "PENDIENTE")] },
    ]);
    expect(temario.map((t) => t.leccion.slug)).toEqual(["lista"]);
  });

  it("acepta módulos sin clases", () => {
    expect(temarioListo([{ orden: 1, lecciones: null }, { orden: 2 }])).toEqual([]);
  });
});
