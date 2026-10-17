import { describe, expect, it } from "vitest";
import { duracionCertificadoTexto } from "@/lib/certificados/duracion";

describe("duracionCertificadoTexto", () => {
  it("redondea a horas y usa singular o plural", () => {
    expect(duracionCertificadoTexto(3600)).toBe("1 hora de teoría y práctica");
    expect(duracionCertificadoTexto(12 * 3600 + 1200)).toBe("12 horas de teoría y práctica");
  });

  it("menos de media hora no imprime duración", () => {
    expect(duracionCertificadoTexto(1500)).toBeNull();
    expect(duracionCertificadoTexto(0)).toBeNull();
  });
});
