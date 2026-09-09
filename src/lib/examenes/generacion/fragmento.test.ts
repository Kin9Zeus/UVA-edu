import { describe, expect, it } from "vitest";
import { normalizarParaComparar, validateFragment } from "./fragmento";
import { MAXIMO_PALABRAS_FRAGMENTO } from "./tipos";

const TRANSCRIPCION =
  "Hoy vamos a configurar la iluminación global en V-Ray. " +
  "El parámetro más importante es la subdivisión de la luz, " +
  "porque controla el ruido de la imagen final.";

describe("normalizarParaComparar", () => {
  it("borra tildes, mayúsculas, puntuación y espacios", () => {
    expect(normalizarParaComparar("La Iluminación, Global!")).toBe("lailuminacionglobal");
  });

  it("deja igual dos textos que solo difieren en el salto de línea del VTT", () => {
    expect(normalizarParaComparar("la subdivisión\nde la luz")).toBe(
      normalizarParaComparar("la subdivisión de la luz"),
    );
  });
});

describe("validateFragment", () => {
  it("acepta un fragmento textual de la transcripción", () => {
    expect(validateFragment("la subdivisión de la luz", TRANSCRIPCION)).toEqual({ valido: true });
  });

  it("acepta aunque cambien tildes, mayúsculas y puntuación", () => {
    expect(validateFragment("La SUBDIVISION, de la luz.", TRANSCRIPCION)).toEqual({
      valido: true,
    });
  });

  // El caso que justifica borrar los espacios al normalizar: Mux parte las
  // frases en cues de dos líneas, así que la transcripción guardada tiene
  // saltos donde el modelo cita texto corrido.
  it("acepta un fragmento partido por el salto de línea de un cue", () => {
    const conSalto = "El parámetro más importante\nes la subdivisión de la luz";
    expect(validateFragment("importante es la subdivisión", conSalto)).toEqual({ valido: true });
  });

  it("rechaza una frase que el profesor nunca dijo", () => {
    expect(validateFragment("la temperatura de color del sol", TRANSCRIPCION)).toEqual({
      valido: false,
      motivo: "no_aparece",
    });
  });

  // Sin la guarda del fragmento vacío, "".includes() es siempre true y esta
  // función dejaría de comprobar nada.
  it("rechaza un fragmento que se queda en nada al normalizar", () => {
    expect(validateFragment("  ...  ", TRANSCRIPCION)).toEqual({ valido: false, motivo: "vacio" });
  });

  // Sin el tope, citar la transcripción entera validaría siempre.
  it("rechaza un fragmento más largo que el tope de palabras", () => {
    const larguisimo = Array.from({ length: MAXIMO_PALABRAS_FRAGMENTO + 1 }, (_, i) => `p${i}`).join(
      " ",
    );
    expect(validateFragment(larguisimo, larguisimo)).toEqual({
      valido: false,
      motivo: "demasiado_largo",
    });
  });

  it("acepta justo en el tope de palabras", () => {
    const justo = Array.from({ length: MAXIMO_PALABRAS_FRAGMENTO }, (_, i) => `p${i}`).join(" ");
    expect(validateFragment(justo, `bla ${justo} bla`)).toEqual({ valido: true });
  });

  // La razón de ser de la firma: se valida contra UNA transcripción, no contra
  // el curso concatenado. Una pregunta del video A anclada a una frase del
  // video B tiene que fallar.
  it("rechaza un fragmento que está en otro video del mismo curso", () => {
    const otroVideo = "En esta clase hablamos de la cámara física y su ISO.";
    expect(validateFragment("la cámara física", TRANSCRIPCION)).toEqual({
      valido: false,
      motivo: "no_aparece",
    });
    expect(validateFragment("la cámara física", otroVideo)).toEqual({ valido: true });
  });
});
