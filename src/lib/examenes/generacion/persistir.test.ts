import { describe, expect, it } from "vitest";
import {
  aOpcionesPregunta,
  aOpcionesVerdaderoFalso,
  aParesEmparejar,
  textoADocumento,
} from "./persistir";

describe("textoADocumento", () => {
  it("envuelve texto en un párrafo Tiptap", () => {
    expect(textoADocumento("¿Qué es un APU?")).toEqual({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "¿Qué es un APU?" }] }],
    });
  });

  // Tiptap rechaza un nodo `text` con string vacío al cargarlo, así que el
  // documento vacío tiene que ser un párrafo SIN `content`, no uno con un
  // `text` en blanco.
  it("un texto vacío produce un párrafo sin content, no un text vacío", () => {
    expect(textoADocumento("   ")).toEqual({ type: "doc", content: [{ type: "paragraph" }] });
  });
});

describe("aOpcionesPregunta", () => {
  it("marca correcta solo la opción del índice pedido", () => {
    const opciones = aOpcionesPregunta(["a", "b", "c", "d"], 1);
    expect(opciones.map((o) => o.correcta)).toEqual([false, true, false, false]);
  });

  it("genera un id distinto por opción", () => {
    const opciones = aOpcionesPregunta(["a", "b"], 0);
    expect(new Set(opciones.map((o) => o.id)).size).toBe(2);
  });

  it("recorta espacios del texto de la opción", () => {
    const opciones = aOpcionesPregunta(["  con espacios  "], 0);
    expect(opciones[0].texto).toBe("con espacios");
  });
});

describe("aOpcionesVerdaderoFalso", () => {
  it("marca Verdadero como correcta cuando la afirmación es cierta", () => {
    const opciones = aOpcionesVerdaderoFalso(true);
    expect(opciones).toEqual([
      { id: expect.any(String), texto: "Verdadero", correcta: true },
      { id: expect.any(String), texto: "Falso", correcta: false },
    ]);
  });

  it("marca Falso como correcta cuando la afirmación es falsa", () => {
    const opciones = aOpcionesVerdaderoFalso(false);
    expect(opciones.find((o) => o.texto === "Falso")?.correcta).toBe(true);
    expect(opciones.find((o) => o.texto === "Verdadero")?.correcta).toBe(false);
  });

  // `preguntaEntradaSchema` exige exactamente dos opciones para
  // VERDADERO_FALSO (src/lib/examenes/tipos.ts): esta función es la única
  // que las produce para una pregunta generada, así que romper el conteo acá
  // tumbaría la pregunta entera en el guardado.
  it("siempre produce exactamente dos opciones", () => {
    expect(aOpcionesVerdaderoFalso(true)).toHaveLength(2);
  });
});

describe("aParesEmparejar", () => {
  it("traduce left/right del modelo a izquierda/derecha del CMS", () => {
    const pares = aParesEmparejar([{ left: "Grava", right: "Material pétreo" }]);
    expect(pares[0]).toMatchObject({ izquierda: "Grava", derecha: "Material pétreo" });
  });

  it("cada par recibe un id propio, distinto del texto", () => {
    const pares = aParesEmparejar([
      { left: "A", right: "1" },
      { left: "B", right: "2" },
    ]);
    expect(new Set(pares.map((p) => p.id)).size).toBe(2);
  });
});
