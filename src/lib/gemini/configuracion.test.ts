import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  _olvidaConfiguracionGemini,
  configuracionGemini,
  peorCasoMs,
} from "./configuracion";

/**
 * Las variables se escriben sobre `process.env` y se restauran enteras después
 * de cada caso: `configuracionGemini()` memoriza, así que un test que deje una
 * variable puesta contaminaría a los siguientes de forma difícil de ver.
 */
const VARIABLES = [
  "GEMINI_MODELS",
  "GEMINI_TIMEOUT_MS",
  "GEMINI_ATTEMPTS_PER_MODEL",
  "GEMINI_RETRY_BASE_MS",
  "GEMINI_TEMPERATURE",
  "GEMINI_TOP_P",
  "GEMINI_MAX_OUTPUT_TOKENS",
  "GEMINI_TARGET_LATENCY_MS",
  "GENERACION_ATASCADA_UMBRAL_MINUTOS",
] as const;

let original: Record<string, string | undefined>;

beforeEach(() => {
  original = Object.fromEntries(VARIABLES.map((nombre) => [nombre, process.env[nombre]]));
  for (const nombre of VARIABLES) delete process.env[nombre];
  _olvidaConfiguracionGemini();
});

afterEach(() => {
  for (const nombre of VARIABLES) {
    if (original[nombre] === undefined) delete process.env[nombre];
    else process.env[nombre] = original[nombre];
  }
  _olvidaConfiguracionGemini();
});

describe("configuracionGemini", () => {
  it("sin ninguna variable, usa los valores del código", () => {
    const config = configuracionGemini();

    expect(config.modelos).toEqual([
      "gemini-3.8-flash",
      "gemini-3.6-flash",
      "gemini-3.5-flash",
    ]);
    expect(config.tiempoLimiteMs).toBe(300_000);
    expect(config.intentosPorModelo).toBe(1);
    expect(config.temperatura).toBe(0.3);
    expect(config.maxTokensSalida).toBe(64_000);
    expect(config.umbralAtascadaMinutos).toBe(20);
  });

  it("no manda topP si GEMINI_TOP_P no está definida", () => {
    expect(configuracionGemini().topP).toBeNull();
  });

  it("lee topP cuando está definida", () => {
    process.env.GEMINI_TOP_P = "0.9";
    expect(configuracionGemini().topP).toBe(0.9);
  });

  it("parte GEMINI_MODELS por comas y descarta espacios", () => {
    process.env.GEMINI_MODELS = " gemini-3.6-flash , gemini-3.5-flash ";
    expect(configuracionGemini().modelos).toEqual([
      "gemini-3.6-flash",
      "gemini-3.5-flash",
    ]);
  });

  it("rechaza alias móviles: cambiarían la calidad del examen sin quedar en git", () => {
    process.env.GEMINI_MODELS = "gemini-flash-latest";
    expect(() => configuracionGemini()).toThrow(/alias móviles/);
  });

  it("rechaza un valor fuera de rango nombrando la variable", () => {
    process.env.GEMINI_TEMPERATURE = "1.8";
    expect(() => configuracionGemini()).toThrow(/GEMINI_TEMPERATURE.*entre 0 y 1/);
  });

  it("rechaza un valor no numérico", () => {
    process.env.GEMINI_TIMEOUT_MS = "cinco minutos";
    expect(() => configuracionGemini()).toThrow(/GEMINI_TIMEOUT_MS debe ser un número/);
  });
});

/**
 * El par timeout ↔ barredor.
 *
 * Es la comprobación que justifica que estos números se puedan mover desde el
 * entorno: si una generación puede tardar más de lo que el barredor tarda en
 * darla por muerta, el barredor mata trabajos vivos, otra corrida entra por el
 * cerrojo liberado y la primera escribe encima. No hay excepción ni nada en
 * Sentry — por eso tiene que fallar ANTES, al leer la configuración.
 */
describe("la invariante con el barredor", () => {
  it("acepta la configuración por defecto: 3 × 300s = 15 min contra 20 min", () => {
    const config = configuracionGemini();
    expect(peorCasoMs(config)).toBe(900_000);
    expect(peorCasoMs(config)).toBeLessThan(config.umbralAtascadaMinutos * 60_000);
  });

  it("rechaza bajar el umbral por debajo de lo que puede tardar una generación", () => {
    process.env.GENERACION_ATASCADA_UMBRAL_MINUTOS = "10";
    expect(() => configuracionGemini()).toThrow(/mataría generaciones vivas/);
  });

  it("rechaza subir los intentos hasta pasarse del umbral", () => {
    process.env.GEMINI_ATTEMPTS_PER_MODEL = "3";
    expect(() => configuracionGemini()).toThrow(/Configuración de IA incoherente/);
  });

  it("rechaza alargar la cadena hasta pasarse del umbral", () => {
    process.env.GEMINI_MODELS = "a-flash,b-flash,c-flash,d-flash,e-flash";
    expect(() => configuracionGemini()).toThrow(/Configuración de IA incoherente/);
  });

  it("el mensaje dice qué número mover y hasta dónde", () => {
    process.env.GEMINI_ATTEMPTS_PER_MODEL = "3";
    expect(() => configuracionGemini()).toThrow(
      /sube GENERACION_ATASCADA_UMBRAL_MINUTOS por encima de \d+/,
    );
  });

  it("deja pasar una configuración más lenta si el umbral la acompaña", () => {
    process.env.GEMINI_ATTEMPTS_PER_MODEL = "3";
    process.env.GENERACION_ATASCADA_UMBRAL_MINUTOS = "60";
    expect(() => configuracionGemini()).not.toThrow();
  });

  it("cuenta las esperas de backoff dentro del peor caso", () => {
    process.env.GEMINI_ATTEMPTS_PER_MODEL = "2";
    process.env.GEMINI_RETRY_BASE_MS = "5000";
    process.env.GENERACION_ATASCADA_UMBRAL_MINUTOS = "60";

    // 3 modelos × (2 intentos × 300s + una espera de 5s) = 1 815 000 ms
    expect(peorCasoMs(configuracionGemini())).toBe(1_815_000);
  });
});
