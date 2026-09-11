import { afterEach, describe, expect, it } from "vitest";
import { construirSystemPrompt, validaPromptSistema } from "./prompt";
import { CAMPOS_PREGUNTA_GENERADA } from "./tipos";

/** Un prompt propio mínimo que SÍ cumple el contrato, para partir de él. */
const PROMPT_VALIDO =
  "Genera {totalPreguntas} preguntas en total. Devuelve videoId, question, " +
  "options, correctAnswerIndex y sourceFragment (frase textual de la transcripción).";

afterEach(() => {
  delete process.env.GEMINI_SYSTEM_PROMPT;
});

describe("construirSystemPrompt", () => {
  it("sin GEMINI_SYSTEM_PROMPT usa el prompt del código", () => {
    const prompt = construirSystemPrompt(4);

    expect(prompt).toContain("EXACTAMENTE 4 preguntas");
    expect(prompt).toContain("sourceFragment");
    // El prompt del código pide 4 opciones y 20 palabras desde las constantes;
    // si alguien las cambia, esto lo acompaña sin tocar el test.
    expect(prompt).not.toContain("{opcionesPorPregunta}");
    expect(prompt).not.toContain("{maximoPalabrasFragmento}");
  });

  it("interpola el total de preguntas que elige el administrador", () => {
    expect(construirSystemPrompt(1)).toContain("EXACTAMENTE 1 preguntas");
    expect(construirSystemPrompt(10)).toContain("EXACTAMENTE 10 preguntas");
  });

  it("usa el prompt del entorno cuando está definido y es válido", () => {
    process.env.GEMINI_SYSTEM_PROMPT = PROMPT_VALIDO;

    const prompt = construirSystemPrompt(7);

    expect(prompt).toContain("Genera 7 preguntas en total");
    expect(prompt).not.toContain("{totalPreguntas}");
  });

  it("ignora un prompt del entorno que solo tiene espacios", () => {
    process.env.GEMINI_SYSTEM_PROMPT = "   \n  ";
    expect(construirSystemPrompt(4)).toContain("Eres un generador de exámenes");
  });
});

/**
 * La guarda del prompt.
 *
 * El modo de fallo que evita es el peor de todos: un prompt que no pide
 * `sourceFragment` produce preguntas que `validateFragment` descarta una por
 * una, y el resultado es un examen VACÍO sin una sola excepción ni nada en
 * Sentry. Parece que funcionó.
 */
describe("validaPromptSistema", () => {
  it("acepta un prompt que cumple el contrato", () => {
    expect(() => validaPromptSistema(PROMPT_VALIDO)).not.toThrow();
  });

  it("rechaza un prompt vacío", () => {
    expect(() => validaPromptSistema("  ")).toThrow(/vacía/);
  });

  it("rechaza que falte sourceFragment, que es el que vacía los exámenes", () => {
    const sinFragmento = PROMPT_VALIDO.replace("y sourceFragment", "");
    expect(() => validaPromptSistema(sinFragmento)).toThrow(/sourceFragment/);
  });

  it("nombra TODOS los campos que faltan, no solo el primero", () => {
    const pelado = "Genera {totalPreguntas} preguntas con videoId.";
    try {
      validaPromptSistema(pelado);
      expect.unreachable("debió lanzar");
    } catch (error) {
      const mensaje = (error as Error).message;
      expect(mensaje).toContain("question");
      expect(mensaje).toContain("options");
      expect(mensaje).toContain("correctAnswerIndex");
      expect(mensaje).toContain("sourceFragment");
    }
  });

  it("rechaza que falte el marcador del total de preguntas", () => {
    const fijo = PROMPT_VALIDO.replace("{totalPreguntas}", "5");
    expect(() => validaPromptSistema(fijo)).toThrow(/\{totalPreguntas\}/);
  });

  /**
   * La guarda no lleva su propia lista de campos: toma
   * `CAMPOS_PREGUNTA_GENERADA`, la misma constante contra la que `tipos.test.ts`
   * compara los dos esquemas. Así, el día que el esquema gane un campo, esta
   * comprobación empieza a exigirlo sola.
   */
  it("exige exactamente los campos del esquema, sin duplicar la lista", () => {
    for (const campo of CAMPOS_PREGUNTA_GENERADA) {
      const sinEse = PROMPT_VALIDO.replaceAll(campo, "");
      expect(() => validaPromptSistema(sinEse)).toThrow(new RegExp(campo));
    }
  });
});
