import { describe, expect, it } from "vitest";
import {
  contenidoNotaSchema,
  duracionIsoNota,
  formatearTiempoNota,
  MAX_CARACTERES_NOTA,
  MAX_SEGUNDO_NOTA,
  segundoNotaSchema,
} from "./notas-validacion";

describe("formatearTiempoNota", () => {
  it("usa mm:ss por debajo de una hora", () => {
    expect(formatearTiempoNota(0)).toBe("00:00");
    expect(formatearTiempoNota(204)).toBe("03:24");
    expect(formatearTiempoNota(3599)).toBe("59:59");
  });

  it("usa h:mm:ss desde una hora", () => {
    expect(formatearTiempoNota(3600)).toBe("1:00:00");
    expect(formatearTiempoNota(3725)).toBe("1:02:05");
  });

  it("trunca decimales y normaliza valores inválidos a cero", () => {
    expect(formatearTiempoNota(204.9)).toBe("03:24");
    expect(formatearTiempoNota(-5)).toBe("00:00");
    expect(formatearTiempoNota(Number.NaN)).toBe("00:00");
  });
});

describe("duracionIsoNota", () => {
  it("genera duraciones ISO 8601 para <time dateTime>", () => {
    expect(duracionIsoNota(0)).toBe("PT0S");
    expect(duracionIsoNota(204)).toBe("PT3M24S");
    expect(duracionIsoNota(180)).toBe("PT3M");
    expect(duracionIsoNota(3725)).toBe("PT1H2M5S");
  });
});

describe("segundoNotaSchema", () => {
  it("acepta enteros dentro del rango del CHECK de la base", () => {
    expect(segundoNotaSchema.safeParse(0).success).toBe(true);
    expect(segundoNotaSchema.safeParse(MAX_SEGUNDO_NOTA).success).toBe(true);
  });

  it("rechaza negativos, decimales y valores por encima del techo", () => {
    expect(segundoNotaSchema.safeParse(-1).success).toBe(false);
    expect(segundoNotaSchema.safeParse(1.5).success).toBe(false);
    expect(segundoNotaSchema.safeParse(MAX_SEGUNDO_NOTA + 1).success).toBe(false);
  });
});

describe("contenidoNotaSchema", () => {
  it("recorta espacios y rechaza una nota vacía", () => {
    expect(contenidoNotaSchema.safeParse("   ").success).toBe(false);
    expect(contenidoNotaSchema.parse("  hola  ")).toBe("hola");
  });

  it("respeta el tope de caracteres", () => {
    expect(contenidoNotaSchema.safeParse("x".repeat(MAX_CARACTERES_NOTA)).success).toBe(true);
    expect(contenidoNotaSchema.safeParse("x".repeat(MAX_CARACTERES_NOTA + 1)).success).toBe(false);
  });
});
